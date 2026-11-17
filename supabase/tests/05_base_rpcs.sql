begin;
do $$
declare v_user uuid; v_tag text; v_phone text; v_n bigint; v_err text; v_tags text[];
begin
  select user_id into v_user from dsales.dsales_members order by created_at limit 1;
  update dsales.dsales_members set role = 'admin', active = true where user_id = v_user;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- รายการ tag ที่มีใน JST
  select tag into v_tag from dsales.dsales_jst_admin_tags() order by sessions desc limit 1;
  assert v_tag ilike 'admin\_%', format('top tag should be an Admin_ tag, got %s', v_tag);

  -- ผูก tag แล้ว customer_base ถูกคำนวณใหม่ทันที
  v_tags := dsales.dsales_set_member_tags(v_user, array[v_tag, ' ' || v_tag, '']);
  assert v_tags = array[v_tag], format('tags should be trimmed and de-duplicated, got %s', v_tags);
  assert (select jst_tags from dsales.dsales_member_tags() where user_id = v_user) = array[v_tag], 'member_tags should return saved tags';
  assert exists (select 1 from dsales.dsales_customer_base where owner_id = v_user), 'set_member_tags must refresh ownership';

  -- ลูกค้าของฉัน: ทุกแถวเป็นของฉันและเข้าเกณฑ์
  select count(*) into v_n from dsales.dsales_base_customers('mine', null, 100, 0, null) r where not r.mine;
  assert v_n = 0, 'mine scope must only return my customers';
  assert exists (select 1 from dsales.dsales_base_customers('mine', null, 1, 0, null)), 'I should own customers after tagging';
  assert (select dormant_days from dsales.dsales_base_customers('mine', null, 1, 0, null)) >= 30, 'mine scope must be dormant customers';

  -- ถังกลาง: ไม่มีเจ้าของ
  select count(*) into v_n from dsales.dsales_base_customers('pool', null, 100, 0, null) r where r.taken;
  assert v_n = 0, 'pool scope must only return customers without an owner';

  -- จองลูกค้าที่เป็นของคนอื่นตาม tag ไม่ได้
  select phone_normalized into v_phone from dsales.dsales_customer_base where owner_id = v_user and eligible limit 1;
  update dsales.dsales_customer_base set owner_id = gen_random_uuid() where phone_normalized = v_phone;
  begin
    perform dsales.dsales_claim_customer(v_phone, 'bebeplay');
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'taken', format('claiming another rep''s tagged customer must fail with taken, got %s', v_err);

  -- เซลล์ที่ไม่ใช่หัวหน้าผูก tag ไม่ได้
  update dsales.dsales_members set role = 'sales' where user_id = v_user;
  begin
    perform dsales.dsales_set_member_tags(v_user, array[v_tag]);
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'forbidden', format('non-admin must get forbidden, got %s', v_err);
end $$;
rollback;
