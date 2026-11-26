begin;
-- ช่วงส่งข้อความ FB/IG (20261123105000): ตั้งได้ด้วย setting meta_window_hours (ค่าเริ่ม 168 ชม. = 7 วัน — JST ส่งได้ภายใน
-- 7 วันหลังข้อความล่าสุดของลูกค้า) · ห้อง FB/IG ที่ลูกค้าทักล่าสุด 1–7 วันก่อน ต้องส่งได้ที่ค่า 168 และส่งไม่ได้ที่ค่า 24. Rolled back.
create temp table _r (k text, v text) on commit drop;
do $$
declare v_phone text; v_ms bigint; v_brand text; j jsonb; t record;
begin
  assert dsales.dsales_meta_window() = interval '168 hours', format('default window, got %s', dsales.dsales_meta_window());

  -- ห้อง FB/IG ที่ผูกกับเบอร์ อยู่บนเพจของแบรนด์ และลูกค้าทักล่าสุด 2–6 วันก่อน (เบอร์นี้มีห้องเดียว จะได้ตรวจ outreach_room ชัด)
  select l.phone_normalized, s.ms_id, m.brand into v_phone, v_ms, v_brand
  from dsales.dsales_chat_links l
  cross join lateral dsales.dsales_room_of(l.ms_id) s
  join (select b.key as brand, jsonb_array_elements_text(b.value) as page
        from jsonb_each(dsales.dsales_setting('page_brand_map')) b) m on m.page = s.page
  where lower(s.channel) in ('facebook', 'instagram') and not s.expired
    and (select max(cm.time) from dsales.dsales_chat_messages_v cm where cm.ms_id = s.ms_id and cm.dir = 'customer')
        between now() - interval '6 days' and now() - interval '2 days'
    and (select count(*) from dsales.dsales_chat_links l2 where l2.phone_normalized = l.phone_normalized) = 1
  limit 1;
  assert v_phone is not null, 'fixture: a FB/IG room whose customer wrote 2-6 days ago';
  insert into _r values ('ms_id', v_ms::text);

  -- 7 วัน: ส่งได้
  j := dsales.dsales_customer_rooms(v_phone);
  assert (j -> 0 ->> 'sendable')::boolean, format('7-day window: sendable, got %s', j);
  select * into t from dsales.dsales_outreach_room(v_phone, v_brand);
  assert t.skip is null and t.ms_id = v_ms, format('7-day window: room picked, got %s', row_to_json(t));
  assert exists (select 1 from dsales.dsales_sendable_rooms() r where r.phone_normalized = v_phone and r.brand = v_brand), '7-day window: in sendable rooms';

  -- 24 ชม. (ค่าเดิม): ส่งไม่ได้
  insert into dsales.dsales_settings (key, value) values ('meta_window_hours', '24'::jsonb)
    on conflict (key) do update set value = excluded.value;
  assert dsales.dsales_meta_window() = interval '24 hours', 'setting changes the window';
  j := dsales.dsales_customer_rooms(v_phone);
  assert not (j -> 0 ->> 'sendable')::boolean, format('24 h window: not sendable, got %s', j);
  select * into t from dsales.dsales_outreach_room(v_phone, v_brand);
  assert t.skip = 'window_closed', format('24 h window: window_closed, got %s', row_to_json(t));
  assert not exists (select 1 from dsales.dsales_sendable_rooms() r where r.phone_normalized = v_phone and r.brand = v_brand), '24 h window: not in sendable rooms';
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 15_meta_window' from _r;
rollback;
