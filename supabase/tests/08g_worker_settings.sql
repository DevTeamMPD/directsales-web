begin;
do $$
declare v_admin uuid; v_sales uuid; j jsonb; v_ok boolean; v_q text; v_t0 timestamptz; v_secs numeric;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  insert into dsales.dsales_worker_status (worker_id, state, jst_session_ok, heartbeat_at) values ('w-test', 'running', true, now() - interval '5 min');
  -- a real customer name prefix (2 chars) from the JST rooms
  select left(btrim(s.customer), 2) into v_q from public.iim_sessions s
  where length(btrim(coalesce(s.customer, ''))) >= 2 order by s.last_time desc nulls last limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  j := dsales.dsales_worker_settings_set(30, 500, true, array[130427]::bigint[]);
  assert (j -> 'settings' ->> 'interval_seconds')::int = 30 and (j -> 'settings' ->> 'line_monthly_cap')::int = 500, 'settings saved';
  assert (j -> 'settings' -> 'test_ms_ids' ->> 0)::bigint = 130427, 'test ids saved';
  j := dsales.dsales_worker_status_get();
  assert exists (select 1 from jsonb_array_elements(j -> 'workers') w where w ->> 'worker_id' = 'w-test' and (w ->> 'online')::boolean = false),
         'heartbeat older than 3 min -> offline';
  assert (j -> 'queue' ? 'queued') and (j -> 'queue' ? 'sent_last_hour'), 'queue counts present';
  v_ok := false;
  begin perform dsales.dsales_worker_settings_set(1, 0, true, null); exception when others then v_ok := sqlerrm = 'invalid_setting'; end;
  assert v_ok, 'interval below 5 s rejected';

  -- find rooms (admin): at most 20 rooms with the contract keys, fast
  v_t0 := clock_timestamp();
  j := dsales.dsales_worker_find_rooms(v_q);
  v_secs := extract(epoch from clock_timestamp() - v_t0);
  perform set_config('test.find_rooms_secs', round(v_secs, 3)::text, true);
  assert v_secs < 2, format('find_rooms too slow: %s s', v_secs);
  assert jsonb_typeof(j) = 'array' and jsonb_array_length(j) between 1 and 20, format('find_rooms returns 1..20 rooms, got %s', jsonb_array_length(j));
  assert (select array_agg(k order by k) from jsonb_object_keys(j -> 0) k) = array['channel', 'customer', 'last_time', 'ms_id', 'page'],
         format('find_rooms keys, got %s', j -> 0);
  assert dsales.dsales_worker_find_rooms(left(v_q, 1)) = '[]'::jsonb, '1-char query -> []';
  assert dsales.dsales_worker_find_rooms(null) = '[]'::jsonb, 'null query -> []';

  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  j := dsales.dsales_worker_status_get();
  assert j ? 'workers', 'sales can read worker status';
  v_ok := false;
  begin perform dsales.dsales_worker_settings_set(60, 0, false, null); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot change worker settings';
  v_ok := false;
  begin perform dsales.dsales_worker_find_rooms(v_q); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot search rooms';
  reset role;
  raise notice 'OK 08g_worker_settings';
end $$;
rollback;
