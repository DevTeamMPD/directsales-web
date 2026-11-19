-- เหมือนเดิมทุกอย่าง ยกเว้นอ่านข้อความจาก dsales_chat_messages_v (เวลาแก้แล้ว) แทน public.iim_messages
-- ทำให้ p_since (เวลาที่จอง) เทียบกับเวลาข้อความได้ถูกต้อง
create or replace function dsales.dsales_customer_chats(p_phone text, p_since timestamp with time zone default null::timestamp with time zone)
 returns table(ms_id bigint, channel text, page text, chat_name text, last_time timestamp with time zone, msg_count integer, admin_msgs bigint, last_admin_time timestamp with time zone, last_admin_sender text, last_customer_time timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'dsales', 'public'
as $function$
  with names as (
    select distinct lower(btrim(n)) as k from (
      select o.buyer_name as n from public.order_tracking o where o.phone = btrim(p_phone)
      union all select ci.display_name from public.customer_identities ci where ci.primary_phone = btrim(p_phone)
      union all select c.jst_chat_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
      union all select c.buyer_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
    ) x
    where nullif(btrim(n), '') is not null and length(btrim(n)) >= 3
      and btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$'
  )
  select s.ms_id, s.channel, s.page, s.customer, s.last_time, s.msg_count,
         (select count(*) from dsales.dsales_chat_messages_v m
           where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')
             and (p_since is null or m.time >= p_since)) as admin_msgs,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')) as last_admin_time,
         (select m.sender from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error') order by m.time desc limit 1) as last_admin_sender,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer') as last_customer_time
  from public.iim_sessions s
  join names on lower(btrim(s.customer)) = names.k
  where nullif(btrim(s.customer), '') is not null
  order by s.last_time desc nulls last
  limit 20;
$function$;
