begin;
-- outreach tables exist, are closed to the API roles, settings seeded, helpers behave
do $$
declare v_admin uuid; v_other uuid; v_ok boolean;
begin
  assert to_regclass('dsales.dsales_templates') is not null, 'dsales_templates missing';
  assert to_regclass('dsales.dsales_outreach_batches') is not null, 'dsales_outreach_batches missing';
  assert to_regclass('dsales.dsales_outreach_queue') is not null, 'dsales_outreach_queue missing';
  assert to_regclass('dsales.dsales_worker_status') is not null, 'dsales_worker_status missing';
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_interactions' and column_name = 'outreach_id'),
         'dsales_interactions.outreach_id missing';
  -- test mode redirect columns (contract §1)
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_outreach_queue'
                 and column_name = 'test_redirect' and data_type = 'boolean' and is_nullable = 'NO'), 'queue.test_redirect missing';
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_outreach_queue'
                 and column_name = 'target_ms_id' and data_type = 'bigint'), 'queue.target_ms_id missing';
  assert not has_table_privilege('authenticated', 'dsales.dsales_outreach_queue', 'select'), 'queue must not be readable by authenticated';
  assert not has_table_privilege('anon', 'dsales.dsales_templates', 'select'), 'templates must not be readable by anon';
  assert (select value from dsales.dsales_settings where key = 'outreach_test_mode') = 'true'::jsonb, 'test mode must default to true';
  assert (select (value #>> '{}')::int from dsales.dsales_settings where key = 'worker_interval_seconds') = 60, 'interval default 60';
  assert (select (value #>> '{}')::int from dsales.dsales_settings where key = 'outreach_max_batch') = 50, 'max batch default 50';
  assert (select jsonb_array_length(value -> 'bebeplay') from dsales.dsales_settings where key = 'page_brand_map') >= 5, 'page_brand_map bebeplay';
  assert not has_function_privilege('authenticated', 'dsales.dsales_setting(text)', 'execute'), 'dsales_setting is internal';

  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  assert exists (select 1 from dsales.dsales_settings, jsonb_array_elements_text(value) u where key = 'worker_user_ids' and u = v_admin::text),
         'worker_user_ids must contain the dev admin';

  -- dsales_worker_uid: admin listed -> ok; another user -> not_worker
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_uid() = v_admin, 'worker_uid returns the caller';
  select id into v_other from auth.users where id <> v_admin limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_uid(); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'non-listed user must get not_worker';
  raise notice 'OK 08_outreach_tables';
end $$;
rollback;
