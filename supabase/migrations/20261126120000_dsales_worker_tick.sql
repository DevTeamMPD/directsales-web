-- Worker on Vercel woken every minute + office PC as standby (spec 2026-11-26-cloud-tick-worker-design.md).
-- 1) dsales_worker_state: what the worker used to keep in memory between loop turns (runtime jsonb) + a lease
--    so two ticks never overlap. JST cookies (worth a password) live in Vault secret dsales_jst_session_<worker>.
-- 2) primary / standby: a worker that is not worker_primary gets no jobs and no link targets while the primary
--    is 'running' with a heartbeat younger than 3 minutes (same rule as "online" on the status card).
-- 3) dsales_tick_kick(): pg_cron every minute -> net.http_post to /api/cron/outreach-tick (same pattern as
--    cdp.trigger_cron_route). Off until worker_tick_enabled = true AND Vault has dsales_app_url + dsales_cron_secret.
-- Defaults keep today's behaviour: worker_primary = office-1, worker_tick_enabled = false.
-- Go-live (by hand, not in this migration): Vault secrets dsales_app_url (base URL of the web app) and
--   dsales_cron_secret (the tick route's bearer secret), then set worker_tick_enabled = true.
-- Rollback, in this order:
--   1) select cron.unschedule('dsales-outreach-tick');
--   2) restore dsales_worker_claim / dsales_worker_link_targets / dsales_worker_status_get from 20261120100500 /
--      20261120150000 / 20261120100600 BEFORE dropping dsales_worker_is_standby (claim and link_targets call it);
--   3) drop the new functions and the table; delete settings worker_primary, worker_tick_enabled;
--   4) delete from vault.secrets where name like 'dsales\_jst\_session\_%' or name in ('dsales_app_url', 'dsales_cron_secret');

insert into dsales.dsales_settings (key, value) values
  ('worker_primary', '"office-1"'::jsonb),
  ('worker_tick_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists dsales.dsales_worker_state (
  worker_id text primary key,
  runtime jsonb not null default '{}'::jsonb,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table dsales.dsales_worker_state enable row level security;
revoke all on dsales.dsales_worker_state from public, anon, authenticated;

/* ---------- primary / standby ---------- */

create or replace function dsales.dsales_worker_is_standby(p_worker text) returns boolean
language sql stable security definer set search_path = dsales, public as $$
  select exists (
    select 1 from dsales.dsales_worker_status w
    where w.worker_id = nullif(btrim(coalesce(dsales.dsales_setting('worker_primary') #>> '{}', '')), '')
      and w.worker_id <> left(coalesce(p_worker, ''), 100)
      and w.state = 'running'
      and w.heartbeat_at > now() - interval '3 minutes')
$$;
revoke all on function dsales.dsales_worker_is_standby(text) from public, anon, authenticated;

-- same as 20261120100500 plus the standby rule, checked after the stale-'sending' requeue so a standby still
-- requeues rows stuck in 'sending' when the primary keeps heartbeating but never reports
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
  if dsales.dsales_worker_is_standby(p_worker) then return null; end if;
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

-- same as 20261120150000 plus the standby rule (a standby searches nothing, so two workers never look up the same ID)
create or replace function dsales.dsales_worker_link_targets(p_worker text, p_limit integer default 20)
returns table (buyer_id text, shop_prefix text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid();
begin
  if dsales.dsales_worker_is_standby(p_worker) then return; end if;
  return query
  with o as (
    select btrim(x.buyer_account_no) as bid, upper(split_part(x.shop, '_', 1)) as sp, dsales.dsales_norm_phone(x.phone) as phone
    from public.order_tracking x
    where btrim(x.buyer_account_no) ~ '^[A-Za-z0-9._-]{5,64}$'
      and upper(split_part(x.shop, '_', 1)) in ('FB', 'LOA', 'SH', 'LA', 'TT', 'IG')
  ), ids as (
    select o.bid, min(o.sp) as sp, max(b.ltv) as ltv, count(distinct o.phone) as nph, bool_or(b.phone_normalized is not null) as in_base
    from o left join dsales.dsales_customer_base b on b.phone_normalized = o.phone and b.eligible
    group by o.bid
  )
  select i.bid, i.sp
  from ids i
  left join dsales.dsales_buyer_lookups k on k.buyer_id = i.bid
  where i.in_base and i.nph <= dsales.dsales_link_max_phones()
    and (k.buyer_id is null or k.looked_up_at < now() - interval '14 days')
  order by k.looked_up_at asc nulls first, i.ltv desc nulls last, i.bid
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
end $$;

-- same as 20261120100600 plus 'primary' and per-worker 'is_primary'
create or replace function dsales.dsales_worker_status_get() returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_primary text := nullif(btrim(coalesce(dsales.dsales_setting('worker_primary') #>> '{}', '')), '');
begin
  perform dsales.dsales_uid();
  return jsonb_build_object(
    'primary', v_primary,
    'workers', coalesce((select jsonb_agg(jsonb_build_object(
        'worker_id', w.worker_id, 'state', w.state, 'jst_session_ok', w.jst_session_ok, 'heartbeat_at', w.heartbeat_at,
        'online', w.heartbeat_at > now() - interval '3 minutes', 'sent_last_hour', w.sent_last_hour,
        'queue_waiting', w.queue_waiting, 'last_error', w.last_error,
        'is_primary', v_primary is not null and w.worker_id = v_primary) order by w.heartbeat_at desc)
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

/* ---------- worker state between ticks ---------- */

-- internal: write the JST cookies of one worker to Vault (create the secret on first use)
create or replace function dsales.dsales_worker_session_write(p_worker text, p_cookies jsonb) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare v_name text := 'dsales_jst_session_' || p_worker; v_secret uuid;
begin
  if p_worker !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_worker'; end if;
  if jsonb_typeof(p_cookies) is distinct from 'array' then raise exception 'invalid_cookies'; end if;
  if jsonb_array_length(p_cookies) = 0 or pg_column_size(p_cookies) > 65536 then raise exception 'invalid_cookies'; end if;
  select s.id into v_secret from vault.secrets s where s.name = v_name;
  if v_secret is null then
    perform vault.create_secret(p_cookies::text, v_name, 'JST session cookies of dsales worker ' || p_worker);
  else
    perform vault.update_secret(v_secret, p_cookies::text);
  end if;
end $$;
revoke all on function dsales.dsales_worker_session_write(text, jsonb) from public, anon, authenticated;

-- start of a tick: null = another tick holds the lease; else take the lease and return {runtime, cookies}
create or replace function dsales.dsales_worker_state_begin(p_worker text, p_lease_seconds int default 90) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_worker_uid(); v_id text := btrim(coalesce(p_worker, ''));
  r dsales.dsales_worker_state; v_cookies jsonb;
begin
  if v_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_worker'; end if;
  insert into dsales.dsales_worker_state (worker_id) values (v_id) on conflict (worker_id) do nothing;
  select * into r from dsales.dsales_worker_state where worker_id = v_id for update;
  if r.lease_until is not null and r.lease_until > now() then return null; end if;
  -- the lease must outlive the tick route's maxDuration (60 s), so a running tick never loses it: at least 70 s
  update dsales.dsales_worker_state
     set lease_until = now() + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 90), 70), 600)), updated_at = now()
   where worker_id = v_id;
  select s.decrypted_secret::jsonb into v_cookies from vault.decrypted_secrets s where s.name = 'dsales_jst_session_' || v_id;
  return jsonb_build_object('runtime', r.runtime, 'cookies', coalesce(v_cookies, '[]'::jsonb));
end $$;

-- end of a tick: store runtime, write cookies when they changed (p_cookies not null), free the lease.
-- Unconditional on purpose (no lease check): the tick's runtime carries its pendingReports and must always be saved.
create or replace function dsales.dsales_worker_state_end(p_worker text, p_runtime jsonb, p_cookies jsonb default null) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid(); v_id text := btrim(coalesce(p_worker, ''));
begin
  if v_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_worker'; end if;
  if jsonb_typeof(coalesce(p_runtime, '{}'::jsonb)) <> 'object' then raise exception 'invalid_runtime'; end if;
  if pg_column_size(p_runtime) > 65536 then raise exception 'invalid_runtime'; end if;
  if p_cookies is not null then perform dsales.dsales_worker_session_write(v_id, p_cookies); end if;
  insert into dsales.dsales_worker_state as t (worker_id, runtime, lease_until, updated_at)
  values (v_id, coalesce(p_runtime, '{}'::jsonb), null, now())
  on conflict (worker_id) do update set runtime = excluded.runtime, lease_until = null, updated_at = now();
end $$;

-- a person logged in to JST by hand (captcha) and uploads the cookies: store them and leave needs_login.
-- worker_busy while a tick holds the lease (its state_end would overwrite the upload); try again after the tick.
create or replace function dsales.dsales_worker_session_put(p_worker text, p_cookies jsonb) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid(); v_id text := btrim(coalesce(p_worker, '')); v_lease timestamptz;
begin
  if v_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_worker'; end if;
  insert into dsales.dsales_worker_state (worker_id) values (v_id) on conflict (worker_id) do nothing;
  select lease_until into v_lease from dsales.dsales_worker_state where worker_id = v_id for update;
  if v_lease > now() then raise exception 'worker_busy'; end if;
  perform dsales.dsales_worker_session_write(v_id, p_cookies);
  update dsales.dsales_worker_state
     set runtime = case when runtime ->> 'state' = 'needs_login'
                        then (runtime - 'lastError') || '{"state":"running","sessionOk":null,"failures":0,"loginTimes":[]}'::jsonb
                        else runtime end,
         updated_at = now()
   where worker_id = v_id;
end $$;

revoke all on function dsales.dsales_worker_state_begin(text, int), dsales.dsales_worker_state_end(text, jsonb, jsonb),
  dsales.dsales_worker_session_put(text, jsonb) from public, anon;
grant execute on function dsales.dsales_worker_state_begin(text, int), dsales.dsales_worker_state_end(text, jsonb, jsonb),
  dsales.dsales_worker_session_put(text, jsonb) to authenticated;

/* ---------- admin (setup page) ---------- */

-- "restart" for a worker that has no process to restart (state stopped after a ShapeError, once a dev has checked).
-- worker_busy while a tick holds the lease (its state_end would undo the reset, and freeing the lease could let
-- two ticks overlap); try again after the tick. A worker with no state row has nothing to reset.
create or replace function dsales.dsales_worker_state_reset(p_worker text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_id text := btrim(coalesce(p_worker, '')); v_lease timestamptz;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  select lease_until into v_lease from dsales.dsales_worker_state where worker_id = v_id for update;
  if v_lease > now() then raise exception 'worker_busy'; end if;
  update dsales.dsales_worker_state set runtime = '{}'::jsonb, lease_until = null, updated_at = now()
   where worker_id = v_id;
  return dsales.dsales_worker_status_get();
end $$;

create or replace function dsales.dsales_worker_primary_set(p_worker text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_id text := btrim(coalesce(p_worker, ''));
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if v_id <> '' and not exists (select 1 from dsales.dsales_worker_status w where w.worker_id = v_id) then
    raise exception 'unknown_worker';
  end if;
  insert into dsales.dsales_settings (key, value, updated_at) values ('worker_primary', to_jsonb(v_id), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return dsales.dsales_worker_status_get();
end $$;

revoke all on function dsales.dsales_worker_state_reset(text), dsales.dsales_worker_primary_set(text) from public, anon;
grant execute on function dsales.dsales_worker_state_reset(text), dsales.dsales_worker_primary_set(text) to authenticated;

/* ---------- tick kick ---------- */

create or replace function dsales.dsales_tick_kick() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  -- text compare, not a boolean cast: a malformed value must never make the per-minute job raise
  if (dsales.dsales_setting('worker_tick_enabled') #>> '{}') is distinct from 'true' then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'dsales_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'dsales_cron_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then return null; end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/outreach-tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end $$;
revoke all on function dsales.dsales_tick_kick() from public, anon, authenticated;

select cron.schedule('dsales-outreach-tick', '* * * * *', $cron$select dsales.dsales_tick_kick()$cron$);
