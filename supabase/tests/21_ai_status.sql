begin;
-- วิเคราะห์สถานะด้วย AI (20261125130000): context / apply / undo + เพดานต่อวัน + สิทธิ์หัวหน้า. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; v_l1 uuid; v_l2 uuid; v_l3 uuid; v_won uuid; ctx jsonb; res jsonb; j jsonb; v_ok boolean; v_t0 timestamptz;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true);
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status)
    values ('self', 'hosttail', 'AI ทดสอบ 1', '0899999961', '0899999961', v_s1, v_s1, now() - interval '2 days', 'new') returning id into v_l1;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status)
    values ('self', 'hosttail', 'AI ทดสอบ 2', '0899999962', '0899999962', v_s1, v_s1, now() - interval '2 days', 'following') returning id into v_l2;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status)
    values ('self', 'hosttail', 'AI ทดสอบ 3', '0899999963', '0899999963', v_s1, v_s1, now() - interval '2 days', 'new') returning id into v_l3;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, closed_bills)
    values ('self', 'hosttail', 'AI ทดสอบ won', '0899999964', '0899999964', v_s1, v_s1, now(), 'won', array['B1']) returning id into v_won;
  insert into dsales.dsales_interactions (lead_id, rep_id, type, result, note, created_at)
    values (v_l1, v_s1, 'chat', 'ส่งโปรโมชันแล้ว', null, now() - interval '1 day');

  -- เซลล์เรียกไม่ได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_ai_status_context(array[v_l1]); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales rep -> forbidden';

  -- หัวหน้า: context (ลีด won ไม่ส่งให้ AI)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  ctx := dsales.dsales_ai_status_context(array[v_l1, v_won, v_l2]);
  assert jsonb_array_length(ctx) = 2, format('won lead excluded, got %s', ctx);
  assert ctx -> 0 ->> 'id' = v_l1::text and ctx -> 0 ->> 'owner' = 'S1' and ctx -> 0 ->> 'today' = v_today::text, format('context fields %s', ctx -> 0);
  assert ctx -> 0 -> 'logs' -> 0 ->> 'result' = 'ส่งโปรโมชันแล้ว', 'logs included';
  assert jsonb_typeof(ctx -> 0 -> 'chat') = 'array' and jsonb_typeof(ctx -> 0 -> 'buys') = 'array' and jsonb_typeof(ctx -> 0 -> 'newBills') = 'array', 'arrays present';
  v_ok := false;
  begin perform dsales.dsales_ai_status_context((select array_agg(gen_random_uuid()) from generate_series(1, 51))); exception when others then v_ok := sqlerrm = 'batch_too_large'; end;
  assert v_ok, '51 leads -> batch_too_large';

  -- apply: L1 มั่นใจ 0.9 → callback พรุ่งนี้ · L2 มั่นใจ 0.5 → คง · L3 มีคนบันทึกหลังอ่านข้อมูล → ข้าม · won → ข้าม · status won จาก AI ไม่ยอม
  v_t0 := now() - interval '1 second';
  reset role;
  insert into dsales.dsales_interactions (lead_id, rep_id, type, result, created_at) values (v_l3, v_s1, 'call', 'โทรแล้ว', now() + interval '1 second');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  res := dsales.dsales_ai_status_apply(jsonb_build_array(
    jsonb_build_object('lead_id', v_l1, 'status', 'callback', 'callback_date', (v_today + 1)::text, 'confidence', 0.9,
                       'interest', 'คอกมีหลังคา', 'reason', 'ลูกค้าขอให้ติดต่อพรุ่งนี้', 'flags', jsonb_build_array('บันทึกว่าส่งโปร แต่ไม่พบข้อความ'), 'next_action', 'โทรพรุ่งนี้'),
    jsonb_build_object('lead_id', v_l2, 'status', 'lost', 'confidence', 0.5, 'reason', 'ไม่แน่ใจ', 'flags', '[]'::jsonb),
    jsonb_build_object('lead_id', v_l3, 'status', 'unreachable', 'confidence', 0.95, 'reason', 'x', 'flags', '[]'::jsonb),
    jsonb_build_object('lead_id', v_won, 'status', 'lost', 'confidence', 0.95, 'reason', 'x', 'flags', '[]'::jsonb)),
    jsonb_build_object('analysed', 3, 'input_tokens', 9000, 'output_tokens', 3000, 'model', 'claude-haiku-5-5'), v_t0);
  insert into _r values ('apply', res::text);
  assert (res ->> 'changed')::int = 1 and (res ->> 'kept')::int = 1, format('changed 1 kept 1, got %s', res);
  assert (select count(*) from jsonb_array_elements(res -> 'skipped')) = 2, 'L3 + won skipped';
  assert exists (select 1 from jsonb_array_elements(res -> 'skipped') x where x ->> 'reason' = 'changed_meanwhile'), 'changed_meanwhile reason';
  reset role;
  assert (select status = 'callback' and callback_date = v_today + 1 and (ai ->> 'applied')::boolean and ai ->> 'prevStatus' = 'new'
          from dsales.dsales_leads where id = v_l1), 'L1 updated with ai summary';
  assert (select status = 'following' and not (ai ->> 'applied')::boolean and ai ->> 'status' = 'lost' from dsales.dsales_leads where id = v_l2), 'L2 kept (low confidence)';
  assert (select status from dsales.dsales_leads where id = v_l3) = 'new' and (select ai from dsales.dsales_leads where id = v_l3) is null, 'L3 untouched';
  assert exists (select 1 from dsales.dsales_interactions where lead_id = v_l1 and type = 'ai' and result = 'callback' and note like '%⚠ บันทึกว่าส่งโปร%' and note like '%→ โทรพรุ่งนี้%'), 'ai interaction L1';
  assert exists (select 1 from dsales.dsales_interactions where lead_id = v_l2 and type = 'ai' and result = 'keep'), 'ai interaction L2 keep';
  assert (select analysed = 3 and changed = 1 and input_tokens = 9000 from dsales.dsales_ai_runs where run_by = v_admin order by created_at desc limit 1), 'run recorded';
  assert (select dsales.dsales_lead_json(l) -> 'ai' ->> 'interest' from dsales.dsales_leads l where l.id = v_l1) = 'คอกมีหลังคา', 'lead_json has ai';

  -- undo
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  j := dsales.dsales_ai_status_undo(v_l1);
  assert j ->> 'status' = 'new' and j ->> 'callback' is null, format('undo restores, got %s', j ->> 'status');
  v_ok := false;
  begin perform dsales.dsales_ai_status_undo(v_l1); exception when others then v_ok := sqlerrm = 'ai_nothing_to_undo'; end;
  assert v_ok, 'second undo -> ai_nothing_to_undo';

  -- เพดานต่อวัน
  reset role;
  update dsales.dsales_settings set value = '3'::jsonb where key = 'ai_daily_limit';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_ai_status_context(array[v_l1]); exception when others then v_ok := sqlerrm = 'ai_daily_limit'; end;
  assert v_ok, 'daily limit reached -> ai_daily_limit';
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 21_ai_status' from _r;
rollback;
