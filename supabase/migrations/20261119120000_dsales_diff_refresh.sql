-- dsales: refresh that writes only the rows that changed (2026-11-19).
-- Applied to production 2026-11-19 as Supabase migration `dsales_diff_refresh` (same code, without the comments).
-- Tested on production in rolled-back transactions against the previous functions:
--   no change between runs: 0 rows written, identical tables
--   with ~9,400 rows made stale, 200 + 100 removed and 5 + 5 bogus rows added: identical tables (0 differing rows),
--     manual chat links untouched
-- The first run of a day still updates every row that has a last order date (dormant_days grows by 1).
-- Both functions used to delete their whole table and insert it again on every run (18,800 + 2,300 rows,
-- ~10 MB of writes and an autovacuum pass each time) although only a handful of rows differ between runs.
-- The result is the same set of rows; what changes is how it is written:
--   * rows that are no longer in the result are deleted, new ones inserted, changed ones updated,
--     unchanged ones are left alone
--   * dsales_customer_base.refreshed_at / dsales_chat_links.linked_at now mean "last time this row was written"
--     (they were "time of the last run"); nothing reads either column and neither table is readable by clients
--   * readers still see the previous data until the run commits (one statement, same as the old delete + insert)
-- Schedule (changed in production the same day, pg_cron job `dsales-refresh-customer-base`):
--   '5 0,5,9 * * *' UTC = 07:05, 12:05, 16:05 Asia/Bangkok (was '5 * * * *', every hour)
--   command: select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();
-- Rollback: restore the previous definitions (delete + insert of the whole table) from the Supabase
--   migration history, and select cron.alter_job(<jobid>, schedule := '5 * * * *') for the old schedule.

create or replace function dsales.dsales_seed_chat_links_by_name()
returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_rows integer;
begin
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
  uniq as (select k, min(phone) as phone from usable group by k having count(distinct phone) = 1),
  new as materialized ( -- ชุดที่ควรมีหลังรอบนี้ (iim_sessions.ms_id เป็น PK จึงได้ 1 แถวต่อห้อง)
    select s.ms_id, u.phone, s.customer
    from public.iim_sessions s
    join uniq u on u.k = lower(btrim(s.customer))
    where nullif(btrim(s.customer), '') is not null
  ),
  del as ( -- จับคู่ด้วยชื่อที่ไม่อยู่ในชุดใหม่แล้ว
    delete from dsales.dsales_chat_links c
    where c.method = 'chat_name'
      and not exists (select 1 from new n where n.ms_id = c.ms_id and n.phone = c.phone_normalized)
    returning 1
  ),
  upd as ( -- คู่เดิม แต่ชื่อแชตที่ใช้เป็นหลักฐานเปลี่ยน
    update dsales.dsales_chat_links c set evidence = n.customer
    from new n
    where c.method = 'chat_name' and c.ms_id = n.ms_id and c.phone_normalized = n.phone
      and c.evidence is distinct from n.customer
    returning 1
  ),
  ins as ( -- คู่ใหม่ (คู่ที่ผูกด้วยวิธีอื่นอยู่แล้วไม่ทับ เหมือนเดิม)
    insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence)
    select n.ms_id, n.phone, 'chat_name', n.customer, 'medium' from new n
    on conflict (ms_id, phone_normalized) do nothing
    returning 1
  )
  select count(*) into v_rows from new;

  -- ค่าที่คืนยังเป็น "จำนวนคู่ที่จับด้วยชื่อ" หลังรอบนี้ เหมือนเดิม
  select count(*) into v_rows from dsales.dsales_chat_links where method = 'chat_name';
  return v_rows;
end $$;

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
