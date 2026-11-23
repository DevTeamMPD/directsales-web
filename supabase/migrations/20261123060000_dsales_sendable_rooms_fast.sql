-- dsales: dsales_sendable_rooms fast again (2026-11-23).
-- After 20261120150000 joined dsales_rooms_v (a UNION ALL view), the planner turned the Facebook / Instagram 24 h check
-- into a hashed subplan that scans all of iim_messages (~735k rows): 4.3 s alone, 5.9 s for the has_chat filter of
-- /mine and /pool (test 09 limit 3 s; authenticated statement_timeout is 8 s). Same result, new shape: the linked rooms
-- are built first (materialized, ~2.4k rows), and the 24 h check is a LATERAL ... LIMIT 1 probe per Facebook /
-- Instagram room on idx_iim_messages_ms_id.

create or replace function dsales.dsales_sendable_rooms()
returns table (phone_normalized text, brand text)
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), r as materialized (
    select l.phone_normalized, s.ms_id, lower(s.channel) as channel, s.page
    from dsales.dsales_chat_links l
    join dsales.dsales_rooms_v s on s.ms_id = l.ms_id
    where not s.expired
  )
  select distinct r.phone_normalized, m.brand
  from r
  join map m on m.page = r.page
  left join lateral (
    select 1 as ok from dsales.dsales_chat_messages_v cm
    where r.channel in ('facebook', 'instagram')
      and cm.ms_id = r.ms_id and cm.dir = 'customer' and cm.time > now() - interval '24 hours'
    limit 1
  ) w on true
  where r.channel not in ('facebook', 'instagram') or w.ok is not null
$$;
revoke all on function dsales.dsales_sendable_rooms() from public, anon, authenticated;
