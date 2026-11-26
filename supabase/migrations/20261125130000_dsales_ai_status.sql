-- dsales: ปุ่ม "วิเคราะห์สถานะ (AI)" ของหัวหน้าในหน้า Direct Sale (2026-11-25).
-- เว็บ (API route ฝั่ง server) อ่านข้อมูลลีด → ส่งให้ Claude Haiku 5.5 → ส่งผลกลับมาบันทึกที่นี่ · DB ไม่เรียก AI เอง
-- 1) interactions ชนิด 'ai' (เขียนได้เฉพาะ RPC ในไฟล์นี้) · dsales_leads.ai = ผลวิเคราะห์ล่าสุด (สรุปให้ตาราง/ป้ายเตือน + ย้อนกลับ)
-- 2) dsales_ai_runs = ประวัติการรัน (จำนวนลีด, token) ใช้คุมเพดานต่อวัน · settings ai_daily_limit (300 ลีด/วัน), ai_min_confidence (0.7)
-- 3) dsales_ai_status_context(p_leads): ข้อมูลที่ AI อ่าน ต่อ 1 ลีด (หัวหน้าเท่านั้น ≤ 50 ลีด/ครั้ง, เช็กเพดานต่อวัน)
-- 4) dsales_ai_status_apply(p_results, p_usage, p_context_at): บันทึกผล — เปลี่ยนสถานะเฉพาะความมั่นใจ ≥ ai_min_confidence,
--    ห้ามปิดการขาย/ตั้งเป็น new, ข้ามลีดที่ปิดการขายแล้ว/ไม่มีเจ้าของ/มีคนบันทึกการติดต่อหลังเวลาที่อ่านข้อมูล
-- 5) dsales_ai_status_undo(p_lead): ย้อนสถานะที่ AI เปลี่ยน (เฉพาะถ้ายังเป็นสถานะที่ AI ตั้ง)
-- 6) dsales_lead_json เพิ่ม 'ai' (ส่วนอื่นเหมือน 20261123130000)
-- Rollback: drop function dsales.dsales_ai_status_undo(uuid), dsales.dsales_ai_status_apply(jsonb, jsonb, timestamptz),
--   dsales.dsales_ai_status_context(uuid[]), dsales.dsales_ai_msg_text(text, text); drop table dsales.dsales_ai_runs;
--   delete from dsales.dsales_interactions where type = 'ai' แล้วคืน check เป็น ('call','chat','system');
--   คืน dsales_lead_json จาก 20261123130000; alter table dsales.dsales_leads drop column ai; delete settings ai_daily_limit, ai_min_confidence

-- 1) interactions 'ai' + คอลัมน์ ai
alter table dsales.dsales_interactions drop constraint if exists dsales_interactions_type_check;
alter table dsales.dsales_interactions add constraint dsales_interactions_type_check check (type = any (array['call', 'chat', 'system', 'ai']));
alter table dsales.dsales_leads add column if not exists ai jsonb;

-- 2) ประวัติการรัน (ภายใน) + settings
create table if not exists dsales.dsales_ai_runs (
  id uuid primary key default gen_random_uuid(),
  run_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  analysed integer not null default 0,
  changed integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  model text
);
create index if not exists dsales_ai_runs_created on dsales.dsales_ai_runs (created_at desc);
alter table dsales.dsales_ai_runs enable row level security;
revoke all on dsales.dsales_ai_runs from public, anon, authenticated;
insert into dsales.dsales_settings (key, value) values ('ai_daily_limit', '300'::jsonb), ('ai_min_confidence', '0.7'::jsonb)
  on conflict (key) do nothing;

-- ข้อความแชตเป็นบรรทัดอ่านง่าย (รูป/สติกเกอร์/แม่แบบ → ป้ายสั้น) ตัดที่ 300 ตัวอักษร
create or replace function dsales.dsales_ai_msg_text(p_fmt text, p_text text) returns text
language plpgsql immutable set search_path = dsales, public as $$
declare j jsonb;
begin
  if coalesce(p_fmt, 'txt') = 'txt' then return left(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'), 300); end if;
  begin j := p_text::jsonb; exception when others then j := null; end;
  if p_fmt = 'image' then return '[รูปภาพ]'; end if;
  if j ? 'text' and nullif(btrim(j ->> 'text'), '') is not null then
    return '[' || coalesce(j ->> 'simple', p_fmt) || '] ' || left(regexp_replace(j ->> 'text', '\s+', ' ', 'g'), 200);
  end if;
  return '[' || coalesce(j ->> 'simple', p_fmt) || ']';
end $$;
revoke all on function dsales.dsales_ai_msg_text(text, text) from public, anon, authenticated;

-- 3) ข้อมูลที่ AI อ่าน
create or replace function dsales.dsales_ai_status_context(p_leads uuid[]) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_limit int := coalesce((select (value #>> '{}')::int from dsales.dsales_settings where key = 'ai_daily_limit'), 300);
  v_used int;
  v_n int := coalesce(cardinality(p_leads), 0);
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if v_n > 50 then raise exception 'batch_too_large'; end if;
  select coalesce(sum(analysed), 0) into v_used from dsales.dsales_ai_runs
    where created_at >= (v_today::timestamp at time zone 'Asia/Bangkok');
  if v_used + v_n > v_limit then raise exception 'ai_daily_limit'; end if;

  return coalesce((
    select jsonb_agg(x.j order by x.ord)
    from (
      select u.ord, jsonb_build_object(
        'id', l.id, 'name', l.name, 'brand', l.brand, 'status', l.status, 'callback', l.callback_date,
        'owner', (select m.display_name from dsales.dsales_members m where m.user_id = l.owner_id),
        'dsSince', to_char(l.ds_since at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI'),
        'today', v_today,
        'lastAiAt', l.ai ->> 'at',
        'logs', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'at', to_char(i.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI'), 'type', i.type,
                   'result', i.result, 'note', left(coalesce(i.note, ''), 300), 'due', i.due,
                   'rep', (select m.display_name from dsales.dsales_members m where m.user_id = i.rep_id)) order by i.created_at)
          from (select * from dsales.dsales_interactions where lead_id = l.id and type in ('call', 'chat')
                order by created_at desc limit 10) i), '[]'::jsonb),
        'buys', coalesce((
          select jsonb_agg(jsonb_build_object('date', p.txn_date, 'product', left(coalesce(p.product_name, p.sku, ''), 80),
                                              'amount', coalesce(p.amount, p.estimated_amount)) order by p.txn_date desc)
          from (select * from public.lendi_purchase_lines where phone = l.phone_normalized
                order by txn_date desc nulls last limit 6) p), '[]'::jsonb),
        'newBills', coalesce((
          select jsonb_agg(distinct btrim(p.bill_no))
          from public.lendi_purchase_lines p
          where p.phone = l.phone_normalized and nullif(btrim(p.bill_no), '') is not null and l.ds_since is not null
            and p.txn_date >= (l.ds_since at time zone 'Asia/Bangkok')::date), '[]'::jsonb),
        'chat', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'at', to_char(c.time at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI'),
                   'who', case when c.dir = 'customer' then 'ลูกค้า' else 'แอดมิน' end,
                   'text', dsales.dsales_ai_msg_text(c.fmt, c.text)) order by c.time)
          from (select m.time, m.dir, m.fmt, m.text
                from dsales.dsales_chat_links cl join dsales.dsales_chat_messages_v m on m.ms_id = cl.ms_id
                where cl.phone_normalized = l.phone_normalized
                  and m.time >= coalesce(l.ds_since, now()) - interval '120 days'
                order by m.time desc limit 40) c), '[]'::jsonb),
        'lastActivity', greatest(
          (select max(m.time) from dsales.dsales_chat_links cl join dsales.dsales_chat_messages_v m on m.ms_id = cl.ms_id
            where cl.phone_normalized = l.phone_normalized),
          (select max(i.created_at) from dsales.dsales_interactions i where i.lead_id = l.id and i.type in ('call', 'chat')))
      ) as j
      from unnest(p_leads) with ordinality as u(id, ord)
      join dsales.dsales_leads l on l.id = u.id
      where l.owner_id is not null and l.status <> 'won'
    ) x), '[]'::jsonb);
end $$;
revoke all on function dsales.dsales_ai_status_context(uuid[]) from public, anon;
grant execute on function dsales.dsales_ai_status_context(uuid[]) to authenticated;

-- 4) บันทึกผล
create or replace function dsales.dsales_ai_status_apply(p_results jsonb, p_usage jsonb, p_context_at timestamptz) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_uid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_min numeric := coalesce((select (value #>> '{}')::numeric from dsales.dsales_settings where key = 'ai_min_confidence'), 0.7);
  r jsonb; l dsales.dsales_leads; v_id uuid; v_new text; v_conf numeric; v_due date; v_apply boolean; v_note text; v_flags jsonb;
  v_changed int := 0; v_kept int := 0; v_skipped jsonb := '[]'::jsonb; v_run uuid;
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_results) <> 'array' then raise exception 'invalid_input'; end if;

  for r in select * from jsonb_array_elements(p_results) loop
    v_id := nullif(r ->> 'lead_id', '')::uuid;
    select * into l from dsales.dsales_leads where id = v_id for update;
    if not found or l.owner_id is null then
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'not_owned'); continue;
    end if;
    if l.status = 'won' then
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'won'); continue;
    end if;
    if p_context_at is not null and exists (select 1 from dsales.dsales_interactions i
         where i.lead_id = l.id and i.type in ('call', 'chat') and i.created_at > p_context_at) then
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'changed_meanwhile'); continue;
    end if;

    v_new := coalesce(r ->> 'status', 'keep');
    if v_new not in ('following', 'callback', 'unreachable', 'lost', 'keep') then v_new := 'keep'; end if;
    v_conf := least(greatest(coalesce((r ->> 'confidence')::numeric, 0), 0), 1);
    v_due := case when (r ->> 'callback_date') ~ '^\d{4}-\d{2}-\d{2}$' then (r ->> 'callback_date')::date end;
    if v_due is not null and v_due < v_today then v_due := null; end if;
    if v_new = 'callback' and v_due is null and l.callback_date >= v_today then v_due := l.callback_date; end if;
    v_apply := v_new <> 'keep' and v_conf >= v_min
               and (v_new <> l.status or (v_new = 'callback' and v_due is distinct from l.callback_date));
    v_flags := case when jsonb_typeof(r -> 'flags') = 'array' then r -> 'flags' else '[]'::jsonb end;

    update dsales.dsales_leads set
      status = case when v_apply then v_new else status end,
      callback_date = case when v_apply then (case when v_new = 'callback' then v_due end) else callback_date end,
      ai = jsonb_build_object(
        'at', now(), 'by', me, 'status', v_new, 'applied', v_apply, 'confidence', v_conf,
        'prevStatus', l.status, 'prevCallback', l.callback_date, 'callback', v_due,
        'interest', left(coalesce(r ->> 'interest', ''), 300), 'reason', left(coalesce(r ->> 'reason', ''), 600),
        'flags', v_flags, 'nextAction', left(coalesce(r ->> 'next_action', ''), 300))
    where id = l.id;

    v_note := left(coalesce(r ->> 'reason', ''), 600)
      || coalesce((select string_agg(E'\n⚠ ' || left(f, 200), '') from jsonb_array_elements_text(v_flags) f), '')
      || case when nullif(btrim(r ->> 'next_action'), '') is not null then E'\n→ ' || left(r ->> 'next_action', 300) else '' end;
    insert into dsales.dsales_interactions (lead_id, rep_id, type, result, note, due)
      values (l.id, me, 'ai', case when v_apply then v_new else 'keep' end, v_note, case when v_apply and v_new = 'callback' then v_due end);
    if v_apply then v_changed := v_changed + 1; else v_kept := v_kept + 1; end if;
  end loop;

  insert into dsales.dsales_ai_runs (run_by, analysed, changed, input_tokens, output_tokens, model)
    values (me, coalesce((p_usage ->> 'analysed')::int, jsonb_array_length(p_results)), v_changed,
            coalesce((p_usage ->> 'input_tokens')::int, 0), coalesce((p_usage ->> 'output_tokens')::int, 0), p_usage ->> 'model')
    returning id into v_run;
  return jsonb_build_object('run', v_run, 'changed', v_changed, 'kept', v_kept, 'skipped', v_skipped);
end $$;
revoke all on function dsales.dsales_ai_status_apply(jsonb, jsonb, timestamptz) from public, anon;
grant execute on function dsales.dsales_ai_status_apply(jsonb, jsonb, timestamptz) to authenticated;

-- 5) ย้อนกลับ
create or replace function dsales.dsales_ai_status_undo(p_lead uuid) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads;
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if not coalesce((l.ai ->> 'applied')::boolean, false) or l.status is distinct from l.ai ->> 'status' then
    raise exception 'ai_nothing_to_undo';
  end if;
  update dsales.dsales_leads set status = l.ai ->> 'prevStatus', callback_date = nullif(l.ai ->> 'prevCallback', '')::date,
         ai = l.ai || jsonb_build_object('applied', false, 'undoneAt', now(), 'undoneBy', me)
    where id = l.id returning * into l;
  insert into dsales.dsales_interactions (lead_id, rep_id, type, result, note)
    values (l.id, me, 'ai', 'undo', 'ย้อนกลับผล AI: ' || (l.ai ->> 'status') || ' → ' || (l.ai ->> 'prevStatus'));
  return dsales.dsales_lead_json(l);
end $$;
revoke all on function dsales.dsales_ai_status_undo(uuid) from public, anon;
grant execute on function dsales.dsales_ai_status_undo(uuid) to authenticated;

-- 6) dsales_lead_json + ai
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
