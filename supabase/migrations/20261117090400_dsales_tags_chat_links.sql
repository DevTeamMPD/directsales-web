-- tag JST ที่ผูกกับเซลล์ (เช่น {Admin_Sao}) และตารางผูกห้องแชต JST กับเบอร์ลูกค้า
alter table dsales.dsales_members add column if not exists jst_tags text[] not null default '{}';

-- ไม่ใส่ foreign key ไป public.iim_sessions เพื่อไม่แตะตารางของระบบอื่น
create table if not exists dsales.dsales_chat_links (
  ms_id bigint not null,
  phone_normalized text not null,
  method text not null check (method in ('order_no', 'buyer_id', 'chat_name', 'manual')),
  evidence text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  linked_at timestamptz not null default now(),
  primary key (ms_id, phone_normalized)
);
create index if not exists dsales_chat_links_phone_idx on dsales.dsales_chat_links (phone_normalized);
revoke all on dsales.dsales_chat_links from anon, authenticated;

-- ผูกด้วยชื่อแชต: ใช้เฉพาะชื่อ (ยาว >= 3 ตัวอักษร) ที่ชี้ไปเบอร์เดียวเท่านั้น ชื่อซ้ำหลายเบอร์ไม่ผูก
create or replace function dsales.dsales_seed_chat_links_by_name() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_rows integer;
begin
  with names as (
    select lower(btrim(x.n)) as k, btrim(x.phone) as phone from (
      select o.buyer_name as n, o.phone from public.order_tracking o
      union all select ci.display_name, ci.primary_phone from public.customer_identities ci
      union all select c.jst_chat_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
      union all select c.buyer_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
    ) x
    where length(btrim(coalesce(x.n, ''))) >= 3 and dsales.dsales_valid_phone(x.phone)
  ),
  uniq as (select k, min(phone) as phone from names group by k having count(distinct phone) = 1)
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
