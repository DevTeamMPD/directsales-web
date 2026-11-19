begin;
do $$
declare v_n integer; v_dup bigint; v_loose bigint;
begin
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'dsales' and table_name = 'dsales_members' and column_name = 'jst_tags'),
         'dsales_members.jst_tags should exist';

  -- ลิงก์วิธีอื่นต้องไม่ถูกลบตอน seed ใหม่ (ms_id ติดลบ = ไม่มีห้องจริง, rollback ตอนจบ)
  insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence)
  values (-1, '0812345678', 'manual', 'test', 'high');

  v_n := dsales.dsales_seed_chat_links_by_name();
  assert v_n > 1000, format('expected more than 1000 sessions linked by unique chat name, got %s', v_n);
  assert v_n = (select count(*) from dsales.dsales_chat_links where method = 'chat_name'),
         'seed must return the number of chat_name links';

  -- ชื่อแชตที่ซ้ำหลายเบอร์ต้องไม่ถูกผูก: 1 ห้องที่ผูกด้วยชื่อแชตต้องมีเบอร์เดียว
  select count(*) into v_dup from (
    select ms_id from dsales.dsales_chat_links where method = 'chat_name' group by ms_id having count(*) > 1) x;
  assert v_dup = 0, format('%s sessions were linked to more than one phone by name', v_dup);

  -- ชื่อที่หลวมเกินไปต้องไม่ถูกผูก: คำเดียวสั้นกว่า 6 ตัว, ชื่อแทน (facebook user / มี *), ตัวเลขล้วน
  select count(*) into v_loose
  from dsales.dsales_chat_links cl join public.iim_sessions s on s.ms_id = cl.ms_id
  where cl.method = 'chat_name'
    and ((btrim(s.customer) !~ '\s' and length(btrim(s.customer)) < 6)
         or lower(btrim(s.customer)) = 'facebook user'
         or s.customer like '%*%'
         or btrim(s.customer) ~ '^[0-9]+$');
  assert v_loose = 0, format('%s sessions were linked by a short, placeholder or digits-only name', v_loose);

  -- seed ซ้ำ = สร้างลิงก์ชื่อแชตใหม่ทั้งชุด ได้จำนวนเท่าเดิม ไม่มีแถวซ้ำ และไม่แตะลิงก์วิธีอื่น
  assert dsales.dsales_seed_chat_links_by_name() = v_n, 'seeding twice must rebuild the same chat_name links';
  assert (select count(*) from dsales.dsales_chat_links where method = 'chat_name') = v_n,
         'seeding twice must not leave duplicates';
  assert exists (select 1 from dsales.dsales_chat_links where ms_id = -1 and method = 'manual'),
         'seeding must not delete links of other methods';
end $$;
rollback;
