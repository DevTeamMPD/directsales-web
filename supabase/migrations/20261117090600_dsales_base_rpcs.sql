-- รายชื่อ tag Admin_* ที่มีใน JST (หัวหน้าใช้เลือกผูกกับเซลล์)
create or replace function dsales.dsales_jst_admin_tags() returns table(tag text, sessions bigint)
language sql stable security definer set search_path = dsales, public as $$
  select e.value ->> 'text', count(*)
  from public.iim_sessions s cross join jsonb_array_elements(s.tags) e
  where dsales.dsales_uid() is not null and dsales.dsales_is_admin() and e.value ->> 'text' ilike 'admin\_%'
  group by 1 order by 2 desc $$;

-- tag ของสมาชิก (หัวหน้าเห็นทุกคน เซลล์เห็นของตัวเอง)
create or replace function dsales.dsales_member_tags() returns table(user_id uuid, jst_tags text[])
language sql stable security definer set search_path = dsales, public as $$
  select m.user_id, m.jst_tags from dsales.dsales_members m
  where dsales.dsales_uid() is not null and (dsales.dsales_is_admin() or m.user_id = auth.uid()) $$;

-- หัวหน้าผูก tag กับเซลล์ (1 tag มีเจ้าของได้คนเดียว) แล้วคำนวณ customer_base ใหม่ทันที
create or replace function dsales.dsales_set_member_tags(p_user uuid, p_tags text[]) returns text[]
language plpgsql security definer set search_path = dsales, public as $$
declare
  v_tags text[] := (select coalesce(array_agg(distinct btrim(t) order by btrim(t)), '{}')
                    from unnest(coalesce(p_tags, '{}')) as t where nullif(btrim(t), '') is not null);
  v_conflict text;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from dsales.dsales_members where user_id = p_user) then raise exception 'member_not_found'; end if;
  select t into v_conflict
  from dsales.dsales_members m cross join unnest(m.jst_tags) as t
  where m.user_id <> p_user and lower(t) in (select lower(x) from unnest(v_tags) as x)
  limit 1;
  if v_conflict is not null then raise exception 'tag_taken: %', v_conflict; end if;
  update dsales.dsales_members set jst_tags = v_tags where user_id = p_user;
  perform dsales.dsales_refresh_customer_base();
  return v_tags;
end $$;

-- ลูกค้าเก่าที่เข้าเกณฑ์ตาม scope: mine = ของฉัน (ลีดที่ฉันถือ หรือ tag ของฉัน), pool = ไม่มีเจ้าของ, team = ทั้งหมด (หัวหน้า)
-- คอลัมน์ 16 ตัวแรกเหมือน dsales_customer_pool_v4 เพื่อให้หน้าเว็บใช้โค้ดเดิมได้
create or replace function dsales.dsales_base_customers(p_scope text, p_search text default null, p_limit integer default 50, p_offset integer default 0, p_brand text default null)
returns table(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer,
              last_order_date date, brands text[], total_count bigint, lead_id uuid, taken boolean, mine boolean, no_call boolean,
              reserved_by text, dormant_days integer, owner_tag text)
language sql stable security definer set search_path = dsales, public as $$
  with me as (select dsales.dsales_uid() as uid, dsales.dsales_is_admin() as admin),
  s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d),
  cand as (
    select b.*, l.id as l_id, coalesce(l.no_call, false) as l_no_call, coalesce(l.owner_id, b.owner_id) as eff_owner
    from dsales.dsales_customer_base b
    left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
    cross join s
    where b.eligible
      and (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
      and (s.t = '' or position(s.t in lower(b.name)) > 0 or position(s.t in lower(coalesce(b.chat_name, ''))) > 0
           or (s.d <> '' and b.phone_normalized like '%' || s.d || '%'))
  ),
  scoped as (
    select c.* from cand c cross join me
    where case p_scope when 'mine' then c.eff_owner = me.uid
                       when 'pool' then c.eff_owner is null
                       when 'team' then me.admin
                       else false end
  )
  select x.identity_id, x.name, x.phone_normalized, x.chat_name, x.segment, x.rfm_segment, x.ltv, x.order_count,
         x.last_order_date, x.brands, count(*) over (), x.l_id, x.eff_owner is not null, x.eff_owner = (select uid from me),
         x.l_no_call,
         case when (select admin from me) and x.eff_owner is not null
              then (select m.display_name from dsales.dsales_members m where m.user_id = x.eff_owner) end,
         x.dormant_days, x.owner_tag
  from scoped x
  order by x.ltv desc nulls last, x.phone_normalized
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0) $$;

-- เหมือนเดิม + ห้ามจองลูกค้าที่เป็นของเซลล์คนอื่นตาม tag
create or replace function dsales.dsales_claim_customer(p_phone text, p_brand text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
        v_tag_owner uuid;
begin
  perform dsales.dsales_register();
  if not dsales.dsales_valid_phone(ph) then raise exception 'invalid_phone'; end if;
  if p_brand not in ('bebeplay','hosttail') then raise exception 'invalid_brand'; end if;
  select b.owner_id into v_tag_owner from dsales.dsales_customer_base b where b.phone_normalized = ph;
  if v_tag_owner is not null and v_tag_owner <> me then raise exception 'taken'; end if;
  select * into l from dsales.dsales_leads where phone_normalized = ph for update;
  if found then
    if l.no_call then raise exception 'no_call'; end if;
    if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
    update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me), updated_at = now()
      where id = l.id returning * into l;
  else
    select ci.id, coalesce(nullif(btrim(ci.display_name), ''), 'ไม่ระบุชื่อ') as nm into ident from public.customer_identities ci where ci.primary_phone = ph limit 1;
    if not found then raise exception 'customer_not_found'; end if;
    insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, identity_id, owner_id, claimed_by, claimed_at, last_seller_id, created_by)
      values ('self', p_brand, ident.nm, ph, ph, ident.id, me, me, now(), me, me) returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $$;

revoke all on function dsales.dsales_jst_admin_tags(), dsales.dsales_member_tags(), dsales.dsales_set_member_tags(uuid, text[]),
  dsales.dsales_base_customers(text, text, integer, integer, text) from public, anon;
grant execute on function dsales.dsales_jst_admin_tags(), dsales.dsales_member_tags(), dsales.dsales_set_member_tags(uuid, text[]),
  dsales.dsales_base_customers(text, text, integer, integer, text) to authenticated;
