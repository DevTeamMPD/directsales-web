begin;
-- ปิดการขายอัตโนมัติจากออเดอร์ (20261125160000): บิลใน sales_transaction ผ่าน order_tracking (ไม่นับซ้ำหลายพัสดุ),
-- บิลก่อนวันที่จองไม่นับ, amount ว่าง = unit_price × quantity, ยอด/บิล/วันที่ปิดการขาย, ผลงานของเจ้าของลีด, cron เรียกก่อน release, หัวหน้าเรียกผ่าน RPC ได้. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; r record; v_old record; v_l1 uuid; v_l2 uuid; v_res jsonb; v_amt numeric; v_nan uuid;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true);

  -- เบอร์ที่มีบิลใน sales_transaction ผ่าน order_tracking (ไม่ cancelled) และยังไม่มีลีด
  select o.phone, btrim(s.bill_no) as bill, max(s.txn_date) as d into r
  from public.order_tracking o join public.sales_transaction s on btrim(s.bill_no) = btrim(o.online_order)
  where nullif(btrim(o.online_order), '') is not null and coalesce(s.order_status, '') <> 'Cancelled' and o.phone ~ '^0\d{9}$'
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = o.phone)
    and s.txn_date >= current_date - 60
  group by 1, 2 having bool_or(s.amount is null and s.unit_price > 0) order by max(s.txn_date) desc limit 1;
  assert r.phone is not null, 'need a phone with a recent bill (one line without amount)';
  select sum(coalesce(s.amount, s.unit_price * coalesce(s.quantity, 1), 0)) into v_amt from public.sales_transaction s where btrim(s.bill_no) = r.bill;

  -- L1: จองก่อนวันที่บิล → ปิดการขาย · L2 (เบอร์เดียวกันไม่ได้ เพราะ phone unique) ใช้บิลเก่ากว่าวันที่จอง → ไม่ปิด
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status)
    values ('self', 'bebeplay', 'ทดสอบปิดจากออเดอร์', r.phone, r.phone, v_s1, v_s1, now(), 'following') returning id into v_l1;
  update dsales.dsales_leads set ds_since = (r.d - 1)::timestamp at time zone 'Asia/Bangkok' where id = v_l1;

  select o.phone, max(s.txn_date) as d into v_old
  from public.order_tracking o join public.sales_transaction s on btrim(s.bill_no) = btrim(o.online_order)
  where nullif(btrim(o.online_order), '') is not null and o.phone ~ '^0\d{9}$' and o.phone <> r.phone
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = o.phone)
  group by 1 having max(s.txn_date) < current_date - 10 limit 1;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status)
    values ('self', 'bebeplay', 'ทดสอบบิลเก่า', v_old.phone, v_old.phone, v_s1, v_s1, now(), 'new') returning id into v_l2;
  update dsales.dsales_leads set ds_since = now() where id = v_l2;  -- บิลทั้งหมดเก่ากว่าวันที่จอง

  -- เซลล์เรียก RPC ไม่ได้ · หัวหน้าเรียกได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  begin perform dsales.dsales_ai_close_orders(array[v_l1]); assert false, 'sales rep must be forbidden';
  exception when others then assert sqlerrm = 'forbidden', format('got %s', sqlerrm); end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := dsales.dsales_ai_close_orders(array[v_l1, v_l2]);
  reset role;
  insert into _r values ('closed', v_res::text);

  assert jsonb_array_length(v_res) = 1 and v_res -> 0 ->> 'id' = v_l1::text, format('only L1 closed, got %s', v_res);
  assert (select status = 'won' and r.bill = any (closed_bills) and closed_amount >= v_amt and v_amt > 0 and closed_at = r.d and last_seller_id = v_s1
          from dsales.dsales_leads where id = v_l1), format('L1 won with bill %s amount %s', r.bill, v_amt);
  assert (select status from dsales.dsales_leads where id = v_l2) = 'new', 'old bill does not close';
  assert exists (select 1 from dsales.dsales_interactions where lead_id = v_l1 and type = 'system' and rep_id = v_s1 and note like 'พบบิล %ปิดการขายอัตโนมัติ'), 'system note';
  -- เรียกซ้ำไม่ปิดซ้ำ
  assert jsonb_array_length(dsales.dsales_close_won_from_orders(array[v_l1])) = 0, 'idempotent';

  -- ลีดจริง Nantaporn (ถ้ายังไม่ปิด): บิล 24/11 ยอด 3,636 (ไม่นับซ้ำ 2 พัสดุ)
  select id into v_nan from dsales.dsales_leads where name = 'Nantaporn Chaiphet' and owner_id is not null and status <> 'won';
  if v_nan is not null then
    v_res := dsales.dsales_close_won_from_orders(array[v_nan]);
    insert into _r values ('nantaporn', v_res::text);
    assert (v_res -> 0 ->> 'amount')::numeric = 3636, format('Nantaporn amount 3636, got %s', v_res);
  end if;

  -- cron เรียกปิดการขายก่อน release
  assert (select command like 'select dsales.dsales_close_won_from_orders(); select dsales.dsales_release_stale_leads();%' from cron.job where jobid = 51), 'cron order';
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 24_auto_close_orders' from _r;
rollback;
