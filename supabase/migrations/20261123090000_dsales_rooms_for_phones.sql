-- dsales: ห้องแชตของหลายเบอร์สำหรับหน้า Direct Sale (2026-11-23, spec 2026-11-23-direct-sale-followup-design.md ข้อ 5.2).
-- คืน (phone, rooms) โดย rooms = dsales_customer_rooms(phone) (ms_id, provider, page, brand, sendable, name,
-- และ outer_user_id / meta_page_id / meta_business_id ของ FB/IG) เฉพาะเบอร์ของลีดที่ผู้เรียกเป็นเจ้าของ — หัวหน้าได้ทุกเบอร์
-- เบอร์ซ้ำ/ว่างถูกตัด · เกิน 100 เบอร์ = too_many_phones (หน้าเว็บแบ่งส่งทีละ 100)
-- dsales_customer_rooms อ่านห้องผ่าน dsales_room_of (inline + index) จึงเร็ว (~0.5 ms/เบอร์)

create or replace function dsales.dsales_rooms_for_phones(p_phones text[])
returns table (phone text, rooms jsonb)
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin(); v_list text[];
begin
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_list
  from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null;
  if cardinality(v_list) > 100 then raise exception 'too_many_phones'; end if;
  return query
  select p, dsales.dsales_customer_rooms(p)
  from unnest(v_list) p
  where v_admin or exists (select 1 from dsales.dsales_leads l where l.phone_normalized = p and l.owner_id = me);
end $$;

revoke all on function dsales.dsales_rooms_for_phones(text[]) from public, anon;
grant execute on function dsales.dsales_rooms_for_phones(text[]) to authenticated;
