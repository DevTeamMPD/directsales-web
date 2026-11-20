-- /mine and /pool: filters beyond name/phone search, chat rooms per row (channel icons) and which brands a
-- customer can be messaged on through the worker (chat_brands). Room rules match dsales_outreach_room: a linked
-- room on a page of the brand (page_brand_map); Facebook/Instagram only when the customer wrote in the last 24 h.
--
-- p_filters (jsonb, all keys optional):
--   rfm        text[]   rfm_segment values; '' = no segment
--   dormant_min/dormant_max  int   days since last order
--   ltv_min    numeric  lifetime value at least
--   orders_min int      order count at least
--   tag        text     owner_tag (JST Admin_*); 'none' = no tag
--   has_chat   boolean  only customers that can be messaged (for p_brand when given)
--   provider   text     has a linked room on this channel (line/shopee/lazada/facebook/instagram/tiktok)
--   sort       text     ltv (default) | dormant_asc | dormant_desc | last_desc | orders_desc
-- chat_rooms / chat_brands are computed only for the returned page (≤ 100 rows); the sendable set (~130 ms) is
-- built only when has_chat is on, so the default call stays ~25 ms.
-- Replaces the 5-argument signature; p_filters defaults to '{}' so named-argument calls from the deployed web
-- keep working and ignore the extra output columns.

-- linked rooms of a phone, with brand and whether the worker can message it now
create or replace function dsales.dsales_customer_rooms(p_phone text) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), rooms as (
    select s.ms_id, s.channel, s.page, s.last_time, m.brand,
           m.brand is not null and (lower(s.channel) not in ('facebook', 'instagram')
             or exists (select 1 from dsales.dsales_chat_messages_v cm
                        where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - interval '24 hours')) as sendable
    from dsales.dsales_chat_links l
    join public.iim_sessions s on s.ms_id = l.ms_id
    left join map m on m.page = s.page
    where l.phone_normalized = p_phone
  )
  select coalesce(jsonb_agg(jsonb_build_object('ms_id', r.ms_id, 'provider', lower(r.channel), 'page', r.page,
                                               'brand', r.brand, 'sendable', r.sendable)
                            order by r.sendable desc, r.last_time desc nulls last), '[]'::jsonb)
  from rooms r
$$;
revoke all on function dsales.dsales_customer_rooms(text) from public, anon, authenticated;

-- every (phone, brand) the worker can message — used by the has_chat filter
create or replace function dsales.dsales_sendable_rooms()
returns table (phone_normalized text, brand text)
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  )
  select distinct l.phone_normalized, m.brand
  from dsales.dsales_chat_links l
  join public.iim_sessions s on s.ms_id = l.ms_id
  join map m on m.page = s.page
  where lower(s.channel) not in ('facebook', 'instagram')
     or exists (select 1 from dsales.dsales_chat_messages_v cm
                where cm.ms_id = s.ms_id and cm.dir = 'customer' and cm.time > now() - interval '24 hours')
$$;
revoke all on function dsales.dsales_sendable_rooms() from public, anon, authenticated;

drop function if exists dsales.dsales_base_customers(text, text, integer, integer, text);

create function dsales.dsales_base_customers(p_scope text, p_search text default null, p_limit integer default 50,
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
    from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
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

revoke all on function dsales.dsales_base_customers(text, text, integer, integer, text, jsonb) from public, anon;
grant execute on function dsales.dsales_base_customers(text, text, integer, integer, text, jsonb) to authenticated;
