begin;
do $$
declare v_n integer; v_dup bigint;
begin
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'dsales' and table_name = 'dsales_members' and column_name = 'jst_tags'),
         'dsales_members.jst_tags should exist';

  v_n := dsales.dsales_seed_chat_links_by_name();
  assert v_n > 1000, format('expected more than 1000 sessions linked by unique chat name, got %s', v_n);

  -- ชื่อแชตที่ซ้ำหลายเบอร์ต้องไม่ถูกผูก: 1 ห้องที่ผูกด้วยชื่อแชตต้องมีเบอร์เดียว
  select count(*) into v_dup from (
    select ms_id from dsales.dsales_chat_links where method = 'chat_name' group by ms_id having count(*) > 1) x;
  assert v_dup = 0, format('%s sessions were linked to more than one phone by name', v_dup);

  assert dsales.dsales_seed_chat_links_by_name() = 0, 'seeding twice must not insert duplicates';
end $$;
rollback;
