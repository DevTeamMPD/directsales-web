-- dsales: แคมเปญใช้ได้จริง — กลุ่มลูกค้าตามสินค้า (2026-11-25).
-- เดิมแคมเปญเก็บแค่ criteria (jsonb) แต่ไม่มีอะไรอ่าน: ตัวสร้างแคมเปญนับจากข้อมูลตัวอย่าง (ล็อกอินจริง = 0) และลูกค้าไม่ถูกผูกกับแคมเปญ
-- 1) dsales_product_search: ค้นสินค้า (SKU + ชื่อ) จากประวัติซื้อ (public.lendi_purchase_lines — แหล่งเดียวกับ popup ลูกค้า) พร้อมจำนวนผู้ซื้อ
-- 2) dsales_base_customers: เพิ่มตัวกรอง (เว็บแปลง criteria ของแคมเปญเป็นตัวกรองเหล่านี้เอง — DB ไม่อ่าน criteria)
--      products   [{ "skus": [...], "kw": "..." }, ...]  เคยซื้อ SKU ใดในกลุ่ม (หรือชื่อ/SKU มีคำค้น kw) — หลายกลุ่ม = ต้องเคยซื้อครบทุกกลุ่ม
--      bought_from / bought_to (date)  มีการซื้อในช่วงวันที่
--      bill_min (numeric)              มีบิลที่ยอดรวมตั้งแต่ค่านี้
--      ltv_to (numeric)                ยอดซื้อรวมไม่เกิน (รวมค่านี้ — ต่างจาก ltv_max ที่ไม่รวม ใช้กับช่วง RFM)
--    ตัวอื่นเหมือนเดิมทุกตัวอักษร
-- 3) dsales_claim_customer(p_phone, p_brand, p_campaign default null): จองจากการ์ดแคมเปญ = ลีดผูกแคมเปญ (source 'campaign')
--    แคมเปญต้องเป็นของแบรนด์เดียวกัน เปิดอยู่และยังไม่เลยวันสิ้นสุด (campaign_closed) · ครบ max_per_rep ของเซลล์ = campaign_quota
--    ไม่ส่ง p_campaign = พฤติกรรมเดิมทุกอย่าง (เรียกแบบ 2 ตัวจาก dsales_enqueue_outreach / เว็บเดิมยังใช้ได้)
-- Rollback: drop function dsales.dsales_product_search(text, integer);
--           สร้าง dsales_base_customers จาก 20261123100000_dsales_base_customers_ltv_max.sql ใหม่
--           drop function dsales.dsales_claim_customer(text, text, uuid); แล้วสร้างแบบ 2 ตัวจาก 20261117090600_dsales_base_rpcs.sql ใหม่

-- 1) ค้นสินค้า
create or replace function dsales.dsales_product_search(p_q text, p_limit integer default 100)
returns table(sku text, product_name text, buyers bigint, last_bought date)
language sql stable security definer set search_path = dsales, public as $$
  select l.sku, max(l.product_name) as product_name, count(distinct l.phone) as buyers, max(l.txn_date) as last_bought
  from public.lendi_purchase_lines l
  where dsales.dsales_uid() is not null
    and length(btrim(coalesce(p_q, ''))) >= 2
    and nullif(btrim(l.sku), '') is not null
    and position(lower(btrim(p_q)) in lower(l.sku || ' ' || coalesce(l.product_name, ''))) > 0
  group by l.sku
  order by count(distinct l.phone) desc, l.sku
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$$;
revoke all on function dsales.dsales_product_search(text, integer) from public, anon;
grant execute on function dsales.dsales_product_search(text, integer) to authenticated;

-- 2) ตัวกรองเพิ่มใน dsales_base_customers
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

-- 3) จองจากการ์ดแคมเปญ
drop function if exists dsales.dsales_claim_customer(text, text);
create or replace function dsales.dsales_claim_customer(p_phone text, p_brand text, p_campaign uuid default null)
returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
        v_tag_owner uuid; c dsales.dsales_campaigns;
begin
  perform dsales.dsales_register();
  if not dsales.dsales_valid_phone(ph) then raise exception 'invalid_phone'; end if;
  if p_brand not in ('bebeplay','hosttail') then raise exception 'invalid_brand'; end if;
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
revoke all on function dsales.dsales_claim_customer(text, text, uuid) from public, anon;
grant execute on function dsales.dsales_claim_customer(text, text, uuid) to authenticated, service_role;
