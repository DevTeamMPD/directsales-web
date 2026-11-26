-- dsales: link JST chat rooms to customers by the online buyer ID (2026-11-20).
--
-- Why: rooms were linked only by exact chat name (dsales_seed_chat_links_by_name), which covered 1,677 of 8,673
-- eligible customers (19%). public.iim_sessions (owned by another system) has no platform user id and misses
-- rooms, so public.order_tracking.buyer_account_no had nothing to join against.
-- JST's own search takes the online buyer ID: POST /iim/getSessions {query_type: 'outer_user_id', name: <id>}.
-- Verified 2026-11-20: each room's outer_user_id equals buyer_account_no (LINE MiniShop = LINE userId U…,
-- Facebook = page-scoped PSID, Shopee / Lazada = buyer id); 13/13 samples found their rooms, TikTok found none.
--
-- How: the JST worker asks dsales_worker_link_targets for buyer IDs of base customers, searches JST when it has
-- no send to do, and hands the rooms to dsales_worker_link_save, which stores them in dsales_jst_rooms and links
-- them in dsales_chat_links (method 'buyer_id', confidence 'high'; an existing 'chat_name' link of the same pair
-- is upgraded, 'manual' / 'order_no' links are left alone). Name links are kept as a fallback.
-- Room readers (dsales_outreach_room, dsales_customer_rooms, dsales_sendable_rooms, the provider filter of
-- dsales_base_customers, dsales_worker_find_rooms) read dsales_rooms_v = iim_sessions plus rooms only JST returned.
-- JST's is_expired flag (true for every Lazada room seen) makes a room not sendable. It does NOT follow Meta's
-- 24 h window (Facebook rooms quiet for two months came back is_expired = false), so Facebook / Instagram still need
-- a customer message in the last 24 h.
-- dsales_customer_rooms also returns outer_user_id (PSID), meta_page_id (setting meta_page_ids, page name → Meta
-- page id) and meta_business_id for Facebook / Instagram rooms so the web can open the page's Meta Business Suite
-- inbox. Tested 2026-11-20: Business Suite's selected_item_id does NOT take the PSID (it uses its own user id, e.g.
-- 100024152088661), so the link can open the page inbox but not the customer's thread.
-- Side effect: dsales_refresh_customer_base picks chat_name and owner_tag (JST Admin_* tag) from linked rooms that
-- are in iim_sessions, so more links also give more customers a chat name and an owner from their JST tag.
-- Rollback: drop the two RPCs, the view and the two tables, delete from dsales_chat_links where method = 'buyer_id',
-- and restore the previous function bodies from 20261120100200 / 20261120110000 / 20261120100500 (find_rooms).

create table if not exists dsales.dsales_jst_rooms (
  ms_id bigint primary key,
  outer_user_id text not null,
  provider text,
  page text,
  name text,
  expired boolean not null default false,
  last_message_time timestamptz,
  fetched_at timestamptz not null default now()
);
create index if not exists dsales_jst_rooms_outer_idx on dsales.dsales_jst_rooms (outer_user_id);

create table if not exists dsales.dsales_buyer_lookups (
  buyer_id text primary key,
  looked_up_at timestamptz not null default now(),
  rooms_found integer not null default 0,
  error text,
  worker text
);

-- Meta Business Suite inbox: business id + page name (as JST / iim_sessions name it) → Meta page id.
-- Bebeplay from the inbox URL the user gave on 2026-11-20; other pages are added by an admin later.
insert into dsales.dsales_settings (key, value) values
  ('meta_business_id', '"543119309449766"'::jsonb),
  ('meta_page_ids', '{"Bebeplay": "347147266044826"}'::jsonb)
on conflict (key) do nothing;

alter table dsales.dsales_jst_rooms enable row level security;
alter table dsales.dsales_buyer_lookups enable row level security;
revoke all on dsales.dsales_jst_rooms, dsales.dsales_buyer_lookups from public, anon, authenticated;

-- every known room: iim_sessions (JST values win where the worker has fetched the room) + rooms only JST returned
create or replace view dsales.dsales_rooms_v with (security_invoker = true) as
  select s.ms_id,
         coalesce(nullif(j.provider, ''), s.channel) as channel,
         coalesce(nullif(j.page, ''), s.page) as page,
         coalesce(nullif(j.name, ''), s.customer) as customer,
         greatest(s.last_time, j.last_message_time) as last_time,
         j.outer_user_id,
         coalesce(j.expired, false) as expired
  from public.iim_sessions s
  left join dsales.dsales_jst_rooms j on j.ms_id = s.ms_id
  union all
  select j.ms_id, j.provider, j.page, j.name, j.last_message_time, j.outer_user_id, j.expired
  from dsales.dsales_jst_rooms j
  where not exists (select 1 from public.iim_sessions s where s.ms_id = j.ms_id);
revoke all on dsales.dsales_rooms_v from public, anon, authenticated;

/* ---------- room readers ---------- */

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
                            '-infinity'::timestamptz) < now() - interval '24 hours') as closed
    from dsales.dsales_chat_links l
    join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone and s.page in (select p.page from pages p)
  )
  select r.ms_id, r.page, r.provider, r.chat_name, null::text
  from rooms r where not r.closed order by r.rnk, r.last_time desc nulls last limit 1;
  if found then return; end if;

  select exists (
    select 1 from dsales.dsales_chat_links l join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone
      and s.page in (select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand))
  ) into v_any;
  return query select null::bigint, null::text, null::text, null::text, case when v_any then 'window_closed' else 'no_chat_room' end;
end $$;
revoke all on function dsales.dsales_outreach_room(text, text) from public, anon, authenticated;

create or replace function dsales.dsales_customer_rooms(p_phone text) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), rooms as (
    select s.ms_id, s.channel, s.page, s.last_time, m.brand, s.outer_user_id,
           lower(s.channel) in ('facebook', 'instagram') as meta,
           m.brand is not null and not s.expired and (lower(s.channel) not in ('facebook', 'instagram')
             or exists (select 1 from dsales.dsales_chat_messages_v cm
                        where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - interval '24 hours')) as sendable
    from dsales.dsales_chat_links l
    join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    left join map m on m.page = s.page
    where l.phone_normalized = p_phone
  )
  select coalesce(jsonb_agg(jsonb_build_object('ms_id', r.ms_id, 'provider', lower(r.channel), 'page', r.page,
                                               'brand', r.brand, 'sendable', r.sendable)
                            || case when r.meta then jsonb_build_object(
                                 'outer_user_id', r.outer_user_id,
                                 'meta_page_id', dsales.dsales_setting('meta_page_ids') ->> r.page,
                                 'meta_business_id', dsales.dsales_setting('meta_business_id') #>> '{}') else '{}'::jsonb end
                            order by r.sendable desc, r.last_time desc nulls last), '[]'::jsonb)
  from rooms r
$$;
revoke all on function dsales.dsales_customer_rooms(text) from public, anon, authenticated;

create or replace function dsales.dsales_sendable_rooms()
returns table (phone_normalized text, brand text)
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  )
  select distinct l.phone_normalized, m.brand
  from dsales.dsales_chat_links l
  join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
  join map m on m.page = s.page
  where not s.expired
    and (lower(s.channel) not in ('facebook', 'instagram')
         or exists (select 1 from dsales.dsales_chat_messages_v cm
                    where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - interval '24 hours'))
$$;
revoke all on function dsales.dsales_sendable_rooms() from public, anon, authenticated;

-- admin room picker (test rooms): search rooms JST returned too
create or replace function dsales.dsales_worker_find_rooms(p_query text)
returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_q text := btrim(coalesce(p_query, '')); v_pat text;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if length(v_q) < 2 then return '[]'::jsonb; end if;
  v_pat := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(jsonb_build_object('ms_id', r.ms_id, 'customer', r.customer, 'channel', r.channel, 'page', r.page,
                                        'last_time', r.last_time) order by r.last_time desc nulls last)
    from (
      select s.ms_id, s.customer, s.channel, s.page, s.last_time
      from dsales.dsales_rooms_v s
      where lower(btrim(s.customer)) like lower(v_pat) || '%' or s.customer ilike '%' || v_pat || '%'
      order by s.last_time desc nulls last
      limit 20
    ) r
  ), '[]'::jsonb);
end $$;

-- provider filter of /mine and /pool reads dsales_rooms_v (rest of the body unchanged from 20261120110000)
create or replace function dsales.dsales_base_customers(p_scope text, p_search text default null, p_limit integer default 50,
                                                        p_offset integer default 0, p_brand text default null, p_filters jsonb default '{}'::jsonb)
returns table (identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric,
               order_count integer, last_order_date date, brands text[], total_count bigint, lead_id uuid, taken boolean,
               mine boolean, no_call boolean, reserved_by text, dormant_days integer, owner_tag text,
               chat_rooms jsonb, chat_brands text[])
language plpgsql stable security definer set search_path = dsales, public as $function$
#variable_conflict use_column
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_uid uuid := dsales.dsales_uid();
  v_admin boolean := dsales.dsales_is_admin();
  v_t text := lower(btrim(coalesce(p_search, '')));
  v_d text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_brand text := lower(nullif(btrim(p_brand), ''));
  v_rfm text[] := case when jsonb_typeof(f -> 'rfm') = 'array' and jsonb_array_length(f -> 'rfm') > 0
                       then array(select jsonb_array_elements_text(f -> 'rfm')) end;
  v_dmin int := (f ->> 'dormant_min')::int;
  v_dmax int := (f ->> 'dormant_max')::int;
  v_ltv numeric := (f ->> 'ltv_min')::numeric;
  v_orders int := (f ->> 'orders_min')::int;
  v_tag text := nullif(btrim(f ->> 'tag'), '');
  v_provider text := lower(nullif(btrim(f ->> 'provider'), ''));
  v_sort text := coalesce(nullif(f ->> 'sort', ''), 'ltv');
  v_chat text[];
  v_prov text[];
begin
  if coalesce((f ->> 'has_chat')::boolean, false) then
    select coalesce(array_agg(distinct r.phone_normalized), '{}') into v_chat
    from dsales.dsales_sendable_rooms() r where v_brand is null or r.brand = v_brand;
  end if;
  if v_provider is not null then
    select coalesce(array_agg(distinct l.phone_normalized), '{}') into v_prov
    from dsales.dsales_chat_links l join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where lower(s.channel) = v_provider;
  end if;

  return query
  with cand as (
    select b.*, l.id as l_id, coalesce(l.no_call, false) as l_no_call, coalesce(l.owner_id, b.owner_id) as eff_owner
    from dsales.dsales_customer_base b
    left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
    where b.eligible
      and (v_brand is null or v_brand = any (b.brands))
      and (v_t = '' or position(v_t in lower(b.name)) > 0 or position(v_t in lower(coalesce(b.chat_name, ''))) > 0
           or (v_d <> '' and b.phone_normalized like '%' || v_d || '%'))
      and (v_rfm is null or coalesce(b.rfm_segment, '') = any (v_rfm))
      and (v_dmin is null or b.dormant_days >= v_dmin)
      and (v_dmax is null or b.dormant_days <= v_dmax)
      and (v_ltv is null or b.ltv >= v_ltv)
      and (v_orders is null or b.order_count >= v_orders)
      and (v_tag is null or (v_tag = 'none' and b.owner_tag is null) or lower(b.owner_tag) = lower(v_tag))
      and (v_chat is null or b.phone_normalized = any (v_chat))
      and (v_prov is null or b.phone_normalized = any (v_prov))
  ),
  scoped as (
    select c.* from cand c
    where case p_scope when 'mine' then c.eff_owner = v_uid
                       when 'pool' then c.eff_owner is null
                       when 'team' then v_admin
                       else false end
  ),
  page as (
    select x.*, count(*) over () as n
    from scoped x
    order by case when v_sort = 'dormant_asc' then x.dormant_days end asc nulls last,
             case when v_sort = 'dormant_desc' then x.dormant_days end desc nulls last,
             case when v_sort = 'last_desc' then x.last_order_date end desc nulls last,
             case when v_sort = 'orders_desc' then x.order_count end desc nulls last,
             x.ltv desc nulls last, x.phone_normalized
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  rooms as (
    select p.*, dsales.dsales_customer_rooms(p.phone_normalized) as r_json from page p
  )
  select p.identity_id, p.name, p.phone_normalized, p.chat_name, p.segment, p.rfm_segment, p.ltv, p.order_count,
         p.last_order_date, p.brands, p.n, p.l_id, p.eff_owner is not null, p.eff_owner = v_uid, p.l_no_call,
         case when v_admin and p.eff_owner is not null
              then (select m.display_name from dsales.dsales_members m where m.user_id = p.eff_owner) end,
         p.dormant_days, p.owner_tag, p.r_json,
         coalesce((select array_agg(distinct e ->> 'brand' order by e ->> 'brand') from jsonb_array_elements(p.r_json) e
                   where (e ->> 'sendable')::boolean), '{}'::text[])
  from rooms p
  order by case when v_sort = 'dormant_asc' then p.dormant_days end asc nulls last,
           case when v_sort = 'dormant_desc' then p.dormant_days end desc nulls last,
           case when v_sort = 'last_desc' then p.last_order_date end desc nulls last,
           case when v_sort = 'orders_desc' then p.order_count end desc nulls last,
           p.ltv desc nulls last, p.phone_normalized;
end $function$;

/* ---------- worker: buyer-ID lookups ---------- */

-- A buyer ID that ordered with more than this many phones is an agent / staff / shared account: its rooms are stored
-- but not linked (one room would otherwise be every one of those customers' room). 2026-11-20: 5,091 IDs had 1 phone,
-- 53 had 2, 4 had 3, 8 had 4–21.
create or replace function dsales.dsales_link_max_phones() returns integer
language sql immutable as $$ select 3 $$;
revoke all on function dsales.dsales_link_max_phones() from public, anon, authenticated;

-- buyer IDs to search in JST: order_tracking.buyer_account_no on chat-capable shops (FB_, LOA_, SH_, LA_, TT_, IG_)
-- with an eligible base customer and at most dsales_link_max_phones() phones.
-- Never-searched IDs first (highest LTV first), then IDs last searched > 14 days ago. ~0.6 s (one pass over orders).
create or replace function dsales.dsales_worker_link_targets(p_worker text, p_limit integer default 20)
returns table (buyer_id text, shop_prefix text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid();
begin
  return query
  with o as (
    select btrim(x.buyer_account_no) as bid, upper(split_part(x.shop, '_', 1)) as sp, dsales.dsales_norm_phone(x.phone) as phone
    from public.order_tracking x
    where btrim(x.buyer_account_no) ~ '^[A-Za-z0-9._-]{5,64}$'
      and upper(split_part(x.shop, '_', 1)) in ('FB', 'LOA', 'SH', 'LA', 'TT', 'IG')
  ), ids as (
    select o.bid, min(o.sp) as sp, max(b.ltv) as ltv, count(distinct o.phone) as nph, bool_or(b.phone_normalized is not null) as in_base
    from o left join dsales.dsales_customer_base b on b.phone_normalized = o.phone and b.eligible
    group by o.bid
  )
  select i.bid, i.sp
  from ids i
  left join dsales.dsales_buyer_lookups k on k.buyer_id = i.bid
  where i.in_base and i.nph <= dsales.dsales_link_max_phones()
    and (k.buyer_id is null or k.looked_up_at < now() - interval '14 days')
  order by k.looked_up_at asc nulls first, i.ltv desc nulls last, i.bid
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
end $$;

-- store one lookup: p_rooms = [{ms_id, outer_user_id, provider, page, name, expired, last_message_time}] from JST.
-- Rooms whose outer_user_id is not exactly p_buyer_id are ignored. Links every phone that ordered with this buyer ID.
-- p_error set = the search failed; the lookup is recorded (retried after 14 days) and nothing is linked.
-- More than dsales_link_max_phones() phones: rooms are stored, nothing is linked, lookup error = 'too_many_phones'.
-- Returns the number of (room, phone) links written.
create or replace function dsales.dsales_worker_link_save(p_worker text, p_buyer_id text, p_rooms jsonb, p_error text default null)
returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_worker_uid(); v_bid text := btrim(coalesce(p_buyer_id, '')); v_rooms int := 0; v_links int := 0;
  v_err text := p_error; v_nph int;
begin
  if v_bid !~ '^[A-Za-z0-9._-]{5,64}$' then raise exception 'invalid_buyer_id'; end if;
  if p_error is null and jsonb_typeof(coalesce(p_rooms, '[]'::jsonb)) <> 'array' then raise exception 'invalid_rooms'; end if;
  if p_error is null and jsonb_array_length(coalesce(p_rooms, '[]'::jsonb)) > 50 then raise exception 'too_many_rooms'; end if;

  select count(distinct dsales.dsales_norm_phone(o.phone)) into v_nph
    from public.order_tracking o where btrim(o.buyer_account_no) = v_bid;

  if p_error is null then
    with r as (
      select (e ->> 'ms_id')::bigint as ms_id, e ->> 'provider' as provider, e ->> 'page' as page, e ->> 'name' as name,
             coalesce((e ->> 'expired')::boolean, false) as expired, nullif(e ->> 'last_message_time', '')::timestamptz as lmt
      from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb)) e
      where e ->> 'outer_user_id' = v_bid and (e ->> 'ms_id') ~ '^[0-9]{1,18}$'
    ), up as (
      insert into dsales.dsales_jst_rooms as j (ms_id, outer_user_id, provider, page, name, expired, last_message_time, fetched_at)
      select r.ms_id, v_bid, left(r.provider, 50), left(r.page, 200), left(r.name, 200), r.expired, r.lmt, now() from r
      on conflict (ms_id) do update set outer_user_id = excluded.outer_user_id, provider = excluded.provider, page = excluded.page,
        name = excluded.name, expired = excluded.expired, last_message_time = excluded.last_message_time, fetched_at = now()
      returning j.ms_id
    ), phones as (
      select distinct dsales.dsales_norm_phone(o.phone) as phone
      from public.order_tracking o where btrim(o.buyer_account_no) = v_bid
    ), ln as (
      insert into dsales.dsales_chat_links as c (ms_id, phone_normalized, method, evidence, confidence)
      select u.ms_id, p.phone, 'buyer_id', v_bid, 'high' from up u cross join phones p
      where p.phone is not null and v_nph <= dsales.dsales_link_max_phones()
      on conflict (ms_id, phone_normalized) do update set method = 'buyer_id', evidence = excluded.evidence,
        confidence = 'high', linked_at = now()
        where c.method in ('chat_name', 'buyer_id')
      returning 1
    )
    select (select count(*) from up), (select count(*) from ln) into v_rooms, v_links;
    if v_nph > dsales.dsales_link_max_phones() then v_err := 'too_many_phones'; end if;
  end if;

  insert into dsales.dsales_buyer_lookups as k (buyer_id, looked_up_at, rooms_found, error, worker)
  values (v_bid, now(), v_rooms, left(v_err, 300), left(p_worker, 100))
  on conflict (buyer_id) do update set looked_up_at = now(), rooms_found = excluded.rooms_found, error = excluded.error,
    worker = excluded.worker;
  return v_links;
end $$;

revoke all on function dsales.dsales_worker_link_targets(text, integer), dsales.dsales_worker_link_save(text, text, jsonb, text)
  from public, anon;
grant execute on function dsales.dsales_worker_link_targets(text, integer), dsales.dsales_worker_link_save(text, text, jsonb, text)
  to authenticated;
