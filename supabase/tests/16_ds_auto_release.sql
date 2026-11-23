begin;
-- Direct Sale auto-release after ds_max_days (30) without a sale:
-- (a) ds_since set when a lead enters a rep's Direct Sale, kept on a same-owner re-claim
-- (b) dsales_release_stale_leads releases stale non-won leads (auto_release row + 'system' interaction)
-- (c) cooldown: the released rep cannot claim it back for 30 days; others can; admin can assign
-- (d) dsales_lead_json has dsSince
-- (e) clients cannot call the release function or read dsales_lead_auto_releases
do $$
declare
  v_admin uuid; v_s1 uuid; v_s2 uuid; v_l1 uuid; v_l2 uuid; v_l3 uuid; v_l4 uuid;
  j jsonb; v_n int; v_err text; v_since timestamptz; l dsales.dsales_leads;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_s2 from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_s1 order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true), (v_s2, 'sales', 'S2', true);
  assert (select coalesce((value #>> '{}')::int, 0) from dsales.dsales_settings where key = 'ds_max_days') = 30, 'setting ds_max_days = 30';

  -- L1: no owner (pool) · L2: s1, won · L3: s1, following · L4: s2, lost
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, created_by)
    values ('self', 'bebeplay', 'ทดสอบคืน1', '0899999981', '0899999981', v_admin) returning id into v_l1;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, closed_bills, created_by)
    values ('self', 'bebeplay', 'ทดสอบคืน2', '0899999982', '0899999982', v_s1, v_s1, now(), 'won', array['B-TEST-1'], v_s1) returning id into v_l2;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, created_by)
    values ('self', 'bebeplay', 'ทดสอบคืน3', '0899999983', '0899999983', v_s1, v_s1, now(), 'following', v_s1) returning id into v_l3;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, created_by)
    values ('self', 'hosttail', 'ทดสอบคืน4', '0899999984', '0899999984', v_s2, v_s2, now(), 'lost', v_s2) returning id into v_l4;
  assert (select ds_since is null from dsales.dsales_leads where id = v_l1), 'no owner -> ds_since null';
  assert (select abs(extract(epoch from ds_since - now())) < 5 from dsales.dsales_leads where id = v_l2), 'insert with owner -> ds_since = now';

  -- (a) + (d) sales claims L1 -> ds_since = now, returned as dsSince
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  j := dsales.dsales_claim_lead(v_l1);
  reset role;
  assert j ? 'dsSince', format('lead json must have dsSince, got %s', j);
  select ds_since into v_since from dsales.dsales_leads where id = v_l1;
  assert v_since is not null and abs(extract(epoch from v_since - now())) < 5, format('claim -> ds_since = now, got %s', v_since);
  assert (j ->> 'dsSince')::timestamptz = v_since, format('dsSince = ds_since, got %s', j ->> 'dsSince');

  -- same-owner re-claim keeps the clock (cannot reset the 30 days by claiming again)
  update dsales.dsales_leads set ds_since = now() - interval '20 days' where id = v_l3;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  perform dsales.dsales_claim_lead(v_l3);
  reset role;
  assert (select ds_since::date = (now() - interval '20 days')::date from dsales.dsales_leads where id = v_l3), 're-claim by the same owner keeps ds_since';

  -- (b) L1 31 days in Direct Sale with a callback, L2 won 31 days, L3 20 days, L4 lost 31 days
  update dsales.dsales_leads set ds_since = now() - interval '31 days', status = 'callback', callback_date = current_date + 1 where id = v_l1;
  update dsales.dsales_leads set ds_since = now() - interval '31 days' where id in (v_l2, v_l4);
  perform set_config('request.jwt.claims', '', true);
  v_n := dsales.dsales_release_stale_leads();
  assert v_n >= 2, format('at least L1 and L4 released, got %s', v_n);
  select * into l from dsales.dsales_leads where id = v_l1;
  assert l.owner_id is null and l.status = 'new' and l.callback_date is null and l.ds_since is null,
         format('L1 released: owner %s status %s callback %s ds_since %s', l.owner_id, l.status, l.callback_date, l.ds_since);
  assert l.claimed_by is null and l.claimed_at is null, 'release clears claimed_by / claimed_at';
  assert not (v_s1 = any (l.released_by)), 'auto-release is not a manual "คัดออก" (released_by unchanged)';
  assert exists (select 1 from dsales.dsales_lead_auto_releases where lead_id = v_l1 and user_id = v_s1), 'auto_release row for L1 / s1';
  assert exists (select 1 from dsales.dsales_interactions where lead_id = v_l1 and type = 'system' and rep_id = v_s1 and note like '%คืนอัตโนมัติ%'),
         'system interaction recorded with the previous owner';
  assert exists (select 1 from jsonb_array_elements(dsales.dsales_lead_json(l) -> 'interactions') x where x ->> 'type' = 'system'),
         'lead history shows the system interaction';
  assert (select owner_id is null and status = 'new' from dsales.dsales_leads where id = v_l4), 'lost lead is released too';
  assert exists (select 1 from dsales.dsales_lead_auto_releases where lead_id = v_l4 and user_id = v_s2), 'auto_release row for L4 / s2';
  assert (select owner_id = v_s1 and status = 'won' from dsales.dsales_leads where id = v_l2), 'won lead is never released';
  assert (select owner_id = v_s1 from dsales.dsales_leads where id = v_l3), '20-day lead is not released';
  assert not exists (select 1 from dsales.dsales_lead_auto_releases where lead_id in (v_l2, v_l3)), 'no auto_release for kept leads';
  perform dsales.dsales_release_stale_leads();
  assert (select count(*) from dsales.dsales_lead_auto_releases where lead_id = v_l1) = 1, 'second run does not release L1 again';

  -- (c) cooldown: s1 cannot claim L1 back (lead or customer RPC)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_err := 'no error';
  begin perform dsales.dsales_claim_lead(v_l1); exception when others then v_err := sqlerrm; end;
  assert v_err = 'release_cooldown', format('s1 claim_lead -> release_cooldown, got %s', v_err);
  v_err := 'no error';
  begin perform dsales.dsales_claim_customer('0899999981', 'bebeplay'); exception when others then v_err := sqlerrm; end;
  assert v_err = 'release_cooldown', format('s1 claim_customer -> release_cooldown, got %s', v_err);
  -- another rep can claim it
  perform set_config('request.jwt.claims', json_build_object('sub', v_s2, 'role', 'authenticated')::text, true);
  j := dsales.dsales_claim_lead(v_l1);
  assert j ->> 'owner' = v_s2::text, 's2 can claim the released lead';
  -- the admin can assign it back to s1
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  j := dsales.dsales_assign_lead(v_l1, v_s1);
  reset role;
  assert j ->> 'owner' = v_s1::text, 'admin assign to s1 bypasses the cooldown';
  assert (select abs(extract(epoch from ds_since - now())) < 5 from dsales.dsales_leads where id = v_l1), 'assign -> ds_since = now';

  -- after ds_max_days the cooldown ends
  update dsales.dsales_leads set owner_id = null, claimed_by = null, claimed_at = null where id = v_l1;
  update dsales.dsales_lead_auto_releases set released_at = now() - interval '31 days' where lead_id = v_l1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  j := dsales.dsales_claim_customer('0899999981', 'bebeplay');
  assert j ->> 'owner' = v_s1::text, 'cooldown over -> s1 can claim again';

  -- (e) clients cannot run the release or read the release log (sales and admin)
  v_err := 'no error';
  begin perform dsales.dsales_release_stale_leads(); exception when others then v_err := sqlstate; end;
  assert v_err = '42501', format('sales cannot call dsales_release_stale_leads, got %s', v_err);
  v_err := 'no error';
  begin perform 1 from dsales.dsales_lead_auto_releases; exception when others then v_err := sqlstate; end;
  assert v_err = '42501', format('sales cannot read dsales_lead_auto_releases, got %s', v_err);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_err := 'no error';
  begin perform dsales.dsales_release_stale_leads(); exception when others then v_err := sqlstate; end;
  assert v_err = '42501', format('admin cannot call dsales_release_stale_leads, got %s', v_err);
  v_err := 'no error';
  begin perform 1 from dsales.dsales_lead_auto_releases; exception when others then v_err := sqlstate; end;
  assert v_err = '42501', format('admin cannot read dsales_lead_auto_releases, got %s', v_err);
  reset role;
end $$;
select 'OK 16_ds_auto_release' as result;
rollback;
