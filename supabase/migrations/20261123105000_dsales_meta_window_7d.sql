-- dsales: ช่วงส่งข้อความ Facebook / Instagram ผ่าน JST = 7 วันหลังข้อความล่าสุดของลูกค้า (2026-11-23).
-- ผู้ใช้ทดสอบแล้วว่า JST ส่งข้อความถึงลูกค้า FB/IG ได้ภายใน 7 วันหลังข้อความสุดท้ายของลูกค้า (เดิมระบบใช้ 24 ชม.)
-- ตั้งได้ด้วย setting meta_window_hours (ค่าเริ่ม 168) ผ่าน dsales_meta_window() — ฟังก์ชันที่ตัดสิน "ส่งได้" ทั้ง 3 ตัวใช้ค่านี้:
-- dsales_sendable_rooms (ตัวกรอง "ส่งแชตได้"), dsales_customer_rooms (ไอคอนจาง/ไม่จาง, sendable), dsales_outreach_room (เลือกห้องตอนส่ง)
-- เนื้อฟังก์ชันอื่นเหมือนเวอร์ชันล่าสุด (20261123060000 / 20261123080000 / 20261123063000) เปลี่ยนเฉพาะ interval '24 hours'
-- Rollback: คืน 3 ฟังก์ชันจาก migration ข้างบน · drop function dsales.dsales_meta_window() · delete setting meta_window_hours

insert into dsales.dsales_settings (key, value) values ('meta_window_hours', '168'::jsonb)
on conflict (key) do nothing;

-- ช่วงเวลาหลังข้อความล่าสุดของลูกค้าที่ยังส่งถึงห้อง FB/IG ได้ — SQL ธรรมดา (ไม่มี security definer/SET) ให้ inline ได้
create or replace function dsales.dsales_meta_window() returns interval
language sql stable as $$
  select make_interval(hours => coalesce((dsales.dsales_setting('meta_window_hours') #>> '{}')::int, 168))
$$;
revoke all on function dsales.dsales_meta_window() from public, anon, authenticated;

create or replace function dsales.dsales_sendable_rooms()
returns table (phone_normalized text, brand text)
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), r as materialized (
    select l.phone_normalized, s.ms_id, lower(s.channel) as channel, s.page
    from dsales.dsales_chat_links l
    join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where not s.expired
  )
  select distinct r.phone_normalized, m.brand
  from r
  join map m on m.page = r.page
  left join lateral (
    select 1 as ok from dsales.dsales_chat_messages_v cm
    where r.channel in ('facebook', 'instagram')
      and cm.ms_id = r.ms_id and cm.dir = 'customer' and cm.time > now() - dsales.dsales_meta_window()
    limit 1
  ) w on true
  where r.channel not in ('facebook', 'instagram') or w.ok is not null
$$;
revoke all on function dsales.dsales_sendable_rooms() from public, anon, authenticated;

create or replace function dsales.dsales_customer_rooms(p_phone text) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), rooms as (
    select s.ms_id, s.channel, s.page, s.last_time, s.customer, m.brand, s.outer_user_id,
           lower(s.channel) in ('facebook', 'instagram') as meta,
           m.brand is not null and not s.expired and (lower(s.channel) not in ('facebook', 'instagram')
             or exists (select 1 from dsales.dsales_chat_messages_v cm
                        where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - dsales.dsales_meta_window())) as sendable
    from dsales.dsales_chat_links l
    cross join lateral dsales.dsales_room_of(l.ms_id) s
    left join map m on m.page = s.page
    where l.phone_normalized = p_phone
  )
  select coalesce(jsonb_agg(jsonb_build_object('ms_id', r.ms_id, 'provider', lower(r.channel), 'page', r.page,
                                               'brand', r.brand, 'sendable', r.sendable, 'name', r.customer)
                            || case when r.meta then jsonb_build_object(
                                 'outer_user_id', r.outer_user_id,
                                 'meta_page_id', dsales.dsales_setting('meta_page_ids') ->> r.page,
                                 'meta_business_id', dsales.dsales_setting('meta_business_id') #>> '{}') else '{}'::jsonb end
                            order by r.sendable desc, r.last_time desc nulls last), '[]'::jsonb)
  from rooms r
$$;
revoke all on function dsales.dsales_customer_rooms(text) from public, anon, authenticated;

create or replace function dsales.dsales_outreach_room(p_phone text, p_brand text)
returns table (ms_id bigint, page text, provider text, chat_name text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_any boolean;
begin
  return query
  with pages as (
    select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand) as page
  ), rooms as (
    select s.ms_id, s.page, s.channel as provider, s.customer as chat_name, s.last_time,
           case lower(s.channel) when 'line' then 1 when 'shopee' then 2 when 'lazada' then 2 when 'tiktok' then 2 else 3 end as rnk,
           s.expired
           or (lower(s.channel) in ('facebook', 'instagram')
               and coalesce((select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer'),
                            '-infinity'::timestamptz) < now() - dsales.dsales_meta_window()) as closed
    from dsales.dsales_chat_links l
    cross join lateral dsales.dsales_room_of(l.ms_id) s
    where l.phone_normalized = p_phone and s.page in (select p.page from pages p)
  )
  select r.ms_id, r.page, r.provider, r.chat_name, null::text
  from rooms r where not r.closed order by r.rnk, r.last_time desc nulls last limit 1;
  if found then return; end if;

  select exists (
    select 1 from dsales.dsales_chat_links l cross join lateral dsales.dsales_room_of(l.ms_id) s
    where l.phone_normalized = p_phone
      and s.page in (select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand))
  ) into v_any;
  return query select null::bigint, null::text, null::text, null::text, case when v_any then 'window_closed' else 'no_chat_room' end;
end $$;
revoke all on function dsales.dsales_outreach_room(text, text) from public, anon, authenticated;
