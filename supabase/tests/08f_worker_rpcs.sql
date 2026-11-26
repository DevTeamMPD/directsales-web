begin;
-- worker claim / report / heartbeat: gate, single flight, pacing, rotation between reps,
-- test mode = redirect to the first test room (contract §1), requeue cap, stale release
do $$
declare
  v_admin uuid; v_s1 uuid; v_s2 uuid; v_tpl uuid; v_b1 uuid; v_b2 uuid; v_lead1 uuid; v_lead2 uuid;
  c jsonb; c2 jsonb; v_ok boolean; v_id uuid; v_m1 uuid;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_s2 from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_s1 order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true), (v_s2, 'sales', 'S2', true);
  -- clean slate for the worker gate and pacing (rolled back)
  update dsales.dsales_outreach_queue set status = 'cancelled' where status in ('queued', 'sending');
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 day' where sent_at > now() - interval '1 day';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'line_monthly_cap';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_settings set value = '[999, 998]'::jsonb where key = 'outreach_test_ms_ids';
  update dsales.dsales_settings set value = '""'::jsonb where key = 'worker_primary'; -- no primary: every worker may claim (20261126120000)

  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 't', 'x', v_admin) returning id into v_tpl;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ1', '0899999991', '0899999991', v_s1, v_s1, now(), v_s1) returning id into v_lead1;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ2', '0899999992', '0899999992', v_s1, v_s1, now(), v_s1) returning id into v_lead2;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_s1, v_tpl, 'bebeplay') returning id into v_b1;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_s2, v_tpl, 'bebeplay') returning id into v_b2;
  insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, provider, chat_name, message_text, requested_by, enqueued_at) values
    (v_b1, v_lead1, '0899999991', 111, 'Line', null, 'm1', v_s1, now() - interval '3 min'),
    (v_b1, v_lead2, '0899999992', 222, 'Line', 'คุณสอง', 'm2', v_s1, now() - interval '2 min'),
    (v_b2, null,    '0899999993', 333, 'Shopee', 'ลูกค้า ก', 'm3', v_s2, now() - interval '1 min'),
    (v_b2, null,    '0899999994', 444, 'Line', '', 'm4', v_s2, now());

  set local role authenticated;
  -- sales cannot use worker RPCs
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_claim('w1'); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker';

  -- test mode with test rooms: oldest item, redirected to the first test room with a prefix
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');
  assert (select array_agg(k order by k) from jsonb_object_keys(c) k)
         = array['attempts', 'chat_name', 'enqueued_at', 'id', 'message', 'ms_id', 'page', 'provider', 'requested_by', 'target_ms_id', 'test_redirect'],
         format('claim keys must match the contract, got %s', c);
  assert (c ->> 'ms_id')::bigint = 111 and (c ->> 'attempts')::int = 1, format('oldest first, got %s', c);
  assert (c ->> 'target_ms_id')::bigint = 999 and (c ->> 'test_redirect')::boolean, format('redirected to the first test room, got %s', c);
  assert c ->> 'message' = '[ทดสอบ → 0899999991] m1', format('prefix uses the phone when chat_name is empty, got %s', c ->> 'message');
  v_m1 := (c ->> 'id')::uuid;
  -- single flight: nothing else is handed out while one is sending
  assert dsales.dsales_worker_claim('w1') is null, 'one item at a time';
  perform dsales.dsales_worker_report(v_m1, 'sent', null, 'jst-1');
  -- fairness: s1 just got a send, so s2's item comes next even though s1's m2 is older
  c2 := dsales.dsales_worker_claim('w1');
  assert (c2 ->> 'ms_id')::bigint = 333, format('rotate between reps, got %s', c2);
  assert c2 ->> 'message' = '[ทดสอบ → ลูกค้า ก] m3', format('prefix uses chat_name, got %s', c2 ->> 'message');
  perform dsales.dsales_worker_report((c2 ->> 'id')::uuid, 'requeue', 'jst 500', null);
  c2 := dsales.dsales_worker_claim('w1');
  assert (c2 ->> 'ms_id')::bigint = 333 and (c2 ->> 'attempts')::int = 2, format('requeued item is claimable again, got %s', c2);
  v_id := (c2 ->> 'id')::uuid;
  perform dsales.dsales_worker_report(v_id, 'failed', 'window_closed', null);
  v_ok := false;
  begin perform dsales.dsales_worker_report(v_id, 'sent', null, null); exception when others then v_ok := sqlerrm = 'invalid_state'; end;
  assert v_ok, 'report on a non-sending item -> invalid_state';

  -- pacing: interval 60 s and a send just happened -> nothing
  reset role;
  update dsales.dsales_settings set value = '60'::jsonb where key = 'worker_interval_seconds';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_claim('w1') is null, 'respects worker_interval_seconds';
  perform dsales.dsales_worker_heartbeat('w1', 'running', true, null);
  reset role;

  assert (select status from dsales.dsales_outreach_queue where id = v_m1) = 'sent', 'm1 sent';
  assert (select jst_msg_id from dsales.dsales_outreach_queue where id = v_m1) = 'jst-1', 'jst msg id stored';
  assert (select test_redirect and target_ms_id = 999 from dsales.dsales_outreach_queue where id = v_m1), 'queue row records the redirect';
  assert not exists (select 1 from dsales.dsales_interactions i where i.outreach_id = v_m1), 'test-redirect send writes no interaction';
  assert (select status from dsales.dsales_leads where id = v_lead1) = 'new', 'test-redirect send leaves the lead status';
  assert (select status from dsales.dsales_outreach_queue where id = v_id) = 'failed', 'failed recorded';
  assert (select state from dsales.dsales_worker_status where worker_id = 'w1') = 'running', 'heartbeat upserted';

  -- test mode without test rooms -> nothing is sent
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '[]'::jsonb where key = 'outreach_test_ms_ids';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_claim('w1') is null, 'test mode with no test rooms -> null';

  -- normal mode: real room, message unchanged, sent writes an interaction for the requester
  reset role;
  update dsales.dsales_settings set value = 'false'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 hour' where id = v_m1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');   -- s2 has no send yet -> m4 before s1's m2
  assert (c ->> 'ms_id')::bigint = 444 and (c ->> 'target_ms_id')::bigint = 444 and not (c ->> 'test_redirect')::boolean,
         format('normal mode targets the real room, got %s', c);
  assert c ->> 'message' = 'm4', 'normal mode message has no prefix';
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'sent', null, 'jst-4');
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'ms_id')::bigint = 222 and (c ->> 'target_ms_id')::bigint = 222 and c ->> 'message' = 'm2', format('m2 next, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'sent', null, 'jst-2');
  reset role;
  assert exists (select 1 from dsales.dsales_interactions i where i.outreach_id = (c ->> 'id')::uuid
                 and i.type = 'chat' and i.rep_id = v_s1 and i.lead_id = v_lead2), 'sent writes a chat interaction for the requester';
  assert (select status from dsales.dsales_leads where id = v_lead2) = 'following', 'new lead moves to following';
  assert (select not test_redirect from dsales.dsales_outreach_queue where id = (c ->> 'id')::uuid), 'normal send is not a redirect';

  -- stale sending (> 10 min) is released on the next claim; attempts cap at 3 -> failed
  update dsales.dsales_outreach_queue set status = 'sending', locked_at = now() - interval '11 min', attempts = 1 where ms_id = 333;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'ms_id')::bigint = 333 and (c ->> 'attempts')::int = 2, format('stale item released and reclaimed, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'e', null);
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'attempts')::int = 3, format('third attempt, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'e', null);
  v_ok := false;
  begin perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'bogus', null, null); exception when others then v_ok := sqlerrm = 'invalid_status'; end;
  assert v_ok, 'unknown report status -> invalid_status';
  reset role;
  assert (select status from dsales.dsales_outreach_queue where ms_id = 333) = 'failed', 'third failure -> failed';
  raise notice 'OK 08f_worker_rpcs';
end $$;
rollback;
