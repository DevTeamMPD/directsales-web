begin;
-- dsales_room_customer_last (20261123110000): เวลาที่ลูกค้าทักล่าสุดของห้อง FB/IG ที่ผูกกับเบอร์ เก็บในตารางเล็ก (cron ทุก 10 นาที)
-- แทนการอ่าน iim_messages ตอนผู้ใช้กรอง/ดูห้อง · ผลหลัง refresh ต้องเท่ากับการคำนวณตรงจาก iim_messages,
-- dsales_sendable_rooms ต้องได้ชุดเดียวกับกติกาเดิม และเร็ว · ตารางภายในไม่ให้ authenticated อ่าน. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare v_sales uuid; v_n int; v_bad int; v_ok boolean; t0 timestamptz; v_secs numeric; v_phones text[];
begin
  t0 := clock_timestamp();
  v_n := dsales.dsales_refresh_room_customer_last();
  insert into _r values ('refresh_s', round(extract(epoch from clock_timestamp() - t0), 3)::text);
  select count(*) into v_n from dsales.dsales_room_customer_last;
  insert into _r values ('rooms', v_n::text);
  assert v_n > 0, 'refresh fills the table';

  -- every row = max customer message time computed straight from the messages view
  select count(*) into v_bad from dsales.dsales_room_customer_last c
  where c.last_customer_at is distinct from
        (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = c.ms_id and m.dir = 'customer');
  assert v_bad = 0, format('%s rooms differ from iim_messages', v_bad);
  -- exactly the linked Facebook / Instagram rooms
  select count(*) into v_bad from (
    (select distinct l.ms_id from dsales.dsales_chat_links l cross join lateral dsales.dsales_room_of(l.ms_id) s
     where lower(s.channel) in ('facebook', 'instagram'))
    except select ms_id from dsales.dsales_room_customer_last) x;
  assert v_bad = 0, format('%s linked FB/IG rooms missing', v_bad);
  -- a second run with nothing new writes nothing
  assert dsales.dsales_refresh_room_customer_last() = 0, 'unchanged rooms are not rewritten';

  -- dsales_sendable_rooms = old rule (customer message within dsales_meta_window() read from iim_messages)
  select count(*) into v_bad from (
    (select * from dsales.dsales_sendable_rooms()
     except
     select distinct l.phone_normalized, m.brand
     from dsales.dsales_chat_links l
     cross join lateral dsales.dsales_room_of(l.ms_id) s
     join (select b.key as brand, jsonb_array_elements_text(b.value) as page
           from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b) m on m.page = s.page
     where not s.expired
       and (lower(s.channel) not in ('facebook', 'instagram')
            or exists (select 1 from dsales.dsales_chat_messages_v cm
                       where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - dsales.dsales_meta_window())))
    union all
    (select distinct l.phone_normalized, m.brand
     from dsales.dsales_chat_links l
     cross join lateral dsales.dsales_room_of(l.ms_id) s
     join (select b.key as brand, jsonb_array_elements_text(b.value) as page
           from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b) m on m.page = s.page
     where not s.expired
       and (lower(s.channel) not in ('facebook', 'instagram')
            or exists (select 1 from dsales.dsales_chat_messages_v cm
                       where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - dsales.dsales_meta_window()))
     except
     select * from dsales.dsales_sendable_rooms())) x;
  assert v_bad = 0, format('sendable rooms differ from the old rule: %s rows', v_bad);

  t0 := clock_timestamp();
  perform count(*) from dsales.dsales_sendable_rooms();
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('sendable_s', round(v_secs, 3)::text);
  assert v_secs < 0.3, format('sendable rooms too slow: %s s', v_secs);

  select array_agg(p) into v_phones from (select distinct phone_normalized p from dsales.dsales_chat_links order by 1 limit 50) z;
  t0 := clock_timestamp();
  perform dsales.dsales_customer_rooms(p) from unnest(v_phones) p;
  perform (select to_jsonb(r) from dsales.dsales_outreach_room(p, 'bebeplay') r) from unnest(v_phones) p;
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('rooms_room_50_s', round(v_secs, 3)::text);
  assert v_secs < 0.5, format('customer_rooms + outreach_room x50 too slow: %s s', v_secs);

  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform 1 from dsales.dsales_room_customer_last limit 1; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'table not readable by authenticated';
  v_ok := false;
  begin perform dsales.dsales_refresh_room_customer_last(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'refresh not callable by authenticated';
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 14_room_customer_last' from _r;
rollback;
