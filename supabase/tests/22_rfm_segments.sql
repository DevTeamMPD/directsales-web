begin;
-- กลุ่มลูกค้า RFM (20261125140000): dsales_rfm, คอลัมน์ rfm, ตัวกรอง/ค่าที่คืนของ dsales_base_customers, dsales_base_segment_counts. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare v_sales uuid; v_bad bigint; v_sum bigint; v_total bigint; v_lost bigint; c jsonb;
begin
  -- กติกา (ข้อแรกที่ตรง) + ขอบเขต
  assert dsales.dsales_rfm(6, 30) = 'Champion' and dsales.dsales_rfm(6, 31) = 'Loyal' and dsales.dsales_rfm(6, 90) = 'Loyal' and dsales.dsales_rfm(6, 91) = 'Shouldn''t Lose', 'F>=6';
  assert dsales.dsales_rfm(4, 90) = 'Loyal' and dsales.dsales_rfm(5, 91) = 'Sleepers' and dsales.dsales_rfm(3, 91) = 'Sleepers', 'F 3-5';
  assert dsales.dsales_rfm(3, 60) = 'Promising' and dsales.dsales_rfm(2, 61) = 'Need Attention' and dsales.dsales_rfm(3, 90) = 'Need Attention', 'F 2-3';
  assert dsales.dsales_rfm(2, 91) = 'Lost' and dsales.dsales_rfm(1, 91) = 'Lost', 'F 1-2 > 90 = Lost';
  assert dsales.dsales_rfm(1, 10) = 'Hot' and dsales.dsales_rfm(1, 31) = 'Warm' and dsales.dsales_rfm(1, 60) = 'Warm' and dsales.dsales_rfm(1, 61) = 'Cold' and dsales.dsales_rfm(1, 90) = 'Cold', 'one-time buyers';
  assert dsales.dsales_rfm(null, 10) is null and dsales.dsales_rfm(0, 10) is null and dsales.dsales_rfm(3, null) is null, 'no data = null';

  -- คอลัมน์ generated ตรงกับฟังก์ชันทุกแถว
  select count(*) into v_bad from dsales.dsales_customer_base b where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  assert v_bad = 0, format('generated rfm mismatch %s', v_bad);

  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);

  -- base_customers คืนกลุ่มใหม่ และกรองด้วยชื่อกลุ่มใหม่ได้
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"rfm": ["Lost"]}') r where r.rfm_segment is distinct from 'Lost';
  assert v_bad = 0, 'rfm filter Lost';
  select max(total_count) into v_lost from dsales.dsales_base_customers('pool', null, 1, 0, null, '{"rfm": ["Lost"]}');
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"rfm": ["Warm", "Cold"]}') r where r.rfm_segment not in ('Warm', 'Cold');
  assert v_bad = 0, 'rfm filter Warm/Cold';

  -- จำนวนต่อกลุ่ม: รวมแล้วเท่าจำนวนทั้งหมดของ pool และ Lost ตรงกับตัวกรอง
  select coalesce(sum(n), 0), jsonb_object_agg(segment, n) into v_sum, c from dsales.dsales_base_segment_counts('pool', null);
  select max(total_count) into v_total from dsales.dsales_base_customers('pool', null, 1, 0, null);
  assert v_sum = v_total, format('counts sum %s = pool total %s', v_sum, v_total);
  assert (c ->> 'Lost')::bigint = v_lost, format('Lost count %s = filter %s', c ->> 'Lost', v_lost);
  assert not exists (select 1 from dsales.dsales_base_segment_counts('mine', null)), 'new rep owns nothing';
  assert not exists (select 1 from dsales.dsales_base_segment_counts('team', null)), 'team scope only for admins';
  reset role;
  insert into _r values ('pool_counts', c::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 22_rfm_segments' from _r;
rollback;
