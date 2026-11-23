begin;
-- dsales_customer_rooms returns each room's own chat name (key "name" = dsales_room_of(ms_id).customer) so the channel
-- icon copies the name of the room that was clicked (a customer can have rooms with different names). Rolled back.
do $$
declare v_phone text; j jsonb; v_bad int;
begin
  -- a phone with two linked rooms whose names differ
  select l.phone_normalized into v_phone
  from dsales.dsales_chat_links l cross join lateral dsales.dsales_room_of(l.ms_id) r
  group by l.phone_normalized having count(distinct r.customer) > 1 limit 1;
  assert v_phone is not null, 'need a phone with rooms of different names';
  j := dsales.dsales_customer_rooms(v_phone);
  select count(*) into v_bad
  from jsonb_array_elements(j) e
  cross join lateral dsales.dsales_room_of((e ->> 'ms_id')::bigint) r
  where (e ->> 'name') is distinct from r.customer;
  assert v_bad = 0, format('every room carries its own name, got %s', j);
  assert (select count(distinct e ->> 'name') from jsonb_array_elements(j) e) > 1, 'names differ per room';
end $$;
select 'OK 11_customer_rooms_name' as result;
rollback;
