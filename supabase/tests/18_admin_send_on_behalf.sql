begin;
-- หัวหน้าส่งข้อความแทนเจ้าของลีดได้ (20261124090000): ลีดที่มีเจ้าของเป็นเซลล์คนอื่น หัวหน้าส่งได้โดยลีดยังเป็นของเจ้าของเดิม
-- เซลล์ยังส่งได้เฉพาะของตัวเอง · ลูกค้าที่เป็นของเซลล์อื่นตาม tag แต่ยังไม่มีลีด หัวหน้าส่งไม่ได้ (taken — ไม่จองแทน). Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; v_s2 uuid; v_tpl uuid; v_phones text[]; v_owned text; v_tagonly text; v_lead uuid;
  p jsonb; e jsonb;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_s2 from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_s1 order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true), (v_s2, 'sales', 'S2', true);
  insert into dsales.dsales_templates (brand, name, body, created_by)
    values ('bebeplay', 'ทดสอบ', 'สวัสดีค่ะคุณ{ชื่อ}', v_admin) returning id into v_tpl;

  -- เบอร์ในถัง (ไม่มีเจ้าของ ไม่มีลีด) ที่มีห้อง Bebeplay ส่งได้
  select array_agg(phone_normalized) into v_phones from (
    select distinct l.phone_normalized
    from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
    join dsales.dsales_customer_base b on b.phone_normalized = l.phone_normalized
    where s.page in ('Bebeplayofficial', 'SH_bebeplay', 'LA_bebeplay') and b.owner_id is null
      and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized)
      and not exists (select 1 from dsales.dsales_excluded_customers(l.phone_normalized)) -- ลูกค้าเคส CS/B2B ถูกข้ามตั้งแต่ 20261125120000
      and exists (select 1 from dsales.dsales_outreach_room(l.phone_normalized, 'bebeplay') r where r.skip is null)
    limit 2) t;
  assert cardinality(v_phones) = 2, 'need 2 pool phones with a sendable Bebeplay room';
  v_owned := v_phones[1];
  v_tagonly := v_phones[2];
  -- v_owned: ลีดของ s1 (และเป็นของ s1 ตาม tag) · v_tagonly: ของ s1 ตาม tag แต่ยังไม่มีลีด
  update dsales.dsales_customer_base set owner_id = v_s1 where phone_normalized in (v_owned, v_tagonly);
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบส่งแทน', v_owned, v_owned, v_s1, v_s1, now(), v_s1) returning id into v_lead;

  set local role authenticated;
  -- เซลล์คนอื่น: taken
  perform set_config('request.jwt.claims', json_build_object('sub', v_s2, 'role', 'authenticated')::text, true);
  p := dsales.dsales_outreach_preview(array[v_owned], v_tpl);
  assert p -> 0 ->> 'skip' = 'taken', format('other sales rep -> taken, got %s', p);
  -- เจ้าของ: ส่งได้
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  p := dsales.dsales_outreach_preview(array[v_owned], v_tpl);
  assert p -> 0 ->> 'skip' is null, format('owner can send, got %s', p);
  -- หัวหน้า: ลีดของ s1 ส่งได้ · ของ s1 ตาม tag ที่ยังไม่มีลีด = taken
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  p := dsales.dsales_outreach_preview(array[v_owned, v_tagonly], v_tpl);
  assert (select x ->> 'skip' from jsonb_array_elements(p) x where x ->> 'phone' = v_owned) is null, format('admin can send for s1 lead, got %s', p);
  assert (select x ->> 'skip' from jsonb_array_elements(p) x where x ->> 'phone' = v_tagonly) = 'taken', format('admin cannot claim a tag-owned customer, got %s', p);
  e := dsales.dsales_enqueue_outreach(array[v_owned, v_tagonly], v_tpl);
  reset role;
  insert into _r values ('enqueue', e::text);
  assert (e ->> 'queued')::int = 1, format('one queued, got %s', e);
  assert (select owner_id = v_s1 and claimed_by = v_s1 from dsales.dsales_leads where id = v_lead), 'lead stays with s1';
  assert (select requested_by = v_admin and lead_id = v_lead from dsales.dsales_outreach_queue where phone_normalized = v_owned and status = 'queued'),
         'queue row on the s1 lead, requested by the admin';
  assert not exists (select 1 from dsales.dsales_leads where phone_normalized = v_tagonly), 'no lead claimed for the tag-owned customer';
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 18_admin_send_on_behalf' from _r;
rollback;
