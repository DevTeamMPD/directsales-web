begin;
do $$
declare v_days integer; v_user uuid; v_owned bigint; v_rows integer;
begin
  update dsales.dsales_members set jst_tags = '{}'; -- เริ่มจากไม่มีใครถือ tag (rollback ตอนจบ)
  v_rows := dsales.dsales_refresh_customer_base();
  assert v_rows > 15000, format('customer_base should hold the CRM customers, got %s', v_rows);
  assert v_rows = (select count(*) from dsales.dsales_customer_base), 'refresh must return the row count';

  v_days := (select (value #>> '{}')::integer from dsales.dsales_settings where key = 'dormant_days');
  assert not exists (select 1 from dsales.dsales_customer_base
                     where eligible <> (last_order_date is not null and dormant_days >= v_days)),
         'eligible must mean dormant for at least dormant_days';
  assert not exists (select 1 from dsales.dsales_customer_base where not dsales.dsales_valid_phone(phone_normalized)),
         'only valid phones';
  assert exists (select 1 from dsales.dsales_customer_base where eligible), 'there must be eligible customers';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_id is not null),
         'no owner before any member has tags';

  -- ผูกทุก tag Admin_* ให้สมาชิกคนแรก แล้วลูกค้าที่มี tag ต้องเป็นของคนนั้น
  select user_id into v_user from dsales.dsales_members order by created_at limit 1;
  update dsales.dsales_members m set jst_tags = (
    select array_agg(distinct e.value ->> 'text') from public.iim_sessions s cross join jsonb_array_elements(s.tags) e
    where e.value ->> 'text' ilike 'admin\_%') where m.user_id = v_user;
  perform dsales.dsales_refresh_customer_base();
  select count(*) into v_owned from dsales.dsales_customer_base where owner_tag is not null;
  assert v_owned > 0, 'some customers must get an Admin_ tag through chat links';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_tag is not null and owner_id is distinct from v_user),
         'every tagged customer must belong to the member holding that tag';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_tag is null and owner_id is not null),
         'owner requires a tag';

  -- เปลี่ยนเกณฑ์วันแล้ว eligible ต้องเปลี่ยนตาม
  update dsales.dsales_settings set value = '100000' where key = 'dormant_days';
  perform dsales.dsales_refresh_customer_base();
  assert not exists (select 1 from dsales.dsales_customer_base where eligible), 'dormant_days setting must drive eligible';
end $$;
rollback;
