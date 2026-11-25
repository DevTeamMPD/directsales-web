begin;
-- หัวหน้าดูในมุมมองเซลล์ + ทำแทน (20261125150000): log นับให้เจ้าของลีด, base_customers as, segment_counts p_as,
-- claim_customer p_for, preview/enqueue p_for · เซลล์ใช้ p_for/as ไม่ได้. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; v_s2 uuid; v_tpl uuid; v_phones text[]; v_lead uuid; j jsonb; e jsonb; v_ok boolean; v_n bigint; v_sum bigint;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_s2 from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_s1 order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true), (v_s2, 'sales', 'S2', true);
  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 'ทดสอบ', 'สวัสดีค่ะคุณ{ชื่อ}', v_admin) returning id into v_tpl;

  -- เบอร์ในถังที่ส่งแชต Bebeplay ได้ และไม่ถูกตัด (CS/B2B)
  select array_agg(phone_normalized) into v_phones from (
    select distinct l.phone_normalized
    from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
    join dsales.dsales_customer_base b on b.phone_normalized = l.phone_normalized
    where s.page in ('Bebeplayofficial', 'SH_bebeplay', 'LA_bebeplay') and b.owner_id is null and b.eligible
      and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized)
      and not exists (select 1 from dsales.dsales_excluded_customers(l.phone_normalized))
      and exists (select 1 from dsales.dsales_outreach_room(l.phone_normalized, 'bebeplay') r where r.skip is null)
    limit 3) t;
  assert cardinality(v_phones) = 3, 'need 3 sendable pool phones';
  -- v_phones[1] = ลูกค้าของ s1 ตาม tag (ยังไม่มีลีด) · [2] = ลีดของ s1 · [3] = ถังกลาง
  update dsales.dsales_customer_base set owner_id = v_s1 where phone_normalized in (v_phones[1], v_phones[2]);
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบทำแทน', v_phones[2], v_phones[2], v_s1, v_s1, now(), v_s1) returning id into v_lead;

  set local role authenticated;
  -- 1) เซลล์ใช้ as / p_for ไม่ได้
  perform set_config('request.jwt.claims', json_build_object('sub', v_s2, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_base_customers('mine', null, 1, 0, null, jsonb_build_object('as', v_s1)); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales rep cannot view as another rep';
  v_ok := false;
  begin perform dsales.dsales_claim_customer(v_phones[3], 'bebeplay', null, v_s1); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales rep cannot claim for another rep';

  -- 2) หัวหน้าดูลูกค้าของ s1 (ตาม tag + ลีด) และจำนวนบนชิปตรงกัน
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select max(total_count) into v_n from dsales.dsales_base_customers('mine', null, 1, 0, null, jsonb_build_object('as', v_s1));
  select coalesce(sum(n), 0) into v_sum from dsales.dsales_base_segment_counts('mine', null, v_s1);
  assert v_n >= 2 and v_sum = v_n, format('view as s1: %s rows, counts %s', v_n, v_sum);
  assert (select bool_and(r.mine) from dsales.dsales_base_customers('mine', null, 100, 0, null, jsonb_build_object('as', v_s1)) r), 'rows are mine of s1';

  -- 3) ส่งข้อความในนาม s1: ลูกค้าตาม tag ของ s1 ไม่ taken, จองให้ s1, requested_by = หัวหน้า
  j := dsales.dsales_outreach_preview(array[v_phones[1], v_phones[2]], v_tpl, v_s1);
  assert (select bool_and(x ->> 'skip' is null) from jsonb_array_elements(j) x), format('preview as s1, got %s', j);
  e := dsales.dsales_enqueue_outreach(array[v_phones[1]], v_tpl, v_s1);
  assert (e ->> 'queued')::int = 1, format('enqueue as s1, got %s', e);

  -- 4) จองให้ s2 จากถังกลาง
  j := dsales.dsales_claim_customer(v_phones[3], 'bebeplay', null, v_s2);
  assert j ->> 'owner' = v_s2::text, format('claimed for s2, got %s', j ->> 'owner');

  -- 5) บันทึกปิดการขายแทน s1 → ผลงานของ s1
  j := dsales.dsales_log(v_lead, 'call', 'ปิดการขาย', 'แทนเซลล์', 'won', null, null, array['B-TEST-1'], 1000);
  reset role;
  assert (select owner_id = v_s1 and created_by = v_admin from dsales.dsales_leads where phone_normalized = v_phones[1]), 'tag customer claimed for s1 by admin';
  assert (select requested_by = v_admin from dsales.dsales_outreach_queue where phone_normalized = v_phones[1] and status = 'queued'), 'queue requested by admin';
  assert (select rep_id = v_s1 and logged_by = v_admin from dsales.dsales_interactions where lead_id = v_lead and type = 'call'), 'interaction credited to s1, logged by admin';
  assert (select last_seller_id = v_s1 and status = 'won' from dsales.dsales_leads where id = v_lead), 'sale credited to s1';

  -- 6) เซลล์บันทึกเอง: logged_by ว่าง
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s2, 'role', 'authenticated')::text, true);
  j := dsales.dsales_log((select id from dsales.dsales_leads where phone_normalized = v_phones[3]), 'chat', 'ทักแล้ว', null, 'following', null, null, null, null);
  reset role;
  assert (select rep_id = v_s2 and logged_by is null from dsales.dsales_interactions where lead_id = (select id from dsales.dsales_leads where phone_normalized = v_phones[3])), 'own log: logged_by null';
  insert into _r values ('as_s1_rows', v_n::text), ('enqueue', e::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 23_admin_view_as' from _r;
rollback;
