begin;
-- buyer-ID room links (20261120150000): worker gate, targets, save (exact outer_user_id only, upgrades name links,
-- keeps manual links, no links for IDs with more than 3 phones), rooms only JST returned are readable through
-- dsales_rooms_v, JST is_expired closes a room, Facebook rooms expose PSID + Meta page / business id.
-- Real data: buyer U51faedd… (1 phone, room 139707 is in JST but not in iim_sessions) and U0565… (5 phones, room 65298
-- is in iim_sessions); fake ms_ids 9000000001.. are not in iim_sessions. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_worker uuid; v_sales uuid; v_ok boolean; v_n int; v_first text;
  v_bid text := 'U51faedd8ba1ec668e0e307bbe1ceb2de'; v_phone text;
  v_many text := 'U05650e2d05ca772824beb46275bc1685';
  t record; j jsonb; e jsonb;
begin
  select id into v_worker from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_worker order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  update dsales.dsales_settings set value = jsonb_build_array(v_worker::text) where key = 'worker_user_ids';
  insert into dsales.dsales_settings (key, value) values ('meta_page_ids', '{"Bebeplay": "111222333"}'::jsonb)
    on conflict (key) do update set value = excluded.value;
  update dsales.dsales_settings set value = '""'::jsonb where key = 'worker_primary'; -- no primary: every worker may claim (20261126120000)
  update dsales.dsales_buyer_lookups set looked_up_at = looked_up_at - interval '15 days'; -- independent of the live worker's lookup history (rolled back)
  select min(dsales.dsales_norm_phone(o.phone)) into v_phone from public.order_tracking o where btrim(o.buyer_account_no) = v_bid;
  assert v_phone is not null and (select count(distinct dsales.dsales_norm_phone(o.phone)) from public.order_tracking o
                                   where btrim(o.buyer_account_no) = v_bid) = 1, 'fixture: buyer id with one phone';
  assert (select count(distinct dsales.dsales_norm_phone(o.phone)) from public.order_tracking o
          where btrim(o.buyer_account_no) = v_many) > dsales.dsales_link_max_phones(), 'fixture: buyer id with many phones';
  delete from dsales.dsales_chat_links where phone_normalized = v_phone or ms_id in (65298, 139707);
  -- a manual link must survive a buyer-id save of the same pair
  insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence)
    values (9000000001, v_phone, 'manual', 'test', 'high');

  set local role authenticated;
  -- internal tables are not readable by clients
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform 1 from dsales.dsales_jst_rooms limit 1; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'dsales_jst_rooms not readable by authenticated';
  v_ok := false;
  begin perform dsales.dsales_worker_link_targets('w', 5); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (targets)';
  v_ok := false;
  begin perform dsales.dsales_worker_link_save('w', v_bid, '[]'::jsonb); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (save)';

  perform set_config('request.jwt.claims', json_build_object('sub', v_worker, 'role', 'authenticated')::text, true);
  -- targets: valid ids on chat shops, not the many-phone id; a searched id drops out
  select count(*) into v_n from dsales.dsales_worker_link_targets('w', 50);
  assert v_n = 50, format('targets honour the limit, got %s', v_n);
  assert not exists (select 1 from dsales.dsales_worker_link_targets('w', 200)
                     where buyer_id !~ '^[A-Za-z0-9._-]{5,64}$' or shop_prefix not in ('FB', 'LOA', 'SH', 'LA', 'TT', 'IG')
                        or buyer_id = v_many),
         'targets are valid ids on chat shops, never a many-phone id';
  select buyer_id into v_first from dsales.dsales_worker_link_targets('w', 1);
  assert dsales.dsales_worker_link_save('w', v_first, null, 'jst_error: test') = 0, 'failed search links nothing';
  assert not exists (select 1 from dsales.dsales_worker_link_targets('w', 200) where buyer_id = v_first), 'searched id is not handed out again';

  v_ok := false;
  begin perform dsales.dsales_worker_link_save('w', '-1', '[]'::jsonb); exception when others then v_ok := sqlerrm = 'invalid_buyer_id'; end;
  assert v_ok, 'invalid buyer id rejected';

  -- save: real JST-only LINE room + fake LINE room (manual pair) + a room of another user (ignored) + a Facebook room
  v_n := dsales.dsales_worker_link_save('w', v_bid, jsonb_build_array(
    jsonb_build_object('ms_id', 139707, 'outer_user_id', v_bid, 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'จริง', 'expired', false,
                       'last_message_time', '2026-11-20T06:00:00Z'),
    jsonb_build_object('ms_id', 9000000001, 'outer_user_id', v_bid, 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'ใหม่', 'expired', false),
    jsonb_build_object('ms_id', 9000000002, 'outer_user_id', 'Uother000', 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'คนอื่น'),
    jsonb_build_object('ms_id', 9000000003, 'outer_user_id', v_bid, 'provider', 'Facebook', 'page', 'Bebeplay', 'name', 'เฟซ', 'expired', false)));
  assert v_n = 2, format('links written (3 rooms, manual pair kept), got %s', v_n);
  -- many-phone id: room stored, nothing linked
  assert dsales.dsales_worker_link_save('w', v_many, jsonb_build_array(
    jsonb_build_object('ms_id', 65298, 'outer_user_id', v_many, 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'หลายเบอร์', 'expired', false)))
    = 0, 'many-phone id links nothing';

  reset role;
  -- room readers (revoked from clients, called as owner) see the JST-only rooms
  select * into t from dsales.dsales_outreach_room(v_phone, 'bebeplay');
  assert t.skip is null and t.ms_id in (139707, 9000000001), format('a LINE room of the brand is picked, got %s', row_to_json(t));
  j := dsales.dsales_customer_rooms(v_phone);
  assert (select count(*) from jsonb_array_elements(j) x where (x ->> 'ms_id')::bigint in (139707, 9000000001, 9000000003)) = 3,
         format('customer rooms include the linked rooms, got %s', j);
  assert not exists (select 1 from jsonb_array_elements(j) x where (x ->> 'ms_id')::bigint = 9000000002), 'room of another user not linked';
  select x into e from jsonb_array_elements(j) x where (x ->> 'ms_id')::bigint = 9000000003;
  assert e ->> 'outer_user_id' = v_bid and e ->> 'meta_page_id' = '111222333' and e ->> 'brand' = 'bebeplay'
         and e ->> 'meta_business_id' = '543119309449766'
         and not (e ->> 'sendable')::boolean, format('Facebook room: PSID + page id, closed without a recent customer message, got %s', e);
  select x into e from jsonb_array_elements(j) x where (x ->> 'ms_id')::bigint = 139707;
  assert (e ->> 'sendable')::boolean and not (e ? 'outer_user_id'), format('LINE room sendable, no PSID key, got %s', e);
  assert exists (select 1 from dsales.dsales_sendable_rooms() r where r.phone_normalized = v_phone and r.brand = 'bebeplay'), 'sendable rooms';

  assert (select method from dsales.dsales_chat_links where ms_id = 9000000001 and phone_normalized = v_phone) = 'manual', 'manual link kept';
  assert (select method || '/' || confidence || '/' || evidence from dsales.dsales_chat_links where ms_id = 139707 and phone_normalized = v_phone)
         = 'buyer_id/high/' || v_bid, 'buyer id link';
  assert not exists (select 1 from dsales.dsales_chat_links where ms_id = 65298), 'many-phone room not linked';
  assert (select rooms_found from dsales.dsales_buyer_lookups where buyer_id = v_bid) = 3, 'lookup recorded with rooms found';
  assert (select error from dsales.dsales_buyer_lookups where buyer_id = v_many) = 'too_many_phones', 'many-phone lookup marked';
  assert (select channel || '/' || customer || '/' || outer_user_id from dsales.dsales_rooms_v where ms_id = 139707) = 'Line/จริง/' || v_bid,
         'JST-only room in the view';
  assert (select count(*) from dsales.dsales_rooms_v where ms_id = 65298) = 1, 'room in both sources appears once';
  assert (select customer from dsales.dsales_rooms_v where ms_id = 65298) = 'หลายเบอร์', 'JST name wins';

  -- a chat_name link of the same pair is upgraded on the next save; JST is_expired closes LINE rooms → window_closed
  update dsales.dsales_chat_links set method = 'chat_name', confidence = 'medium' where ms_id = 139707 and phone_normalized = v_phone;
  set local role authenticated;
  perform dsales.dsales_worker_link_save('w', v_bid, jsonb_build_array(
    jsonb_build_object('ms_id', 139707, 'outer_user_id', v_bid, 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'จริง', 'expired', true),
    jsonb_build_object('ms_id', 9000000001, 'outer_user_id', v_bid, 'provider', 'Line', 'page', 'Bebeplayofficial', 'name', 'ใหม่', 'expired', true)));
  reset role;
  select * into t from dsales.dsales_outreach_room(v_phone, 'bebeplay');
  assert t.skip = 'window_closed' and t.ms_id is null, format('expired rooms are closed, got %s', row_to_json(t));
  assert (select method from dsales.dsales_chat_links where ms_id = 139707 and phone_normalized = v_phone) = 'buyer_id', 'name link upgraded';
  insert into _r values ('links', v_n::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 10_buyer_id_room_links' from _r;
rollback;
