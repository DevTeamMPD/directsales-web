begin;
-- แคมเปญตามสินค้า (20261125090000): dsales_product_search, ตัวกรองใหม่ของ dsales_base_customers
-- (products / bought_from-to / bill_min / ltv_to) และ dsales_claim_customer(..., p_campaign). Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; v_sku text; v_sku2 text; v_kw text; v_n bigint; v_exp bigint; v_ok boolean;
  v_camp uuid; v_closed uuid; v_other uuid; v_quota uuid; v_ph text[]; j jsonb; r record;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true);

  -- SKU ที่มีผู้ซื้อในฐานลูกค้า (eligible) มากที่สุด 2 ตัว
  select l.sku into v_sku from public.lendi_purchase_lines l join dsales.dsales_customer_base b on b.phone_normalized = l.phone and b.eligible
    where nullif(btrim(l.sku), '') is not null group by l.sku order by count(distinct l.phone) desc, l.sku limit 1;
  select l.sku into v_sku2 from public.lendi_purchase_lines l join dsales.dsales_customer_base b on b.phone_normalized = l.phone and b.eligible
    where nullif(btrim(l.sku), '') is not null and l.sku <> v_sku group by l.sku order by count(distinct l.phone) desc, l.sku limit 1;
  v_kw := lower(left(v_sku, 6));
  insert into _r values ('sku', v_sku), ('sku2', v_sku2);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 1) ค้นสินค้า: เจอ SKU + จำนวนผู้ซื้อ, คำค้นสั้นกว่า 2 ตัว = ไม่คืน
  select * into r from dsales.dsales_product_search(v_sku) x where x.sku = v_sku;
  assert r.buyers >= 1 and r.product_name is not null, format('product search finds %s, got %s', v_sku, r);
  assert not exists (select 1 from dsales.dsales_product_search('a')), 'query < 2 chars returns nothing';

  -- 2) products: เคยซื้อ SKU (นับจากทีม = ทุกคนที่ eligible)
  select total_count into v_n from dsales.dsales_base_customers('team', null, 1, 0, null,
    jsonb_build_object('products', jsonb_build_array(jsonb_build_object('skus', jsonb_build_array(v_sku)))));
  reset role;
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized and l.sku = v_sku);
  insert into _r values ('buyers', v_n::text);
  assert v_n = v_exp and v_n > 0, format('sku filter: got %s expected %s', v_n, v_exp);

  -- หลายกลุ่ม = ต้องซื้อครบทุกกลุ่ม · SKU หลายตัวในกลุ่มเดียว = ตัวใดก็ได้
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized and l.sku = v_sku)
      and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized and l.sku = v_sku2);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select coalesce(max(total_count), 0) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null,
    jsonb_build_object('products', jsonb_build_array(jsonb_build_object('skus', jsonb_build_array(v_sku)), jsonb_build_object('skus', jsonb_build_array(v_sku2)))));
  assert v_n = v_exp, format('two groups AND: got %s expected %s', v_n, v_exp);
  select coalesce(max(total_count), 0) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null,
    jsonb_build_object('products', jsonb_build_array(jsonb_build_object('skus', jsonb_build_array(v_sku, v_sku2)))));
  reset role;
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized and l.sku in (v_sku, v_sku2));
  assert v_n = v_exp, format('one group OR: got %s expected %s', v_n, v_exp);

  -- kw (ชื่อ/SKU มีคำค้น) · กลุ่มว่างไม่นับเป็นเงื่อนไข
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized
      and position(v_kw in lower(coalesce(l.sku, '') || ' ' || coalesce(l.product_name, ''))) > 0);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select coalesce(max(total_count), 0) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null,
    jsonb_build_object('products', jsonb_build_array(jsonb_build_object('kw', upper(v_kw)))));
  assert v_n = v_exp, format('kw: got %s expected %s', v_n, v_exp);
  select max(total_count) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null, jsonb_build_object('products', jsonb_build_array(jsonb_build_object('kw', ' '))));
  select max(total_count) into v_exp from dsales.dsales_base_customers('team', null, 1, 0, null, '{}'::jsonb);
  assert v_n = v_exp, 'empty product group = no condition';

  -- 3) ช่วงวันที่ซื้อ, บิลขั้นต่ำ, ltv_to (รวมค่าขอบ)
  select coalesce(max(total_count), 0) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null,
    jsonb_build_object('bought_from', '2026-10-01', 'bought_to', '2026-10-31'));
  reset role;
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized and l.txn_date between '2026-10-01' and '2026-10-31');
  assert v_n = v_exp, format('bought range: got %s expected %s', v_n, v_exp);
  select count(distinct b.phone_normalized) into v_exp from dsales.dsales_customer_base b
    where b.eligible and exists (select 1 from public.lendi_purchase_lines l where l.phone = b.phone_normalized
      group by coalesce(nullif(l.bill_no, ''), nullif(l.order_no, ''), l.sale_id::text) having sum(coalesce(l.amount, l.estimated_amount, 0)) >= 5000);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select coalesce(max(total_count), 0) into v_n from dsales.dsales_base_customers('team', null, 1, 0, null, jsonb_build_object('bill_min', 5000));
  assert v_n = v_exp, format('bill_min: got %s expected %s', v_n, v_exp);
  select ltv into r from dsales.dsales_base_customers('team', null, 1, 0, null, '{}'::jsonb) limit 1;
  select bool_or(x.ltv = r.ltv) into v_ok from dsales.dsales_base_customers('team', null, 100, 0, null, jsonb_build_object('ltv_to', r.ltv)) x;
  assert v_ok, 'ltv_to includes the boundary';

  -- 4) จองจากการ์ดแคมเปญ (เซลล์ S1): ลีดผูกแคมเปญ · ปิด/คนละแบรนด์ = campaign_closed · ครบโควตา = campaign_quota
  reset role;
  insert into dsales.dsales_campaigns (brand, name, max_per_rep) values ('bebeplay', 'TEST seg', 1) returning id into v_camp;
  insert into dsales.dsales_campaigns (brand, name, active) values ('bebeplay', 'TEST closed', false) returning id into v_closed;
  insert into dsales.dsales_campaigns (brand, name) values ('hosttail', 'TEST other') returning id into v_other;
  select array_agg(phone_normalized) into v_ph from (
    select b.phone_normalized from dsales.dsales_customer_base b
    where b.eligible and b.owner_id is null
      and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = b.phone_normalized)
      and exists (select 1 from public.customer_identities ci where ci.primary_phone = b.phone_normalized)
    order by b.phone_normalized limit 3) t;
  assert cardinality(v_ph) = 3, 'need 3 pool phones';

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  j := dsales.dsales_claim_customer(v_ph[1], 'bebeplay', v_camp);
  assert j ->> 'campaignId' = v_camp::text and j ->> 'source' = 'campaign' and j ->> 'owner' = v_s1::text, format('campaign claim, got %s', j);
  v_ok := false;
  begin perform dsales.dsales_claim_customer(v_ph[2], 'bebeplay', v_camp); exception when others then v_ok := sqlerrm = 'campaign_quota'; end;
  assert v_ok, 'max_per_rep reached -> campaign_quota';
  v_ok := false;
  begin perform dsales.dsales_claim_customer(v_ph[2], 'bebeplay', v_closed); exception when others then v_ok := sqlerrm = 'campaign_closed'; end;
  assert v_ok, 'inactive campaign -> campaign_closed';
  v_ok := false;
  begin perform dsales.dsales_claim_customer(v_ph[2], 'bebeplay', v_other); exception when others then v_ok := sqlerrm = 'campaign_closed'; end;
  assert v_ok, 'other brand campaign -> campaign_closed';
  -- เรียกแบบเดิม 2 ตัว = ลีด self ไม่ผูกแคมเปญ
  j := dsales.dsales_claim_customer(v_ph[3], 'bebeplay');
  assert j ->> 'source' = 'self' and j ->> 'campaignId' is null, format('2-arg claim unchanged, got %s', j);
  -- ลูกค้าที่จองแล้วหายจาก pool ของแคมเปญ
  select count(*) into v_n from dsales.dsales_base_customers('pool', v_ph[1], 5, 0, null, '{}'::jsonb);
  assert v_n = 0, 'claimed customer leaves the pool';
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 19_campaign_segments' from _r;
rollback;
