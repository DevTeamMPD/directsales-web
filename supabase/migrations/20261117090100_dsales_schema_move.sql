-- สร้างโดย tools/db/rewrite-dsales.mjs จาก 20261117090000_baseline_public_dsales_functions.sql (ห้ามแก้มือ ให้แก้สคริปต์แล้วสร้างใหม่)
create schema if not exists dsales;
grant usage on schema dsales to anon, authenticated, service_role;

drop function if exists public.dsales_customer_pool(p_search text, p_limit integer, p_offset integer);
drop function if exists public.dsales_customer_pool_v2(p_search text, p_limit integer, p_offset integer, p_from date, p_to date, p_brand text);

alter table public.dsales_members set schema dsales;
alter table public.dsales_campaigns set schema dsales;
alter table public.dsales_leads set schema dsales;
alter table public.dsales_interactions set schema dsales;

set local search_path = dsales, public;
alter function public.dsales_assign_lead(p_lead uuid, p_user uuid) set schema dsales;
alter function public.dsales_claim_customer(p_phone text, p_brand text) set schema dsales;
alter function public.dsales_claim_lead(p_lead uuid) set schema dsales;
alter function public.dsales_customer_channels(p_phone text) set schema dsales;
alter function public.dsales_customer_chats(p_phone text, p_since timestamp with time zone) set schema dsales;
alter function public.dsales_customer_pool_v3(p_search text, p_limit integer, p_offset integer, p_from date, p_to date, p_brand text) set schema dsales;
alter function public.dsales_customer_pool_v4(p_search text, p_limit integer, p_offset integer, p_from date, p_to date, p_brand text) set schema dsales;
alter function public.dsales_customer_purchases(p_phone text) set schema dsales;
alter function public.dsales_is_admin() set schema dsales;
alter function public.dsales_lead_json(l dsales_leads) set schema dsales;
alter function public.dsales_log(p_lead uuid, p_type text, p_result text, p_note text, p_status text, p_callback date, p_interest text, p_bills text[], p_amount numeric) set schema dsales;
alter function public.dsales_me() set schema dsales;
alter function public.dsales_my_leads(p_limit integer, p_offset integer) set schema dsales;
alter function public.dsales_norm_platform(p_platform text, p_shop text) set schema dsales;
alter function public.dsales_register() set schema dsales;
alter function public.dsales_set_nocall(p_lead uuid, p_on boolean) set schema dsales;
alter function public.dsales_team() set schema dsales;
alter function public.dsales_touch_updated_at() set schema dsales;
alter function public.dsales_uid() set schema dsales;
alter function public.dsales_unclaim_lead(p_lead uuid) set schema dsales;
alter function public.dsales_valid_phone(p text) set schema dsales;

CREATE OR REPLACE FUNCTION dsales.dsales_assign_lead(p_lead uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare l dsales.dsales_leads;
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from dsales.dsales_members where user_id = p_user and active) then raise exception 'invalid_user'; end if;
  update dsales.dsales_leads set owner_id = p_user, claimed_by = p_user, claimed_at = now(), updated_at = now()
    where id = p_lead and not no_call returning * into l;
  if not found then raise exception 'not_found'; end if;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_claim_customer(p_phone text, p_brand text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
begin
  perform dsales.dsales_register();
  if not dsales.dsales_valid_phone(ph) then raise exception 'invalid_phone'; end if;
  if p_brand not in ('bebeplay','hosttail') then raise exception 'invalid_brand'; end if;
  select * into l from dsales.dsales_leads where phone_normalized = ph for update;
  if found then
    if l.no_call then raise exception 'no_call'; end if;
    if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
    update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me), updated_at = now()
      where id = l.id returning * into l;
  else
    select ci.id, coalesce(nullif(btrim(ci.display_name), ''), 'ไม่ระบุชื่อ') as nm into ident from public.customer_identities ci where ci.primary_phone = ph limit 1;
    if not found then raise exception 'customer_not_found'; end if;
    insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, identity_id, owner_id, claimed_by, claimed_at, last_seller_id, created_by)
      values ('self', p_brand, ident.nm, ph, ph, ident.id, me, me, now(), me, me) returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_claim_lead(p_lead uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads;
begin
  perform dsales.dsales_register();
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if l.no_call then raise exception 'no_call'; end if;
  if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
  update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me), updated_at = now()
    where id = p_lead returning * into l;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_customer_channels(p_phone text)
 RETURNS TABLE(platform text, shop text, orders bigint, last_order timestamp with time zone, chat_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select coalesce(s.platform,
           case lower(btrim(coalesce(o.platform, '')))
             when 'shopee' then 'shopee' when 'lazada' then 'lazada' when 'tiktok' then 'tiktok' when 'line' then 'line'
             when 'facebook' then 'facebook' when 'instagram' then 'instagram'
             when 'shopify' then 'website' when 'minishop' then 'website' when 'shopss' then 'website' when 'sapo' then 'website'
             else 'other' end) as platform,
         o.shop, count(*) as orders, max(o.created_at) as last_order,
         max(nullif(btrim(o.buyer_name), '')) as chat_name
  from public.order_tracking o
  left join cdp.shops s on s.shop = o.shop
  where btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$' and o.phone = btrim(p_phone)
  group by 1, 2
  order by max(o.created_at) desc nulls last
  limit 20;
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_customer_chats(p_phone text, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(ms_id bigint, channel text, page text, chat_name text, last_time timestamp with time zone, msg_count integer, admin_msgs bigint, last_admin_time timestamp with time zone, last_admin_sender text, last_customer_time timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
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
         (select count(*) from public.iim_messages m
           where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')
             and (p_since is null or m.time >= p_since)) as admin_msgs,
         (select max(m.time) from public.iim_messages m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')) as last_admin_time,
         (select m.sender from public.iim_messages m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error') order by m.time desc limit 1) as last_admin_sender,
         (select max(m.time) from public.iim_messages m where m.ms_id = s.ms_id and m.dir = 'customer') as last_customer_time
  from public.iim_sessions s
  join names on lower(btrim(s.customer)) = names.k
  where nullif(btrim(s.customer), '') is not null
  order by s.last_time desc nulls last
  limit 20;
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_customer_pool_v3(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_brand text DEFAULT NULL::text)
 RETURNS TABLE(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer, last_order_date date, brands text[], total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  with s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d),
  q as (
    select ci.id, ci.display_name, ci.primary_phone, ci.segment, ci.rfm_segment,
           coalesce(v.ltv_thb, ci.ltv) as ltv_v, v.order_count as oc, v.last_order_date as lod
    from public.customer_identities ci
    left join public.lendi_customer_value v on v.phone = ci.primary_phone
    cross join s
    where ci.primary_phone is not null and ci.primary_phone <> ''
      and (p_from is null or v.last_order_date >= p_from)
      and (p_to is null or v.last_order_date <= p_to)
      and (
        nullif(btrim(p_brand), '') is null
        or exists (select 1 from public.identity_brands ib2 join public.brands b2 on b2.id = ib2.brand_id
                   where ib2.identity_id = ci.id and b2.code = lower(btrim(p_brand)))
      )
      and (
        s.t = ''
        or (ci.display_name is not null and position(s.t in lower(ci.display_name)) > 0)
        or (s.d <> '' and ci.primary_phone like '%' || s.d || '%')
        or ci.primary_phone in (select l.phone from public.lendi_purchase_lines l
                                where l.bill_no is not null and position(s.t in lower(l.bill_no)) > 0
                                   or l.order_no is not null and position(s.t in lower(l.order_no)) > 0)
        or ci.primary_phone in (select coalesce(c.phone_normalized, c.phone) from public.lds_customers c
                                where c.jst_chat_name is not null and position(s.t in lower(c.jst_chat_name)) > 0
                                   or c.buyer_account is not null and position(s.t in lower(c.buyer_account)) > 0)
      )
  )
  select q.id, coalesce(nullif(btrim(q.display_name), ''), 'ไม่ระบุชื่อ'), q.primary_phone,
         (select max(c.jst_chat_name) from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = q.primary_phone and c.jst_chat_name is not null),
         q.segment, q.rfm_segment, q.ltv_v, q.oc, q.lod,
         (select array_agg(b.code order by b.code) from public.identity_brands ib join public.brands b on b.id = ib.brand_id where ib.identity_id = q.id),
         count(*) over ()
  from q
  order by q.ltv_v desc nulls last, q.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_customer_pool_v4(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_brand text DEFAULT NULL::text)
 RETURNS TABLE(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer, last_order_date date, brands text[], total_count bigint, lead_id uuid, taken boolean, mine boolean, no_call boolean, reserved_by text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select p.identity_id, p.name, p.phone, p.chat_name, p.segment, p.rfm_segment, p.ltv, p.order_count, p.last_order_date, p.brands, p.total_count,
         l.id, (l.owner_id is not null), (l.owner_id = auth.uid()), coalesce(l.no_call, false),
         case when dsales.dsales_is_admin() and l.owner_id is not null then (select m.display_name from dsales.dsales_members m where m.user_id = l.owner_id) end
  from dsales.dsales_customer_pool_v3(p_search, p_limit, p_offset, p_from, p_to, p_brand) p
  left join dsales.dsales_leads l on l.phone_normalized = p.phone
  where dsales.dsales_uid() is not null $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_customer_purchases(p_phone text)
 RETURNS TABLE(txn_date date, bill_no text, order_no text, sku text, product_name text, quantity numeric, amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select l.txn_date, l.bill_no, l.order_no, l.sku, l.product_name, l.quantity, coalesce(l.amount, l.estimated_amount)
  from public.lendi_purchase_lines l
  where nullif(btrim(p_phone), '') is not null and l.phone = btrim(p_phone)
  order by l.txn_date desc nulls last, l.sale_id
  limit 200;
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select exists (select 1 from dsales.dsales_members m where m.user_id = auth.uid() and m.role = 'admin' and m.active);
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_lead_json(l dsales_leads)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select jsonb_build_object(
    'id', l.id, 'name', l.name, 'phone', l.phone, 'address', l.address, 'shop', l.shop, 'chatName', l.chat_name, 'channels', l.channels,
    'brand', l.brand, 'source', l.source, 'campaignId', l.campaign_id, 'owner', l.owner_id, 'status', l.status, 'callback', l.callback_date,
    'interest', coalesce(l.interest, ''), 'closedBills', to_jsonb(l.closed_bills), 'closedAmount', l.closed_amount, 'closedAt', l.closed_at,
    'claimedBy', l.claimed_by, 'claimedAt', l.claimed_at, 'noCall', l.no_call, 'noCallBy', l.no_call_by, 'noCallAt', l.no_call_at,
    'releasedBy', to_jsonb(l.released_by), 'autoSkip', l.auto_skip, 'identityId', l.identity_id,
    'bills', coalesce(pl.bills, '[]'::jsonb), 'total', coalesce(pl.total, 0), 'lastBuy', pl.last_buy, 'orders', coalesce(pl.orders, 0),
    'interactions', coalesce(ix.items, '[]'::jsonb))
  from (select 1) x
  left join lateral (
    select to_jsonb(coalesce((array_agg(distinct nullif(btrim(p.bill_no), '') order by nullif(btrim(p.bill_no), '') desc))[1:6], '{}'::text[])) as bills,
           sum(coalesce(p.amount, p.estimated_amount)) as total, max(p.txn_date) as last_buy,
           count(distinct coalesce(nullif(btrim(p.bill_no), ''), p.order_no)) as orders
    from public.lendi_purchase_lines p where p.phone = l.phone_normalized) pl on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', i.id, 'type', i.type, 'date', i.created_at, 'rep', i.rep_id, 'result', i.result, 'note', i.note, 'due', i.due, 'bills', to_jsonb(i.bills)) order by i.created_at) as items
    from (select * from dsales.dsales_interactions where lead_id = l.id order by created_at desc limit 30) i) ix on true
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_log(p_lead uuid, p_type text, p_result text, p_note text, p_status text, p_callback date, p_interest text, p_bills text[], p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; bills text[] := coalesce(p_bills, '{}');
begin
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if l.owner_id is distinct from me and not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if p_type not in ('call','chat') then raise exception 'invalid_type'; end if;
  if p_status not in ('new','following','callback','won','lost','unreachable') then raise exception 'invalid_status'; end if;
  if p_status = 'won' and cardinality(bills) = 0 then raise exception 'bill_required'; end if;
  insert into dsales.dsales_interactions (lead_id, type, result, note, bills, rep_id, due) values (p_lead, p_type, p_result, p_note, bills, me, p_callback);
  update dsales.dsales_leads set status = p_status, callback_date = case when p_status = 'callback' then p_callback else null end,
      interest = coalesce(p_interest, interest),
      closed_bills = case when p_status = 'won' then bills else closed_bills end,
      closed_amount = case when p_status = 'won' then p_amount else closed_amount end,
      closed_at = case when p_status = 'won' then current_date else closed_at end,
      last_seller_id = case when p_status = 'won' then me else last_seller_id end, updated_at = now()
    where id = p_lead returning * into l;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_me()
 RETURNS TABLE(user_id uuid, email text, display_name text, is_admin boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select u.id, u.email::text,
         coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1)),
         coalesce(m.role = 'admin' and m.active, false)
  from auth.users u
  left join dsales.dsales_members m on m.user_id = u.id
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_my_leads(p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select dsales.dsales_lead_json(l)
  from dsales.dsales_leads l
  where dsales.dsales_uid() is not null and (
    (dsales.dsales_is_admin() and (l.owner_id is not null or l.campaign_id is not null))
    or l.owner_id = auth.uid()
    or (l.owner_id is null and not l.no_call and l.campaign_id is not null and not (auth.uid() = any (l.released_by))))
  order by l.updated_at desc, l.id
  limit least(greatest(coalesce(p_limit, 500), 1), 1000) offset greatest(coalesce(p_offset, 0), 0) $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_norm_platform(p_platform text, p_shop text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'dsales', 'public'
AS $function$
  select coalesce((select s.platform from cdp.shops s where s.shop = p_shop),
    case lower(btrim(coalesce(p_platform, '')))
      when 'shopee' then 'shopee' when 'lazada' then 'lazada' when 'tiktok' then 'tiktok' when 'line' then 'line'
      when 'facebook' then 'facebook' when 'instagram' then 'instagram'
      when 'shopify' then 'website' when 'minishop' then 'website' when 'shopss' then 'website' when 'sapo' then 'website'
      else 'other' end) $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_register()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid();
begin
  insert into dsales.dsales_members (user_id, role, display_name)
  select u.id, 'sales', coalesce(nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id where u.id = me
  on conflict (user_id) do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_set_nocall(p_lead uuid, p_on boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads;
begin
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if p_on then
    if l.owner_id is distinct from me and not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
    update dsales.dsales_leads set no_call = true, no_call_by = coalesce(owner_id, me), no_call_at = current_date, updated_at = now() where id = p_lead returning * into l;
  else
    if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
    update dsales.dsales_leads set no_call = false, no_call_by = null, no_call_at = null, owner_id = null, claimed_by = null, claimed_at = null, status = 'new', updated_at = now() where id = p_lead returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_team()
 RETURNS TABLE(user_id uuid, display_name text, role text, active boolean, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
  select m.user_id, coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1)), m.role, m.active, u.email::text
  from dsales.dsales_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.id = m.user_id
  where dsales.dsales_uid() is not null and (dsales.dsales_is_admin() or m.user_id = auth.uid())
  order by m.role, 2 $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'dsales', 'public'
AS $function$
begin new.updated_at = now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_uid()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
AS $function$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return u;
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_unclaim_lead(p_lead uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dsales', 'public'
AS $function$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads;
begin
  select * into l from dsales.dsales_leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if l.owner_id is distinct from me and not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  update dsales.dsales_leads set owner_id = null, claimed_by = null, claimed_at = null, status = 'new',
      released_by = case when l.owner_id is null or l.owner_id = any (released_by) then released_by else released_by || l.owner_id end,
      auto_skip = case when campaign_id is not null then true else auto_skip end, updated_at = now()
    where id = p_lead returning * into l;
  return dsales.dsales_lead_json(l);
end $function$
;

CREATE OR REPLACE FUNCTION dsales.dsales_valid_phone(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$ select btrim(coalesce(p, '')) ~ '^[0-9]{9,10}$' and btrim(coalesce(p, '')) !~ '^(.)\1+$' $function$
;

