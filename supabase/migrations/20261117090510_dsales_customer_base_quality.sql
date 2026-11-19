-- Task 8b: แก้คุณภาพข้อมูลฐานลูกค้า (เปลี่ยนเฉพาะ function ไม่เปลี่ยนรูปตาราง)
-- 1) แปลงเบอร์ให้เป็นรูปเดียวกันก่อน join  2) ผูกบิลด้วย bill_no หรือ order_no
-- 3) ผูกห้องแชตด้วยชื่อให้เข้มขึ้นและสร้างใหม่ทุกครั้ง  4) order_count/ชื่อ/ชื่อแชต/tag/วันที่แบบไทย

-- แปลงเบอร์: ตัดทุกอย่างที่ไม่ใช่ตัวเลข, 66xxxxxxxxx (และ 660xxxxxxxxx) → 0xxxxxxxxx,
-- มือถือ 9 หลักที่ขาด 0 นำหน้า (6/8/9) → เติม 0, เบอร์ที่ถูกปิดบัง (มี *) หรือไม่ผ่าน dsales_valid_phone → null
-- เขียนเป็น expression เดียว (ไม่มี FROM, ไม่ set search_path) เพื่อให้ planner inline ได้:
-- เร็วกว่าแบบ subquery ~8 เท่า (order_tracking 43k แถว: ~150 ms แทน ~1.2 s)
-- '^660?([0-9]{9})$' = 66 + 9 หลัก (11 หลัก) หรือ 660 + 9 หลัก (12 หลัก, ~2k แถวในข้อมูลจริง)
create or replace function dsales.dsales_norm_phone(p text) returns text
language sql immutable parallel safe as $$
  select case when strpos(coalesce(p, ''), '*') = 0
               and dsales.dsales_valid_phone(
                     regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'),
                                                   '^660?([0-9]{9})$', '0\1'), '^([689][0-9]{8})$', '0\1'))
              then regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'),
                                                 '^660?([0-9]{9})$', '0\1'), '^([689][0-9]{8})$', '0\1')
         end
$$;

-- ผูกด้วยชื่อแชต: ลบลิงก์ chat_name เดิมแล้วสร้างใหม่ทุกครั้ง (ลิงก์วิธีอื่นไม่แตะ)
-- ใช้เฉพาะชื่อที่ชี้ไปเบอร์เดียว และตัดชื่อที่หลวมเกินไป: คำเดียวที่สั้นกว่า 6 ตัว, ชื่อแทน
-- (facebook user / มี *), ตัวเลขล้วน
create or replace function dsales.dsales_seed_chat_links_by_name() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_rows integer;
begin
  delete from dsales.dsales_chat_links where method = 'chat_name';

  with names as (
    select lower(btrim(x.n)) as k, dsales.dsales_norm_phone(x.phone) as phone from (
      select o.buyer_name as n, o.phone from public.order_tracking o
      union all select ci.display_name, ci.primary_phone from public.customer_identities ci
      union all select c.jst_chat_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
      union all select c.buyer_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
    ) x
  ),
  usable as (
    select k, phone from names
    where phone is not null
      and length(k) >= 3
      and not (k !~ '\s' and length(k) < 6)
      and k <> 'facebook user'
      and position('*' in k) = 0
      and k !~ '^[0-9]+$'
  ),
  uniq as (select k, min(phone) as phone from usable group by k having count(distinct phone) = 1)
  insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence)
  select s.ms_id, u.phone, 'chat_name', s.customer, 'medium'
  from public.iim_sessions s
  join uniq u on u.k = lower(btrim(s.customer))
  where nullif(btrim(s.customer), '') is not null
  on conflict (ms_id, phone_normalized) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function dsales.dsales_seed_chat_links_by_name() from public, anon, authenticated;

create or replace function dsales.dsales_refresh_customer_base() returns integer
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

  delete from dsales.dsales_customer_base; -- delete (ไม่ใช่ truncate) เพื่อให้คนที่อ่านอยู่ยังเห็นข้อมูลชุดเดิมจนกว่าจะ commit
  insert into dsales.dsales_customer_base
    (phone_normalized, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv,
     segment, rfm_segment, brands, owner_tag, owner_id, eligible, refreshed_at)
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
  phones as (select phone from ids union select phone from ot_phone)
  select p.phone, ids.id,
         coalesce(nullif(btrim(ids.display_name), ''), buyer.buyer_name, 'ไม่ระบุชื่อ'),
         coalesce(chat.chat_name, last_sess.customer),
         lo.d, v_today - lo.d,
         greatest(val.order_count, st.bills), coalesce(val.ltv_thb, ids.ltv), ids.segment, ids.rfm_segment,
         coalesce(br.codes, '{}'), tagged.tag, tagmap.user_id,
         lo.d is not null and v_today - lo.d >= v_days, now()
  from phones p
  left join ids on ids.phone = p.phone
  left join buyer on buyer.phone = p.phone
  left join st on st.phone = p.phone
  left join val on val.phone = p.phone
  left join chat on chat.phone = p.phone
  left join last_sess on last_sess.phone = p.phone
  left join br on br.identity_id = ids.id
  left join tagged on tagged.phone = p.phone
  left join tagmap on tagmap.tag = lower(tagged.tag)
  cross join lateral (select greatest(val.last_order_date, st.last_bill) as d) lo;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function dsales.dsales_refresh_customer_base() from public, anon, authenticated;
