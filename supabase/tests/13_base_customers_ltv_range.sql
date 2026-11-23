begin;
-- dsales_base_customers p_filters.ltv_max (20261123100000): ยอดซื้อสะสมเป็นช่วง [ltv_min, ltv_max) — ขอบบนไม่รวม,
-- ใช้ร่วมกับ ltv_min หรือเดี่ยว ๆ ได้, ไม่ส่ง = ไม่จำกัด (เหมือนเดิม). Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare v_sales uuid; v_bad bigint; v_n bigint; v_all bigint; t0 timestamptz; v_secs numeric;
begin
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);

  select max(r.total_count) into v_all from dsales.dsales_base_customers('pool', null, 1, 0, null) r;
  t0 := clock_timestamp();
  select max(r.total_count) into v_n from dsales.dsales_base_customers('pool', null, 1, 0, null, '{"ltv_min": 5000, "ltv_max": 10000}') r;
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('pool_all', v_all::text), ('pool_5000_9999', v_n::text), ('range_s', round(v_secs, 3)::text);
  assert v_n > 0 and v_n < v_all, format('range narrows the pool, got %s of %s', v_n, v_all);
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"ltv_min": 5000, "ltv_max": 10000}') r
    where r.ltv < 5000 or r.ltv >= 10000;
  assert v_bad = 0, 'every row is within [5000, 10000)';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"ltv_max": 1000}') r where r.ltv >= 1000;
  assert v_bad = 0, 'ltv_max alone: below 1000 only';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"ltv_min": 50000}') r where r.ltv < 50000;
  assert v_bad = 0, 'ltv_min alone still works (open-ended)';
  assert v_secs < 1, format('range filter too slow: %s s', v_secs);
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 13_base_customers_ltv_range' from _r;
rollback;
