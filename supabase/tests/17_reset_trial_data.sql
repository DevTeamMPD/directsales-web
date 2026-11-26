begin;
-- dsales_reset_trial_data (20261123140000): ล้างข้อมูลช่วงทดลองใช้ (ลีด, ประวัติ, แคมเปญ, ชุดส่ง/คิว, ประวัติคืนลีด)
-- ต้องส่งคำยืนยันตรงตัว · เก็บสมาชิก, การตั้งค่า, template, ฐานลูกค้า, ห้องแชตที่ผูก · เว็บ/สมาชิกเรียกไม่ได้. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare v_admin uuid; v_ok boolean; j jsonb;
  n_members int; n_settings int; n_templates int; n_base int; n_links int;
begin
  select count(*) into n_members from dsales.dsales_members;
  select count(*) into n_settings from dsales.dsales_settings;
  select count(*) into n_templates from dsales.dsales_templates;
  select count(*) into n_base from dsales.dsales_customer_base;
  select count(*) into n_links from dsales.dsales_chat_links;

  -- ข้อมูลทดลองอย่างน้อย 1 แถวต่อตาราง (ไม่พึ่งข้อมูลจริงที่มีอยู่)
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active limit 1;
  insert into dsales.dsales_campaigns (name, brand) values ('TEST reset', 'bebeplay');
  insert into dsales.dsales_leads (brand, name, phone, phone_normalized, owner_id, status)
    values ('bebeplay', 'TEST reset', '0899999971', '0899999971', v_admin, 'new');
  insert into dsales.dsales_interactions (lead_id, rep_id, type)
    select id, v_admin, 'call' from dsales.dsales_leads where phone = '0899999971';

  -- คำยืนยันผิด → ไม่ลบอะไร
  v_ok := false;
  begin perform dsales.dsales_reset_trial_data('yes'); exception when others then v_ok := sqlerrm = 'confirm_required'; end;
  assert v_ok, 'wrong confirmation is refused';
  assert exists (select 1 from dsales.dsales_leads where phone = '0899999971'), 'nothing deleted on refusal';

  -- สมาชิก (แม้เป็นหัวหน้า) เรียกไม่ได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_reset_trial_data('RESET DSALES TRIAL'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'not callable by authenticated';
  reset role;

  j := dsales.dsales_reset_trial_data('RESET DSALES TRIAL');
  insert into _r values ('result', j::text);
  assert (j ->> 'leads')::int >= 1 and (j ->> 'campaigns')::int >= 1 and (j ->> 'interactions')::int >= 1, format('counts, got %s', j);

  assert not exists (select 1 from dsales.dsales_leads), 'leads cleared';
  assert not exists (select 1 from dsales.dsales_interactions), 'interactions cleared';
  assert not exists (select 1 from dsales.dsales_campaigns), 'campaigns cleared';
  assert not exists (select 1 from dsales.dsales_outreach_batches), 'batches cleared';
  assert not exists (select 1 from dsales.dsales_outreach_queue), 'queue cleared';
  if to_regclass('dsales.dsales_lead_auto_releases') is not null then
    execute 'select not exists (select 1 from dsales.dsales_lead_auto_releases)' into v_ok;
    assert v_ok, 'auto releases cleared';
  end if;

  assert (select count(*) from dsales.dsales_members) = n_members, 'members kept';
  assert (select count(*) from dsales.dsales_settings) = n_settings, 'settings kept';
  assert (select count(*) from dsales.dsales_templates) = n_templates, 'templates kept';
  assert (select count(*) from dsales.dsales_customer_base) = n_base, 'customer base kept';
  assert (select count(*) from dsales.dsales_chat_links) = n_links, 'chat links kept';
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 17_reset_trial_data' from _r;
rollback;
