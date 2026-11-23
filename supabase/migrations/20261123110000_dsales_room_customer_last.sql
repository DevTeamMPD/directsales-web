-- dsales: เวลาที่ลูกค้าทักล่าสุดของห้อง FB/IG เก็บในตารางเล็กของเราเอง (2026-11-23).
-- ปัญหา: ตัวกรอง "ส่งแชตได้" (dsales_sendable_rooms) ตรวจช่วง 24 ชม. ของ Meta ด้วยการอ่าน iim_messages (~740k แถว ตารางของ
-- ระบบอื่น) ทีละห้อง ~1,400 ห้อง — ปกติ ~0.1 วินาที แต่ตอนข้อมูลไม่อยู่ใน cache ใช้ 5–12 วินาที (เกิน statement_timeout 8 วินาที
-- ของ authenticated) เห็น 4 ครั้งในวันที่ 2026-11-23
-- ทางแก้: dsales_refresh_room_customer_last() (pg_cron ทุก 10 นาที) คำนวณ max(time) ของข้อความลูกค้า (dir = customer) ของห้อง
-- FB/IG ที่ผูกกับเบอร์ เก็บใน dsales_room_customer_last (เขียนเฉพาะห้องที่ค่าเปลี่ยน / ลบห้องที่ไม่ผูกแล้ว) แล้ว
-- dsales_sendable_rooms / dsales_customer_rooms / dsales_outreach_room อ่านตารางนี้แทน iim_messages
-- ผลข้างเคียง: ช้ากว่าความจริงได้ไม่เกิน ~10 นาที (+ ระยะที่ระบบอื่นดึงแชตเข้า iim_messages) — ลูกค้าเพิ่งทักใน 10 นาทีล่าสุด
-- อาจยังนับว่า "ส่งไม่ได้" จนรอบถัดไป (ด้านปลอดภัย) · ห้องที่เพิ่งผูกใหม่นับว่าส่งไม่ได้จนรอบถัดไป
-- iim_messages.id ไม่เรียงตามเวลา (เป็น id จาก JST) และไม่มีคอลัมน์เวลาบันทึก จึงอ่านแบบ "เฉพาะที่ใหม่กว่า id ล่าสุด" ไม่ได้
-- Rollback: cron.unschedule('dsales-room-customer-last'); คืนฟังก์ชัน 3 ตัวจาก 20261123060000 / 20261123080000; drop table + function

create table if not exists dsales.dsales_room_customer_last (
  ms_id bigint primary key,
  last_customer_at timestamptz,
  refreshed_at timestamptz not null default now()
);
alter table dsales.dsales_room_customer_last enable row level security;
revoke all on dsales.dsales_room_customer_last from public, anon, authenticated;

-- คืนจำนวนห้องที่เขียน (เพิ่ม/เปลี่ยน/ลบ) — 0 = ไม่มีอะไรเปลี่ยน
create or replace function dsales.dsales_refresh_room_customer_last() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_n int;
begin
  with r as materialized (
    select distinct l.ms_id
    from dsales.dsales_chat_links l
    cross join lateral dsales.dsales_room_of(l.ms_id) s
    where lower(s.channel) in ('facebook', 'instagram')
  ), v as materialized (
    select r.ms_id,
           (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = r.ms_id and m.dir = 'customer') as t
    from r
  ), del as (
    delete from dsales.dsales_room_customer_last x where not exists (select 1 from r where r.ms_id = x.ms_id)
    returning 1
  ), up as (
    insert into dsales.dsales_room_customer_last as c (ms_id, last_customer_at, refreshed_at)
    select v.ms_id, v.t, now() from v
    on conflict (ms_id) do update set last_customer_at = excluded.last_customer_at, refreshed_at = now()
      where c.last_customer_at is distinct from excluded.last_customer_at
    returning 1
  )
  select (select count(*) from del) + (select count(*) from up) into v_n;
  return v_n;
end $$;
revoke all on function dsales.dsales_refresh_room_customer_last() from public, anon, authenticated;

-- ห้อง FB/IG ที่ลูกค้าทักมาใน 24 ชม. (จากตาราง) — SQL function ธรรมดาให้ planner inline เป็น index lookup
create or replace function dsales.dsales_meta_open(p_ms_id bigint) returns boolean
language sql stable as $$
  select exists (select 1 from dsales.dsales_room_customer_last c
                 where c.ms_id = p_ms_id and c.last_customer_at > now() - interval '24 hours')
$$;
revoke all on function dsales.dsales_meta_open(bigint) from public, anon, authenticated;

create or replace function dsales.dsales_sendable_rooms()
returns table (phone_normalized text, brand text)
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  )
  select distinct l.phone_normalized, m.brand
  from dsales.dsales_chat_links l
  cross join lateral dsales.dsales_room_of(l.ms_id) s
  join map m on m.page = s.page
  where not s.expired
    and (lower(s.channel) not in ('facebook', 'instagram') or dsales.dsales_meta_open(s.ms_id))
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
           m.brand is not null and not s.expired
             and (lower(s.channel) not in ('facebook', 'instagram') or dsales.dsales_meta_open(s.ms_id)) as sendable
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
           s.expired or (lower(s.channel) in ('facebook', 'instagram') and not dsales.dsales_meta_open(s.ms_id)) as closed
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

-- เติมตารางครั้งแรก แล้วตั้ง cron ทุก 10 นาที
select dsales.dsales_refresh_room_customer_last();
select cron.schedule('dsales-room-customer-last', '*/10 * * * *', $cron$select dsales.dsales_refresh_room_customer_last()$cron$);
