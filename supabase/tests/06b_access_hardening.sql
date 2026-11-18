begin;
-- Task 1b: helper dsales_is_member, RLS ของสมาชิกที่ถูกปิด, ห้ามเขียน dsales_members ตรง, advisory lock, สิทธิ์ dsales_uid
do $$
declare v_admin uuid; v_out uuid; v_lead uuid; v_n bigint; v_hit boolean := false;
begin
  select user_id into v_admin from dsales.dsales_members order by created_at limit 1;
  assert (select role = 'admin' and active from dsales.dsales_members where user_id = v_admin),
         'the existing member must be an active admin';
  select u.id into v_out
  from auth.users u
  where u.email is not null and not exists (select 1 from dsales.dsales_members m where m.user_id = u.id)
  order by u.created_at limit 1;
  assert v_out is not null, 'need at least one auth user who is not a member';

  -- dsales_is_member
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_is_member() is true, 'dsales_is_member must be true for the active admin';
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  assert dsales.dsales_is_member() is false, 'dsales_is_member must be false for a random uuid';
  perform set_config('request.jwt.claims', '', true);
  assert dsales.dsales_is_member() is false, 'dsales_is_member must be false when not logged in';

  -- ข้อมูลทดสอบ (postgres ข้าม RLS): เซลล์ active + ลีดของเขา + แคมเปญ
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_out, 'sales', 'rls-test', true);
  insert into dsales.dsales_leads (owner_id, source, brand, name, phone, phone_normalized)
    values (v_out, 'self', 'bebeplay', 'RLS Test', '0899999999', '0899999999') returning id into v_lead;
  insert into dsales.dsales_campaigns (brand, name) values ('bebeplay', 'rls-test-campaign');

  -- สมาชิก active เห็นลีดของตัวเอง + แคมเปญ
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_leads;
  assert v_n = 1, format('active owner must see exactly 1 lead, got %s', v_n);
  select count(*) into v_n from dsales.dsales_campaigns;
  assert v_n >= 1, format('active member must see campaigns, got %s', v_n);
  reset role;

  -- ปิดใช้งาน: ลีดและแคมเปญหายไป
  update dsales.dsales_members set active = false where user_id = v_out;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_leads;
  assert v_n = 0, format('inactive owner must see 0 leads, got %s', v_n);
  select count(*) into v_n from dsales.dsales_campaigns;
  assert v_n = 0, format('inactive member must see 0 campaigns, got %s', v_n);
  reset role;

  -- คนที่ไม่ใช่สมาชิกเลย: แคมเปญ 0 แถว (ทั้งที่มีแคมเปญอยู่)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_campaigns;
  assert v_n = 0, format('non-member must see 0 campaigns, got %s', v_n);
  reset role;
  assert (select count(*) from dsales.dsales_campaigns) >= 1, 'campaign must exist for postgres';

  -- หัวหน้าเขียน dsales_members ตรงไม่ได้
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    update dsales.dsales_members set active = active;
  exception when insufficient_privilege then
    v_hit := true;
  end;
  reset role;
  assert v_hit, 'authenticated direct UPDATE on dsales_members must raise insufficient_privilege';
  assert not has_table_privilege('authenticated', 'dsales.dsales_members', 'insert'), 'no insert for authenticated';
  assert not has_table_privilege('authenticated', 'dsales.dsales_members', 'delete'), 'no delete for authenticated';
  assert not has_table_privilege('authenticated', 'dsales.dsales_members', 'truncate'), 'no truncate for authenticated';
  assert has_table_privilege('authenticated', 'dsales.dsales_members', 'select'), 'authenticated keeps select';

  -- advisory lock ในฟังก์ชันจัดการสมาชิก
  assert (select prosrc from pg_proc where oid = 'dsales.dsales_add_member(text, text)'::regprocedure) like '%pg_advisory_xact_lock%',
         'dsales_add_member must take the advisory lock';
  assert (select prosrc from pg_proc where oid = 'dsales.dsales_set_member_active(uuid, boolean)'::regprocedure) like '%pg_advisory_xact_lock%',
         'dsales_set_member_active must take the advisory lock';
  assert has_function_privilege('authenticated', 'dsales.dsales_add_member(text, text)', 'execute'), 'authenticated keeps add_member';
  assert not has_function_privilege('anon', 'dsales.dsales_set_member_active(uuid, boolean)', 'execute'), 'anon no set_member_active';

  -- สิทธิ์ dsales_uid / dsales_is_member
  assert not has_function_privilege('anon', 'dsales.dsales_uid()', 'execute'), 'anon must not execute dsales_uid';
  assert has_function_privilege('authenticated', 'dsales.dsales_uid()', 'execute'), 'authenticated must execute dsales_uid';
  assert not has_function_privilege('anon', 'dsales.dsales_is_member()', 'execute'), 'anon must not execute dsales_is_member';
  assert has_function_privilege('authenticated', 'dsales.dsales_is_member()', 'execute'), 'authenticated must execute dsales_is_member';
  -- ไม่มี TRUNCATE (ข้าม RLS) / TRIGGER / REFERENCES ให้ authenticated และ anon ในทุกตาราง dsales
  assert not exists (
    select 1 from unnest(array['dsales_leads', 'dsales_interactions', 'dsales_campaigns', 'dsales_members']) t,
                  unnest(array['authenticated', 'anon']) r,
                  unnest(array['TRUNCATE', 'TRIGGER', 'REFERENCES']) pr
    where has_table_privilege(r, 'dsales.' || t, pr)), 'authenticated/anon must not have TRUNCATE/TRIGGER/REFERENCES on dsales tables';
  assert has_table_privilege('authenticated', 'dsales.dsales_leads', 'select'), 'authenticated keeps select on leads';
  assert has_table_privilege('authenticated', 'dsales.dsales_campaigns', 'select'), 'authenticated keeps select on campaigns';
  assert has_table_privilege('authenticated', 'dsales.dsales_interactions', 'select'), 'authenticated keeps select on interactions';
  assert has_table_privilege('authenticated', 'dsales.dsales_campaigns', 'update'), 'campaigns write stays (RLS governs)';
  assert not exists (select 1 from pg_policies where schemaname = 'dsales' and policyname = 'dsales_members_write'),
         'dsales_members_write policy must be dropped';
end $$;
rollback;
