-- dsales: หน้า Direct Sale แสดงกลุ่มลูกค้า RFM + "ไม่ซื้อมา N วัน" เหมือนหน้าลูกค้าของฉัน (2026-11-26).
-- dsales_lead_json คืนเพิ่ม 2 key จาก dsales_customer_base ของเบอร์เดียวกับลีด (ค่าเดียวกับที่ dsales_base_customers คืนให้ /mine /pool):
--   'rfm' = customer_base.rfm (กลุ่มตาม dsales_rfm — 20261125140000) · 'dormantDays' = customer_base.dormant_days
--   เบอร์ที่ไม่อยู่ในฐานลูกค้า = null ทั้งคู่
-- ไม่คำนวณจาก lastBuy/orders ของลีดเอง เพราะนับจาก lendi_purchase_lines ซึ่งไม่ตรงกับฐานลูกค้า
--   (ตรวจ 2026-11-26: ลีดที่มีเจ้าของ 120 ราย กลุ่มต่างกัน 27 ราย)
-- ส่วนอื่นของฟังก์ชันเหมือน 20261125130000 ทุกตัวอักษร · สิทธิ์เดิม (ไม่ grant ให้ authenticated — เรียกผ่าน RPC อื่น)
-- Rollback: สร้าง dsales_lead_json จาก 20261125130000 ใหม่

create or replace function dsales.dsales_lead_json(l dsales.dsales_leads) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  select jsonb_build_object(
    'id', l.id, 'name', l.name, 'phone', l.phone, 'address', l.address, 'shop', l.shop, 'chatName', l.chat_name, 'channels', l.channels,
    'brand', l.brand, 'source', l.source, 'campaignId', l.campaign_id, 'owner', l.owner_id, 'status', l.status, 'callback', l.callback_date,
    'interest', coalesce(l.interest, ''), 'closedBills', to_jsonb(l.closed_bills), 'closedAmount', l.closed_amount, 'closedAt', l.closed_at,
    'claimedBy', l.claimed_by, 'claimedAt', l.claimed_at, 'noCall', l.no_call, 'noCallBy', l.no_call_by, 'noCallAt', l.no_call_at,
    'releasedBy', to_jsonb(l.released_by), 'autoSkip', l.auto_skip, 'identityId', l.identity_id, 'dsSince', case when l.owner_id is not null then l.ds_since end,
    'ai', l.ai,
    'bills', coalesce(pl.bills, '[]'::jsonb), 'total', coalesce(pl.total, 0), 'lastBuy', pl.last_buy, 'orders', coalesce(pl.orders, 0),
    'rfm', cb.rfm, 'dormantDays', cb.dormant_days,
    'interactions', coalesce(ix.items, '[]'::jsonb))
  from (select 1) x
  left join dsales.dsales_customer_base cb on cb.phone_normalized = l.phone_normalized
  left join lateral (
    select to_jsonb(coalesce((array_agg(distinct nullif(btrim(p.bill_no), '') order by nullif(btrim(p.bill_no), '') desc))[1:6], '{}'::text[])) as bills,
           sum(coalesce(p.amount, p.estimated_amount)) as total, max(p.txn_date) as last_buy,
           count(distinct coalesce(nullif(btrim(p.bill_no), ''), p.order_no)) as orders
    from public.lendi_purchase_lines p where p.phone = l.phone_normalized) pl on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', i.id, 'type', i.type, 'date', i.created_at, 'rep', i.rep_id, 'result', i.result, 'note', i.note, 'due', i.due, 'bills', to_jsonb(i.bills)) order by i.created_at) as items
    from (select * from dsales.dsales_interactions where lead_id = l.id order by created_at desc limit 30) i) ix on true
$$;
