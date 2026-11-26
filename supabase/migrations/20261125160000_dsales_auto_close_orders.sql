-- dsales: ปิดการขายอัตโนมัติเมื่อมีออเดอร์/บิลหลังวันที่จอง (2026-11-25).
-- ปัญหา: Nantaporn Chaiphet ชำระแล้ว 24/11 มีบิลใน public.sales_transaction (ออเดอร์ 303461/303462) แต่ระบบดูบิลใหม่จาก
--   public.lendi_purchase_lines อย่างเดียว ซึ่งยังไม่มีบิลนี้ → ไม่ปิดการขาย (และ AI ไม่มีสิทธิ์ปิดการขายเอง)
-- 1) dsales_close_won_from_orders(p_leads default null) (ภายใน): ลีดที่มีเจ้าของ ยังไม่ won ไม่ห้ามโทร มี ds_since
--    บิลของลีด = sales_transaction ที่ bill_no ตรงกับ order_tracking.online_order ของเบอร์นั้น (รวมทุกพัสดุไม่นับซ้ำ)
--                + lendi_purchase_lines ของเบอร์นั้น (เฉพาะบิลที่ไม่เจอใน sales_transaction)
--    ยอดต่อแถว = amount (ถ้าว่าง = unit_price × quantity — sales_transaction ~26% ของแถวล่าสุด amount ว่าง)
--    เงื่อนไข: วันที่บิล ≥ วันที่จอง (เวลาไทย), ไม่ได้ Cancelled ทั้งบิล และยอดบิล > 0 (ของแถม/ส่งเคลม 0 บาท ไม่นับเป็นการขาย)
--    → status won, closed_bills = บิล, closed_amount = ยอดรวม, closed_at = วันที่บิลล่าสุด, last_seller_id = เจ้าของลีด
--      + interaction system (rep_id = เจ้าของ) "พบบิล … — ปิดการขายอัตโนมัติ"
-- 2) dsales_ai_close_orders(p_leads) — หัวหน้าเรียกจากปุ่มวิเคราะห์สถานะ (ก่อนส่งให้ AI)
-- 3) cron dsales-refresh-customer-base: เรียกข้อ 1 ก่อน release (ลีดที่มีบิลวันที่ 30 ได้ปิดการขาย ไม่ถูกคืน) — ผู้ใช้อนุมัติ 2026-11-25
-- Rollback: select cron.alter_job(51, command := 'select dsales.dsales_release_stale_leads(); select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();');
--   drop function dsales.dsales_ai_close_orders(uuid[]), dsales.dsales_close_won_from_orders(uuid[])

create or replace function dsales.dsales_close_won_from_orders(p_leads uuid[] default null) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare r record; v_out jsonb := '[]'::jsonb; l dsales.dsales_leads;
begin
  for r in
    with ld as (
      select x.id, x.phone_normalized, x.ds_since from dsales.dsales_leads x
      where x.owner_id is not null and x.status <> 'won' and not x.no_call and x.ds_since is not null
        and (p_leads is null or x.id = any (p_leads))
    ),
    ot as (
      select distinct ld.id as lead_id, btrim(o.online_order) as bill
      from ld join public.order_tracking o on o.phone = ld.phone_normalized
      where nullif(btrim(o.online_order), '') is not null
    ),
    st as (
      select ot.lead_id, ot.bill, max(s.txn_date) as d, sum(coalesce(s.amount, s.unit_price * coalesce(s.quantity, 1), 0)) as amt,
             bool_and(coalesce(s.order_status, '') = 'Cancelled') as cancelled
      from ot join public.sales_transaction s on btrim(s.bill_no) = ot.bill and nullif(btrim(s.bill_no), '') is not null
      group by 1, 2
    ),
    lp as (
      select ld.id as lead_id, btrim(p.bill_no) as bill, max(p.txn_date) as d, sum(coalesce(p.amount, p.estimated_amount, 0)) as amt,
             bool_and(coalesce(p.order_status, '') = 'Cancelled') as cancelled
      from ld join public.lendi_purchase_lines p on p.phone = ld.phone_normalized
      where nullif(btrim(p.bill_no), '') is not null
      group by 1, 2
    ),
    allb as (
      select * from st
      union all
      select * from lp where not exists (select 1 from st where st.lead_id = lp.lead_id and st.bill = lp.bill)
    )
    select a.lead_id, array_agg(a.bill order by a.bill) as bills, sum(a.amt) as amt, max(a.d) as d
    from allb a join ld on ld.id = a.lead_id
    where not a.cancelled and a.amt > 0 and a.d >= (ld.ds_since at time zone 'Asia/Bangkok')::date
    group by a.lead_id
  loop
    update dsales.dsales_leads set status = 'won', closed_bills = r.bills, closed_amount = r.amt, closed_at = r.d,
           last_seller_id = owner_id, callback_date = null, updated_at = now()
      where id = r.lead_id and status <> 'won' and owner_id is not null
      returning * into l;
    if not found then continue; end if;
    insert into dsales.dsales_interactions (lead_id, rep_id, type, result, note, bills)
      values (l.id, l.owner_id, 'system', 'won',
              'พบบิล ' || array_to_string(r.bills, ', ') || ' วันที่ ' || to_char(r.d, 'DD/MM/YYYY') || ' ยอด '
              || to_char(r.amt, 'FM999,999,990') || ' บาท หลังวันที่จอง — ปิดการขายอัตโนมัติ', r.bills);
    v_out := v_out || jsonb_build_object('id', l.id, 'name', l.name, 'bills', to_jsonb(r.bills), 'amount', r.amt, 'date', r.d);
  end loop;
  return v_out;
end $$;
revoke all on function dsales.dsales_close_won_from_orders(uuid[]) from public, anon, authenticated;

create or replace function dsales.dsales_ai_close_orders(p_leads uuid[]) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(cardinality(p_leads), 0) > 50 then raise exception 'batch_too_large'; end if;
  if coalesce(cardinality(p_leads), 0) = 0 then return '[]'::jsonb; end if;
  return dsales.dsales_close_won_from_orders(p_leads);
end $$;
revoke all on function dsales.dsales_ai_close_orders(uuid[]) from public, anon;
grant execute on function dsales.dsales_ai_close_orders(uuid[]) to authenticated;

select cron.alter_job(51, command := 'select dsales.dsales_close_won_from_orders(); select dsales.dsales_release_stale_leads(); select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();');
