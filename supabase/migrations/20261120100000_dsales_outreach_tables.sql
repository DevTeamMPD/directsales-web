-- Batch outreach through the JST worker (spec 2026-11-20-jst-outreach-worker-design.md §4):
-- templates, batches, the send queue, worker heartbeat, settings, and two internal helpers.
-- All tables are reached through security definer RPCs only (no grants to anon/authenticated).
-- Test mode redirects sends to a test room (contract 2026-11-20-outreach-contract.md §1):
-- the queue records test_redirect and target_ms_id (the room actually messaged) at claim time.

create table if not exists dsales.dsales_templates (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('bebeplay', 'hosttail')),
  name text not null check (length(btrim(name)) between 1 and 100),
  body text not null check (length(btrim(body)) between 1 and 2000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dsales.dsales_outreach_batches (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  template_id uuid not null references dsales.dsales_templates(id) on delete restrict,
  brand text not null check (brand in ('bebeplay', 'hosttail')),
  total integer not null default 0,
  skipped jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dsales.dsales_outreach_queue (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references dsales.dsales_outreach_batches(id) on delete cascade,
  lead_id uuid references dsales.dsales_leads(id) on delete set null,
  phone_normalized text not null,
  ms_id bigint not null,
  page text,
  provider text,
  chat_name text,
  message_text text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  error text,
  enqueued_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  jst_msg_id text,
  test_redirect boolean not null default false,
  target_ms_id bigint
);
create index if not exists dsales_outreach_queue_status_idx on dsales.dsales_outreach_queue (status, enqueued_at);
create index if not exists dsales_outreach_queue_batch_idx on dsales.dsales_outreach_queue (batch_id);
create index if not exists dsales_outreach_queue_requester_idx on dsales.dsales_outreach_queue (requested_by, status);
create index if not exists dsales_outreach_queue_sent_idx on dsales.dsales_outreach_queue (sent_at desc) where sent_at is not null;

create table if not exists dsales.dsales_worker_status (
  worker_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  heartbeat_at timestamptz not null default now(),
  jst_session_ok boolean not null default false,
  state text not null default 'running' check (state in ('running', 'paused', 'needs_login', 'stopped')),
  sent_last_hour integer not null default 0,
  queue_waiting integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table dsales.dsales_interactions
  add column if not exists outreach_id uuid references dsales.dsales_outreach_queue(id) on delete set null;

alter table dsales.dsales_templates enable row level security;
alter table dsales.dsales_outreach_batches enable row level security;
alter table dsales.dsales_outreach_queue enable row level security;
alter table dsales.dsales_worker_status enable row level security;
revoke all on dsales.dsales_templates, dsales.dsales_outreach_batches, dsales.dsales_outreach_queue, dsales.dsales_worker_status
  from public, anon, authenticated;

insert into dsales.dsales_settings (key, value) values
  ('worker_user_ids', (select coalesce(jsonb_agg(u.id::text), '[]'::jsonb) from auth.users u where u.email = 'dev@mpdgroup.co')),
  ('worker_interval_seconds', '60'::jsonb),
  ('outreach_max_batch', '50'::jsonb),
  ('outreach_test_mode', 'true'::jsonb),
  ('outreach_test_ms_ids', '[]'::jsonb),
  ('line_monthly_cap', '0'::jsonb),
  ('page_brand_map', jsonb_build_object(
    'bebeplay', jsonb_build_array('Bebeplay', 'Bebeplayofficial', 'bebeplayspace', 'SH_bebeplay', 'LA_bebeplay'),
    'hosttail', jsonb_build_array('HostTail คอกหมา บ้านแมว ของใช้สัตว์เลี้ยง', 'Hosttail แหล่งรวมเฟอร์นิเจอร์สัตว์เลี้ยง🧡',
                                  'Host Tail', 'SH_hosttail', 'LA_hosttail', 'TT_hosttail')))
on conflict (key) do nothing;

-- internal: read one setting
create or replace function dsales.dsales_setting(p_key text) returns jsonb
language sql stable security definer set search_path = dsales, public as $$
  select value from dsales.dsales_settings where key = p_key
$$;
revoke all on function dsales.dsales_setting(text) from public, anon, authenticated;

-- worker RPC gate: caller must be listed in worker_user_ids
create or replace function dsales.dsales_worker_uid() returns uuid
language plpgsql stable security definer set search_path = dsales, public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(dsales.dsales_setting('worker_user_ids'), '[]'::jsonb)) x where x = u::text) then
    raise exception 'not_worker' using errcode = '42501';
  end if;
  return u;
end $$;
revoke all on function dsales.dsales_worker_uid() from public, anon;
grant execute on function dsales.dsales_worker_uid() to authenticated;
