-- Worker status card and settings on the web setup page (spec §6.4). Everyone reads; admins change.
-- dsales_worker_find_rooms (contract §1): admins search JST rooms by customer name to pick test rooms.

create or replace function dsales.dsales_worker_settings_json() returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  select jsonb_build_object(
    'interval_seconds', coalesce((dsales.dsales_setting('worker_interval_seconds') #>> '{}')::int, 60),
    'line_monthly_cap', coalesce((dsales.dsales_setting('line_monthly_cap') #>> '{}')::int, 0),
    'test_mode', coalesce((dsales.dsales_setting('outreach_test_mode') #>> '{}')::boolean, true),
    'test_ms_ids', coalesce(dsales.dsales_setting('outreach_test_ms_ids'), '[]'::jsonb),
    'max_batch', coalesce((dsales.dsales_setting('outreach_max_batch') #>> '{}')::int, 50))
$$;
revoke all on function dsales.dsales_worker_settings_json() from public, anon, authenticated;

create or replace function dsales.dsales_worker_status_get() returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  return jsonb_build_object(
    'workers', coalesce((select jsonb_agg(jsonb_build_object(
        'worker_id', w.worker_id, 'state', w.state, 'jst_session_ok', w.jst_session_ok, 'heartbeat_at', w.heartbeat_at,
        'online', w.heartbeat_at > now() - interval '3 minutes', 'sent_last_hour', w.sent_last_hour,
        'queue_waiting', w.queue_waiting, 'last_error', w.last_error) order by w.heartbeat_at desc)
      from dsales.dsales_worker_status w), '[]'::jsonb),
    'queue', (select jsonb_build_object(
        'queued', count(*) filter (where status = 'queued'),
        'sending', count(*) filter (where status = 'sending'),
        'sent_last_hour', count(*) filter (where status = 'sent' and sent_at > now() - interval '1 hour'),
        'line_sent_this_month', count(*) filter (where status = 'sent' and lower(provider) = 'line'
            and sent_at >= date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'))
      from dsales.dsales_outreach_queue),
    'settings', dsales.dsales_worker_settings_json());
end $$;

create or replace function dsales.dsales_worker_settings_set(p_interval int, p_line_cap int, p_test_mode boolean, p_test_ms_ids bigint[])
returns jsonb language plpgsql security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if p_interval is null or p_interval < 5 or p_interval > 3600 or coalesce(p_line_cap, -1) < 0 or p_test_mode is null then
    raise exception 'invalid_setting';
  end if;
  update dsales.dsales_settings set value = to_jsonb(p_interval), updated_at = now() where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = to_jsonb(p_line_cap), updated_at = now() where key = 'line_monthly_cap';
  update dsales.dsales_settings set value = to_jsonb(p_test_mode), updated_at = now() where key = 'outreach_test_mode';
  update dsales.dsales_settings set value = to_jsonb(coalesce(p_test_ms_ids, '{}')), updated_at = now() where key = 'outreach_test_ms_ids';
  return dsales.dsales_worker_status_get();
end $$;

-- Admin: find JST rooms by customer name (case-insensitive; name starts with / contains the query),
-- newest activity first, at most 20. Queries shorter than 2 characters return [].
create or replace function dsales.dsales_worker_find_rooms(p_query text) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_q text := btrim(coalesce(p_query, '')); v_pat text;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if length(v_q) < 2 then return '[]'::jsonb; end if;
  v_pat := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(jsonb_build_object('ms_id', r.ms_id, 'customer', r.customer, 'channel', r.channel, 'page', r.page,
                                        'last_time', r.last_time) order by r.last_time desc nulls last)
    from (
      select s.ms_id, s.customer, s.channel, s.page, s.last_time
      from public.iim_sessions s
      where lower(btrim(s.customer)) like lower(v_pat) || '%' or s.customer ilike '%' || v_pat || '%'
      order by s.last_time desc nulls last
      limit 20
    ) r
  ), '[]'::jsonb);
end $$;

revoke all on function dsales.dsales_worker_status_get(), dsales.dsales_worker_settings_set(int, int, boolean, bigint[]),
  dsales.dsales_worker_find_rooms(text) from public, anon;
grant execute on function dsales.dsales_worker_status_get(), dsales.dsales_worker_settings_set(int, int, boolean, bigint[]),
  dsales.dsales_worker_find_rooms(text) to authenticated;
