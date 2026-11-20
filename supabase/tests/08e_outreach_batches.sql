begin;
do $$
declare v_admin uuid; v_sales uuid; v_other uuid; v_tpl uuid; v_batch uuid; v_q1 uuid; v_q2 uuid; j jsonb; n int; v_ok boolean;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_other from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_sales order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true), (v_other, 'sales', 'S2', true);
  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 't', 'x', v_admin) returning id into v_tpl;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand, total) values (v_sales, v_tpl, 'bebeplay', 2) returning id into v_batch;
  insert into dsales.dsales_outreach_queue (batch_id, phone_normalized, ms_id, message_text, requested_by, status)
    values (v_batch, '0800000001', 1, 'a', v_sales, 'queued') returning id into v_q1;
  insert into dsales.dsales_outreach_queue (batch_id, phone_normalized, ms_id, message_text, requested_by, status, sent_at)
    values (v_batch, '0800000002', 2, 'b', v_sales, 'sent', now()) returning id into v_q2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  j := dsales.dsales_outreach_batches_mine(20, 0);
  assert (j -> 0 ->> 'id')::uuid = v_batch and (j -> 0 -> 'counts' ->> 'queued')::int = 1 and (j -> 0 -> 'counts' ->> 'sent')::int = 1, 'my batch with counts';
  j := dsales.dsales_outreach_batch(v_batch);
  assert jsonb_array_length(j -> 'items') = 2 and j -> 'batch' ->> 'template_name' = 't', 'batch detail';

  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  assert jsonb_array_length(dsales.dsales_outreach_batches_mine(20, 0)) = 0, 'other rep sees none';
  v_ok := false;
  begin perform dsales.dsales_outreach_batch(v_batch); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'other rep cannot open the batch';
  assert dsales.dsales_outreach_cancel(array[v_q1, v_q2]) = 0, 'other rep cannot cancel';

  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  n := dsales.dsales_outreach_cancel(array[v_q1, v_q2]);
  assert n = 1, 'only the queued row is cancelled';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert jsonb_array_length(dsales.dsales_outreach_batches_mine(20, 0)) >= 1, 'admin sees all batches';
  v_ok := false;
  begin perform dsales.dsales_outreach_batch(gen_random_uuid()); exception when others then v_ok := sqlerrm = 'not_found'; end;
  assert v_ok, 'unknown batch -> not_found';
  reset role;
  assert (select status from dsales.dsales_outreach_queue where id = v_q1) = 'cancelled', 'q1 cancelled';
  assert (select status from dsales.dsales_outreach_queue where id = v_q2) = 'sent', 'q2 untouched';
  raise notice 'OK 08e_outreach_batches';
end $$;
rollback;
