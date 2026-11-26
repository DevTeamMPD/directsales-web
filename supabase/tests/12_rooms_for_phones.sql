begin;
-- dsales_rooms_for_phones (20261123090000): เซลล์ได้เฉพาะเบอร์ของลีดที่ตัวเองเป็นเจ้าของ, หัวหน้าได้ทุกเบอร์,
-- JSON ห้อง = dsales_customer_rooms, เบอร์ซ้ำ/ว่างถูกตัด, เกิน 100 เบอร์ = too_many_phones, 100 เบอร์ < 1 วินาที (DB ใช้ร่วม — เผื่อช่วงโหลดสูง). Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_sales uuid; v_phones text[]; v_mine text; v_other text; v_json jsonb; v_n int; v_ok boolean;
  t0 timestamptz; v_secs numeric;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  -- 100 เบอร์ที่มีห้องผูกและยังไม่มีลีด
  select array_agg(p) into v_phones from (
    select distinct l.phone_normalized as p from dsales.dsales_chat_links l
    where not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized)
    order by 1 limit 100) z;
  assert cardinality(v_phones) = 100, 'fixture: 100 linked phones without a lead';
  v_mine := v_phones[1];
  v_other := v_phones[2];
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ', v_mine, v_mine, v_sales, v_sales, now(), v_sales);
  v_json := dsales.dsales_customer_rooms(v_mine); -- ก่อนสลับ role (ฟังก์ชันนี้ไม่ให้ authenticated เรียก)

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_rooms_for_phones(array[v_mine, v_other, v_mine, ' ', null]);
  assert v_n = 1, format('sales gets only phones of own leads, deduped, got %s rows', v_n);
  assert (select r.rooms from dsales.dsales_rooms_for_phones(array[v_mine]) r) = v_json, 'rooms JSON = dsales_customer_rooms';
  assert (select r.phone from dsales.dsales_rooms_for_phones(array[' ' || v_mine]) r) = v_mine, 'phone trimmed';
  v_ok := false;
  begin
    perform dsales.dsales_rooms_for_phones(v_phones || array['0800000000']);
  exception when others then v_ok := sqlerrm = 'too_many_phones';
  end;
  assert v_ok, '101 phones -> too_many_phones';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_rooms_for_phones(array[v_mine, v_other]);
  assert v_n = 2, format('admin gets every phone, got %s', v_n);
  t0 := clock_timestamp();
  perform * from dsales.dsales_rooms_for_phones(v_phones);
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('admin_100_s', round(v_secs, 3)::text);
  assert v_secs < 1, format('100 phones too slow: %s s', v_secs);
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 12_rooms_for_phones' from _r;
rollback;
