begin;
do $$
declare
  v_admin uuid; v_sales uuid; v_tpl uuid; v_phones text[]; v_pool text; v_taken text; v_none text;
  p jsonb; e jsonb; v_ok boolean; v_t0 timestamptz; v_secs numeric; v_q int;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  insert into dsales.dsales_templates (brand, name, body, created_by)
    values ('bebeplay', 'ทดสอบ', 'สวัสดีค่ะคุณ{ชื่อ} จาก {ร้าน} สินค้าล่าสุด {สินค้าล่าสุด}', v_admin) returning id into v_tpl;

  -- 20 pool phones (no owner, no lead) with a LINE/marketplace Bebeplay room
  select array_agg(phone_normalized) into v_phones from (
    select distinct l.phone_normalized
    from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
    join dsales.dsales_customer_base b on b.phone_normalized = l.phone_normalized
    where s.page in ('Bebeplayofficial', 'SH_bebeplay', 'LA_bebeplay') and b.owner_id is null
      and not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized)
    limit 20) t;
  assert cardinality(v_phones) >= 3, 'need pool phones with Bebeplay rooms';
  v_pool := v_phones[1];
  -- one phone owned by someone else -> taken
  v_taken := v_phones[2];
  update dsales.dsales_customer_base set owner_id = v_admin where phone_normalized = v_taken;
  -- a phone without any chat link
  select b.phone_normalized into v_none from dsales.dsales_customer_base b
  where b.owner_id is null and not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized) limit 1;

  set local statement_timeout = '8s';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);

  p := dsales.dsales_outreach_preview(v_phones || array[v_none, v_pool], v_tpl);
  assert (select count(*) from jsonb_array_elements(p) x where x ->> 'phone' = v_pool) = 1, 'duplicates collapsed';
  assert (select x ->> 'skip' from jsonb_array_elements(p) x where x ->> 'phone' = v_taken) = 'taken', 'owned by other -> taken';
  assert (select x ->> 'skip' from jsonb_array_elements(p) x where x ->> 'phone' = v_none) = 'no_chat_room', 'no link -> no_chat_room';
  e := (select x from jsonb_array_elements(p) x where x ->> 'phone' = v_pool);
  assert e ->> 'skip' is null and (e ->> 'ms_id') is not null, 'pool phone gets a room';
  assert position('{ชื่อ}' in e ->> 'message') = 0 and position('{ร้าน}' in e ->> 'message') = 0, 'variables replaced';
  assert position(e ->> 'page' in e ->> 'message') > 0, '{ร้าน} = page name';
  assert not exists (select 1 from dsales.dsales_leads where phone_normalized = v_pool), 'preview writes nothing';

  v_ok := false;
  begin perform dsales.dsales_outreach_preview(v_phones, gen_random_uuid()); exception when others then v_ok := sqlerrm = 'template_not_found'; end;
  assert v_ok, 'unknown template -> template_not_found';
  v_ok := false;
  begin perform dsales.dsales_outreach_preview((select array_agg('08' || lpad(g::text, 8, '0')) from generate_series(1, 51) g), v_tpl);
  exception when others then v_ok := sqlerrm = 'batch_too_large'; end;
  assert v_ok, '51 phones -> batch_too_large';

  v_t0 := clock_timestamp();
  e := dsales.dsales_enqueue_outreach(v_phones || array[v_none], v_tpl);
  v_secs := extract(epoch from clock_timestamp() - v_t0);
  raise notice 'enqueue % phones took % s', cardinality(v_phones) + 1, round(v_secs, 2);
  perform set_config('test.enqueue_secs', round(v_secs, 3)::text, true);
  assert v_secs < 5, format('enqueue too slow: %s s', v_secs);
  reset role;

  select count(*) into v_q from dsales.dsales_outreach_queue where batch_id = (e ->> 'batch_id')::uuid;
  assert v_q = (e ->> 'queued')::int and v_q >= 1, 'queued rows match the result';
  assert exists (select 1 from jsonb_array_elements(e -> 'skipped') x where x ->> 'phone' = v_taken and x ->> 'reason' = 'taken'), 'taken recorded as skipped';
  assert (select owner_id from dsales.dsales_leads where phone_normalized = v_pool) = v_sales, 'pool customer claimed for the sales rep';
  assert (select status from dsales.dsales_outreach_queue where phone_normalized = v_pool) = 'queued', 'queue row is queued';
  assert (select requested_by from dsales.dsales_outreach_batches where id = (e ->> 'batch_id')::uuid) = v_sales, 'batch owner';

  -- second enqueue of the same phone while queued -> already_queued
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  e := dsales.dsales_enqueue_outreach(array[v_pool], v_tpl);
  reset role;
  assert (e ->> 'queued')::int = 0 and (e -> 'skipped' -> 0 ->> 'reason') = 'already_queued', 'no double queue';
  raise notice 'OK 08d_outreach_enqueue';
end $$;
rollback;
