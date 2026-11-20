-- Batch progress for the web (/outreach) and cancelling items that have not been sent yet.
-- Sales see their own batches; admins see every batch.

create or replace function dsales.dsales_outreach_batches_mine(p_limit int default 20, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin();
begin
  return coalesce((
    select jsonb_agg(row_json order by created_at desc)
    from (
      select b.created_at, jsonb_build_object(
        'id', b.id, 'created_at', b.created_at, 'brand', b.brand, 'requested_by', b.requested_by,
        'template_name', t.name, 'total', b.total, 'skipped', jsonb_array_length(b.skipped),
        'counts', (select jsonb_build_object(
                     'queued', count(*) filter (where q.status = 'queued'),
                     'sending', count(*) filter (where q.status = 'sending'),
                     'sent', count(*) filter (where q.status = 'sent'),
                     'failed', count(*) filter (where q.status = 'failed'),
                     'cancelled', count(*) filter (where q.status = 'cancelled'))
                   from dsales.dsales_outreach_queue q where q.batch_id = b.id)) as row_json
      from dsales.dsales_outreach_batches b join dsales.dsales_templates t on t.id = b.template_id
      where v_admin or b.requested_by = me
      order by b.created_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
    ) s
  ), '[]'::jsonb);
end $$;

create or replace function dsales.dsales_outreach_batch(p_batch uuid) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); b record;
begin
  select x.*, t.name as template_name into b
  from dsales.dsales_outreach_batches x join dsales.dsales_templates t on t.id = x.template_id where x.id = p_batch;
  if not found then raise exception 'not_found'; end if;
  if b.requested_by <> me and not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'batch', jsonb_build_object('id', b.id, 'created_at', b.created_at, 'brand', b.brand, 'template_name', b.template_name,
                                'total', b.total, 'skipped', b.skipped, 'requested_by', b.requested_by),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'phone', q.phone_normalized, 'lead_id', q.lead_id, 'ms_id', q.ms_id, 'page', q.page, 'provider', q.provider,
               'chat_name', q.chat_name, 'message', q.message_text, 'status', q.status, 'attempts', q.attempts, 'error', q.error,
               'enqueued_at', q.enqueued_at, 'sent_at', q.sent_at) order by q.enqueued_at, q.phone_normalized)
      from dsales.dsales_outreach_queue q where q.batch_id = b.id), '[]'::jsonb));
end $$;

create or replace function dsales.dsales_outreach_cancel(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin(); n int;
begin
  update dsales.dsales_outreach_queue set status = 'cancelled', locked_at = null, locked_by = null
  where id = any(coalesce(p_ids, '{}')) and status = 'queued' and (v_admin or requested_by = me);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function dsales.dsales_outreach_batches_mine(int, int), dsales.dsales_outreach_batch(uuid), dsales.dsales_outreach_cancel(uuid[]) from public, anon;
grant execute on function dsales.dsales_outreach_batches_mine(int, int), dsales.dsales_outreach_batch(uuid), dsales.dsales_outreach_cancel(uuid[]) to authenticated;
