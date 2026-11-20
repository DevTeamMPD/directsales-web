-- Pick the JST chat room to message for a phone and brand (spec §4.4):
-- linked rooms on that brand's pages; LINE first, then marketplace chats, then Facebook/Instagram;
-- newest activity first. Facebook/Instagram rooms whose last customer message is older than 24 h are
-- closed for shop-initiated messages and are skipped. Returns one row: a room, or skip = reason.

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
           lower(s.channel) in ('facebook', 'instagram')
             and coalesce((select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer'),
                          '-infinity'::timestamptz) < now() - interval '24 hours' as closed
    from dsales.dsales_chat_links l
    join public.iim_sessions s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone and s.page in (select p.page from pages p)
  )
  select r.ms_id, r.page, r.provider, r.chat_name, null::text
  from rooms r where not r.closed order by r.rnk, r.last_time desc nulls last limit 1;
  if found then return; end if;

  select exists (
    select 1 from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone
      and s.page in (select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand))
  ) into v_any;
  return query select null::bigint, null::text, null::text, null::text, case when v_any then 'window_closed' else 'no_chat_room' end;
end $$;
revoke all on function dsales.dsales_outreach_room(text, text) from public, anon, authenticated;
