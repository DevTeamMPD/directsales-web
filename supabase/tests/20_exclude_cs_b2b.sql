begin;
-- ลูกค้าเคสบริการ/เคลม + B2B ไม่ถูกดึงเป็นลีด (20261125120000): ห้องแชตที่ผูกกับเบอร์มี tag ใน excluded_room_tags
-- หรือขึ้นต้นด้วย excluded_room_tag_prefixes (CS_) หรือ customer_base.segment = 'b2b'
-- = หายจากถัง/ฐานลูกค้า, จองไม่ได้ (cs_customer), ส่งข้อความเป็นชุดข้าม (cs_customer)
-- และลีดที่จองไว้แล้ว (ยกเว้น won) ถูกคืน + ตั้งไม่สะดวกให้โทร + ยกเลิกคิวที่รอส่ง. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_s1 uuid; v_tpl uuid; v_batch uuid;
  v_cs text; v_cs2 text; v_won text; v_b2b text; v_ok boolean; v_n bigint; v_reason text;
  v_lead uuid; v_wlead uuid; v_q uuid; p jsonb; l dsales.dsales_leads;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true);

  -- เบอร์ที่มีห้อง tag 'แจ้งปัญหา' (อยู่ในฐาน ยังไม่มีลีด ไม่มีเจ้าของตาม tag) และเบอร์ที่มีห้อง tag CS_* (ไม่มี tag ชุด exact)
  select cl.phone_normalized into v_cs
  from dsales.dsales_chat_links cl join public.iim_sessions s on s.ms_id = cl.ms_id
  join dsales.dsales_customer_base b on b.phone_normalized = cl.phone_normalized and b.eligible and b.owner_id is null
  where s.tags @> '[{"text": "แจ้งปัญหา"}]'
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = cl.phone_normalized)
  order by cl.phone_normalized limit 1;
  select cl.phone_normalized into v_cs2
  from dsales.dsales_chat_links cl join public.iim_sessions s on s.ms_id = cl.ms_id
  join dsales.dsales_customer_base b on b.phone_normalized = cl.phone_normalized and b.eligible
  where exists (select 1 from jsonb_array_elements(s.tags) e where e.value ->> 'text' like 'CS\_%')
    and not exists (select 1 from dsales.dsales_chat_links c2 join public.iim_sessions s2 on s2.ms_id = c2.ms_id
                    cross join lateral jsonb_array_elements(s2.tags) e2
                    where c2.phone_normalized = cl.phone_normalized
                      and e2.value ->> 'text' in ('มาจากเซ็นทรัล', 'มาจาก OFFLINE', 'แจ้งปัญหา', 'Customer Service'))
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = cl.phone_normalized)
    and cl.phone_normalized <> coalesce(v_cs, '')
  order by cl.phone_normalized limit 1;
  select cl.phone_normalized into v_won
  from dsales.dsales_chat_links cl join public.iim_sessions s on s.ms_id = cl.ms_id
  where s.tags @> '[{"text": "แจ้งปัญหา"}]'
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = cl.phone_normalized)
    and cl.phone_normalized not in (coalesce(v_cs, ''), coalesce(v_cs2, ''))
  order by cl.phone_normalized limit 1;
  select b.phone_normalized into v_b2b from dsales.dsales_customer_base b where b.segment = 'b2b' and b.eligible order by 1 limit 1;
  assert v_cs is not null and v_cs2 is not null and v_won is not null, 'need tagged phones';
  insert into _r values ('cs', v_cs), ('cs2', v_cs2), ('b2b', coalesce(v_b2b, '-'));

  -- 1) ชุดเบอร์ที่ถูกตัด + เหตุผล
  select reason into v_reason from dsales.dsales_excluded_customers() where phone = v_cs;
  assert v_reason = 'แจ้งปัญหา', format('reason for tagged phone, got %s', v_reason);
  select reason into v_reason from dsales.dsales_excluded_customers(v_cs2);
  assert v_reason like 'CS\_%', format('CS_ prefix, got %s', v_reason);
  if v_b2b is not null then
    assert exists (select 1 from dsales.dsales_excluded_customers(v_b2b) where reason = 'B2B'), 'b2b excluded';
  end if;

  -- ลีดของ S1 บน v_cs2 + คิวที่รอส่ง · ลีด won บน v_won
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, created_by)
    values ('self', 'bebeplay', 'TEST cs', v_cs2, v_cs2, v_s1, v_s1, now(), 'following', v_s1) returning id into v_lead;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, status, closed_bills, created_by)
    values ('self', 'bebeplay', 'TEST won', v_won, v_won, v_s1, v_s1, now(), 'won', array['TESTBILL'], v_s1) returning id into v_wlead;
  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 'ทดสอบ', 'สวัสดีค่ะ', v_admin) returning id into v_tpl;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand, total) values (v_s1, v_tpl, 'bebeplay', 1) returning id into v_batch;
  insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, message_text, requested_by)
    values (v_batch, v_lead, v_cs2, 1, 'x', v_s1) returning id into v_q;

  -- 2) ถัง/ฐานลูกค้า: ไม่เห็นเบอร์ที่ถูกตัด (ทุก scope)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_base_customers('team', v_cs, 10, 0, null, '{}'::jsonb) r where r.phone = v_cs;
  assert v_n = 0, 'base_customers hides tagged customer';
  if v_b2b is not null then
    select count(*) into v_n from dsales.dsales_base_customers('team', v_b2b, 10, 0, null, '{}'::jsonb) r where r.phone = v_b2b;
    assert v_n = 0, 'base_customers hides b2b';
  end if;
  select count(*) into v_n from dsales.dsales_customer_pool_v4(v_cs, 10, 0) r where r.phone = v_cs;
  assert v_n = 0, 'pool_v4 hides tagged customer';
  assert exists (select 1 from dsales.dsales_base_customers('team', null, 1, 0, null, '{}'::jsonb)), 'others still listed';

  -- 3) ส่งข้อความเป็นชุด: ข้าม cs_customer
  p := dsales.dsales_outreach_preview(array[v_cs], v_tpl);
  assert p -> 0 ->> 'skip' = 'cs_customer', format('outreach skip cs_customer, got %s', p);

  -- 4) จองไม่ได้ (เซลล์และหัวหน้า)
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_claim_customer(v_cs, 'bebeplay'); exception when others then v_ok := sqlerrm = 'cs_customer'; end;
  assert v_ok, 'claim_customer -> cs_customer';
  reset role;

  -- 5) คืนลีดที่จองไว้: ไม่ใช่ won -> ไม่มีเจ้าของ + ไม่สะดวกให้โทร + บันทึกระบบ + ยกเลิกคิว · won คงเดิม
  v_n := dsales.dsales_release_excluded_leads();
  insert into _r values ('released', v_n::text);
  assert v_n >= 1, 'at least the test lead released';
  select * into l from dsales.dsales_leads where id = v_lead;
  assert l.owner_id is null and l.claimed_by is null and l.status = 'new' and l.no_call and l.ds_since is null, format('released lead, got %s', row_to_json(l));
  assert exists (select 1 from dsales.dsales_interactions i where i.lead_id = v_lead and i.type = 'system' and i.rep_id = v_s1 and i.note like '%CS\_%'),
         'system note with the tag';
  assert (select status = 'cancelled' and error = 'cs_customer' from dsales.dsales_outreach_queue where id = v_q), 'queued row cancelled';
  assert (select owner_id = v_s1 and status = 'won' from dsales.dsales_leads where id = v_wlead), 'won lead kept';
  assert not exists (select 1 from dsales.dsales_lead_auto_releases where lead_id = v_lead), 'no cooldown row';
  perform dsales.dsales_release_excluded_leads();
  assert (select count(*) from dsales.dsales_interactions i where i.lead_id = v_lead and i.type = 'system') = 1,
         'second run does not release the same lead again';

  -- 6) จองลีดที่ถูกคืนไม่ได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_claim_lead(v_lead); exception when others then v_ok := sqlerrm = 'cs_customer'; end;
  assert v_ok, 'claim_lead -> cs_customer';
  reset role;

  -- 7) cron ตัวเดิมเรียกการคืนนี้ด้วย
  assert position('dsales_release_excluded_leads' in pg_get_functiondef('dsales.dsales_release_stale_leads()'::regprocedure)) > 0,
         'release_stale_leads calls release_excluded_leads';

  -- 8) ตั้งค่าได้: เอา prefix CS_ ออก -> v_cs2 ไม่ถูกตัดแล้ว
  update dsales.dsales_settings set value = '[]'::jsonb where key = 'excluded_room_tag_prefixes';
  assert not exists (select 1 from dsales.dsales_excluded_customers(v_cs2)), 'prefix list is configurable';

  -- 9) เว็บเรียกฟังก์ชันภายในไม่ได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_release_excluded_leads(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'release_excluded_leads not callable by authenticated';
  v_ok := false;
  begin perform * from dsales.dsales_excluded_customers(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'excluded_customers not callable by authenticated';
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 20_exclude_cs_b2b' from _r;
rollback;
