begin;
-- primary / standby: a standby worker gets no jobs and no link targets while the primary is
-- running with a fresh heartbeat; it takes over when the primary is stale or not running;
-- with no worker_primary the old behaviour is kept
do $$
declare
  v_admin uuid; v_w uuid; v_tpl uuid; v_b uuid; c jsonb; v_n int; s jsonb;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select (x #>> '{}')::uuid into v_w from jsonb_array_elements(dsales.dsales_setting('worker_user_ids')) x limit 1;
  assert v_admin is not null and v_w is not null, 'need an admin and a worker account';
  -- clean slate (rolled back)
  update dsales.dsales_outreach_queue set status = 'cancelled' where status in ('queued', 'sending');
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 day' where sent_at > now() - interval '1 day';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'line_monthly_cap';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_settings set value = '[999]'::jsonb where key = 'outreach_test_ms_ids';
  update dsales.dsales_buyer_lookups set looked_up_at = looked_up_at - interval '15 days'; -- buyer ids are due for lookup, whatever the live worker did
  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 't25', 'x', v_admin) returning id into v_tpl;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_admin, v_tpl, 'bebeplay') returning id into v_b;
  insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, provider, chat_name, message_text, requested_by, enqueued_at) values
    (v_b, null, '0899999971', 711, 'Line', 'ก', 'm1', v_admin, now() - interval '2 min'),
    (v_b, null, '0899999972', 712, 'Line', 'ข', 'm2', v_admin, now() - interval '1 min');
  insert into dsales.dsales_worker_status (worker_id, user_id, heartbeat_at, jst_session_ok, state, sent_last_hour, queue_waiting, updated_at)
    values ('t25-primary', v_w, now(), true, 'running', 0, 0, now());
  insert into dsales.dsales_settings (key, value) values ('worker_primary', '"t25-primary"'::jsonb)
    on conflict (key) do update set value = excluded.value;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_worker_link_targets('t25-primary', 5);
  assert v_n > 0, 'the primary gets link targets (so the standby''s 0 below means something)';
  assert dsales.dsales_worker_claim('t25-standby') is null, 'standby gets nothing while the primary is fresh and running';
  select count(*) into v_n from dsales.dsales_worker_link_targets('t25-standby', 5);
  assert v_n = 0, 'standby gets no link targets';
  c := dsales.dsales_worker_claim('t25-primary');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 1, format('the primary claims, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'x', null);

  -- stale heartbeat -> the standby takes over
  reset role;
  update dsales.dsales_worker_status set heartbeat_at = now() - interval '4 minutes' where worker_id = 't25-primary';
  set local role authenticated;
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 2, format('standby takes over on a stale heartbeat, got %s', c);
  select count(*) into v_n from dsales.dsales_worker_link_targets('t25-standby', 5);
  assert v_n > 0, 'standby gets link targets once the primary is stale';
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'x', null);

  -- fresh heartbeat but not running -> the standby takes over
  reset role;
  update dsales.dsales_worker_status set heartbeat_at = now(), state = 'needs_login' where worker_id = 't25-primary';
  set local role authenticated;
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 3, format('standby takes over when the primary is not running, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'failed', 'done', null);

  -- status card: primary name and per-worker flag
  reset role;
  update dsales.dsales_worker_status set state = 'running' where worker_id = 't25-primary';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  s := dsales.dsales_worker_status_get();
  assert s ->> 'primary' = 't25-primary', format('status shows the primary, got %s', s ->> 'primary');
  assert exists (select 1 from jsonb_array_elements(s -> 'workers') w where w ->> 'worker_id' = 't25-primary' and (w ->> 'is_primary')::boolean),
         'the primary row is flagged';
  assert not exists (select 1 from jsonb_array_elements(s -> 'workers') w where w ->> 'worker_id' <> 't25-primary' and (w ->> 'is_primary')::boolean),
         'no other row is flagged';

  -- no primary configured -> nobody is a standby (old behaviour)
  reset role;
  update dsales.dsales_settings set value = '""'::jsonb where key = 'worker_primary';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 712, format('no primary -> any worker claims, got %s', c);
  reset role;
  raise notice 'OK 25_worker_primary_standby';
end $$;
rollback;
