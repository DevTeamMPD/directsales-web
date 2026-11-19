begin;
-- คืน 'no error' หรือ '<sqlstate> <ข้อความ>' ของคำสั่งที่ส่งเข้าไป (อยู่ใน pg_temp และหายตอน rollback)
create function pg_temp.err_of(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'no error';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

do $$
declare v_admin uuid; v_admin_email text; v_out uuid; v_out_email text; v_me record; v_j jsonb; v_e text; v_sql text;
begin
  select user_id into v_admin from dsales.dsales_members order by created_at limit 1;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin;
  assert (select role = 'admin' and active from dsales.dsales_members where user_id = v_admin),
         'the existing member must be an active admin';
  select u.id, u.email::text into v_out, v_out_email
  from auth.users u
  where u.email is not null and not exists (select 1 from dsales.dsales_members m where m.user_id = u.id)
  order by u.created_at limit 1;
  assert v_out is not null, 'need at least one auth user who is not a member';

  -- ไม่ได้ล็อกอิน
  perform set_config('request.jwt.claims', '', true);
  v_e := pg_temp.err_of('select dsales.dsales_uid()');
  assert v_e = '28000 not_authenticated', format('anonymous: expected 28000 not_authenticated, got %s', v_e);

  -- ล็อกอินแต่ไม่มีแถวสมาชิก
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_e := pg_temp.err_of('select dsales.dsales_team()');
  assert v_e = '42501 not_member', format('unknown user: expected 42501 not_member from dsales_team, got %s', v_e);

  -- บัญชีพนักงานจริงที่ไม่ใช่สมาชิก: dsales_me ตอบได้ ส่วน RPC ข้อมูลลูกค้าถูกปิด
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  select * into v_me from dsales.dsales_me();
  assert v_me.user_id = v_out and v_me.is_member = false and v_me.active = false and v_me.is_admin = false,
         'dsales_me must describe a non-member without raising';
  v_e := pg_temp.err_of('select dsales.dsales_register()');
  assert v_e = '42501 not_member', format('dsales_register: expected 42501 not_member, got %s', v_e);
  assert not exists (select 1 from dsales.dsales_members where user_id = v_out), 'dsales_register must not add members any more';
  foreach v_sql in array array[
    'select dsales.dsales_my_leads(1, 0)',
    'select dsales.dsales_customer_purchases(''0812345678'')',
    'select dsales.dsales_customer_channels(''0812345678'')',
    'select dsales.dsales_customer_chats(''0812345678'', null)',
    'select dsales.dsales_customer_pool_v3(null, 1, 0, null, null, null)'
  ] loop
    v_e := pg_temp.err_of(v_sql);
    assert v_e = '42501 not_member', format('%s: expected 42501 not_member, got %s', v_sql, v_e);
  end loop;

  -- สมาชิกที่ถูกปิดใช้งาน
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  update dsales.dsales_members set active = false where user_id = v_admin;
  select * into v_me from dsales.dsales_me();
  assert v_me.is_member and not v_me.active and not v_me.is_admin, 'inactive member: is_member true, active false';
  v_e := pg_temp.err_of('select dsales.dsales_team()');
  assert v_e = '42501 not_member', format('inactive member: expected 42501 not_member, got %s', v_e);
  update dsales.dsales_members set active = true where user_id = v_admin;

  -- หัวหน้า active
  select * into v_me from dsales.dsales_me();
  assert v_me.is_member and v_me.active and v_me.is_admin, 'active admin: is_member, active, is_admin all true';
  perform dsales.dsales_customer_channels('0000000000'); -- สมาชิกยังเรียกได้ (เบอร์ซ้ำตัวเดียวจึงไม่ค้นจริง)
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', 'nobody-' || gen_random_uuid() || '@example.invalid', 'sales'));
  assert v_e = 'P0001 user_not_found', format('unknown email: expected P0001 user_not_found, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_out_email, 'boss'));
  assert v_e = 'P0001 invalid_role', format('bad role: expected P0001 invalid_role, got %s', v_e);
  -- หัวหน้าคนเดียว: ลดบทบาทหรือปิดตัวเองไม่ได้ (ต้องเหลือหัวหน้า active อย่างน้อย 1 คน)
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_admin_email, 'sales'));
  assert v_e = 'P0001 last_admin', format('demoting the only admin: expected P0001 last_admin, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, false)', v_admin));
  assert v_e = 'P0001 last_admin', format('deactivating the only admin: expected P0001 last_admin, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, true)', gen_random_uuid()));
  assert v_e = 'P0001 member_not_found', format('unknown member: expected P0001 member_not_found, got %s', v_e);

  v_j := dsales.dsales_add_member(upper(v_out_email), 'sales');
  assert (v_j ->> 'user_id')::uuid = v_out and v_j ->> 'role' = 'sales' and (v_j ->> 'active')::boolean,
         format('add_member returned role %s active %s', v_j ->> 'role', v_j ->> 'active');
  assert exists (select 1 from dsales.dsales_members where user_id = v_out and role = 'sales' and active),
         'add_member must insert an active sales member';
  perform dsales.dsales_set_member_active(v_out, false);
  assert exists (select 1 from dsales.dsales_members where user_id = v_out and not active), 'set_member_active(false) must deactivate';
  perform dsales.dsales_set_member_active(v_out, true);

  -- มีหัวหน้า 2 คน: ปิดตัวเองยังไม่ได้ แต่ลดบทบาทหัวหน้าอีกคนได้
  v_j := dsales.dsales_add_member(v_out_email, 'admin');
  assert v_j ->> 'role' = 'admin', format('promote: expected role admin, got %s', v_j ->> 'role');
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, false)', v_admin));
  assert v_e = 'P0001 cannot_deactivate_self', format('self with another admin: expected P0001 cannot_deactivate_self, got %s', v_e);
  v_j := dsales.dsales_add_member(v_out_email, 'sales');
  assert v_j ->> 'role' = 'sales', format('demoting a second admin must work, got role %s', v_j ->> 'role');

  -- เซลล์ (ไม่ใช่หัวหน้า) เพิ่มสมาชิกไม่ได้
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_out_email, 'admin'));
  assert v_e = 'P0001 forbidden', format('sales adding a member: expected P0001 forbidden, got %s', v_e);

  -- สิทธิ์ execute
  assert not has_function_privilege('anon', 'dsales.dsales_me()', 'execute'), 'anon must not execute dsales_me';
  assert has_function_privilege('authenticated', 'dsales.dsales_me()', 'execute'), 'authenticated must execute dsales_me';
  assert not has_function_privilege('anon', 'dsales.dsales_add_member(text, text)', 'execute'), 'anon must not execute dsales_add_member';
  assert has_function_privilege('authenticated', 'dsales.dsales_set_member_active(uuid, boolean)', 'execute'),
         'authenticated must execute dsales_set_member_active';
end $$;
rollback;
