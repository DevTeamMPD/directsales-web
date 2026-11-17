-- ฐานลูกค้า 1 แถวต่อเบอร์ คำนวณใหม่ทุกชั่วโมง (Task 10) เพื่อให้หน้าเว็บไม่ต้อง join ตารางใหญ่ทุกครั้ง
create table if not exists dsales.dsales_customer_base (
  phone_normalized text primary key,
  identity_id uuid,
  name text not null,
  chat_name text,
  last_order_date date,
  dormant_days integer,
  order_count integer,
  ltv numeric,
  segment text,
  rfm_segment text,
  brands text[] not null default '{}',
  owner_tag text,          -- tag Admin_* ของห้องแชตล่าสุดที่ผูกกับเบอร์นี้
  owner_id uuid,           -- เซลล์ที่ถือ tag นั้น (null = ไม่มีเจ้าของตาม tag)
  eligible boolean not null default false, -- ไม่ได้ซื้อมา >= dormant_days วัน
  refreshed_at timestamptz not null default now()
);
create index if not exists dsales_customer_base_owner_idx on dsales.dsales_customer_base (owner_id) where eligible;
create index if not exists dsales_customer_base_ltv_idx on dsales.dsales_customer_base (ltv desc nulls last);
revoke all on dsales.dsales_customer_base from anon, authenticated;

create or replace function dsales.dsales_refresh_customer_base() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare
  v_days integer := (select (value #>> '{}')::integer from dsales.dsales_settings where key = 'dormant_days');
  v_rows integer;
begin
  delete from dsales.dsales_customer_base; -- delete (ไม่ใช่ truncate) เพื่อให้คนที่อ่านอยู่ยังเห็นข้อมูลชุดเดิมจนกว่าจะ commit
  insert into dsales.dsales_customer_base
    (phone_normalized, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv,
     segment, rfm_segment, brands, owner_tag, owner_id, eligible, refreshed_at)
  with ids as (
    select distinct on (ci.primary_phone) ci.primary_phone as phone, ci.id, ci.display_name, ci.segment, ci.rfm_segment, ci.ltv
    from public.customer_identities ci
    where dsales.dsales_valid_phone(ci.primary_phone)
    order by ci.primary_phone, ci.updated_at desc nulls last
  ),
  ot as (
    select distinct btrim(o.phone) as phone from public.order_tracking o where dsales.dsales_valid_phone(o.phone)
  ),
  st as ( -- บิลจริง: sales_transaction.bill_no = order_tracking.online_order
    select btrim(o.phone) as phone, max(s.txn_date) as last_bill, count(distinct s.bill_no)::integer as bills
    from public.sales_transaction s
    join public.order_tracking o on btrim(o.online_order) = btrim(s.bill_no)
    where s.bill_no is not null and dsales.dsales_valid_phone(o.phone)
    group by 1
  ),
  val as (
    select v.phone, max(v.order_count) as order_count, max(v.ltv_thb) as ltv_thb, max(v.last_order_date) as last_order_date
    from public.lendi_customer_value v group by 1
  ),
  chat as (
    select coalesce(c.phone_normalized, c.phone) as phone, max(c.jst_chat_name) as chat_name
    from public.lds_customers c where c.jst_chat_name is not null group by 1
  ),
  br as (
    select ib.identity_id, array_agg(distinct b.code order by b.code) as codes
    from public.identity_brands ib join public.brands b on b.id = ib.brand_id group by 1
  ),
  tagged as ( -- tag Admin_* ตัวแรกของห้องแชตที่ last_time ล่าสุด ต่อเบอร์
    select distinct on (cl.phone_normalized) cl.phone_normalized as phone, t.tag
    from dsales.dsales_chat_links cl
    join public.iim_sessions s on s.ms_id = cl.ms_id
    cross join lateral (
      select e.value ->> 'text' as tag
      from jsonb_array_elements(s.tags) with ordinality as e(value, ord)
      where e.value ->> 'text' ilike 'admin\_%'
      order by e.ord limit 1
    ) t
    order by cl.phone_normalized, s.last_time desc nulls last
  ),
  tagmap as (
    select distinct on (lower(t.tag)) lower(t.tag) as tag, m.user_id
    from dsales.dsales_members m cross join unnest(m.jst_tags) as t(tag)
    where m.active
    order by lower(t.tag), m.user_id
  ),
  phones as (select phone from ids union select phone from ot)
  select p.phone, ids.id, coalesce(nullif(btrim(ids.display_name), ''), 'ไม่ระบุชื่อ'), chat.chat_name,
         lo.d, current_date - lo.d,
         coalesce(val.order_count, st.bills), coalesce(val.ltv_thb, ids.ltv), ids.segment, ids.rfm_segment,
         coalesce(br.codes, '{}'), tagged.tag, tagmap.user_id,
         lo.d is not null and current_date - lo.d >= v_days, now()
  from phones p
  left join ids on ids.phone = p.phone
  left join st on st.phone = p.phone
  left join val on val.phone = p.phone
  left join chat on chat.phone = p.phone
  left join br on br.identity_id = ids.id
  left join tagged on tagged.phone = p.phone
  left join tagmap on tagmap.tag = lower(tagged.tag)
  cross join lateral (select greatest(val.last_order_date, st.last_bill) as d) lo;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function dsales.dsales_refresh_customer_base() from public, anon, authenticated;
