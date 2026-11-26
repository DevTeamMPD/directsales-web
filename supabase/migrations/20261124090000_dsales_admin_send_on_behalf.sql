-- dsales: หัวหน้าส่งข้อความแทนเจ้าของลีดได้ (2026-11-24).
-- ผู้ใช้ต้องการให้หัวหน้าติ๊กลีดของเซลล์คนอื่นในหน้า Direct Sale แล้วส่งข้อความได้ (เดิมขึ้น "มีคนจองแล้ว" = taken)
-- กติกาใหม่ใน dsales_outreach_plan (ใช้ทั้ง preview และ enqueue):
--   - หัวหน้า + ลีดมีเจ้าของแล้ว (ใครก็ได้) -> ส่งได้ · enqueue ไม่จองแทน (owner คงเดิม) คิวผูกกับลีดนั้น requested_by = หัวหน้า
--     worker รายงาน sent -> บันทึกแชตในประวัติลีดโดย rep = หัวหน้า (dsales_worker_report เดิม)
--   - หัวหน้า + ลูกค้าเป็นของเซลล์อื่นตาม tag แต่ยังไม่มีลีดที่มีเจ้าของ -> ยัง taken (ไม่จองลูกค้าของคนอื่นมาเป็นของหัวหน้า)
--   - เซลล์: เหมือนเดิม (ส่งได้เฉพาะลูกค้า/ลีดของตัวเองหรือในถัง)
-- ส่วนอื่นของฟังก์ชันเหมือนนิยาม production 2026-11-24
-- Rollback: คืน dsales_outreach_plan เป็นนิยามเดิม (ตัด v_admin และเงื่อนไข "not (v_admin and v_lead_owner is not null)" / "not v_admin")

create or replace function dsales.dsales_outreach_plan(p_phones text[], p_template uuid, p_me uuid)
returns table (phone text, name text, lead_id uuid, ms_id bigint, page text, provider text, chat_name text, message text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare
  t dsales.dsales_templates; v_max int := coalesce((dsales.dsales_setting('outreach_max_batch') #>> '{}')::int, 50);
  ph text; v_skip text; v_msg text; v_product text;
  v_in_base boolean; v_base_name text; v_base_owner uuid;
  v_lead uuid; v_lead_owner uuid; v_lead_name text;
  v_ms bigint; v_page text; v_prov text; v_chat text;
  v_admin boolean := exists (select 1 from dsales.dsales_members m where m.user_id = p_me and m.role = 'admin' and m.active);
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  if (select count(distinct btrim(x)) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null) > v_max then
    raise exception 'batch_too_large';
  end if;

  for ph in select distinct btrim(x) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null loop
    v_skip := null; v_msg := null; v_ms := null; v_page := null; v_prov := null; v_chat := null;
    v_base_name := null; v_base_owner := null; v_lead := null; v_lead_owner := null; v_lead_name := null;
    select c.name, c.owner_id into v_base_name, v_base_owner from dsales.dsales_customer_base c where c.phone_normalized = ph;
    v_in_base := found;
    select x.id, x.owner_id, x.name into v_lead, v_lead_owner, v_lead_name from dsales.dsales_leads x where x.phone_normalized = ph;
    if not v_in_base and v_lead is null then v_skip := 'customer_not_found';
    elsif not (v_admin and v_lead_owner is not null) and v_base_owner is not null and v_base_owner <> p_me then v_skip := 'taken';
    elsif not v_admin and v_lead_owner is not null and v_lead_owner <> p_me then v_skip := 'taken';
    elsif exists (select 1 from dsales.dsales_outreach_queue q where q.phone_normalized = ph and q.status in ('queued', 'sending')) then
      v_skip := 'already_queued';
    else
      select r.ms_id, r.page, r.provider, r.chat_name, r.skip into v_ms, v_page, v_prov, v_chat, v_skip
      from dsales.dsales_outreach_room(ph, t.brand) r;
    end if;
    if v_skip is null then
      v_product := '';
      if position('{สินค้าล่าสุด}' in t.body) > 0 then
        select coalesce(p.product_name, '') into v_product from dsales.dsales_customer_purchases(ph) p order by p.txn_date desc nulls last limit 1;
      end if;
      v_msg := replace(replace(replace(t.body,
                 '{ชื่อ}', coalesce(nullif(btrim(coalesce(v_lead_name, v_base_name)), ''), '')),
                 '{ร้าน}', coalesce(v_page, '')),
                 '{สินค้าล่าสุด}', coalesce(v_product, ''));
    end if;
    return query select ph, coalesce(v_lead_name, v_base_name), v_lead, v_ms, v_page, v_prov, v_chat, v_msg, v_skip;
  end loop;
end $$;
