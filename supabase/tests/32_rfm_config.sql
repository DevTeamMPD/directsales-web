begin;
-- RFM config (20261126150000): rules table, dsales_rfm reads it, rfm column kept by a trigger,
-- dsales_rfm_apply, dsales_rfm_config_get, dsales_rfm_map. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_sales uuid; v_bad bigint; v_n bigint; v_sum bigint; v_un bigint; c jsonb; v_ok boolean;
begin
  -- (a) seed: 10 groups, Lost is the fallback and comes last
  assert (select count(*) from dsales.dsales_rfm_segments) = 10, '10 segments';
  assert (select key from dsales.dsales_rfm_segments where is_fallback) = 'Lost', 'Lost is the fallback';
  assert (select sort_order from dsales.dsales_rfm_segments where key = 'Lost') = (select max(sort_order) from dsales.dsales_rfm_segments), 'fallback is last';

  -- (b) same result as the old fixed rules at every boundary, plus Hot
  assert dsales.dsales_rfm(6, 30) = 'Champion' and dsales.dsales_rfm(6, 31) = 'Loyal' and dsales.dsales_rfm(6, 90) = 'Loyal' and dsales.dsales_rfm(6, 91) = 'Shouldn''t Lose', 'F>=6';
  assert dsales.dsales_rfm(4, 30) = 'Loyal' and dsales.dsales_rfm(4, 90) = 'Loyal' and dsales.dsales_rfm(5, 91) = 'Sleepers' and dsales.dsales_rfm(3, 91) = 'Sleepers', 'F 3-5';
  assert dsales.dsales_rfm(3, 60) = 'Promising' and dsales.dsales_rfm(2, 61) = 'Need Attention' and dsales.dsales_rfm(3, 90) = 'Need Attention', 'F 2-3';
  assert dsales.dsales_rfm(2, 91) = 'Lost' and dsales.dsales_rfm(1, 91) = 'Lost', 'F 1-2 > 90 = Lost';
  assert dsales.dsales_rfm(1, 0) = 'Hot' and dsales.dsales_rfm(1, 30) = 'Hot' and dsales.dsales_rfm(1, 31) = 'Warm' and dsales.dsales_rfm(1, 60) = 'Warm'
     and dsales.dsales_rfm(1, 61) = 'Cold' and dsales.dsales_rfm(1, 90) = 'Cold', 'one-time buyers: Hot / Warm / Cold';
  assert dsales.dsales_rfm(null, 10) is null and dsales.dsales_rfm(0, 10) is null and dsales.dsales_rfm(3, null) is null, 'no data = null';
  assert dsales.dsales_rfm(6, -1) = 'Champion' and dsales.dsales_rfm(1, -3) = 'Hot', 'a purchase dated after today counts as today';

  -- (c) stored column = function on every row; the trigger keeps it on write
  select count(*) into v_bad from dsales.dsales_customer_base b where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  assert v_bad = 0, format('rfm column mismatch on %s rows', v_bad);
  insert into dsales.dsales_customer_base (phone_normalized, name, order_count, dormant_days, last_order_date)
    values ('0899999951', 'ทดสอบ RFM config', 1, 10, current_date - 10);
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Hot', 'insert sets rfm';
  update dsales.dsales_customer_base set dormant_days = 45 where phone_normalized = '0899999951';
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Warm', 'update of dormant_days sets rfm';
  update dsales.dsales_customer_base set order_count = 7, dormant_days = 200 where phone_normalized = '0899999951';
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Shouldn''t Lose', 'update of order_count sets rfm';
  insert into dsales.dsales_customer_base (phone_normalized, name, order_count, dormant_days, last_order_date)
    values ('0899999951', 'ทดสอบ RFM config', 1, 70, current_date - 70)
    on conflict (phone_normalized) do update set order_count = excluded.order_count, dormant_days = excluded.dormant_days;
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Cold', 'upsert (the way the refresh writes) sets rfm';

  -- changing a rule + dsales_rfm_apply moves customers, a second apply writes nothing
  update dsales.dsales_rfm_segments set r_max = 20 where key = 'Hot';
  update dsales.dsales_rfm_segments set r_min = 21 where key = 'Warm';
  assert dsales.dsales_rfm(1, 25) = 'Warm', 'a rule change is used at once';
  perform dsales.dsales_rfm_apply();
  select count(*) into v_bad from dsales.dsales_customer_base b where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  assert v_bad = 0, 'apply brings every row in line';
  assert dsales.dsales_rfm_apply() = 0, 'second apply writes nothing';
  update dsales.dsales_rfm_segments set r_max = 30 where key = 'Hot';
  update dsales.dsales_rfm_segments set r_min = 31 where key = 'Warm';
  perform dsales.dsales_rfm_apply();

  -- (d) config for the web: any member can read it, nobody can touch the table or run apply
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  c := dsales.dsales_rfm_config_get();
  assert jsonb_array_length(c) = 10, format('config has 10 segments, got %s', jsonb_array_length(c));
  assert c -> 0 ->> 'key' = 'Champion' and (c -> 0 ->> 'f_min')::int = 6 and c -> 0 -> 'f_max' = 'null'::jsonb and (c -> 0 ->> 'r_max')::int = 30,
         format('first rule, got %s', c -> 0);
  assert c -> 9 ->> 'key' = 'Lost' and (c -> 9 ->> 'fallback')::boolean, 'last = fallback';
  assert (c -> 0) ?& array['key', 'sort', 'f_min', 'f_max', 'r_min', 'r_max', 'fallback', 'tone', 'behavior', 'action', 'template_bebeplay', 'template_hosttail', 'no_outreach'],
         format('config keys, got %s', c -> 0);
  assert (select bool_and(e ->> 'tone' <> '' and e ->> 'behavior' <> '' and e ->> 'action' <> '') from jsonb_array_elements(c) e), 'every segment has its action context';
  v_ok := false;
  begin perform 1 from dsales.dsales_rfm_segments; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'members cannot read the table directly';
  v_ok := false;
  begin perform dsales.dsales_rfm_apply(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'members cannot call dsales_rfm_apply';

  -- (e) map: a new rep owns nothing, team is for admins, pool: contactable = the chip counts and n >= contactable
  assert not exists (select 1 from dsales.dsales_rfm_map('mine', null)), 'new rep: empty mine map';
  assert not exists (select 1 from dsales.dsales_rfm_map('team', null)), 'team scope only for admins';
  select count(*) into v_bad
  from dsales.dsales_rfm_map('pool', null) m
  full join dsales.dsales_base_segment_counts('pool', null) s on s.segment = m.segment
  where m.segment is null or m.contactable is distinct from coalesce(s.n, 0) or m.n < m.contactable;
  assert v_bad = 0, format('pool map: contactable must equal the segment counts (%s rows differ)', v_bad);
  v_ok := false;
  begin perform dsales.dsales_rfm_map('mine', null, v_admin); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'p_as only for admins';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select coalesce(sum(n), 0), coalesce(sum(n) filter (where segment = ''), 0) into v_sum, v_un from dsales.dsales_rfm_map('team', null);
  assert not exists (select 1 from dsales.dsales_rfm_map('mine', null, v_sales)), 'admin viewing as the new rep sees that rep''s (empty) map';
  reset role;
  select count(*) into v_n from dsales.dsales_customer_base b
  where not (b.phone_normalized = any (array(select x.phone from dsales.dsales_excluded_customers() x)));
  assert v_sum = v_n, format('team map covers the whole base: %s vs %s', v_sum, v_n);
  insert into _r values ('team_total', v_sum::text), ('unscored', v_un::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 32_rfm_config' from _r;
rollback;
