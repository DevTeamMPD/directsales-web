-- dsales: คืนลีดอัตโนมัติเมื่ออยู่ใน Direct Sale ครบ 30 วันแล้วยังไม่ปิดการขาย (2026-11-23).
-- ปัญหา: เซลล์ "ดอง" ลูกค้าไว้ใน Direct Sale นาน ๆ (ยอดค่าคอมนับเฉพาะลูกค้าที่อยู่ใน Direct Sale — spec 2026-11-23 ข้อ 2)
-- การตัดสินใจ (ผู้ใช้ยืนยัน 2026-11-23, แผน docs/superpowers/plans/2026-11-23-direct-sale-30-day-release.md):
--   1) นับ 30 วันจากวันที่ลีดเข้า Direct Sale ของเจ้าของคนปัจจุบัน (จอง / ส่งเข้า Direct Sale / หัวหน้ามอบหมาย) เข้าใหม่ = นับใหม่
--   2) ลีด won ไม่ถูกคืน สถานะอื่นทั้งหมดถูกคืน (owner = null, status = new, ล้าง callback/claimed)
--   3) หลังถูกคืน เซลล์คนเดิมจองลีดนั้นเองไม่ได้ 30 วัน (raise 'release_cooldown') — คนอื่นจองได้ หัวหน้ามอบหมายได้
--   4) การคืนบันทึกในประวัติลีด (dsales_interactions.type = 'system', rep_id = เจ้าของเดิม)
--   5) (review) ยกเลิกจองแล้วจองใหม่ไม่ทำให้เริ่มนับใหม่ · หัวหน้าไม่ติด cooldown (จองเองหรือมอบหมายได้เสมอ)
-- โครงสร้าง:
--   - dsales_leads.ds_since = เวลาที่เข้า Direct Sale ของเจ้าของปัจจุบัน ตั้งโดย trigger BEFORE INSERT OR UPDATE OF owner_id
--     จึงครอบทุก RPC ที่ตั้งเจ้าของ (claim_customer / claim_lead / assign_lead / unclaim_lead / set_nocall / enqueue) โดยไม่ต้องแก้ RPC
--     เจ้าของเดิมจองซ้ำ (owner ไม่เปลี่ยน) ไม่เริ่มนับใหม่ · backfill ลีดที่มีเจ้าของ = coalesce(claimed_at, created_at)
--     (ตรวจ 2026-11-23: 76 ลีดมีเจ้าของ เก่าสุด 5 วัน — ไม่มีลีดถูกคืนทันที)
--   - dsales_lead_auto_releases = ประวัติการคืนอัตโนมัติ (ใช้ตรวจ cooldown) ภายใน ไม่มี grant
--   - dsales_release_stale_leads() เรียกจาก cron เดิม dsales-refresh-customer-base (cron.alter_job ทำแยกหลังผู้ใช้อนุมัติ — ไม่อยู่ในไฟล์นี้)
--   - setting ds_max_days (ค่าเริ่ม 30) ใช้ทั้งระยะคืนและระยะ cooldown
--   - dsales_lead_json เพิ่ม dsSince (นิยามอื่นคงเดิมตาม production 2026-11-23)
-- หมายเหตุ: การคืนอัตโนมัติไม่เพิ่มเจ้าของเดิมใน released_by ("คัดออก" ด้วยมือ = ซ่อนถาวร) เพราะ cooldown มีกำหนด 30 วัน
-- enqueue ที่เจอ release_cooldown จะข้ามเบอร์นั้นเป็น 'claim_failed' (exception ถูกจับรายเบอร์อยู่แล้ว)
-- Rollback: drop trigger dsales_leads_ds_since on dsales.dsales_leads; drop function dsales.dsales_leads_ds_since(),
--   dsales.dsales_release_stale_leads(); drop table dsales.dsales_lead_auto_releases; delete from dsales.dsales_interactions
--   where type = 'system' แล้วคืน constraint dsales_interactions_type_check เป็น ('call','chat'); คืน dsales_lead_json เป็น
--   นิยามในข้อ 7 โดยตัด 'dsSince' ออก (= production ก่อน migration นี้); alter table dsales.dsales_leads drop column ds_since, drop column ds_owner; delete setting ds_max_days

-- 1) คอลัมน์ + backfill (ปิด trigger touch ชั่วคราวเพื่อไม่ให้ updated_at ของลีดเดิมเปลี่ยน)
-- ds_owner = เจ้าของที่นาฬิกา ds_since เป็นของเขา (คงไว้หลังยกเลิกจอง เพื่อกันการยกเลิกแล้วจองใหม่เพื่อเริ่มนับใหม่)
alter table dsales.dsales_leads add column if not exists ds_since timestamptz;
alter table dsales.dsales_leads add column if not exists ds_owner uuid;
alter table dsales.dsales_leads disable trigger dsales_leads_touch;
update dsales.dsales_leads set ds_since = coalesce(claimed_at, created_at), ds_owner = owner_id where owner_id is not null and ds_since is null;
alter table dsales.dsales_leads enable trigger dsales_leads_touch;

-- 2) ประวัติการคืนอัตโนมัติ (ภายใน)
create table if not exists dsales.dsales_lead_auto_releases (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references dsales.dsales_leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  released_at timestamptz not null default now()
);
create index if not exists dsales_lead_auto_releases_lead_user on dsales.dsales_lead_auto_releases (lead_id, user_id, released_at desc);
alter table dsales.dsales_lead_auto_releases enable row level security;
revoke all on dsales.dsales_lead_auto_releases from public, anon, authenticated;

-- 3) setting
insert into dsales.dsales_settings (key, value) values ('ds_max_days', '30'::jsonb) on conflict (key) do nothing;

-- 4) interactions: เพิ่มชนิด system (dsales_log ยังรับเฉพาะ call/chat — client เขียน system ไม่ได้)
alter table dsales.dsales_interactions drop constraint if exists dsales_interactions_type_check;
alter table dsales.dsales_interactions add constraint dsales_interactions_type_check check (type = any (array['call', 'chat', 'system']));

-- 5) trigger: ตั้ง ds_since + cooldown ของเซลล์ที่เพิ่งถูกคืน
-- security definer: หัวหน้าอัปเดต dsales_leads ตรงได้ (policy admin_write) ต้องอ่าน dsales_settings / auto_releases ที่ไม่มี grant
-- กติกา (v_self = เซลล์จองเอง: auth.uid() = เจ้าของใหม่ และไม่ใช่หัวหน้า — หัวหน้า/cron/มอบหมาย ไม่ติดกติกานี้):
--   owner -> null (ยกเลิกจอง/คืน): คง ds_since/ds_owner ไว้ (dsales_release_stale_leads ล้างเองหลังคืนอัตโนมัติ)
--   owner เดิม: คงนาฬิกา
--   v_self + เพิ่งถูกคืนลีดนี้อัตโนมัติภายใน ds_max_days -> 'release_cooldown'
--   v_self + เป็นเจ้าของนาฬิกาเดิม (ยกเลิกแล้วจองใหม่): นาฬิกายังไม่หมด -> นับต่อ · หมดแล้วไม่เกิน ds_max_days -> 'release_cooldown'
--     (เท่ากับถูกคืนตอนครบกำหนด) · เกินกว่านั้น -> เริ่มนับใหม่
--   นอกนั้น: เริ่มนับใหม่ (now())
create or replace function dsales.dsales_leads_ds_since() returns trigger
language plpgsql security definer set search_path = dsales, public as $$
declare v_days int; v_self boolean;
begin
  if new.owner_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.owner_id is not distinct from new.owner_id then
    new.ds_since := coalesce(new.ds_since, old.ds_since, now());
    new.ds_owner := new.owner_id;
    return new;
  end if;
  v_self := auth.uid() is not null and new.owner_id = auth.uid() and not dsales.dsales_is_admin();
  if tg_op = 'UPDATE' and v_self then
    select coalesce((value #>> '{}')::int, 30) into v_days from dsales.dsales_settings where key = 'ds_max_days';
    v_days := coalesce(v_days, 30);
    if exists (select 1 from dsales.dsales_lead_auto_releases r
               where r.lead_id = new.id and r.user_id = new.owner_id
                 and r.released_at > now() - make_interval(days => v_days)) then
      raise exception 'release_cooldown';
    end if;
    if old.ds_owner = new.owner_id and old.ds_since is not null then
      if old.ds_since > now() - make_interval(days => v_days) then
        new.ds_since := old.ds_since;
        new.ds_owner := new.owner_id;
        return new;
      elsif old.ds_since > now() - make_interval(days => 2 * v_days) then
        raise exception 'release_cooldown';
      end if;
    end if;
  end if;
  new.ds_since := now();
  new.ds_owner := new.owner_id;
  return new;
end $$;
revoke all on function dsales.dsales_leads_ds_since() from public, anon, authenticated;

drop trigger if exists dsales_leads_ds_since on dsales.dsales_leads;
create trigger dsales_leads_ds_since before insert or update of owner_id on dsales.dsales_leads
  for each row execute function dsales.dsales_leads_ds_since();

-- 6) คืนลีดที่ครบกำหนด (cron เท่านั้น) — คืนจำนวนลีดที่คืน
create or replace function dsales.dsales_release_stale_leads() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_days int; v_n int;
begin
  select coalesce((value #>> '{}')::int, 30) into v_days from dsales.dsales_settings where key = 'ds_max_days';
  v_days := coalesce(v_days, 30);
  with s as (
    select l.id, l.owner_id from dsales.dsales_leads l
    where l.owner_id is not null and l.status <> 'won' and l.ds_since < now() - make_interval(days => v_days)
    for update skip locked
  ), ar as (
    insert into dsales.dsales_lead_auto_releases (lead_id, user_id) select s.id, s.owner_id from s
  ), ix as (
    insert into dsales.dsales_interactions (lead_id, type, note, rep_id)
    select s.id, 'system', format('ครบ %s วันยังไม่ปิดการขาย — คืนอัตโนมัติ', v_days), s.owner_id from s
  ), up as (
    update dsales.dsales_leads l set owner_id = null, claimed_by = null, claimed_at = null, status = 'new', callback_date = null,
        ds_since = null, ds_owner = null, updated_at = now()
    from s where l.id = s.id
    returning 1
  )
  select count(*) into v_n from up;
  return v_n;
end $$;
revoke all on function dsales.dsales_release_stale_leads() from public, anon, authenticated;

-- 7) dsales_lead_json + dsSince (ส่วนอื่นเหมือนนิยาม production 2026-11-23)
create or replace function dsales.dsales_lead_json(l dsales.dsales_leads) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  select jsonb_build_object(
    'id', l.id, 'name', l.name, 'phone', l.phone, 'address', l.address, 'shop', l.shop, 'chatName', l.chat_name, 'channels', l.channels,
    'brand', l.brand, 'source', l.source, 'campaignId', l.campaign_id, 'owner', l.owner_id, 'status', l.status, 'callback', l.callback_date,
    'interest', coalesce(l.interest, ''), 'closedBills', to_jsonb(l.closed_bills), 'closedAmount', l.closed_amount, 'closedAt', l.closed_at,
    'claimedBy', l.claimed_by, 'claimedAt', l.claimed_at, 'noCall', l.no_call, 'noCallBy', l.no_call_by, 'noCallAt', l.no_call_at,
    'releasedBy', to_jsonb(l.released_by), 'autoSkip', l.auto_skip, 'identityId', l.identity_id, 'dsSince', case when l.owner_id is not null then l.ds_since end,
    'bills', coalesce(pl.bills, '[]'::jsonb), 'total', coalesce(pl.total, 0), 'lastBuy', pl.last_buy, 'orders', coalesce(pl.orders, 0),
    'interactions', coalesce(ix.items, '[]'::jsonb))
  from (select 1) x
  left join lateral (
    select to_jsonb(coalesce((array_agg(distinct nullif(btrim(p.bill_no), '') order by nullif(btrim(p.bill_no), '') desc))[1:6], '{}'::text[])) as bills,
           sum(coalesce(p.amount, p.estimated_amount)) as total, max(p.txn_date) as last_buy,
           count(distinct coalesce(nullif(btrim(p.bill_no), ''), p.order_no)) as orders
    from public.lendi_purchase_lines p where p.phone = l.phone_normalized) pl on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', i.id, 'type', i.type, 'date', i.created_at, 'rep', i.rep_id, 'result', i.result, 'note', i.note, 'due', i.due, 'bills', to_jsonb(i.bills)) order by i.created_at) as items
    from (select * from dsales.dsales_interactions where lead_id = l.id order by created_at desc limit 30) i) ix on true
$$;
