-- Worker side of the queue (spec §4.3, §5). Callers must be in worker_user_ids (dsales_worker_uid).
-- claim: releases stale 'sending' rows (> 10 min), keeps one send in flight, paces sends by
-- worker_interval_seconds, rotates between reps (rep whose last send is oldest goes first) and
-- honours the monthly LINE cap. report: sent / failed / requeue (max 3 attempts).
-- Test mode = redirect (contract 2026-11-20-outreach-contract.md §1): with outreach_test_mode on,
-- claim hands out items as usual but target_ms_id = the first room in outreach_test_ms_ids and the
-- message gets a "[ทดสอบ → <chat name or phone>] " prefix; with no test rooms nothing is handed out.
-- A redirected send is marked sent but writes no interaction and leaves the lead status alone.

create or replace function dsales.dsales_worker_claim(p_worker text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_worker_uid();
  v_interval int := coalesce((dsales.dsales_setting('worker_interval_seconds') #>> '{}')::int, 60);
  v_test boolean := coalesce((dsales.dsales_setting('outreach_test_mode') #>> '{}')::boolean, true);
  v_test_ids bigint[] := (select coalesce(array_agg(x.v::bigint order by x.n), '{}')
                          from jsonb_array_elements_text(coalesce(dsales.dsales_setting('outreach_test_ms_ids'), '[]'::jsonb))
                               with ordinality as x(v, n));
  v_line_cap int := coalesce((dsales.dsales_setting('line_monthly_cap') #>> '{}')::int, 0);
  v_line_sent int; v_id uuid; q dsales.dsales_outreach_queue;
begin
  perform pg_advisory_xact_lock(hashtext('dsales_worker_claim'));
  update dsales.dsales_outreach_queue
     set status = case when attempts >= 3 then 'failed' else 'queued' end,
         error = case when attempts >= 3 then coalesce(error, 'stale_sending') else error end,
         locked_at = null, locked_by = null
   where status = 'sending' and locked_at < now() - interval '10 minutes';
  if v_test and cardinality(v_test_ids) = 0 then return null; end if;
  if exists (select 1 from dsales.dsales_outreach_queue where status = 'sending') then return null; end if;
  if v_interval > 0 and exists (select 1 from dsales.dsales_outreach_queue where sent_at > now() - make_interval(secs => v_interval)) then
    return null;
  end if;
  select count(*) into v_line_sent from dsales.dsales_outreach_queue
   where status = 'sent' and lower(provider) = 'line'
     and sent_at >= date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';

  select x.id into v_id from dsales.dsales_outreach_queue x
   where x.status = 'queued'
     and (v_line_cap <= 0 or lower(coalesce(x.provider, '')) <> 'line' or v_line_sent < v_line_cap)
   order by (select max(y.sent_at) from dsales.dsales_outreach_queue y where y.requested_by = x.requested_by) asc nulls first,
            x.enqueued_at
   limit 1
   for update skip locked;
  if v_id is null then return null; end if;

  update dsales.dsales_outreach_queue
     set status = 'sending', locked_at = now(), locked_by = left(p_worker, 100), attempts = attempts + 1,
         test_redirect = v_test, target_ms_id = case when v_test then v_test_ids[1] else ms_id end
   where id = v_id returning * into q;
  return jsonb_build_object(
    'id', q.id, 'ms_id', q.ms_id, 'target_ms_id', q.target_ms_id, 'test_redirect', q.test_redirect,
    'page', q.page, 'provider', q.provider, 'chat_name', q.chat_name,
    'message', case when q.test_redirect
                    then '[ทดสอบ → ' || coalesce(nullif(q.chat_name, ''), q.phone_normalized) || '] ' || q.message_text
                    else q.message_text end,
    'attempts', q.attempts, 'enqueued_at', q.enqueued_at, 'requested_by', q.requested_by);
end $$;

create or replace function dsales.dsales_worker_report(p_id uuid, p_status text, p_error text, p_jst_msg_id text) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid(); q dsales.dsales_outreach_queue;
begin
  if coalesce(p_status, '') not in ('sent', 'failed', 'requeue') then raise exception 'invalid_status'; end if;
  select * into q from dsales.dsales_outreach_queue where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if q.status <> 'sending' then raise exception 'invalid_state'; end if;
  if p_status = 'sent' then
    update dsales.dsales_outreach_queue set status = 'sent', sent_at = now(), jst_msg_id = left(p_jst_msg_id, 100), error = null,
           locked_at = null, locked_by = null where id = q.id;
    if not q.test_redirect and q.lead_id is not null then
      insert into dsales.dsales_interactions (lead_id, type, result, note, rep_id, outreach_id)
      values (q.lead_id, 'chat', 'ส่งข้อความผ่าน worker', left(q.message_text, 500), q.requested_by, q.id);
      update dsales.dsales_leads set status = 'following', updated_at = now() where id = q.lead_id and status = 'new';
    end if;
  elsif p_status = 'failed' then
    update dsales.dsales_outreach_queue set status = 'failed', error = left(coalesce(p_error, 'failed'), 500),
           locked_at = null, locked_by = null where id = q.id;
  else -- requeue
    update dsales.dsales_outreach_queue
       set status = case when q.attempts >= 3 then 'failed' else 'queued' end,
           error = left(coalesce(p_error, 'retry'), 500), locked_at = null, locked_by = null
     where id = q.id;
  end if;
end $$;

create or replace function dsales.dsales_worker_heartbeat(p_worker text, p_state text, p_session_ok boolean, p_last_error text) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid();
begin
  if coalesce(p_state, '') not in ('running', 'paused', 'needs_login', 'stopped') then raise exception 'invalid_state'; end if;
  insert into dsales.dsales_worker_status as w (worker_id, user_id, heartbeat_at, jst_session_ok, state, sent_last_hour, queue_waiting, last_error, updated_at)
  values (left(p_worker, 100), me, now(), coalesce(p_session_ok, false), p_state,
          (select count(*) from dsales.dsales_outreach_queue where status = 'sent' and sent_at > now() - interval '1 hour'),
          (select count(*) from dsales.dsales_outreach_queue where status = 'queued'),
          left(p_last_error, 500), now())
  on conflict (worker_id) do update set user_id = excluded.user_id, heartbeat_at = excluded.heartbeat_at,
    jst_session_ok = excluded.jst_session_ok, state = excluded.state, sent_last_hour = excluded.sent_last_hour,
    queue_waiting = excluded.queue_waiting, last_error = excluded.last_error, updated_at = excluded.updated_at;
end $$;

revoke all on function dsales.dsales_worker_claim(text), dsales.dsales_worker_report(uuid, text, text, text),
  dsales.dsales_worker_heartbeat(text, text, boolean, text) from public, anon;
grant execute on function dsales.dsales_worker_claim(text), dsales.dsales_worker_report(uuid, text, text, text),
  dsales.dsales_worker_heartbeat(text, text, boolean, text) to authenticated;
