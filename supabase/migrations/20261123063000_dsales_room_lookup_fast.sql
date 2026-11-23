-- dsales: per-customer room lookups by index again (2026-11-23).
-- dsales_customer_rooms / dsales_outreach_room joined dsales_rooms_v (UNION ALL view) and the planner hashed the whole
-- view (31k rooms, ~6-40 ms) for every phone instead of probing iim_sessions by ms_id: /mine and /pool default page
-- went from ~25 ms to ~355 ms (50 rows × dsales_customer_rooms). dsales_room_of(ms_id) is the same row as the view
-- for one room; it is a plain SQL function (no security definer / SET) so the planner inlines it and probes
-- iim_sessions_pkey and dsales_jst_rooms_pkey. Results unchanged.

create or replace function dsales.dsales_room_of(p_ms_id bigint)
returns table (ms_id bigint, channel text, page text, customer text, last_time timestamptz, outer_user_id text, expired boolean)
language sql stable as $$
  select s.ms_id,
         coalesce(nullif(j.provider, ''), s.channel),
         coalesce(nullif(j.page, ''), s.page),
         coalesce(nullif(j.name, ''), s.customer),
         greatest(s.last_time, j.last_message_time),
         j.outer_user_id,
         coalesce(j.expired, false)
  from public.iim_sessions s
  left join dsales.dsales_jst_rooms j on j.ms_id = s.ms_id
  where s.ms_id = p_ms_id
  union all
  select j.ms_id, j.provider, j.page, j.name, j.last_message_time, j.outer_user_id, j.expired
  from dsales.dsales_jst_rooms j
  where j.ms_id = p_ms_id and not exists (select 1 from public.iim_sessions s where s.ms_id = p_ms_id)
$$;
revoke all on function dsales.dsales_room_of(bigint) from public, anon, authenticated;

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
    cross join lateral dsales.dsales_room_of(l.ms_id) s
    where l.phone_normalized = p_phone and s.page in (select p.page from pages p)
  )
  select r.ms_id, r.page, r.provider, r.chat_name, null::text
  from rooms r where not r.closed order by r.rnk, r.last_time desc nulls last limit 1;
  if found then return; end if;

  select exists (
    select 1 from dsales.dsales_chat_links l cross join lateral dsales.dsales_room_of(l.ms_id) s
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
    cross join lateral dsales.dsales_room_of(l.ms_id) s
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
