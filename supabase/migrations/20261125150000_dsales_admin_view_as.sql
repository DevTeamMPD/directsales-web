-- dsales: โหมดหัวหน้า "ดูในมุมมองเซลล์" + ทำแทนเซลล์ (2026-11-25, ผู้ใช้ขอสำหรับ dev@mpdgroup.co ซึ่งเป็นหัวหน้าอยู่แล้ว)
-- ผู้ใช้เลือก: ทำแทนแล้วนับผลงานให้เซลล์เจ้าของลีด + ครอบคลุมทุกหน้า
-- 1) dsales_interactions.logged_by = คนที่กดบันทึกจริง (null = เจ้าของ rep_id เอง) · dsales_actor(p_for) ตรวจสิทธิ์ทำแทน
-- 2) dsales_log: หัวหน้าบันทึกบนลีดของเซลล์อื่น → rep_id = เจ้าของลีด, logged_by = หัวหน้า, ปิดการขาย last_seller_id = เจ้าของลีด
-- 3) dsales_base_customers: p_filters.as (หัวหน้าเท่านั้น) = ดูลูกค้าของเซลล์คนนั้น (ส่วนอื่นเหมือน 20261125140000)
--    dsales_base_segment_counts(p_scope, p_brand, p_as default null)
-- 4) dsales_claim_customer(..., p_for default null): หัวหน้าจองให้เซลล์ (เจ้าของ = p_for, created_by = หัวหน้า)
-- 5) dsales_outreach_preview / dsales_enqueue_outreach (..., p_for default null): หัวหน้าส่งข้อความในนามเซลล์
--    (กติกา taken/ห้องเหมือนเซลล์คนนั้นส่งเอง, จองลูกค้าในถังให้เซลล์, requested_by = หัวหน้า)
-- ไม่ส่ง p_for / as = พฤติกรรมเดิมทุกอย่าง
-- Rollback: drop ฟังก์ชันแบบมี p_for/p_as แล้วสร้างแบบเดิมจาก 20261125140000 (base_customers, segment_counts),
--   20261125120000 (claim_customer 3 ตัว), production เดิม (log, preview, enqueue 2 ตัว); drop function dsales.dsales_actor(uuid);
--   alter table dsales.dsales_interactions drop column logged_by

-- 1)
alter table dsales.dsales_interactions add column if not exists logged_by uuid references auth.users(id) on delete set null;

create or replace function dsales.dsales_actor(p_for uuid) returns uuid
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  if p_for is null or p_for = me then return me; end if;
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from dsales.dsales_members m where m.user_id = p_for and m.active) then raise exception 'invalid_user'; end if;
  return p_for;
end $$;
revoke all on function dsales.dsales_actor(uuid) from public, anon, authenticated;

-- 2)
create or replace function dsales.dsales_log(p_lead uuid, p_type text, p_result text, p_note text, p_status text, p_callback date, p_interest text, p_bills text[], p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; bills text[] := coalesce(p_bills, '{}'); v_rep uuid;
begin
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if l.owner_id is distinct from me and not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if p_type not in ('call','chat') then raise exception 'invalid_type'; end if;
  if p_status not in ('new','following','callback','won','lost','unreachable') then raise exception 'invalid_status'; end if;
  if p_status = 'won' and cardinality(bills) = 0 then raise exception 'bill_required'; end if;
  v_rep := coalesce(l.owner_id, me);  -- หัวหน้าบันทึกแทน = ผลงานของเจ้าของลีด
  insert into dsales.dsales_interactions (lead_id, type, result, note, bills, rep_id, due, logged_by)
    values (p_lead, p_type, p_result, p_note, bills, v_rep, p_callback, case when v_rep <> me then me end);
  update dsales.dsales_leads set status = p_status, callback_date = case when p_status = 'callback' then p_callback else null end,
      interest = coalesce(p_interest, interest),
      closed_bills = case when p_status = 'won' then bills else closed_bills end,
      closed_amount = case when p_status = 'won' then p_amount else closed_amount end,
      closed_at = case when p_status = 'won' then current_date else closed_at end,
      last_seller_id = case when p_status = 'won' then v_rep else last_seller_id end, updated_at = now()
    where id = p_lead returning * into l;
  return dsales.dsales_lead_json(l);
end $function$;

-- 3)
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
  -- หัวหน้าดูในมุมมองเซลล์: p_filters.as = user id ของเซลล์ (scope mine = ลูกค้าของเซลล์คนนั้น)
  if nullif(f ->> 'as', '') is not null then
    if not v_admin then raise exception 'forbidden'; end if;
    v_uid := (f ->> 'as')::uuid;
  end if;
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

drop function if exists dsales.dsales_base_segment_counts(text, text);
create or replace function dsales.dsales_base_segment_counts(p_scope text, p_brand text default null, p_as uuid default null)
returns table(segment text, n bigint)
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_uid uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin();
begin
  if p_as is not null then
    if not v_admin then raise exception 'forbidden'; end if;
    v_uid := p_as;
  end if;
  return query
  with ex as (select coalesce(array_agg(x.phone), '{}') as phones from dsales.dsales_excluded_customers() x)
  select coalesce(b.rfm, '') as segment, count(*) as n
  from dsales.dsales_customer_base b
  left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
  cross join ex
  where b.eligible
    and (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
    and not (b.phone_normalized = any (ex.phones))
    and case p_scope when 'mine' then coalesce(l.owner_id, b.owner_id) = v_uid
                     when 'pool' then coalesce(l.owner_id, b.owner_id) is null
                     when 'team' then v_admin
                     else false end
  group by 1;
end $$;
revoke all on function dsales.dsales_base_segment_counts(text, text, uuid) from public, anon;
grant execute on function dsales.dsales_base_segment_counts(text, text, uuid) to authenticated;

-- 4)
drop function if exists dsales.dsales_claim_customer(text, text, uuid);
create or replace function dsales.dsales_claim_customer(p_phone text, p_brand text, p_campaign uuid default null, p_for uuid default null)
returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_by uuid := dsales.dsales_uid(); me uuid; l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
        v_tag_owner uuid; c dsales.dsales_campaigns;
begin
  perform dsales.dsales_register();
  me := dsales.dsales_actor(p_for);
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
      values (case when p_campaign is null then 'self' else 'campaign' end, p_brand, ident.nm, ph, ph, ident.id, me, me, now(), me, v_by, p_campaign)
      returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $$;
revoke all on function dsales.dsales_claim_customer(text, text, uuid, uuid) from public, anon;
grant execute on function dsales.dsales_claim_customer(text, text, uuid, uuid) to authenticated, service_role;

-- 5)
drop function if exists dsales.dsales_outreach_preview(text[], uuid);
create or replace function dsales.dsales_outreach_preview(p_phones text[], p_template uuid, p_for uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_actor(p_for);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('phone', x.phone, 'name', x.name, 'ms_id', x.ms_id, 'page', x.page, 'provider', x.provider,
                                        'chat_name', x.chat_name, 'message', x.message, 'skip', x.skip) order by x.skip nulls first, x.phone)
    from dsales.dsales_outreach_plan(p_phones, p_template, me) x
  ), '[]'::jsonb);
end $function$;
revoke all on function dsales.dsales_outreach_preview(text[], uuid, uuid) from public, anon;
grant execute on function dsales.dsales_outreach_preview(text[], uuid, uuid) to authenticated;

drop function if exists dsales.dsales_enqueue_outreach(text[], uuid);
create or replace function dsales.dsales_enqueue_outreach(p_phones text[], p_template uuid, p_for uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare
  v_by uuid := dsales.dsales_uid(); me uuid := dsales.dsales_actor(p_for); t dsales.dsales_templates; v_batch uuid; x record; v_lead uuid; v_owner uuid;
  v_skipped jsonb := '[]'::jsonb; v_queued int := 0;
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_by, t.id, t.brand) returning id into v_batch;

  for x in select * from dsales.dsales_outreach_plan(p_phones, p_template, me) loop
    if x.skip is not null then
      v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', x.skip);
      continue;
    end if;
    v_lead := x.lead_id;
    v_owner := null;
    if v_lead is not null then
      select l.owner_id into v_owner from dsales.dsales_leads l where l.id = v_lead;
    end if;
    if v_lead is null or v_owner is null then
      begin
        v_lead := (dsales.dsales_claim_customer(x.phone, t.brand, null, case when me <> v_by then me end) ->> 'id')::uuid;
      exception when others then
        v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', case when sqlerrm in ('taken', 'no_call', 'customer_not_found', 'cs_customer') then sqlerrm else 'claim_failed' end);
        continue;
      end;
    end if;
    insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, page, provider, chat_name, message_text, requested_by)
    values (v_batch, v_lead, x.phone, x.ms_id, x.page, x.provider, x.chat_name, x.message, v_by);
    v_queued := v_queued + 1;
  end loop;

  update dsales.dsales_outreach_batches set total = v_queued, skipped = v_skipped where id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'queued', v_queued, 'skipped', v_skipped);
end $function$;
revoke all on function dsales.dsales_enqueue_outreach(text[], uuid, uuid) from public, anon;
grant execute on function dsales.dsales_enqueue_outreach(text[], uuid, uuid) to authenticated;
