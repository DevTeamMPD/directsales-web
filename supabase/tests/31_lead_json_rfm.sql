begin;
-- dsales_lead_json คืนกลุ่มลูกค้า RFM + วันที่ไม่ได้ซื้อ จาก dsales_customer_base (ค่าเดียวกับหน้าลูกค้าของฉัน) — 20261126140000. Rolled back.
-- (a) ลีดที่เบอร์อยู่ในฐานลูกค้า → rfm / dormantDays ตรงกับแถวในฐาน
-- (b) ลีดที่เบอร์ไม่อยู่ในฐาน → มี key ทั้งสอง ค่าเป็น null
-- (c) key เดิมยังอยู่ครบ
-- (d) ลีดจริงทุกแถว (สูงสุด 100) ได้ค่าเท่ากับ dsales_customer_base
do $$
declare
  v_admin uuid; l dsales.dsales_leads; j jsonb; v_bad int;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  insert into dsales.dsales_customer_base (phone_normalized, name, order_count, dormant_days, last_order_date)
    values ('0899999971', 'ทดสอบ RFM', 7, 120, current_date - 120);

  -- (a)
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, created_by)
    values ('self', 'bebeplay', 'ทดสอบ RFM 1', '0899999971', '0899999971', v_admin) returning * into l;
  j := dsales.dsales_lead_json(l);
  assert j ->> 'rfm' = 'Shouldn''t Lose', format('rfm from customer_base, got %s', j -> 'rfm');
  assert (j ->> 'dormantDays')::int = 120, format('dormantDays from customer_base, got %s', j -> 'dormantDays');

  -- (c)
  assert j ?& array['id', 'name', 'phone', 'brand', 'owner', 'status', 'dsSince', 'ai', 'bills', 'total', 'lastBuy', 'orders', 'interactions'],
         format('existing keys kept, got %s', (select string_agg(k, ',') from jsonb_object_keys(j) k));

  -- (b)
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, created_by)
    values ('self', 'bebeplay', 'ทดสอบ RFM 2', '0899999972', '0899999972', v_admin) returning * into l;
  j := dsales.dsales_lead_json(l);
  assert j ? 'rfm' and j ? 'dormantDays', format('keys present without a base row, got %s', j);
  assert j -> 'rfm' = 'null'::jsonb and j -> 'dormantDays' = 'null'::jsonb, format('null without a base row, got %s / %s', j -> 'rfm', j -> 'dormantDays');

  -- (d)
  select count(*) into v_bad
  from (select x, dsales.dsales_lead_json(x) as lj from dsales.dsales_leads x order by x.created_at desc limit 100) t
  left join dsales.dsales_customer_base b on b.phone_normalized = (t.x).phone_normalized
  where (t.lj ->> 'rfm') is distinct from b.rfm or (t.lj ->> 'dormantDays')::int is distinct from b.dormant_days;
  assert v_bad = 0, format('lead json rfm / dormantDays differ from customer_base on %s leads', v_bad);
end $$;
rollback;
