-- dsales: customer brands also come from the page of the customer's chat rooms (2026-11-26).
-- dsales_customer_base.brands was public.identity_brands only (CDP, by shop name). That table was last updated
-- 2026-06-21 and covers 3,051 of 21,816 identities, so 5,971 of 8,736 eligible customers (68%) had no brand:
-- the brand column on /mine and /pool showed "–", the Bebeplay / Hosttail filter hid them, and claiming them
-- needed a brand picked by hand. JST knows the brand of every chat (the page the room is on).
-- Now brands = CDP brands + the brands of the pages (setting page_brand_map) of every room linked to the phone
-- (dsales_chat_links), sorted and distinct. Rooms count whether or not they can be messaged (expired rooms too):
-- the brand says where the customer talked to us, not whether a message can be sent now (that is chat_brands).
-- Pages that are not in page_brand_map (Bebekim, Bebeshop, Mothery, ...) add nothing.
-- Only the brands expression changes; everything else in the function is the 20261119120000 version.
-- Not changed: dsales_customer_pool_v3/v4 (campaign pool) still read identity_brands directly.
-- The function is run once at the end so the change shows without waiting for the next cron round
-- (07:05 / 12:05 / 16:05); it writes only the rows whose brands changed.
-- Rollback: re-apply the function from 20261119120000_dsales_diff_refresh.sql and run it once.

create or replace function dsales.dsales_refresh_customer_base()
returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare
  v_days integer;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_rows integer;
begin
  -- กันการ refresh ซ้อนกัน (cron กับคนกดเอง) ตัวที่สองรอจนตัวแรก commit
  perform pg_advisory_xact_lock(hashtext('dsales_refresh_customer_base'));

  select (value #>> '{}')::integer into v_days from dsales.dsales_settings where key = 'dormant_days';
  if v_days is null then
    raise exception 'dsales_settings key "dormant_days" is missing or null; cannot refresh customer base';
  end if;

  -- เขียนเฉพาะแถวที่เปลี่ยน (เดิมลบทั้งตารางแล้ว insert ใหม่ทุกรอบ) คำสั่งเดียว คนที่อ่านอยู่ยังเห็นข้อมูลชุดเดิมจนกว่าจะ commit
  with ids as (
    select distinct on (x.phone) x.phone, x.id, x.display_name, x.segment, x.rfm_segment, x.ltv
    from (select dsales.dsales_norm_phone(ci.primary_phone) as phone, ci.* from public.customer_identities ci) x
    where x.phone is not null
    order by x.phone, x.updated_at desc nulls last, x.id
  ),
  ot as ( -- order_tracking ที่แปลงเบอร์แล้ว (เบอร์ที่ถูกปิดบังตัดทิ้ง)
    select dsales.dsales_norm_phone(o.phone) as phone, btrim(o.online_order) as k,
           nullif(btrim(o.buyer_name), '') as buyer_name, o.created_at, o.updated_at
    from public.order_tracking o
  ),
  ot_phone as (select distinct phone from ot where phone is not null),
  buyer as ( -- ชื่อผู้ซื้อล่าสุดที่ไม่ว่างของเบอร์นั้น
    select distinct on (phone) phone, buyer_name
    from ot where phone is not null and buyer_name is not null
    order by phone, created_at desc nulls last, updated_at desc nulls last
  ),
  ot_keys as ( -- เลขออร์เดอร์ออนไลน์ → เบอร์ (ตัดเลขสั้นกว่า 8 ตัว เพราะชนกันข้ามออร์เดอร์)
    select distinct k, phone from ot where phone is not null and length(k) >= 8
  ),
  -- บิลจริง: sales_transaction.bill_no หรือ order_no = order_tracking.online_order
  -- ใช้ 2 equi-join ต่อกันด้วย union all (join แบบ OR ช้าจน timeout) แล้วค่อย group
  -- lateral + offset 0 บังคับให้ค้นทีละเลขผ่าน index btrim(bill_no)/btrim(order_no) (~9k ครั้ง)
  -- แทน merge join ที่อ่าน sales_transaction ทั้ง index (~270k แถว, ช้ามากตอน disk IO ตึง)
  hits as (
    select ok.phone, ok.k, b.txn_date
    from ot_keys ok
    cross join lateral (
      select s.txn_date from public.sales_transaction s
      where nullif(btrim(s.bill_no), '') is not null and btrim(s.bill_no) = ok.k
      offset 0
    ) b
    union all
    select ok.phone, ok.k, b.txn_date
    from ot_keys ok
    cross join lateral (
      select s.txn_date from public.sales_transaction s
      where btrim(s.order_no) = ok.k
      offset 0
    ) b
  ),
  st as (
    select phone, max(txn_date) as last_bill, count(distinct k)::integer as bills from hits group by phone
  ),
  val as (
    select x.phone, max(x.order_count) as order_count, max(x.ltv_thb) as ltv_thb, max(x.last_order_date) as last_order_date
    from (select dsales.dsales_norm_phone(v.phone) as phone, v.order_count, v.ltv_thb, v.last_order_date
          from public.lendi_customer_value v) x
    where x.phone is not null group by 1
  ),
  chat as (
    select x.phone, max(x.chat_name) as chat_name
    from (select dsales.dsales_norm_phone(coalesce(c.phone_normalized, c.phone)) as phone,
                 nullif(btrim(c.jst_chat_name), '') as chat_name
          from public.lds_customers c) x
    where x.phone is not null and x.chat_name is not null group by 1
  ),
  last_sess as ( -- ชื่อแชตของห้องล่าสุดที่ผูกกับเบอร์
    select distinct on (cl.phone_normalized) cl.phone_normalized as phone, btrim(s.customer) as customer
    from dsales.dsales_chat_links cl
    join public.iim_sessions s on s.ms_id = cl.ms_id
    where nullif(btrim(s.customer), '') is not null
    order by cl.phone_normalized, s.last_time desc nulls last, s.ms_id desc
  ),
  br as (
    select ib.identity_id, array_agg(distinct b.code order by b.code) as codes
    from public.identity_brands ib join public.brands b on b.id = ib.brand_id group by 1
  ),
  pmap as ( -- เพจ → แบรนด์ (setting page_brand_map ชุดเดียวกับที่ใช้เลือกห้องส่งข้อความ)
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ),
  chat_br as ( -- แบรนด์ของเพจที่ห้องแชตของเบอร์นั้นอยู่ (ชื่อเพจแบบเดียวกับ dsales_room_of: ห้องใน iim_sessions
               -- + ห้องที่มีเฉพาะใน dsales_jst_rooms) join ทั้งชุดครั้งเดียว ไม่เรียก dsales_room_of รายเบอร์
    select cl.phone_normalized as phone, array_agg(distinct pm.brand) as codes
    from dsales.dsales_chat_links cl
    left join public.iim_sessions s on s.ms_id = cl.ms_id
    left join dsales.dsales_jst_rooms j on j.ms_id = cl.ms_id
    join pmap pm on pm.page = coalesce(nullif(j.page, ''), s.page)
    group by 1
  ),
  tagged as ( -- tag Admin_* ตัวแรกของห้องล่าสุด (last_time, แล้ว ms_id) ที่มี tag Admin_* ต่อเบอร์
    select distinct on (cl.phone_normalized) cl.phone_normalized as phone, t.tag
    from dsales.dsales_chat_links cl
    join public.iim_sessions s on s.ms_id = cl.ms_id
    cross join lateral (
      select e.value ->> 'text' as tag
      from jsonb_array_elements(s.tags) with ordinality as e(value, ord)
      where e.value ->> 'text' ilike 'admin\_%'
      order by e.ord limit 1
    ) t
    order by cl.phone_normalized, s.last_time desc nulls last, s.ms_id desc
  ),
  tagmap as (
    select distinct on (lower(t.tag)) lower(t.tag) as tag, m.user_id
    from dsales.dsales_members m cross join unnest(m.jst_tags) as t(tag)
    where m.active
    order by lower(t.tag), m.user_id
  ),
  phones as (select phone from ids union select phone from ot_phone),
  new (phone_normalized, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv,
       segment, rfm_segment, brands, owner_tag, owner_id, eligible, refreshed_at) as materialized (
    select p.phone, ids.id,
           coalesce(nullif(btrim(ids.display_name), ''), buyer.buyer_name, 'ไม่ระบุชื่อ'),
           coalesce(chat.chat_name, last_sess.customer),
           lo.d, v_today - lo.d,
           greatest(val.order_count, st.bills), coalesce(val.ltv_thb, ids.ltv), ids.segment, ids.rfm_segment,
           coalesce((select array_agg(distinct c order by c)
                     from unnest(coalesce(br.codes, '{}') || coalesce(chat_br.codes, '{}')) c), '{}'),
           tagged.tag, tagmap.user_id,
           lo.d is not null and v_today - lo.d >= v_days, now()
    from phones p
    left join ids on ids.phone = p.phone
    left join buyer on buyer.phone = p.phone
    left join st on st.phone = p.phone
    left join val on val.phone = p.phone
    left join chat on chat.phone = p.phone
    left join last_sess on last_sess.phone = p.phone
    left join br on br.identity_id = ids.id
    left join chat_br on chat_br.phone = p.phone
    left join tagged on tagged.phone = p.phone
    left join tagmap on tagmap.tag = lower(tagged.tag)
    cross join lateral (select greatest(val.last_order_date, st.last_bill) as d) lo
  ),
  del as ( -- เบอร์ที่ไม่อยู่ในชุดใหม่แล้ว
    delete from dsales.dsales_customer_base b
    where not exists (select 1 from new n where n.phone_normalized = b.phone_normalized)
    returning 1
  ),
  ups as ( -- เบอร์ใหม่ = insert · เบอร์เดิมที่มีช่องใดช่องหนึ่งเปลี่ยน = update · ที่เหลือไม่แตะ
    insert into dsales.dsales_customer_base as b
      (phone_normalized, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv,
       segment, rfm_segment, brands, owner_tag, owner_id, eligible, refreshed_at)
    select n.phone_normalized, n.identity_id, n.name, n.chat_name, n.last_order_date, n.dormant_days, n.order_count, n.ltv,
           n.segment, n.rfm_segment, n.brands, n.owner_tag, n.owner_id, n.eligible, n.refreshed_at
    from new n
    on conflict (phone_normalized) do update set
      identity_id = excluded.identity_id, name = excluded.name, chat_name = excluded.chat_name,
      last_order_date = excluded.last_order_date, dormant_days = excluded.dormant_days,
      order_count = excluded.order_count, ltv = excluded.ltv, segment = excluded.segment,
      rfm_segment = excluded.rfm_segment, brands = excluded.brands, owner_tag = excluded.owner_tag,
      owner_id = excluded.owner_id, eligible = excluded.eligible, refreshed_at = excluded.refreshed_at
    where (b.identity_id, b.name, b.chat_name, b.last_order_date, b.dormant_days, b.order_count, b.ltv,
           b.segment, b.rfm_segment, b.brands, b.owner_tag, b.owner_id, b.eligible)
          is distinct from
          (excluded.identity_id, excluded.name, excluded.chat_name, excluded.last_order_date, excluded.dormant_days,
           excluded.order_count, excluded.ltv, excluded.segment, excluded.rfm_segment, excluded.brands,
           excluded.owner_tag, excluded.owner_id, excluded.eligible)
    returning 1
  )
  select count(*) into v_rows from new;   -- จำนวนแถวของฐานลูกค้าหลังรอบนี้ (ค่าที่คืนเหมือนเดิม)
  return v_rows;
end $$;

select dsales.dsales_refresh_customer_base();
