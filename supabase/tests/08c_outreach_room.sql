begin;
do $$
declare v_phone text; r record; v_fb text; v_none text;
begin
  -- a phone that has a Bebeplay LINE room
  select l.phone_normalized into v_phone
  from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
  where s.page = 'Bebeplayofficial' and lower(s.channel) = 'line' limit 1;
  assert v_phone is not null, 'need a phone with a Bebeplayofficial LINE room';
  select * into r from dsales.dsales_outreach_room(v_phone, 'bebeplay');
  assert r.skip is null and r.ms_id is not null and lower(r.provider) = 'line', format('expected a LINE room, got %s', to_jsonb(r));

  -- same phone, other brand -> no room of that brand (unless it also has one)
  select * into r from dsales.dsales_outreach_room(v_phone, 'hosttail');
  assert r.skip is null or r.skip in ('no_chat_room', 'window_closed'), 'hosttail lookup returns a room or a reason';

  -- a phone whose only bebeplay room is Facebook with no customer message within the send window (dsales_meta_window) -> window_closed
  select l.phone_normalized into v_fb
  from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
  where s.page = 'Bebeplay' and lower(s.channel) = 'facebook'
    and not exists (select 1 from dsales.dsales_chat_links l2 join public.iim_sessions s2 on s2.ms_id = l2.ms_id
                    where l2.phone_normalized = l.phone_normalized and s2.ms_id <> s.ms_id)
    and not exists (select 1 from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer' and m.time > now() - dsales.dsales_meta_window())
  limit 1;
  if v_fb is not null then
    select * into r from dsales.dsales_outreach_room(v_fb, 'bebeplay');
    assert r.skip = 'window_closed' and r.ms_id is null, format('expected window_closed, got %s', to_jsonb(r));
  end if;

  -- a phone with no chat link -> no_chat_room
  select b.phone_normalized into v_none from dsales.dsales_customer_base b
  where not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized) limit 1;
  select * into r from dsales.dsales_outreach_room(v_none, 'bebeplay');
  assert r.skip = 'no_chat_room', 'no link -> no_chat_room';
  assert not has_function_privilege('authenticated', 'dsales.dsales_outreach_room(text,text)', 'execute'), 'room picker is internal';
  raise notice 'OK 08c_outreach_room';
end $$;
rollback;
