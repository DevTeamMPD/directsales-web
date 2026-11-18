-- Next.js spec ข้อ 5: เข้าใช้ได้เฉพาะสมาชิกที่หัวหน้าเพิ่มไว้และ active
-- ฟังก์ชันทุกตัวที่เรียก dsales_uid() จึงปิดให้คนนอกทีม/คนที่ถูกปิดใช้งานทันที (helper ตัวเดียว)

-- 1) helper: ต้องล็อกอิน และต้องเป็นสมาชิก active
create or replace function dsales.dsales_uid() returns uuid
language plpgsql stable security definer set search_path = dsales, public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from dsales.dsales_members m where m.user_id = u and m.active) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return u;
end $$;

-- 2) ไม่เพิ่มสมาชิกเองอีก (คงชื่อไว้ให้หน้า legacy และ dsales_claim_customer ที่ยังเรียกอยู่)
create or replace function dsales.dsales_register() returns void
language plpgsql security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
end $$;

-- 3) dsales_me: ทุกคนที่ล็อกอินเรียกได้ (ไม่เรียก dsales_uid) และบอกว่าเป็นสมาชิก/active หรือไม่
--    คอลัมน์เดิม 4 ตัวอยู่หน้าและลำดับเดิม; เปลี่ยน return type จึงต้อง drop แล้วสร้างใหม่
drop function dsales.dsales_me();
create function dsales.dsales_me()
returns table(user_id uuid, email text, display_name text, is_admin boolean, is_member boolean, active boolean)
language sql stable security definer set search_path = dsales, public as $$
  select u.id, u.email::text,
         coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1)),
         coalesce(m.role = 'admin' and m.active, false),
         m.user_id is not null,
         coalesce(m.active, false)
  from auth.users u
  left join dsales.dsales_members m on m.user_id = u.id
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid() $$;

-- 4) หัวหน้าเพิ่มสมาชิกด้วยอีเมล (บัญชีต้องมีใน auth.users แล้ว) เพิ่มซ้ำ = เปิดใช้งาน + ตั้งบทบาทใหม่
create or replace function dsales.dsales_add_member(p_email text, p_role text default 'sales') returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_role text := lower(btrim(coalesce(p_role, ''))); v_user uuid; v_email text; v_name text; v_res jsonb;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if v_role not in ('sales', 'admin') then raise exception 'invalid_role'; end if;
  select u.id, u.email::text, coalesce(nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1))
    into v_user, v_email, v_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email::text) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if v_user is null then raise exception 'user_not_found'; end if;
  -- ลดบทบาทหัวหน้าเป็นเซลล์ได้เมื่อยังเหลือหัวหน้า active คนอื่น
  if v_role = 'sales'
     and exists (select 1 from dsales.dsales_members where user_id = v_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> v_user) then
    raise exception 'last_admin';
  end if;
  insert into dsales.dsales_members as m (user_id, role, display_name, active)
  values (v_user, v_role, v_name, true)
  on conflict (user_id) do update
    set role = excluded.role, active = true,
        display_name = coalesce(nullif(btrim(m.display_name), ''), excluded.display_name);
  select jsonb_build_object('user_id', m.user_id, 'email', v_email, 'display_name', m.display_name, 'role', m.role, 'active', m.active)
    into v_res
  from dsales.dsales_members m where m.user_id = v_user;
  return v_res;
end $$;

-- 5) หัวหน้าปิด/เปิดใช้งานสมาชิก: ต้องเหลือหัวหน้า active อย่างน้อย 1 คน (last_admin) และปิดตัวเองไม่ได้
--    ตรวจ last_admin ก่อน: หัวหน้าคนเดียวที่ปิดตัวเองได้ last_admin, มีหัวหน้าหลายคนได้ cannot_deactivate_self
create or replace function dsales.dsales_set_member_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not coalesce(p_active, false)
     and exists (select 1 from dsales.dsales_members where user_id = p_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> p_user) then
    raise exception 'last_admin';
  end if;
  if p_user = me and not coalesce(p_active, false) then raise exception 'cannot_deactivate_self'; end if;
  update dsales.dsales_members set active = coalesce(p_active, false) where user_id = p_user;
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- 6) RPC อ่านข้อมูลลูกค้าที่ยังไม่เรียก dsales_uid(): เพิ่มเงื่อนไขสมาชิก (ตัวฟังก์ชันอื่นเหมือนเดิมทุกตัวอักษร)
create or replace function dsales.dsales_customer_purchases(p_phone text)
returns table(txn_date date, bill_no text, order_no text, sku text, product_name text, quantity numeric, amount numeric)
language sql stable security definer set search_path = dsales, public as $$
  select l.txn_date, l.bill_no, l.order_no, l.sku, l.product_name, l.quantity, coalesce(l.amount, l.estimated_amount)
  from public.lendi_purchase_lines l
  where dsales.dsales_uid() is not null and nullif(btrim(p_phone), '') is not null and l.phone = btrim(p_phone)
  order by l.txn_date desc nulls last, l.sale_id
  limit 200;
$$;

create or replace function dsales.dsales_customer_channels(p_phone text)
returns table(platform text, shop text, orders bigint, last_order timestamp with time zone, chat_name text)
language sql stable security definer set search_path = dsales, public as $$
  select coalesce(s.platform,
           case lower(btrim(coalesce(o.platform, '')))
             when 'shopee' then 'shopee' when 'lazada' then 'lazada' when 'tiktok' then 'tiktok' when 'line' then 'line'
             when 'facebook' then 'facebook' when 'instagram' then 'instagram'
             when 'shopify' then 'website' when 'minishop' then 'website' when 'shopss' then 'website' when 'sapo' then 'website'
             else 'other' end) as platform,
         o.shop, count(*) as orders, max(o.created_at) as last_order,
         max(nullif(btrim(o.buyer_name), '')) as chat_name
  from public.order_tracking o
  left join cdp.shops s on s.shop = o.shop
  where dsales.dsales_uid() is not null
    and btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$' and o.phone = btrim(p_phone)
  group by 1, 2
  order by max(o.created_at) desc nulls last
  limit 20;
$$;

create or replace function dsales.dsales_customer_chats(p_phone text, p_since timestamp with time zone default null)
returns table(ms_id bigint, channel text, page text, chat_name text, last_time timestamp with time zone, msg_count integer,
              admin_msgs bigint, last_admin_time timestamp with time zone, last_admin_sender text, last_customer_time timestamp with time zone)
language sql stable security definer set search_path = dsales, public as $$
  with names as (
    select distinct lower(btrim(n)) as k from (
      select o.buyer_name as n from public.order_tracking o where o.phone = btrim(p_phone)
      union all select ci.display_name from public.customer_identities ci where ci.primary_phone = btrim(p_phone)
      union all select c.jst_chat_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
      union all select c.buyer_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
    ) x
    where nullif(btrim(n), '') is not null and length(btrim(n)) >= 3
      and btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$'
  )
  select s.ms_id, s.channel, s.page, s.customer, s.last_time, s.msg_count,
         (select count(*) from dsales.dsales_chat_messages_v m
           where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')
             and (p_since is null or m.time >= p_since)) as admin_msgs,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')) as last_admin_time,
         (select m.sender from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error') order by m.time desc limit 1) as last_admin_sender,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer') as last_customer_time
  from public.iim_sessions s
  join names on lower(btrim(s.customer)) = names.k
  where dsales.dsales_uid() is not null and nullif(btrim(s.customer), '') is not null
  order by s.last_time desc nulls last
  limit 20;
$$;

create or replace function dsales.dsales_customer_pool_v3(p_search text default null, p_limit integer default 50, p_offset integer default 0,
                                                          p_from date default null, p_to date default null, p_brand text default null)
returns table(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer,
              last_order_date date, brands text[], total_count bigint)
language sql stable security definer set search_path = dsales, public as $$
  with s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d),
  q as (
    select ci.id, ci.display_name, ci.primary_phone, ci.segment, ci.rfm_segment,
           coalesce(v.ltv_thb, ci.ltv) as ltv_v, v.order_count as oc, v.last_order_date as lod
    from public.customer_identities ci
    left join public.lendi_customer_value v on v.phone = ci.primary_phone
    cross join s
    where dsales.dsales_uid() is not null
      and ci.primary_phone is not null and ci.primary_phone <> ''
      and (p_from is null or v.last_order_date >= p_from)
      and (p_to is null or v.last_order_date <= p_to)
      and (
        nullif(btrim(p_brand), '') is null
        or exists (select 1 from public.identity_brands ib2 join public.brands b2 on b2.id = ib2.brand_id
                   where ib2.identity_id = ci.id and b2.code = lower(btrim(p_brand)))
      )
      and (
        s.t = ''
        or (ci.display_name is not null and position(s.t in lower(ci.display_name)) > 0)
        or (s.d <> '' and ci.primary_phone like '%' || s.d || '%')
        or ci.primary_phone in (select l.phone from public.lendi_purchase_lines l
                                where l.bill_no is not null and position(s.t in lower(l.bill_no)) > 0
                                   or l.order_no is not null and position(s.t in lower(l.order_no)) > 0)
        or ci.primary_phone in (select coalesce(c.phone_normalized, c.phone) from public.lds_customers c
                                where c.jst_chat_name is not null and position(s.t in lower(c.jst_chat_name)) > 0
                                   or c.buyer_account is not null and position(s.t in lower(c.buyer_account)) > 0)
      )
  )
  select q.id, coalesce(nullif(btrim(q.display_name), ''), 'ไม่ระบุชื่อ'), q.primary_phone,
         (select max(c.jst_chat_name) from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = q.primary_phone and c.jst_chat_name is not null),
         q.segment, q.rfm_segment, q.ltv_v, q.oc, q.lod,
         (select array_agg(b.code order by b.code) from public.identity_brands ib join public.brands b on b.id = ib.brand_id where ib.identity_id = q.id),
         count(*) over ()
  from q
  order by q.ltv_v desc nulls last, q.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 7) ข้อมูล: สมาชิกเดิมคนเดียว (บัญชีที่ใช้อยู่) = หัวหน้า active
update dsales.dsales_members set role = 'admin', active = true
where (select count(*) from dsales.dsales_members) = 1;

-- 8) สิทธิ์
revoke all on function dsales.dsales_me(), dsales.dsales_add_member(text, text), dsales.dsales_set_member_active(uuid, boolean)
  from public, anon;
grant execute on function dsales.dsales_me(), dsales.dsales_add_member(text, text), dsales.dsales_set_member_active(uuid, boolean)
  to authenticated, service_role;
