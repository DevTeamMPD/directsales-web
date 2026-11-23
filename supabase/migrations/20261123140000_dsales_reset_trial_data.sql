-- dsales: คำสั่งล้างข้อมูลช่วงทดลองใช้ (2026-11-23).
-- ระบบยังอยู่ในช่วงทดลอง ผู้ใช้ต้องการล้างงานขายทั้งหมดก่อนเริ่มใช้จริง (หรือระหว่างทดลองซ้ำ)
-- ลบ: ประวัติโทร/แชต (dsales_interactions), คิว/ชุดส่งข้อความ (dsales_outreach_queue / _batches), ประวัติคืนลีดอัตโนมัติ
--     (dsales_lead_auto_releases ถ้ามี), ลีดทั้งหมด (dsales_leads), แคมเปญ (dsales_campaigns)
-- เก็บไว้: สมาชิก/สิทธิ์, การตั้งค่า, template ข้อความ, สถานะ worker, ฐานลูกค้า + เจ้าของตาม tag JST (คำนวณจาก JST), ห้องแชตที่ผูก
-- เรียกได้จาก SQL เท่านั้น (เว็บ/สมาชิกเรียกไม่ได้) และต้องส่งคำยืนยันตรงตัว:
--   select dsales.dsales_reset_trial_data('RESET DSALES TRIAL');
-- ** ลบถาวร กู้คืนไม่ได้ — เมื่อเริ่มใช้จริงแล้วควร drop function นี้ **
-- Rollback: drop function dsales.dsales_reset_trial_data(text);

create or replace function dsales.dsales_reset_trial_data(p_confirm text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  n_inter int; n_queue int; n_batches int; n_rel int := 0; n_leads int; n_camps int;
begin
  if p_confirm is distinct from 'RESET DSALES TRIAL' then
    raise exception 'confirm_required';
  end if;
  -- กันชนกับ cron refresh / การบันทึกของหัวหน้าที่กำลังรัน
  perform pg_advisory_xact_lock(hashtext('dsales_refresh_customer_base'));

  delete from dsales.dsales_interactions;      get diagnostics n_inter = row_count;
  delete from dsales.dsales_outreach_queue;    get diagnostics n_queue = row_count;
  delete from dsales.dsales_outreach_batches;  get diagnostics n_batches = row_count;
  if to_regclass('dsales.dsales_lead_auto_releases') is not null then
    execute 'delete from dsales.dsales_lead_auto_releases';
    get diagnostics n_rel = row_count;
  end if;
  delete from dsales.dsales_leads;             get diagnostics n_leads = row_count;
  delete from dsales.dsales_campaigns;         get diagnostics n_camps = row_count;

  return jsonb_build_object('interactions', n_inter, 'outreach_queue', n_queue, 'outreach_batches', n_batches,
                            'auto_releases', n_rel, 'leads', n_leads, 'campaigns', n_camps);
end $$;
revoke all on function dsales.dsales_reset_trial_data(text) from public, anon, authenticated;
