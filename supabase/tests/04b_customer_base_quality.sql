begin;
do $$
declare
  v_days integer;
  v_bkk date := (now() at time zone 'Asia/Bangkok')::date;
  v_null bigint;
  v_bad bigint;
begin
  -- แปลงเบอร์จาก order_tracking.phone ให้เป็นรูปเดียวกัน (เบอร์ที่ถูกปิดบังหรือมั่วต้องได้ null)
  assert dsales.dsales_norm_phone('061-018-2738') = '0610182738', 'dashes must be stripped';
  assert dsales.dsales_norm_phone('66812345678') = '0812345678', '66 prefix must become 0';
  -- ข้อมูลจริง ~2,000 แถวเป็น 12 หลักแบบ 66 + เบอร์ที่มี 0 (เช่น 660610313976) ไม่ใช่ 11 หลัก
  assert dsales.dsales_norm_phone('660610313976') = '0610313976', '660 prefix must become 0';
  assert dsales.dsales_norm_phone('+66 81 234 5678') = '0812345678', '+66 with spaces must become 0';
  assert dsales.dsales_norm_phone('812345678') = '0812345678', '9-digit mobile must get a leading 0';
  assert dsales.dsales_norm_phone('021234567') = '021234567', '9-digit landline starting 0 stays as is';
  assert dsales.dsales_norm_phone('08*****123') is null, 'masked phone must be null';
  assert dsales.dsales_norm_phone('0000000000') is null, 'all-same-digit phone must be null';

  perform dsales.dsales_refresh_customer_base();

  -- เบอร์นี้ใน order_tracking เก็บเป็น 080-622-3222 จึง join บิล 2026-11-15 ไม่ได้
  -- (ก่อนแก้ได้ last_order_date = 2026-08-06, eligible = true)
  assert exists (select 1 from dsales.dsales_customer_base
                 where phone_normalized = '0806223222' and last_order_date >= date '2026-11-15' and not eligible),
         'customer 0806223222 must show its recent order and not be eligible';

  assert not exists (select 1 from dsales.dsales_customer_base where phone_normalized ~ '^[689][0-9]{8}$'),
         'no 9-digit mobile without leading 0';

  -- ก่อนแก้ (2026-11-17 ข้อมูลจริง) มี 11,424 แถวที่ last_order_date เป็น null
  -- ต้องลดลงอย่างน้อย 1,000 แถว → เกณฑ์ <= 10,424
  select count(*) into v_null from dsales.dsales_customer_base where last_order_date is null;
  assert v_null <= 10424, format('expected at most 10424 customers without last_order_date, got %s', v_null);

  -- ลูกค้าที่มีบิล (ผูกด้วย bill_no หรือ order_no) ภายใน dormant_days วันล่าสุด ต้องไม่ eligible
  v_days := (select (value #>> '{}')::integer from dsales.dsales_settings where key = 'dormant_days');
  with recent as (
    select dsales.dsales_norm_phone(o.phone) as phone
    from public.sales_transaction s
    join public.order_tracking o on btrim(o.online_order) = btrim(s.bill_no)
    where length(btrim(s.bill_no)) >= 8 and s.txn_date > v_bkk - v_days
    union
    select dsales.dsales_norm_phone(o.phone)
    from public.sales_transaction s
    join public.order_tracking o on btrim(o.online_order) = btrim(s.order_no)
    where length(btrim(s.order_no)) >= 8 and s.txn_date > v_bkk - v_days
  )
  select count(*) into v_bad
  from dsales.dsales_customer_base b join recent r on r.phone = b.phone_normalized
  where b.eligible;
  assert v_bad = 0, format('%s eligible customers have an order in the last %s days', v_bad, v_days);

  -- ไม่มีค่า dormant_days ต้อง error ชัดเจน (ไม่ใช่คำนวณ eligible เป็น null/false เงียบ ๆ)
  delete from dsales.dsales_settings where key = 'dormant_days';
  begin
    perform dsales.dsales_refresh_customer_base();
    assert false, 'refresh must fail without dormant_days';
  exception when raise_exception then
    assert sqlerrm like '%dormant_days%', format('unexpected error: %s', sqlerrm);
  end;
end $$;
rollback;
