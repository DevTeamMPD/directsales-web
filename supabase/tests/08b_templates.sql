begin;
do $$
declare v_admin uuid; v_sales uuid; t jsonb; v_list jsonb; v_ok boolean;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  t := dsales.dsales_template_save(null, 'bebeplay', 'ทักลูกค้าเก่า', 'สวัสดีค่ะคุณ{ชื่อ} จาก {ร้าน}', true);
  assert t ->> 'brand' = 'bebeplay' and t ->> 'name' = 'ทักลูกค้าเก่า', 'admin creates a template';
  t := dsales.dsales_template_save((t ->> 'id')::uuid, 'bebeplay', 'ทักลูกค้าเก่า v2', 'สวัสดีค่ะ', false);
  assert t ->> 'name' = 'ทักลูกค้าเก่า v2' and (t ->> 'active')::boolean = false, 'admin edits/deactivates';
  v_list := dsales.dsales_templates_list('bebeplay');
  assert jsonb_array_length(v_list) >= 1, 'admin sees inactive templates too';

  v_ok := false;
  begin perform dsales.dsales_template_save(null, 'other', 'x', 'y', true); exception when others then v_ok := sqlerrm = 'invalid_template'; end;
  assert v_ok, 'invalid brand -> invalid_template';
  v_ok := false;
  begin perform dsales.dsales_template_save(gen_random_uuid(), 'bebeplay', 'x', 'y', true); exception when others then v_ok := sqlerrm = 'not_found'; end;
  assert v_ok, 'unknown id -> not_found';

  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  v_list := dsales.dsales_templates_list('bebeplay');
  assert not exists (select 1 from jsonb_array_elements(v_list) e where (e ->> 'active')::boolean = false), 'sales sees active only';
  v_ok := false;
  begin perform dsales.dsales_template_save(null, 'bebeplay', 'x', 'y', true); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot save templates';
  reset role;
  raise notice 'OK 08b_templates';
end $$;
rollback;
