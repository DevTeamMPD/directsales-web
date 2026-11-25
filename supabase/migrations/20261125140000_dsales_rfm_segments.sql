-- dsales: กลุ่มลูกค้า RFM แบบระบบเก่า สำหรับหน้าลูกค้าของฉัน/ถังกลาง (2026-11-25).
-- เดิม rfm_segment มาจาก customer_identities (ส่วนใหญ่ว่าง/Unscored) → คำนวณเองจากจำนวนออเดอร์ (F) กับวันที่ไม่ได้ซื้อ (R)
-- ตาม docs/superpowers/specs/2026-11-20-rfm-segments-backlog.md โดยเช็กตามลำดับ (ข้อแรกที่ตรง) — ผู้ใช้ยืนยัน 2026-11-25:
--   F ≥ 6 และ R ≤ 30 = Champion · F ≥ 6 และ R > 90 = Shouldn't Lose · F ≥ 4 และ R ≤ 90 = Loyal · F ≥ 3 และ R > 90 = Sleepers
--   F ≥ 2 และ R ≤ 60 = Promising · F ≥ 2 และ R ≤ 90 = Need Attention
--   F = 1 และ R ≤ 60 = Warm (ซื้อครั้งเดียว — รวม Hot เดิม เพราะฐานลูกค้าเก่าเริ่มที่ 30 วัน) · F = 1 และ R ≤ 90 = Cold · ที่เหลือ = Lost
--   ไม่มีจำนวนออเดอร์หรือวันซื้อล่าสุด = null (ยังไม่จัดกลุ่ม)
-- 1) dsales_rfm(orders, days) (immutable) + คอลัมน์ generated dsales_customer_base.rfm (อัปเดตเองทุกครั้งที่ refresh เขียน order_count/dormant_days)
-- 2) dsales_base_customers: กรอง/คืน rfm_segment จาก b.rfm (ส่วนอื่นเหมือน 20261125120000 ทุกตัวอักษร)
-- 3) dsales_base_segment_counts(p_scope, p_brand): จำนวนลูกค้าต่อกลุ่มตามขอบเขต (mine/pool/team) + แบรนด์ ใช้กติกาเดียวกับ base_customers
-- Rollback: drop function dsales.dsales_base_segment_counts(text, text); สร้าง dsales_base_customers จาก 20261125120000 ใหม่;
--   alter table dsales.dsales_customer_base drop column rfm; drop function dsales.dsales_rfm(integer, integer)

-- 1)
create or replace function dsales.dsales_rfm(p_orders integer, p_days integer) returns text
language sql immutable set search_path = dsales, public as $$
  select case
    when p_orders is null or p_orders < 1 or p_days is null then null
    when p_orders >= 6 and p_days <= 30 then 'Champion'
    when p_orders >= 6 and p_days > 90 then 'Shouldn''t Lose'
    when p_orders >= 4 and p_days <= 90 then 'Loyal'
    when p_orders >= 3 and p_days > 90 then 'Sleepers'
    when p_orders >= 2 and p_days <= 60 then 'Promising'
    when p_orders >= 2 and p_days <= 90 then 'Need Attention'
    when p_orders = 1 and p_days <= 60 then 'Warm'
    when p_orders = 1 and p_days <= 90 then 'Cold'
    else 'Lost' end
$$;
revoke all on function dsales.dsales_rfm(integer, integer) from public, anon, authenticated;
alter table dsales.dsales_customer_base add column if not exists rfm text
  generated always as (dsales.dsales_rfm(order_count, dormant_days)) stored;

-- 2)
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
      and (v_rfm is null or coalesce(b.rfm, '') = any (v_rfm))
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
  select p.identity_id, p.name, p.phone_normalized, p.chat_name, p.segment, p.rfm, p.ltv, p.order_count,
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

-- 3)
create or replace function dsales.dsales_base_segment_counts(p_scope text, p_brand text default null)
returns table(segment text, n bigint)
language sql stable security definer set search_path = dsales, public as $$
  with me as (select dsales.dsales_uid() as uid, dsales.dsales_is_admin() as admin),
  ex as (select coalesce(array_agg(x.phone), '{}') as phones from dsales.dsales_excluded_customers() x)
  select coalesce(b.rfm, '') as segment, count(*) as n
  from dsales.dsales_customer_base b
  left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
  cross join me cross join ex
  where b.eligible
    and (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
    and not (b.phone_normalized = any (ex.phones))
    and case p_scope when 'mine' then coalesce(l.owner_id, b.owner_id) = me.uid
                     when 'pool' then coalesce(l.owner_id, b.owner_id) is null
                     when 'team' then me.admin
                     else false end
  group by 1
$$;
revoke all on function dsales.dsales_base_segment_counts(text, text) from public, anon;
grant execute on function dsales.dsales_base_segment_counts(text, text) to authenticated;
