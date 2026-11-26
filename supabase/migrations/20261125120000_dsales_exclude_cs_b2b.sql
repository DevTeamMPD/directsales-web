-- dsales: ไม่ดึงลูกค้าเคสบริการ/เคลม และลูกค้า B2B เป็นลีด (2026-11-25).
-- ลูกค้าที่ทักมาเคลม/แจ้งปัญหาแล้วโดนเซลล์ขายของจะไม่พอใจ ผู้ใช้จึงให้ตัดออกจากงาน Direct Sale ทั้งหมด:
--   - ห้องแชต JST ที่ผูกกับเบอร์ (dsales_chat_links -> public.iim_sessions.tags) มี tag ตรงกับ setting excluded_room_tags
--     (มาจากเซ็นทรัล, มาจาก OFFLINE, แจ้งปัญหา, Customer Service) หรือขึ้นต้นด้วย excluded_room_tag_prefixes (CS_) — ไม่สนตัวพิมพ์
--   - ลูกค้า B2B (dsales_customer_base.segment = 'b2b' / customer_identities.segment)
-- ผล: หายจาก dsales_base_customers (/mine /pool แคมเปญ) และ dsales_customer_pool_v3/v4 (ถังของหน้าแคมเปญ),
--     จองไม่ได้ (dsales_claim_customer / dsales_claim_lead -> cs_customer), ส่งข้อความเป็นชุดข้าม (dsales_outreach_plan -> cs_customer)
--     ลีดที่จองไว้แล้ว (ยกเว้น won) คืนทันที + no_call (ไม่สะดวกให้โทร) + บันทึกระบบพร้อม tag + ยกเลิกคิวที่รอส่ง
--     (dsales_release_excluded_leads — รันท้าย migration นี้ และทุกรอบ cron ผ่าน dsales_release_stale_leads) ไม่บันทึก cooldown
-- หัวหน้าแก้รายการ tag ได้ที่ dsales_settings (excluded_room_tags / excluded_room_tag_prefixes เป็น jsonb array ของข้อความ)
-- Rollback: คืน dsales_base_customers / dsales_claim_customer จาก 20261125090000, dsales_outreach_plan จาก 20261124090000,
--   dsales_customer_pool_v3 / dsales_claim_lead / dsales_release_stale_leads ตามนิยามก่อนไฟล์นี้ (ตัดบรรทัดที่อ้าง dsales_excluded_customers /
--   dsales_release_excluded_leads ออก), drop function dsales.dsales_release_excluded_leads(), dsales.dsales_excluded_customers(text),
--   delete setting excluded_room_tags / excluded_room_tag_prefixes · ลีดที่ถูกคืนแล้วต้องตั้ง no_call = false และจองใหม่เอง

-- 1) setting
insert into dsales.dsales_settings (key, value) values
  ('excluded_room_tags', '["มาจากเซ็นทรัล", "มาจาก OFFLINE", "แจ้งปัญหา", "Customer Service"]'::jsonb),
  ('excluded_room_tag_prefixes', '["CS_"]'::jsonb)
on conflict (key) do nothing;

-- 2) ชุดเบอร์ที่ถูกตัด (ภายใน — เรียกจากฟังก์ชัน security definer เท่านั้น) · p_phone = ตรวจเบอร์เดียว
create or replace function dsales.dsales_excluded_customers(p_phone text default null)
returns table(phone text, reason text)
language sql stable security definer set search_path = dsales, public as $$
  with cfg as (
    select coalesce((select array(select lower(btrim(t)) from jsonb_array_elements_text(s.value) t)
                     from dsales.dsales_settings s where s.key = 'excluded_room_tags' and jsonb_typeof(s.value) = 'array'), '{}') as tags,
           coalesce((select array(select lower(btrim(t)) from jsonb_array_elements_text(s.value) t where btrim(t) <> '')
                     from dsales.dsales_settings s where s.key = 'excluded_room_tag_prefixes' and jsonb_typeof(s.value) = 'array'), '{}') as pre
  ),
  hit as (
    select cl.phone_normalized as phone, btrim(e.value ->> 'text') as tag,
           lower(btrim(e.value ->> 'text')) = any (cfg.tags) as exact
    from dsales.dsales_chat_links cl
    join public.iim_sessions s on s.ms_id = cl.ms_id
    cross join cfg
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s.tags) = 'array' then s.tags else '[]'::jsonb end) e
    where (p_phone is null or cl.phone_normalized = btrim(p_phone))
      and (lower(btrim(e.value ->> 'text')) = any (cfg.tags)
           or exists (select 1 from unnest(cfg.pre) p where left(lower(btrim(e.value ->> 'text')), length(p)) = p))
  ),
  -- เหตุผล = tag ในรายการตรงตัวก่อน (เช่น แจ้งปัญหา) แล้วค่อย tag ที่ขึ้นต้นด้วย prefix
  tagged as (select h.phone, (array_agg(h.tag order by h.exact desc, h.tag))[1] as reason from hit h group by h.phone)
  select t.phone, t.reason from tagged t
  union all
  select b.phone_normalized, 'B2B' from dsales.dsales_customer_base b
  where b.segment = 'b2b' and (p_phone is null or b.phone_normalized = btrim(p_phone))
    and not exists (select 1 from tagged t where t.phone = b.phone_normalized)
$$;
revoke all on function dsales.dsales_excluded_customers(text) from public, anon, authenticated;

-- 3) คืนลีดของลูกค้าที่ถูกตัด (ภายใน · cron) — ไม่แตะ won · ตั้ง no_call กันโผล่ในถัง/แคมเปญและกันจองซ้ำ
create or replace function dsales.dsales_release_excluded_leads()
returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_n int;
begin
  with x as (select e.phone, e.reason from dsales.dsales_excluded_customers() e),
  s as (
    select l.id, l.owner_id, l.phone_normalized, x.reason from dsales.dsales_leads l join x on x.phone = l.phone_normalized
    where l.status <> 'won' and (l.owner_id is not null or not l.no_call)
    for update of l skip locked
  ), ix as (
    insert into dsales.dsales_interactions (lead_id, type, note, rep_id)
    select s.id, 'system', format('ลูกค้าเคสบริการ/เคลมหรือ B2B (%s) — คืนออกจาก Direct Sale อัตโนมัติ และตั้งไม่สะดวกให้โทร', s.reason), s.owner_id
    from s where s.owner_id is not null
  ), q as (
    update dsales.dsales_outreach_queue oq set status = 'cancelled', error = 'cs_customer'
    from s where oq.phone_normalized = s.phone_normalized and oq.status = 'queued'
  ), up as (
    update dsales.dsales_leads l set owner_id = null, claimed_by = null, claimed_at = null, status = 'new', callback_date = null,
        ds_since = null, ds_owner = null, no_call = true, no_call_by = null,
        no_call_at = (now() at time zone 'Asia/Bangkok')::date, updated_at = now()
    from s where l.id = s.id
    returning s.owner_id
  )
  select count(*) filter (where owner_id is not null) into v_n from up;
  return v_n;
end $$;
revoke all on function dsales.dsales_release_excluded_leads() from public, anon, authenticated;

-- 4) cron เดิม (job dsales-refresh-customer-base เรียก dsales_release_stale_leads ก่อน) คืนลูกค้าที่ติด tag ใหม่ด้วย
create or replace function dsales.dsales_release_stale_leads()
 returns integer
 language plpgsql
 security definer
 set search_path to 'dsales', 'public'
as $function$
declare v_days int; v_n int;
begin
  perform dsales.dsales_release_excluded_leads();
  select coalesce((value #>> '{}')::int, 30) into v_days from dsales.dsales_settings where key = 'ds_max_days';
  v_days := coalesce(v_days, 30);
  with s as (
    select l.id, l.owner_id from dsales.dsales_leads l
    where l.owner_id is not null and l.status <> 'won' and l.ds_since < now() - make_interval(days => v_days)
    for update skip locked
  ), ar as (
    insert into dsales.dsales_lead_auto_releases (lead_id, user_id) select s.id, s.owner_id from s
  ), ix as (
    insert into dsales.dsales_interactions (lead_id, type, note, rep_id)
    select s.id, 'system', format('ครบ %s วันยังไม่ปิดการขาย — คืนอัตโนมัติ', v_days), s.owner_id from s
  ), up as (
    update dsales.dsales_leads l set owner_id = null, claimed_by = null, claimed_at = null, status = 'new', callback_date = null,
        ds_since = null, ds_owner = null, updated_at = now()
    from s where l.id = s.id
    returning 1
  )
  select count(*) into v_n from up;
  return v_n;
end $function$;

-- 5) ฐานลูกค้า (/mine /pool แคมเปญ): ตัดเบอร์ที่ถูกตัดทุก scope (นอกนั้นเหมือน 20261125090000)
create or replace function dsales.dsales_base_customers(p_scope text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_brand text DEFAULT NULL::text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer, last_order_date date, brands text[], total_count bigint, lead_id uuid, taken boolean, mine boolean, no_call boolean, reserved_by text, dormant_days integer, owner_tag text, chat_rooms jsonb, chat_brands text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
#variable_conflict use_column
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_uid uuid := dsales.dsales_uid();
  v_admin boolean := dsales.dsales_is_admin();
  v_t text := lower(btrim(coalesce(p_search, '')));
  v_d text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_brand text := lower(nullif(btrim(p_brand), ''));
  v_rfm text[] := case when jsonb_typeof(f -> 'rfm') = 'array' and jsonb_array_length(f -> 'rfm') > 0
                       then array(select jsonb_array_elements_text(f -> 'rfm')) end;
  v_dmin int := (f ->> 'dormant_min')::int;
  v_dmax int := (f ->> 'dormant_max')::int;
  v_ltv numeric := (f ->> 'ltv_min')::numeric;
  v_ltv_max numeric := (f ->> 'ltv_max')::numeric;
  v_ltv_to numeric := (f ->> 'ltv_to')::numeric;
  v_orders int := (f ->> 'orders_min')::int;
  v_tag text := nullif(btrim(f ->> 'tag'), '');
  v_provider text := lower(nullif(btrim(f ->> 'provider'), ''));
  v_sort text := coalesce(nullif(f ->> 'sort', ''), 'ltv');
  v_from date := nullif(f ->> 'bought_from', '')::date;
  v_to date := nullif(f ->> 'bought_to', '')::date;
  v_bill numeric := (f ->> 'bill_min')::numeric;
  v_chat text[];
  v_prov text[];
  v_prod text[];
  v_when text[];
  v_bills text[];
  v_excl text[] := array(select x.phone from dsales.dsales_excluded_customers() x);
begin
  if coalesce((f ->> 'has_chat')::boolean, false) then
    select coalesce(array_agg(distinct r.phone_normalized), '{}') into v_chat
    from dsales.dsales_sendable_rooms() r where v_brand is null or r.brand = v_brand;
  end if;
  if v_provider is not null then
    select coalesce(array_agg(distinct l.phone_normalized), '{}') into v_prov
    from dsales.dsales_chat_links l join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where lower(s.channel) = v_provider;
  end if;
  -- เคยซื้อสินค้า: ทุกกลุ่มต้องเจออย่างน้อย 1 บรรทัด (กลุ่มที่ไม่มีทั้ง skus และ kw ไม่นับเป็นเงื่อนไข)
  if jsonb_typeof(f -> 'products') = 'array' then
    with g as (
      select x, i from jsonb_array_elements(f -> 'products') with ordinality as t(x, i)
      where (jsonb_typeof(x -> 'skus') = 'array' and jsonb_array_length(x -> 'skus') > 0)
         or nullif(btrim(x ->> 'kw'), '') is not null
    )
    select case when (select count(*) from g) = 0 then null else coalesce((
      select array_agg(ph) from (
        select l.phone as ph
        from public.lendi_purchase_lines l join g on
             (jsonb_typeof(g.x -> 'skus') = 'array' and l.sku in (select jsonb_array_elements_text(g.x -> 'skus')))
          or (nullif(btrim(g.x ->> 'kw'), '') is not null
              and position(lower(btrim(g.x ->> 'kw')) in lower(coalesce(l.sku, '') || ' ' || coalesce(l.product_name, ''))) > 0)
        group by l.phone
        having count(distinct g.i) = (select count(*) from g)) m), '{}') end
    into v_prod;
  end if;
  if v_from is not null or v_to is not null then
    select coalesce(array_agg(distinct l.phone), '{}') into v_when
    from public.lendi_purchase_lines l
    where (v_from is null or l.txn_date >= v_from) and (v_to is null or l.txn_date <= v_to);
  end if;
  if v_bill is not null then
    select coalesce(array_agg(distinct b.phone), '{}') into v_bills
    from (select l.phone from public.lendi_purchase_lines l
          group by l.phone, coalesce(nullif(l.bill_no, ''), nullif(l.order_no, ''), l.sale_id::text)
          having sum(coalesce(l.amount, l.estimated_amount, 0)) >= v_bill) b;
  end if;

  return query
  with cand as (
    select b.*, l.id as l_id, coalesce(l.no_call, false) as l_no_call, coalesce(l.owner_id, b.owner_id) as eff_owner
    from dsales.dsales_customer_base b
    left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
    where b.eligible
      and (v_brand is null or v_brand = any (b.brands))
      and (v_t = '' or position(v_t in lower(b.name)) > 0 or position(v_t in lower(coalesce(b.chat_name, ''))) > 0
           or (v_d <> '' and b.phone_normalized like '%' || v_d || '%'))
      and (v_rfm is null or coalesce(b.rfm_segment, '') = any (v_rfm))
      and (v_dmin is null or b.dormant_days >= v_dmin)
      and (v_dmax is null or b.dormant_days <= v_dmax)
      and (v_ltv is null or b.ltv >= v_ltv)
      and (v_ltv_max is null or b.ltv < v_ltv_max)
      and (v_ltv_to is null or b.ltv <= v_ltv_to)
      and (v_orders is null or b.order_count >= v_orders)
      and (v_tag is null or (v_tag = 'none' and b.owner_tag is null) or lower(b.owner_tag) = lower(v_tag))
      and (v_chat is null or b.phone_normalized = any (v_chat))
      and (v_prov is null or b.phone_normalized = any (v_prov))
      and (v_prod is null or b.phone_normalized = any (v_prod))
      and (v_when is null or b.phone_normalized = any (v_when))
      and (v_bills is null or b.phone_normalized = any (v_bills))
      and not (b.phone_normalized = any (v_excl))
  ),
  scoped as (
    select c.* from cand c
    where case p_scope when 'mine' then c.eff_owner = v_uid
                       when 'pool' then c.eff_owner is null
                       when 'team' then v_admin
                       else false end
  ),
  page as (
    select x.*, count(*) over () as n
    from scoped x
    order by case when v_sort = 'dormant_asc' then x.dormant_days end asc nulls last,
             case when v_sort = 'dormant_desc' then x.dormant_days end desc nulls last,
             case when v_sort = 'last_desc' then x.last_order_date end desc nulls last,
             case when v_sort = 'orders_desc' then x.order_count end desc nulls last,
             x.ltv desc nulls last, x.phone_normalized
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  rooms as (
    select p.*, dsales.dsales_customer_rooms(p.phone_normalized) as r_json from page p
  )
  select p.identity_id, p.name, p.phone_normalized, p.chat_name, p.segment, p.rfm_segment, p.ltv, p.order_count,
         p.last_order_date, p.brands, p.n, p.l_id, p.eff_owner is not null, p.eff_owner = v_uid, p.l_no_call,
         case when v_admin and p.eff_owner is not null
              then (select m.display_name from dsales.dsales_members m where m.user_id = p.eff_owner) end,
         p.dormant_days, p.owner_tag, p.r_json,
         coalesce((select array_agg(distinct e ->> 'brand' order by e ->> 'brand') from jsonb_array_elements(p.r_json) e
                   where (e ->> 'sendable')::boolean), '{}'::text[])
  from rooms p
  order by case when v_sort = 'dormant_asc' then p.dormant_days end asc nulls last,
           case when v_sort = 'dormant_desc' then p.dormant_days end desc nulls last,
           case when v_sort = 'last_desc' then p.last_order_date end desc nulls last,
           case when v_sort = 'orders_desc' then p.order_count end desc nulls last,
           p.ltv desc nulls last, p.phone_normalized;
end $function$;

-- 6) ถังของหน้าแคมเปญ (pool_v3 — v4 ห่อตัวนี้): ตัดเบอร์ที่ถูกตัด + B2B (นอกนั้นเหมือนนิยาม production 2026-11-25)
create or replace function dsales.dsales_customer_pool_v3(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_brand text DEFAULT NULL::text)
 RETURNS TABLE(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer, last_order_date date, brands text[], total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  -- ex = array ครั้งเดียวต่อการเรียก (NOT EXISTS กับ CTE ทำให้ค้นหาช้าลงหลายเท่า)
  with s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d,
                    (select coalesce(array_agg(x.phone), '{}') from dsales.dsales_excluded_customers() x) as ex),
  q as (
    select ci.id, ci.display_name, ci.primary_phone, ci.segment, ci.rfm_segment,
           coalesce(v.ltv_thb, ci.ltv) as ltv_v, v.order_count as oc, v.last_order_date as lod
    from public.customer_identities ci
    left join public.lendi_customer_value v on v.phone = ci.primary_phone
    cross join s
    where dsales.dsales_uid() is not null
      and ci.primary_phone is not null and ci.primary_phone <> ''
      and coalesce(ci.segment, '') <> 'b2b'
      and not (ci.primary_phone = any (s.ex))
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
$function$;

-- 7) จอง: ลูกค้าที่ถูกตัด -> cs_customer (claim_customer นอกนั้นเหมือน 20261125090000 · claim_lead เหมือนนิยาม production)
create or replace function dsales.dsales_claim_customer(p_phone text, p_brand text, p_campaign uuid default null)
returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
        v_tag_owner uuid; c dsales.dsales_campaigns;
begin
  perform dsales.dsales_register();
  if not dsales.dsales_valid_phone(ph) then raise exception 'invalid_phone'; end if;
  if p_brand not in ('bebeplay','hosttail') then raise exception 'invalid_brand'; end if;
  if exists (select 1 from dsales.dsales_excluded_customers(ph)) then raise exception 'cs_customer'; end if;
  if p_campaign is not null then
    select * into c from dsales.dsales_campaigns where id = p_campaign;
    if not found or c.brand <> p_brand or not coalesce(c.active, true)
       or (c.end_date is not null and c.end_date < (now() at time zone 'Asia/Bangkok')::date) then
      raise exception 'campaign_closed';
    end if;
    if c.max_per_rep is not null and (select count(*) from dsales.dsales_leads x
         where x.campaign_id = p_campaign and x.owner_id = me and x.phone_normalized <> ph) >= c.max_per_rep then
      raise exception 'campaign_quota';
    end if;
  end if;
  select b.owner_id into v_tag_owner from dsales.dsales_customer_base b where b.phone_normalized = ph;
  if v_tag_owner is not null and v_tag_owner <> me then raise exception 'taken'; end if;
  select * into l from dsales.dsales_leads where phone_normalized = ph for update;
  if found then
    if l.no_call then raise exception 'no_call'; end if;
    if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
    update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me),
           campaign_id = coalesce(campaign_id, p_campaign), updated_at = now()
      where id = l.id returning * into l;
  else
    select ci.id, coalesce(nullif(btrim(ci.display_name), ''), 'ไม่ระบุชื่อ') as nm into ident from public.customer_identities ci where ci.primary_phone = ph limit 1;
    if not found then raise exception 'customer_not_found'; end if;
    insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, identity_id, owner_id, claimed_by, claimed_at, last_seller_id, created_by, campaign_id)
      values (case when p_campaign is null then 'self' else 'campaign' end, p_brand, ident.nm, ph, ph, ident.id, me, me, now(), me, me, p_campaign)
      returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $$;

create or replace function dsales.dsales_claim_lead(p_lead uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'dsales', 'public'
as $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads;
begin
  perform dsales.dsales_register();
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from dsales.dsales_excluded_customers(l.phone_normalized)) then raise exception 'cs_customer'; end if;
  if l.no_call then raise exception 'no_call'; end if;
  if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
  update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me), updated_at = now()
    where id = p_lead returning * into l;
  return dsales.dsales_lead_json(l);
end $function$;

-- 8) ส่งข้อความเป็นชุด: ข้ามลูกค้าที่ถูกตัด (cs_customer) ทั้งเซลล์และหัวหน้า (นอกนั้นเหมือน 20261124090000)
create or replace function dsales.dsales_outreach_plan(p_phones text[], p_template uuid, p_me uuid)
returns table (phone text, name text, lead_id uuid, ms_id bigint, page text, provider text, chat_name text, message text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare
  t dsales.dsales_templates; v_max int := coalesce((dsales.dsales_setting('outreach_max_batch') #>> '{}')::int, 50);
  ph text; v_skip text; v_msg text; v_product text;
  v_in_base boolean; v_base_name text; v_base_owner uuid;
  v_lead uuid; v_lead_owner uuid; v_lead_name text;
  v_ms bigint; v_page text; v_prov text; v_chat text;
  v_admin boolean := exists (select 1 from dsales.dsales_members m where m.user_id = p_me and m.role = 'admin' and m.active);
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  if (select count(distinct btrim(x)) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null) > v_max then
    raise exception 'batch_too_large';
  end if;

  for ph in select distinct btrim(x) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null loop
    v_skip := null; v_msg := null; v_ms := null; v_page := null; v_prov := null; v_chat := null;
    v_base_name := null; v_base_owner := null; v_lead := null; v_lead_owner := null; v_lead_name := null;
    select c.name, c.owner_id into v_base_name, v_base_owner from dsales.dsales_customer_base c where c.phone_normalized = ph;
    v_in_base := found;
    select x.id, x.owner_id, x.name into v_lead, v_lead_owner, v_lead_name from dsales.dsales_leads x where x.phone_normalized = ph;
    if not v_in_base and v_lead is null then v_skip := 'customer_not_found';
    elsif exists (select 1 from dsales.dsales_excluded_customers(ph)) then v_skip := 'cs_customer';
    elsif not (v_admin and v_lead_owner is not null) and v_base_owner is not null and v_base_owner <> p_me then v_skip := 'taken';
    elsif not v_admin and v_lead_owner is not null and v_lead_owner <> p_me then v_skip := 'taken';
    elsif exists (select 1 from dsales.dsales_outreach_queue q where q.phone_normalized = ph and q.status in ('queued', 'sending')) then
      v_skip := 'already_queued';
    else
      select r.ms_id, r.page, r.provider, r.chat_name, r.skip into v_ms, v_page, v_prov, v_chat, v_skip
      from dsales.dsales_outreach_room(ph, t.brand) r;
    end if;
    if v_skip is null then
      v_product := '';
      if position('{สินค้าล่าสุด}' in t.body) > 0 then
        select coalesce(p.product_name, '') into v_product from dsales.dsales_customer_purchases(ph) p order by p.txn_date desc nulls last limit 1;
      end if;
      v_msg := replace(replace(replace(t.body,
                 '{ชื่อ}', coalesce(nullif(btrim(coalesce(v_lead_name, v_base_name)), ''), '')),
                 '{ร้าน}', coalesce(v_page, '')),
                 '{สินค้าล่าสุด}', coalesce(v_product, ''));
    end if;
    return query select ph, coalesce(v_lead_name, v_base_name), v_lead, v_ms, v_page, v_prov, v_chat, v_msg, v_skip;
  end loop;
end $$;

-- 9) คืนลีดที่จองไว้แล้วตอนนี้เลย (ผู้ใช้เลือก "คืนทันที")
select dsales.dsales_release_excluded_leads();
