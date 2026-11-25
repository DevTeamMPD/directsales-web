begin;
-- dsales_base_customers: p_filters, chat_rooms (channel icons) and chat_brands (worker can message)
create temp table _r(k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_sales uuid; v_all bigint; v_chat bigint; v_bad bigint; t0 timestamptz; v_phone text; v_brands text[]; v_rooms jsonb; v_secs numeric;
begin
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  -- a pool phone whose only rooms are LINE on the Host Tail page -> chat_brands = {hosttail}
  select l.phone_normalized into v_phone
  from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
  join dsales.dsales_customer_base b on b.phone_normalized = l.phone_normalized
  where s.page = 'Host Tail' and lower(s.channel) = 'line' and b.eligible and b.owner_id is null
    and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized and x.owner_id is not null)
    and not exists (select 1 from dsales.dsales_excluded_customers(l.phone_normalized))
    and not exists (select 1 from dsales.dsales_chat_links l2 join public.iim_sessions s2 on s2.ms_id = l2.ms_id
                    where l2.phone_normalized = l.phone_normalized and s2.page <> 'Host Tail')
  limit 1;
  assert v_phone is not null, 'need a pool phone with only a Host Tail LINE room';

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);

  -- default call stays fast; old 5-argument call works
  t0 := clock_timestamp();
  perform * from dsales.dsales_base_customers('pool', null, 50, 0, null);
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('default_s', round(v_secs, 3)::text);
  assert v_secs < 1, format('default call too slow: %s s', v_secs);

  select r.chat_brands, r.chat_rooms into v_brands, v_rooms from dsales.dsales_base_customers('pool', v_phone, 5, 0, null) r where r.phone = v_phone;
  assert v_brands = array['hosttail'], format('expected {hosttail}, got %s', v_brands);
  assert v_rooms -> 0 ->> 'provider' = 'line' and (v_rooms -> 0 ->> 'sendable')::boolean and v_rooms -> 0 ->> 'brand' = 'hosttail', format('rooms %s', v_rooms);

  select max(r.total_count) into v_all from dsales.dsales_base_customers('pool', null, 1, 0, null) r;
  t0 := clock_timestamp();
  select max(r.total_count) into v_chat from dsales.dsales_base_customers('pool', null, 50, 0, null, '{"has_chat": true}') r;
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('pool_all', v_all::text), ('pool_chat', v_chat::text), ('has_chat_s', round(v_secs, 3)::text);
  assert v_chat > 0 and v_chat < v_all, 'has_chat narrows the pool';
  assert v_secs < 3, format('has_chat too slow: %s s', v_secs);
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"has_chat": true}') r where cardinality(r.chat_brands) = 0;
  assert v_bad = 0, 'has_chat rows can all be messaged';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, 'bebeplay', '{"has_chat": true}') r where not ('bebeplay' = any (r.chat_brands));
  assert v_bad = 0, 'brand + has_chat -> room of that brand';

  -- other filters
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"rfm": ["Loyal"]}') r where r.rfm_segment is distinct from 'Loyal';
  assert v_bad = 0, 'rfm filter';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"dormant_min": 90, "dormant_max": 180}') r where r.dormant_days not between 90 and 180;
  assert v_bad = 0, 'dormant range';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"ltv_min": 10000, "orders_min": 2}') r where r.ltv < 10000 or r.order_count < 2;
  assert v_bad = 0, 'ltv + orders';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"tag": "admin_pop"}') r where lower(r.owner_tag) is distinct from 'admin_pop';
  assert v_bad = 0, 'tag filter (case-insensitive)';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"tag": "none"}') r where r.owner_tag is not null;
  assert v_bad = 0, 'tag none';
  select count(*) into v_bad from dsales.dsales_base_customers('pool', null, 100, 0, null, '{"provider": "line"}') r
    where not exists (select 1 from jsonb_array_elements(r.chat_rooms) e where e ->> 'provider' = 'line');
  assert v_bad = 0, 'provider filter';
  -- sort by dormant ascending
  select count(*) into v_bad from (
    select r.dormant_days, lag(r.dormant_days) over () as prev from dsales.dsales_base_customers('pool', null, 50, 0, null, '{"sort": "dormant_asc"}') r) z
    where z.prev > z.dormant_days;
  assert v_bad = 0, 'dormant_asc sort';
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 09_base_customers_chat' from _r;
rollback;
