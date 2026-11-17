begin;
do $$
declare v_raw timestamptz; v_fixed timestamptz; v_late bigint;
begin
  assert (select value #>> '{}' from dsales.dsales_settings where key = 'dormant_days') = '30', 'dormant_days should default to 30';
  assert (select value #>> '{}' from dsales.dsales_settings where key = 'window_days') = '30', 'window_days should default to 30';

  select m.time, v.time into v_raw, v_fixed
  from public.iim_messages m join dsales.dsales_chat_messages_v v on v.id = m.id
  order by m.id desc limit 1;
  assert v_raw - v_fixed = interval '7 hours', format('expected a 7 hour correction, got %s', v_raw - v_fixed);

  select count(*) into v_late
  from dsales.dsales_chat_messages_v v join public.iim_sessions s on s.ms_id = v.ms_id
  where v.time >= now() - interval '30 days' and v.time > s.fetched_at + interval '5 minutes';
  assert v_late <= 5, format('corrected times should not be after the fetch time, found %s', v_late);
  assert pg_get_functiondef('dsales.dsales_customer_chats(text, timestamptz)'::regprocedure) ~ 'dsales_chat_messages_v'
     and pg_get_functiondef('dsales.dsales_customer_chats(text, timestamptz)'::regprocedure) !~ 'public\.iim_messages',
         'dsales_customer_chats must read the corrected view';
end $$;
rollback;
