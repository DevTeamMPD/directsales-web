begin;
-- worker state between ticks: lease (no overlapping ticks, expires by itself), runtime jsonb,
-- JST cookies round-trip through Vault, session upload clears needs_login, admin-only reset / primary
do $$
declare
  v_admin uuid; v_w uuid; v_s uuid; r jsonb; v_ok boolean; v_n int; v_t text;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select (x #>> '{}')::uuid into v_w from jsonb_array_elements(dsales.dsales_setting('worker_user_ids')) x limit 1;
  select id into v_s from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_w order by id limit 1;
  assert v_admin is not null and v_w is not null and v_s is not null, 'need an admin, a worker account and a spare user';
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s, 'sales', 'S26', true);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r -> 'runtime' = '{}'::jsonb and r -> 'cookies' = '[]'::jsonb, format('first begin returns empty state, got %s', r);
  assert dsales.dsales_worker_state_begin('t26', 90) is null, 'a second begin while the lease is held returns null';
  perform dsales.dsales_worker_state_end('t26', '{"state":"needs_login","failures":2,"lastError":"x"}'::jsonb, '[{"name":"a","value":"1"}]'::jsonb);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{runtime,state}' = 'needs_login' and r #>> '{runtime,failures}' = '2', format('runtime is stored, got %s', r);
  assert r #>> '{cookies,0,name}' = 'a' and r #>> '{cookies,0,value}' = '1', 'cookies come back from Vault';
  -- end without cookies keeps the stored session
  perform dsales.dsales_worker_state_end('t26', '{"state":"needs_login"}'::jsonb, null);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{cookies,0,value}' = '1', 'cookies are kept when end passes null';

  -- a tick that died never calls end: the lease expires by itself
  reset role;
  update dsales.dsales_worker_state set lease_until = now() - interval '1 second' where worker_id = 't26';
  select count(*) into v_n from vault.secrets where name = 'dsales_jst_session_t26';
  assert v_n = 1, 'exactly one Vault secret per worker';
  set local role authenticated;
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r is not null, 'an expired lease can be taken';

  -- while a tick holds the lease: no session upload, no reset (the tick's state_end would undo them)
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '[{"name":"b","value":"2"}]'::jsonb); exception when others then v_ok := sqlerrm = 'worker_busy'; end;
  assert v_ok, 'session upload while a tick holds the lease -> worker_busy';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_state_reset('t26'); exception when others then v_ok := sqlerrm = 'worker_busy'; end;
  assert v_ok, 'reset while a tick holds the lease -> worker_busy';
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  perform dsales.dsales_worker_state_end('t26', '{"state":"needs_login"}'::jsonb, null);

  -- session upload (no lease held): new cookies, needs_login -> running
  perform dsales.dsales_worker_session_put('t26', '[{"name":"b","value":"2"}]'::jsonb);
  reset role;
  select runtime ->> 'state' into v_t from dsales.dsales_worker_state where worker_id = 't26';
  assert v_t = 'running', format('session upload clears needs_login, got %s', v_t);
  select count(*) into v_n from vault.secrets where name = 'dsales_jst_session_t26';
  assert v_n = 1, 'upload updates the same Vault secret';
  set local role authenticated;
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{cookies,0,name}' = 'b', 'uploaded cookies are returned';
  perform dsales.dsales_worker_state_end('t26', '{}'::jsonb, null);

  -- bad ids / bad payloads (no lease held)
  v_ok := false;
  begin perform dsales.dsales_worker_state_begin('bad id!', 90); exception when others then v_ok := sqlerrm = 'invalid_worker'; end;
  assert v_ok, 'worker id must be [A-Za-z0-9_-]';
  v_ok := false;
  begin perform dsales.dsales_worker_state_end('t26', '[]'::jsonb, null); exception when others then v_ok := sqlerrm = 'invalid_runtime'; end;
  assert v_ok, 'runtime must be an object';
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '{}'::jsonb); exception when others then v_ok := sqlerrm = 'invalid_cookies'; end;
  assert v_ok, 'cookies must be an array';
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '[]'::jsonb); exception when others then v_ok := sqlerrm = 'invalid_cookies'; end;
  assert v_ok, 'cookies must not be empty';

  -- sales: no worker RPCs, no table, no admin RPCs
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_state_begin('t26', 90); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (begin)';
  v_ok := false;
  begin perform dsales.dsales_worker_state_end('t26', '{}'::jsonb, null); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (end)';
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '[]'::jsonb); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (session_put)';
  v_ok := false;
  begin perform 1 from dsales.dsales_worker_state limit 1; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'the state table is not readable directly';
  v_ok := false;
  begin perform 1 from vault.decrypted_secrets limit 1; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'Vault is not readable directly';
  v_ok := false;
  begin perform dsales.dsales_worker_state_reset('t26'); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot reset';
  v_ok := false;
  begin perform dsales.dsales_worker_primary_set('t26'); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot set the primary';

  -- admin: reset and primary
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform dsales.dsales_worker_state_reset('t26');
  reset role;
  assert (select runtime = '{}'::jsonb and lease_until is null from dsales.dsales_worker_state where worker_id = 't26'), 'reset empties runtime and frees the lease';
  insert into dsales.dsales_worker_status (worker_id, user_id, heartbeat_at, jst_session_ok, state, sent_last_hour, queue_waiting, updated_at)
    values ('t26', v_w, now(), true, 'running', 0, 0, now());
  set local role authenticated;
  v_ok := false;
  begin perform dsales.dsales_worker_primary_set('nope-26'); exception when others then v_ok := sqlerrm = 'unknown_worker'; end;
  assert v_ok, 'the primary must be a worker that has sent a heartbeat';
  r := dsales.dsales_worker_primary_set('t26');
  assert r ->> 'primary' = 't26', format('primary set, got %s', r ->> 'primary');
  r := dsales.dsales_worker_primary_set('');
  assert r ->> 'primary' is null, 'empty clears the primary';
  reset role;
  assert not has_function_privilege('authenticated', 'dsales.dsales_worker_session_write(text, jsonb)', 'execute'),
         'session_write is internal';
  assert not has_function_privilege('authenticated', 'dsales.dsales_worker_is_standby(text)', 'execute'),
         'is_standby is internal';
  raise notice 'OK 26_worker_state';
end $$;
rollback;
