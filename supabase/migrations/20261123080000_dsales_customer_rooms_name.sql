-- dsales: dsales_customer_rooms returns each room's own chat name (2026-11-23).
-- The channel icons on /mine and /pool copied one chat name per customer (dsales_customer_base.chat_name) for every
-- room, so a customer with two rooms named differently got the wrong name pasted into the JST / Meta search.
-- New key "name" = dsales_room_of(ms_id).customer (JST name of that room). Additive: clients that ignore it keep working.

create or replace function dsales.dsales_customer_rooms(p_phone text) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  with map as (
    select b.key as brand, jsonb_array_elements_text(b.value) as page
    from jsonb_each(coalesce(dsales.dsales_setting('page_brand_map'), '{}'::jsonb)) b
  ), rooms as (
    select s.ms_id, s.channel, s.page, s.last_time, s.customer, m.brand, s.outer_user_id,
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
                                               'brand', r.brand, 'sendable', r.sendable, 'name', r.customer)
                            || case when r.meta then jsonb_build_object(
                                 'outer_user_id', r.outer_user_id,
                                 'meta_page_id', dsales.dsales_setting('meta_page_ids') ->> r.page,
                                 'meta_business_id', dsales.dsales_setting('meta_business_id') #>> '{}') else '{}'::jsonb end
                            order by r.sendable desc, r.last_time desc nulls last), '[]'::jsonb)
  from rooms r
$$;
revoke all on function dsales.dsales_customer_rooms(text) from public, anon, authenticated;
