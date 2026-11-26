-- dsales: กติกากลุ่มลูกค้า RFM อยู่ในตาราง (แก้ได้) + Action Context ต่อกลุ่ม + ข้อมูลของหน้า /rfm (2026-11-26)
-- spec: docs/superpowers/specs/2026-11-26-rfm-page-design.md (ข้อ 3, 4.1, 4.2, 4.3 เฉพาะ config_get / rfm_map)
-- 1) dsales_rfm_segments: 10 กลุ่มคงที่ เช็กตาม sort_order ข้อแรกที่ตรง = กลุ่มนั้น, Lost = fallback รับที่เหลือ
--    seed = กติกาเดิมของ dsales_rfm (20261125140000) + แยก Hot (ซื้อครั้งเดียว 0–30 วัน) ออกจาก Warm
-- 2) dsales_rfm(orders, days) อ่านกติกาจากตาราง (stable) · dsales_customer_base.rfm เลิกเป็น generated,
--    trigger ตั้งค่าเมื่อ insert / update order_count, dormant_days (refresh ของ cron ไม่ต้องแก้) · dsales_rfm_apply() คำนวณทั้งตาราง
-- 3) dsales_rfm_config_get(): กติกา + Action Context ให้เว็บ (สมาชิกทุกคน)
-- 4) dsales_rfm_map(p_scope, p_brand, p_as): จำนวนลูกค้าต่อกลุ่มของหน้า /rfm — n = ทุกคนที่อยู่ในขอบเขต,
--    contactable = เฉพาะ eligible (ไม่ซื้อมา >= 30 วัน) ขอบเขต/แบรนด์/ตัด CS-B2B เหมือน dsales_base_segment_counts
-- Rollback: drop function dsales.dsales_rfm_map(text, text, uuid), dsales.dsales_rfm_config_get(), dsales.dsales_rfm_apply();
--   drop trigger dsales_customer_base_set_rfm on dsales.dsales_customer_base; drop function dsales.dsales_customer_base_set_rfm();
--   สร้าง dsales_rfm แบบ immutable จาก 20261125140000 ใหม่; alter table dsales.dsales_customer_base drop column rfm,
--   add column rfm text generated always as (dsales.dsales_rfm(order_count, dormant_days)) stored; drop table dsales.dsales_rfm_segments

-- 1)
create table if not exists dsales.dsales_rfm_segments (
  key text primary key,
  sort_order integer not null unique,
  f_min integer, f_max integer, r_min integer, r_max integer,
  is_fallback boolean not null default false,
  tone text not null default '',
  behavior text not null default '',
  action text not null default '',
  template_bebeplay uuid references dsales.dsales_templates(id) on delete set null,
  template_hosttail uuid references dsales.dsales_templates(id) on delete set null,
  no_outreach boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint dsales_rfm_segments_range check (
    is_fallback or (f_min is not null and r_min is not null and f_min >= 1 and r_min >= 0
                    and (f_max is null or f_max >= f_min) and (r_max is null or r_max >= r_min)))
);
alter table dsales.dsales_rfm_segments enable row level security;
revoke all on dsales.dsales_rfm_segments from public, anon, authenticated;

insert into dsales.dsales_rfm_segments (key, sort_order, f_min, f_max, r_min, r_max, is_fallback, tone, behavior, action) values
  ('Champion', 1, 6, null, 0, 30, false, 'ดูแลพิเศษ', 'ลูกค้าแชมป์เปี้ยน มาบ่อย ซื้อเยอะ',
   'บริการพิเศษ ขอรีวิว ส่งสินค้าใหม่ให้ลองฟรี ของขวัญวันเกิด ต้องดูแลรักษาไว้ให้ดีที่สุด'),
  ('Shouldn''t Lose', 2, 6, null, 91, null, false, 'Hard winback', 'ลูกค้ายอดสูงที่หายจากเราไปนานแล้ว อาจไปซื้อคู่แข่ง',
   'Hard winback: จัดโปรแรงในสินค้าที่เคยซื้อ แนะนำสินค้าใหม่ที่น่าถูกใจ'),
  ('Loyal', 3, 4, null, 0, 90, false, 'กระตุ้นซื้อซ้ำ', 'ลูกค้าประจำ มาบ่อย ซื้อเยอะ แต่ห่างไปช่วงสั้น ๆ แล้ว',
   'สะสมแต้มทุกสัปดาห์/เดือน ของขวัญวันเกิด เพื่อเพิ่ม Recency'),
  ('Sleepers', 4, 3, 5, 91, null, false, 'Soft winback', 'ลูกค้าที่ซื้อยอดกลาง ๆ ที่หายไปสักพักแล้ว',
   'Soft winback: จัดโปรเบา ๆ ให้ลูกค้ากลับมาซื้อ แนะนำสินค้าที่น่าถูกใจ'),
  ('Promising', 5, 2, 3, 0, 60, false, 'Up-sell', 'ลูกค้ามาบ่อยพอสมควร ซื้อขนาดกลาง ๆ',
   'Up-sell: แนะนำสินค้าที่ลูกค้าน่าจะถูกใจ อัปเกรดเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  ('Need Attention', 6, 2, 3, 61, 90, false, 'Up-sell / Cross-sell', 'ลูกค้าที่ซื้อมาสักระยะ มีศักยภาพที่จะขายได้เพิ่ม',
   'Up-sell, Cross-sell: แนะนำสินค้าที่ถูกใจ โปรพิเศษตามเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  ('Hot', 7, 1, 1, 0, 30, false, 'ต้อนรับ', 'ลูกค้าหน้าใหม่ เพิ่งมาซื้อครั้งแรก',
   'สร้างความสัมพันธ์ ต้อนรับสมาชิกใหม่ ชวนรับข่าวสารจากแบรนด์ สะสมแต้ม'),
  ('Warm', 8, 1, 1, 31, 60, false, 'Hard conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ยังตามกลับมาได้ทัน',
   'Hard conversation: ติดต่อกลับให้เร็วที่สุด ผ่านช่องทางที่ลูกค้าต้องการให้ติดต่อ สร้างความมั่นใจ'),
  ('Cold', 9, 1, 1, 61, 90, false, 'Soft conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ตามกลับมาไม่ทันแล้ว',
   'Soft conversation: สร้างความมั่นใจ ไม่ปล่อยให้ห่างเหิน แต่ไม่รบกวนเกินไป ติดต่อด้วยสื่อที่ไม่รบกวนมาก'),
  ('Lost', 10, null, null, null, null, true, 'หยุดส่ง', 'ลูกค้าที่ซื้อน้อย ไม่บ่อย และหายไปนานแล้ว',
   'หยุดส่งแคมเปญ เอางบและเวลาไปลงกับกลุ่มอื่นดีกว่า')
on conflict (key) do nothing;

-- 2)
alter table dsales.dsales_customer_base alter column rfm drop expression;

create or replace function dsales.dsales_rfm(p_orders integer, p_days integer) returns text
language sql stable set search_path = dsales, public as $$
  select case when p_orders is null or p_orders < 1 or p_days is null then null else (
    select s.key from dsales.dsales_rfm_segments s
    where s.is_fallback
       or (p_orders >= s.f_min and (s.f_max is null or p_orders <= s.f_max) and p_days >= s.r_min and (s.r_max is null or p_days <= s.r_max))
    order by s.sort_order limit 1) end
$$;
revoke all on function dsales.dsales_rfm(integer, integer) from public, anon, authenticated;

create or replace function dsales.dsales_customer_base_set_rfm() returns trigger
language plpgsql security definer set search_path = dsales, public as $$
begin
  new.rfm := dsales.dsales_rfm(new.order_count, new.dormant_days);
  return new;
end $$;
revoke all on function dsales.dsales_customer_base_set_rfm() from public, anon, authenticated;
drop trigger if exists dsales_customer_base_set_rfm on dsales.dsales_customer_base;
create trigger dsales_customer_base_set_rfm
  before insert or update of order_count, dormant_days on dsales.dsales_customer_base
  for each row execute function dsales.dsales_customer_base_set_rfm();

create or replace function dsales.dsales_rfm_apply() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare n integer;
begin
  update dsales.dsales_customer_base b set rfm = dsales.dsales_rfm(b.order_count, b.dormant_days)
  where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function dsales.dsales_rfm_apply() from public, anon, authenticated;

-- 3)
create or replace function dsales.dsales_rfm_config_get() returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key, 'sort', s.sort_order, 'f_min', s.f_min, 'f_max', s.f_max, 'r_min', s.r_min, 'r_max', s.r_max, 'fallback', s.is_fallback,
      'tone', s.tone, 'behavior', s.behavior, 'action', s.action,
      'template_bebeplay', s.template_bebeplay, 'template_hosttail', s.template_hosttail, 'no_outreach', s.no_outreach) order by s.sort_order), '[]'::jsonb)
    from dsales.dsales_rfm_segments s);
end $$;
revoke all on function dsales.dsales_rfm_config_get() from public, anon;
grant execute on function dsales.dsales_rfm_config_get() to authenticated;

-- 4)
create or replace function dsales.dsales_rfm_map(p_scope text, p_brand text default null, p_as uuid default null)
returns table(segment text, n bigint, contactable bigint)
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_uid uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin();
begin
  if p_as is not null then
    if not v_admin then raise exception 'forbidden'; end if;
    v_uid := p_as;
  end if;
  return query
  with ex as (select coalesce(array_agg(x.phone), '{}') as phones from dsales.dsales_excluded_customers() x)
  select coalesce(b.rfm, '') as segment, count(*) as n, count(*) filter (where b.eligible) as contactable
  from dsales.dsales_customer_base b
  left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
  cross join ex
  where (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
    and not (b.phone_normalized = any (ex.phones))
    and case p_scope when 'mine' then coalesce(l.owner_id, b.owner_id) = v_uid
                     when 'pool' then coalesce(l.owner_id, b.owner_id) is null
                     when 'team' then v_admin
                     else false end
  group by 1;
end $$;
revoke all on function dsales.dsales_rfm_map(text, text, uuid) from public, anon;
grant execute on function dsales.dsales_rfm_map(text, text, uuid) to authenticated;

-- ลูกค้าซื้อครั้งเดียว 0–30 วัน ย้ายจาก Warm เป็น Hot
select dsales.dsales_rfm_apply();
