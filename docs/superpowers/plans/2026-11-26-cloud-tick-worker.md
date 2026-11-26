# Worker บน Vercel (ปลุกทุกนาที) + `office-1` เป็นตัวสำรอง Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้การส่งข้อความและการผูกห้องทำงานจากฟังก์ชันบน Vercel ที่ pg_cron ปลุกทุกนาที โดย `office-1` รันลูปเดิมเป็นตัวสำรองและรับช่วงเองเมื่อตัวหลักเงียบเกิน 3 นาที

**Architecture:** `dsales.dsales_tick_kick()` (pg_cron ทุกนาที) ยิง `POST /api/cron/outreach-tick` · route ใช้ `tools/jst-worker` ชุดเดิมผ่านทางเข้าใหม่ `tick.mjs` ที่โหลดสถานะจาก DB (`dsales_worker_state` + Vault) รัน `worker.tick()` หนึ่งรอบ แล้วบันทึกกลับ · การเลือกตัวหลัก/ตัวสำรองอยู่ใน `dsales_worker_claim` / `dsales_worker_link_targets`

**Tech Stack:** Postgres 17 / Supabase (plpgsql, pg_cron 1.6, pg_net 0.20, Vault), Node.js 24 (`node --test`), Next.js 15 route handler (runtime nodejs), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`

---

## กติกาที่ต้องทำตามตลอดแผน (จาก `CLAUDE.md`)

- Supabase project `nroyacasuchqniaiuirk` เป็น production ที่ใช้ร่วมกัน: แก้ได้เฉพาะ schema `dsales` · **ถามผู้ใช้ก่อน `apply_migration`, ก่อน push และก่อน merge ทุกครั้ง**
- Migration ทำตามลำดับ: test ล้มก่อน → dry run ใน transaction → apply → test ผ่าน → regression ทีละไฟล์ (1 ไฟล์ต่อ `execute_sql` 1 ครั้ง)
- Commit: ข้อความอังกฤษแบบ conventional จบด้วยบรรทัดว่าง + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · ผู้เขียน git = DevTeamMPD (ตั้งไว้ใน repo แล้ว)
- ห้าม log หรือพิมพ์ cookie, รหัสผ่าน, header หรือเนื้อความข้อความ
- ทำงานใน worktree `C:\Claude Ai\Directsale\directsales-web-worker` branch `feat/cloud-tick-worker` (แตกจาก `main` หลัง merge PR #7)

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20261126120000_dsales_worker_tick.sql` | สร้าง: ตารางสถานะ, RPC ใหม่, กติกาตัวสำรอง, ตัวปลุก + cron |
| `supabase/tests/28_worker_primary_standby.sql` / `29_worker_state.sql` / `30_tick_kick.sql` | สร้าง: SQL test |
| `tools/jst-worker/session-store.mjs` (+ `.test.mjs`) | สร้าง: ที่เก็บ cookie แบบไฟล์และแบบหน่วยความจำ |
| `tools/jst-worker/jst-client.mjs` | แก้: รับ `sessionStore`, เพิ่ม `ping()` |
| `tools/jst-worker/worker-core.mjs` | แก้: `initialState`, `exportState()`, `tick()` |
| `tools/jst-worker/worker-tick.test.mjs` | สร้าง: test ของโหมดรอบ |
| `tools/jst-worker/queue-client.mjs` | แก้: `stateBegin` / `stateEnd` / `sessionPut`, ล็อกอินใหม่เมื่อ token เก่า |
| `tools/jst-worker/tick.mjs` (+ `.test.mjs`) | สร้าง: ลำดับขั้นของหนึ่งรอบ |
| `tools/jst-worker/config.mjs` (+ `.test.mjs`) | สร้าง: อ่านค่าตั้ง (ย้าย `readEnvFile` ออกจาก `worker.mjs`) |
| `tools/jst-worker/import-session.mjs` | แก้: `--upload <worker_id>` |
| `lib/cron/auth.ts` (+ `.test.ts`) | สร้าง: ตรวจ Bearer token |
| `app/api/cron/outreach-tick/route.ts` | สร้าง: route ที่ถูกปลุก |
| `middleware.ts` | แก้: ไม่ตรวจ session กับ `/api/cron/` |
| `lib/api/types.ts`, `lib/api/rpc.ts`, `lib/api/errors.ts`, `lib/domain/outreach.ts` (+ test), `components/setup/OutreachPanels.tsx`, `lib/fixtures/outreach.ts`, `e2e/outreach.spec.ts` | แก้: การ์ด Worker (ป้ายตัวหลัก/ตัวสำรอง, ปุ่ม) |
| `tools/jst-worker/README.md`, `CLAUDE.md`, `docs/DATABASE.md`, `.env.example` | แก้: เอกสาร |

---

### Task 0: เตรียม worktree

- [ ] **Step 1: ติดตั้ง dependency**

Run (ใน `C:\Claude Ai\Directsale\directsales-web-worker`): `npm ci --no-audit --no-fund`
Expected: จบด้วย `added … packages` ไม่มี error

- [ ] **Step 2: ยืนยันว่า test เดิมผ่านก่อนแก้**

Run: `cd tools/jst-worker && node --test`
Expected: `# fail 0`

Run (ที่รากโปรเจกต์): `npm test`
Expected: ทุกไฟล์ผ่าน

---

### Task 1: ฐานข้อมูล — ตารางสถานะ, กติกาตัวสำรอง, ตัวปลุก

**Files:**
- Create: `supabase/tests/28_worker_primary_standby.sql`, `supabase/tests/29_worker_state.sql`, `supabase/tests/30_tick_kick.sql`
- Create: `supabase/migrations/20261126120000_dsales_worker_tick.sql`

- [ ] **Step 1: เขียน test `supabase/tests/28_worker_primary_standby.sql`**

```sql
begin;
-- primary / standby: a standby worker gets no jobs and no link targets while the primary is
-- running with a fresh heartbeat; it takes over when the primary is stale or not running;
-- with no worker_primary the old behaviour is kept
do $$
declare
  v_admin uuid; v_w uuid; v_tpl uuid; v_b uuid; c jsonb; v_n int; s jsonb;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select (x #>> '{}')::uuid into v_w from jsonb_array_elements(dsales.dsales_setting('worker_user_ids')) x limit 1;
  assert v_admin is not null and v_w is not null, 'need an admin and a worker account';
  -- clean slate (rolled back)
  update dsales.dsales_outreach_queue set status = 'cancelled' where status in ('queued', 'sending');
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 day' where sent_at > now() - interval '1 day';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'line_monthly_cap';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_settings set value = '[999]'::jsonb where key = 'outreach_test_ms_ids';
  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 't25', 'x', v_admin) returning id into v_tpl;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_admin, v_tpl, 'bebeplay') returning id into v_b;
  insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, provider, chat_name, message_text, requested_by, enqueued_at) values
    (v_b, null, '0899999971', 711, 'Line', 'ก', 'm1', v_admin, now() - interval '2 min'),
    (v_b, null, '0899999972', 712, 'Line', 'ข', 'm2', v_admin, now() - interval '1 min');
  insert into dsales.dsales_worker_status (worker_id, user_id, heartbeat_at, jst_session_ok, state, sent_last_hour, queue_waiting, updated_at)
    values ('t25-primary', v_w, now(), true, 'running', 0, 0, now());
  insert into dsales.dsales_settings (key, value) values ('worker_primary', '"t25-primary"'::jsonb)
    on conflict (key) do update set value = excluded.value;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_claim('t25-standby') is null, 'standby gets nothing while the primary is fresh and running';
  select count(*) into v_n from dsales.dsales_worker_link_targets('t25-standby', 5);
  assert v_n = 0, 'standby gets no link targets';
  c := dsales.dsales_worker_claim('t25-primary');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 1, format('the primary claims, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'x', null);

  -- stale heartbeat -> the standby takes over
  reset role;
  update dsales.dsales_worker_status set heartbeat_at = now() - interval '4 minutes' where worker_id = 't25-primary';
  set local role authenticated;
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 2, format('standby takes over on a stale heartbeat, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'x', null);

  -- fresh heartbeat but not running -> the standby takes over
  reset role;
  update dsales.dsales_worker_status set heartbeat_at = now(), state = 'needs_login' where worker_id = 't25-primary';
  set local role authenticated;
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 711 and (c ->> 'attempts')::int = 3, format('standby takes over when the primary is not running, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'failed', 'done', null);

  -- status card: primary name and per-worker flag
  reset role;
  update dsales.dsales_worker_status set state = 'running' where worker_id = 't25-primary';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  s := dsales.dsales_worker_status_get();
  assert s ->> 'primary' = 't25-primary', format('status shows the primary, got %s', s ->> 'primary');
  assert exists (select 1 from jsonb_array_elements(s -> 'workers') w where w ->> 'worker_id' = 't25-primary' and (w ->> 'is_primary')::boolean),
         'the primary row is flagged';
  assert not exists (select 1 from jsonb_array_elements(s -> 'workers') w where w ->> 'worker_id' <> 't25-primary' and (w ->> 'is_primary')::boolean),
         'no other row is flagged';

  -- no primary configured -> nobody is a standby (old behaviour)
  reset role;
  update dsales.dsales_settings set value = '""'::jsonb where key = 'worker_primary';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('t25-standby');
  assert (c ->> 'ms_id')::bigint = 712, format('no primary -> any worker claims, got %s', c);
  reset role;
  raise notice 'OK 28_worker_primary_standby';
end $$;
rollback;
```

- [ ] **Step 2: เขียน test `supabase/tests/29_worker_state.sql`**

```sql
begin;
-- worker state between ticks: lease (no overlapping ticks, expires by itself), runtime jsonb,
-- JST cookies round-trip through Vault, session upload clears needs_login, admin-only reset / primary
do $$
declare
  v_admin uuid; v_w uuid; v_s uuid; r jsonb; v_ok boolean; v_n int; v_t text;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select (x #>> '{}')::uuid into v_w from jsonb_array_elements(dsales.dsales_setting('worker_user_ids')) x limit 1;
  select id into v_s from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_w order by id limit 1;
  assert v_admin is not null and v_w is not null and v_s is not null, 'need an admin, a worker account and a spare user';
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s, 'sales', 'S26', true);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r -> 'runtime' = '{}'::jsonb and r -> 'cookies' = '[]'::jsonb, format('first begin returns empty state, got %s', r);
  assert dsales.dsales_worker_state_begin('t26', 90) is null, 'a second begin while the lease is held returns null';
  perform dsales.dsales_worker_state_end('t26', '{"state":"needs_login","failures":2,"lastError":"x"}'::jsonb, '[{"name":"a","value":"1"}]'::jsonb);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{runtime,state}' = 'needs_login' and r #>> '{runtime,failures}' = '2', format('runtime is stored, got %s', r);
  assert r #>> '{cookies,0,name}' = 'a' and r #>> '{cookies,0,value}' = '1', 'cookies come back from Vault';
  -- end without cookies keeps the stored session
  perform dsales.dsales_worker_state_end('t26', '{"state":"needs_login"}'::jsonb, null);
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{cookies,0,value}' = '1', 'cookies are kept when end passes null';

  -- a tick that died never calls end: the lease expires by itself
  reset role;
  update dsales.dsales_worker_state set lease_until = now() - interval '1 second' where worker_id = 't26';
  select count(*) into v_n from vault.secrets where name = 'dsales_jst_session_t26';
  assert v_n = 1, 'exactly one Vault secret per worker';
  set local role authenticated;
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r is not null, 'an expired lease can be taken';

  -- session upload: new cookies, needs_login -> running
  perform dsales.dsales_worker_session_put('t26', '[{"name":"b","value":"2"}]'::jsonb);
  reset role;
  select runtime ->> 'state' into v_t from dsales.dsales_worker_state where worker_id = 't26';
  assert v_t = 'running', format('session upload clears needs_login, got %s', v_t);
  update dsales.dsales_worker_state set lease_until = null where worker_id = 't26';
  select count(*) into v_n from vault.secrets where name = 'dsales_jst_session_t26';
  assert v_n = 1, 'upload updates the same Vault secret';
  set local role authenticated;
  r := dsales.dsales_worker_state_begin('t26', 90);
  assert r #>> '{cookies,0,name}' = 'b', 'uploaded cookies are returned';

  -- bad ids / bad payloads
  v_ok := false;
  begin perform dsales.dsales_worker_state_begin('bad id!', 90); exception when others then v_ok := sqlerrm = 'invalid_worker'; end;
  assert v_ok, 'worker id must be [A-Za-z0-9_-]';
  v_ok := false;
  begin perform dsales.dsales_worker_state_end('t26', '[]'::jsonb, null); exception when others then v_ok := sqlerrm = 'invalid_runtime'; end;
  assert v_ok, 'runtime must be an object';
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '{}'::jsonb); exception when others then v_ok := sqlerrm = 'invalid_cookies'; end;
  assert v_ok, 'cookies must be an array';

  -- sales: no worker RPCs, no table, no admin RPCs
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_state_begin('t26', 90); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (begin)';
  v_ok := false;
  begin perform dsales.dsales_worker_state_end('t26', '{}'::jsonb, null); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (end)';
  v_ok := false;
  begin perform dsales.dsales_worker_session_put('t26', '[]'::jsonb); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker (session_put)';
  v_ok := false;
  begin perform 1 from dsales.dsales_worker_state limit 1; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'the state table is not readable directly';
  v_ok := false;
  begin perform dsales.dsales_worker_state_reset('t26'); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot reset';
  v_ok := false;
  begin perform dsales.dsales_worker_primary_set('t26'); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot set the primary';

  -- admin: reset and primary
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform dsales.dsales_worker_state_reset('t26');
  reset role;
  assert (select runtime = '{}'::jsonb and lease_until is null from dsales.dsales_worker_state where worker_id = 't26'), 'reset empties runtime and frees the lease';
  insert into dsales.dsales_worker_status (worker_id, user_id, heartbeat_at, jst_session_ok, state, sent_last_hour, queue_waiting, updated_at)
    values ('t26', v_w, now(), true, 'running', 0, 0, now());
  set local role authenticated;
  v_ok := false;
  begin perform dsales.dsales_worker_primary_set('nope-26'); exception when others then v_ok := sqlerrm = 'unknown_worker'; end;
  assert v_ok, 'the primary must be a worker that has sent a heartbeat';
  r := dsales.dsales_worker_primary_set('t26');
  assert r ->> 'primary' = 't26', format('primary set, got %s', r ->> 'primary');
  r := dsales.dsales_worker_primary_set('');
  assert r ->> 'primary' is null, 'empty clears the primary';
  reset role;
  raise notice 'OK 29_worker_state';
end $$;
rollback;
```

- [ ] **Step 3: เขียน test `supabase/tests/30_tick_kick.sql`**

```sql
begin;
-- tick kick: fires only when enabled and both Vault secrets exist; posts to the tick route with
-- the bearer secret; nobody but cron (postgres) may call it; the cron job runs every minute
do $$
declare v_id bigint; v_ok boolean; v_n int;
begin
  delete from vault.secrets where name in ('dsales_app_url', 'dsales_cron_secret');
  insert into dsales.dsales_settings (key, value) values ('worker_tick_enabled', 'true'::jsonb)
    on conflict (key) do update set value = excluded.value;
  assert dsales.dsales_tick_kick() is null, 'no secrets -> no request';
  perform vault.create_secret('https://example.invalid/', 'dsales_app_url');
  perform vault.create_secret('s3cret-27', 'dsales_cron_secret');
  update dsales.dsales_settings set value = 'false'::jsonb where key = 'worker_tick_enabled';
  assert dsales.dsales_tick_kick() is null, 'switch off -> no request';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'worker_tick_enabled';
  v_id := dsales.dsales_tick_kick();
  assert v_id is not null, 'enabled + secrets -> a request is queued';
  select count(*) into v_n from net.http_request_queue q
   where q.id = v_id and q.url = 'https://example.invalid/api/cron/outreach-tick' and q.headers ->> 'Authorization' = 'Bearer s3cret-27';
  assert v_n = 1, 'the request goes to the tick route with the bearer secret';
  select count(*) into v_n from cron.job where jobname = 'dsales-outreach-tick' and schedule = '* * * * *';
  assert v_n = 1, 'the cron job runs every minute';
  set local role authenticated;
  v_ok := false;
  begin perform dsales.dsales_tick_kick(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'authenticated cannot call the kick';
  reset role;
  raise notice 'OK 30_tick_kick';
end $$;
rollback;
```

- [ ] **Step 4: รัน test ทั้งสามให้เห็นว่าล้ม**

รันทีละไฟล์ด้วย MCP `execute_sql` (`project_id = "nroyacasuchqniaiuirk"`)
Expected: 28 ล้มที่ `standby gets nothing…` หรือ `function … does not exist` · 29 ล้มที่ `function dsales.dsales_worker_state_begin(unknown, integer) does not exist` · 30 ล้มที่ `function dsales.dsales_tick_kick() does not exist`

- [ ] **Step 5: เขียน migration `supabase/migrations/20261126120000_dsales_worker_tick.sql`**

> ไฟล์ migration ใน repo เป็นตัวจริง (authoritative) ถ้าโค้ดด้านล่างต่างจากไฟล์ ให้ยึดไฟล์ · `dsales_worker_claim` ตรวจตัวสำรองหลังจากถือ advisory lock และปล่อยแถว `sending` ที่ค้างเกิน 10 นาทีกลับคิวแล้ว (ตัวสำรองจึงยังช่วยปล่อยงานค้างได้)

```sql
-- Worker on Vercel woken every minute + office PC as standby (spec 2026-11-26-cloud-tick-worker-design.md).
-- 1) dsales_worker_state: what the worker used to keep in memory between loop turns (runtime jsonb) + a lease
--    so two ticks never overlap. JST cookies (worth a password) live in Vault secret dsales_jst_session_<worker>.
-- 2) primary / standby: a worker that is not worker_primary gets no jobs and no link targets while the primary
--    is 'running' with a heartbeat younger than 3 minutes (same rule as "online" on the status card).
-- 3) dsales_tick_kick(): pg_cron every minute -> net.http_post to /api/cron/outreach-tick (same pattern as
--    cdp.trigger_cron_route). Off until worker_tick_enabled = true AND Vault has dsales_app_url + dsales_cron_secret.
-- Defaults keep today's behaviour: worker_primary = office-1, worker_tick_enabled = false.
-- Rollback: select cron.unschedule('dsales-outreach-tick'); restore dsales_worker_claim / dsales_worker_link_targets /
--   dsales_worker_status_get from 20261120100500 / 20261120150000 / 20261120100600; drop the new functions and table;
--   delete settings worker_primary, worker_tick_enabled; delete Vault secrets dsales_jst_session_*.

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
  update dsales.dsales_worker_state
     set lease_until = now() + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 90), 10), 600)), updated_at = now()
   where worker_id = v_id;
  select s.decrypted_secret::jsonb into v_cookies from vault.decrypted_secrets s where s.name = 'dsales_jst_session_' || v_id;
  return jsonb_build_object('runtime', r.runtime, 'cookies', coalesce(v_cookies, '[]'::jsonb));
end $$;

-- end of a tick: store runtime, write cookies when they changed (p_cookies not null), free the lease
create or replace function dsales.dsales_worker_state_end(p_worker text, p_runtime jsonb, p_cookies jsonb default null) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid(); v_id text := btrim(coalesce(p_worker, ''));
begin
  if v_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_worker'; end if;
  if jsonb_typeof(coalesce(p_runtime, '{}'::jsonb)) <> 'object' then raise exception 'invalid_runtime'; end if;
  if p_cookies is not null then perform dsales.dsales_worker_session_write(v_id, p_cookies); end if;
  insert into dsales.dsales_worker_state as t (worker_id, runtime, lease_until, updated_at)
  values (v_id, coalesce(p_runtime, '{}'::jsonb), null, now())
  on conflict (worker_id) do update set runtime = excluded.runtime, lease_until = null, updated_at = now();
end $$;

-- a person logged in to JST by hand (captcha) and uploads the cookies: store them and leave needs_login
create or replace function dsales.dsales_worker_session_put(p_worker text, p_cookies jsonb) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_worker_uid(); v_id text := btrim(coalesce(p_worker, ''));
begin
  perform dsales.dsales_worker_session_write(v_id, p_cookies);
  insert into dsales.dsales_worker_state (worker_id) values (v_id) on conflict (worker_id) do nothing;
  update dsales.dsales_worker_state
     set runtime = case when runtime ->> 'state' = 'needs_login'
                        then (runtime - 'lastError') || '{"state":"running","sessionOk":null}'::jsonb
                        else runtime end,
         updated_at = now()
   where worker_id = v_id;
end $$;

revoke all on function dsales.dsales_worker_state_begin(text, int), dsales.dsales_worker_state_end(text, jsonb, jsonb),
  dsales.dsales_worker_session_put(text, jsonb) from public, anon;
grant execute on function dsales.dsales_worker_state_begin(text, int), dsales.dsales_worker_state_end(text, jsonb, jsonb),
  dsales.dsales_worker_session_put(text, jsonb) to authenticated;

/* ---------- admin (setup page) ---------- */

-- "restart" for a worker that has no process to restart (state stopped after a ShapeError, once a dev has checked)
create or replace function dsales.dsales_worker_state_reset(p_worker text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  update dsales.dsales_worker_state set runtime = '{}'::jsonb, lease_until = null, updated_at = now()
   where worker_id = btrim(coalesce(p_worker, ''));
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
  if coalesce((dsales.dsales_setting('worker_tick_enabled') #>> '{}')::boolean, false) is not true then return null; end if;
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
```

- [ ] **Step 6: Dry run**

`execute_sql` ครั้งเดียว = `begin;` + migration ทั้งไฟล์ + ตัว test 28, 29, 30 (ตัด `begin;`/`rollback;` ของแต่ละ test) + `rollback;`
Expected: ไม่มี error และเห็น notice `OK 28_…`, `OK 29_…`, `OK 30_…`
ถ้า test 29 ล้มที่ `vault.create_secret` / `vault.update_secret` (สิทธิ์เขียน Vault) → **หยุด** แจ้งผู้ใช้และกลับไปทบทวน spec ข้อ 4.1 ก่อนทำต่อ

- [ ] **Step 7: ถามผู้ใช้ แล้ว apply**

ถาม: "ขอ apply migration `dsales_worker_tick` ลง production (ค่าเริ่ม: ตัวหลัก = office-1, ตัวปลุกปิด — พฤติกรรมปัจจุบันไม่เปลี่ยน)"
เมื่อได้ yes: `apply_migration` (`project_id = "nroyacasuchqniaiuirk"`, `name = "dsales_worker_tick"`, query = ทั้งไฟล์)

- [ ] **Step 8: รัน test ใหม่และ regression**

รันทีละไฟล์: `28_worker_primary_standby.sql`, `29_worker_state.sql`, `30_tick_kick.sql`, `08f_worker_rpcs.sql`, `08g_worker_settings.sql`, `10_buyer_id_room_links.sql`
Expected: ทุกไฟล์ผ่าน (notice `OK …`)
ตรวจหลัง apply ด้วย `execute_sql`: `select state, heartbeat_at > now() - interval '3 minutes' as online from dsales.dsales_worker_status where worker_id = 'office-1';` → `office-1` ยัง `running` / online

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261126120000_dsales_worker_tick.sql supabase/tests/28_worker_primary_standby.sql supabase/tests/29_worker_state.sql supabase/tests/30_tick_kick.sql
git commit -m "feat(db): worker state, primary/standby rule and per-minute tick kick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ที่เก็บ session แบบเสียบได้ + `ping()`

**Files:**
- Create: `tools/jst-worker/session-store.mjs`, `tools/jst-worker/session-store.test.mjs`
- Modify: `tools/jst-worker/jst-client.mjs`
- Test: `tools/jst-worker/jst-client.test.mjs` (เพิ่ม test ท้ายไฟล์)

- [ ] **Step 1: เขียน test `tools/jst-worker/session-store.test.mjs`**

```js
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanCookies, fileStore, memoryStore } from './session-store.mjs';

test('cleanCookies keeps only {name, value} string pairs', () => {
  assert.deepEqual(cleanCookies([{ name: 'a', value: '1', path: '/' }, { name: 'b' }, null, 'x']), [{ name: 'a', value: '1' }]);
  assert.deepEqual(cleanCookies('nope'), []);
});

test('fileStore: missing file loads empty; save writes JSON and bumps mtime', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'jsts-')), '.session.json');
  const s = fileStore(path);
  assert.deepEqual(s.load(), []);
  assert.equal(s.mtime(), 0);
  s.save([{ name: 'a', value: '1' }]);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), [{ name: 'a', value: '1' }]);
  assert.ok(s.mtime() > 0);
  assert.equal(existsSync(`${path}.tmp`), false);
  writeFileSync(path, 'not json');
  assert.deepEqual(s.load(), []);
});

test('memoryStore: starts clean, becomes dirty on save, hands out copies', () => {
  const s = memoryStore([{ name: 'a', value: '1', extra: true }]);
  assert.equal(s.dirty, false);
  assert.deepEqual(s.load(), [{ name: 'a', value: '1' }]);
  s.load()[0].value = 'changed';
  assert.deepEqual(s.cookies(), [{ name: 'a', value: '1' }]);
  s.save([{ name: 'a', value: '2' }]);
  assert.equal(s.dirty, true);
  assert.deepEqual(s.cookies(), [{ name: 'a', value: '2' }]);
  assert.equal(s.mtime(), 0);
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd tools/jst-worker && node --test session-store.test.mjs`
Expected: FAIL `Cannot find module … session-store.mjs`

- [ ] **Step 3: เขียน `tools/jst-worker/session-store.mjs`**

```js
// ที่เก็บ cookie ของ JST — แบบไฟล์ (.session.json บนเครื่อง worker) และแบบหน่วยความจำ (โหมดรอบบน Vercel)
// store = { load(): [{name, value}], save(cookies), mtime(): number }
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';

const isCookie = (c) => c && typeof c === 'object' && typeof c.name === 'string' && typeof c.value === 'string';

/** เหลือเฉพาะคู่ {name, value} ที่เป็นข้อความ */
export const cleanCookies = (list) => (Array.isArray(list) ? list.filter(isCookie).map((c) => ({ name: c.name, value: c.value })) : []);

export function fileStore(path) {
  return {
    load() {
      if (!path || !existsSync(path)) return [];
      try {
        return cleanCookies(JSON.parse(readFileSync(path, 'utf8')));
      } catch {
        return [];
      }
    },
    save(cookies) {
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(cleanCookies(cookies), null, 2), { mode: 0o600 });
      renameSync(tmp, path);
    },
    mtime() {
      try {
        return statSync(path).mtimeMs;
      } catch {
        return 0;
      }
    },
  };
}

/** dirty = มีการ save หลังสร้าง (ใช้ตัดสินว่าต้องเขียน cookie กลับ DB หรือไม่) */
export function memoryStore(initial = []) {
  let cookies = cleanCookies(initial);
  let dirty = false;
  return {
    load: () => cookies.map((c) => ({ ...c })),
    save(next) {
      cookies = cleanCookies(next);
      dirty = true;
    },
    mtime: () => 0,
    cookies: () => cookies.map((c) => ({ ...c })),
    get dirty() {
      return dirty;
    },
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test session-store.test.mjs`
Expected: `# pass 3` `# fail 0`

- [ ] **Step 5: เพิ่ม test ท้าย `tools/jst-worker/jst-client.test.mjs`**

เพิ่ม import ที่หัวไฟล์ (บรรทัดถัดจาก import ของ `./jst-client.mjs`):

```js
import { memoryStore } from './session-store.mjs';
```

เพิ่มท้ายไฟล์:

```js
test('sessionStore: cookies are read from and written to the store, not a file', async () => {
  const store = memoryStore([{ name: 'auth', value: 'OLD' }]);
  const fetch = fakeFetch({
    'POST /iim/getSessions': (req) => {
      assert.match(req.headers.Cookie, /auth=OLD/);
      return res({ success: true, data: { data: [ROOM] } }, { cookies: ['auth=NEW; Path=/'] });
    },
  });
  const jst = createJstClient({ accountId: 'u', password: 'p', sessionStore: store, fetch });
  assert.equal(jst.hasSession(), true);
  assert.equal(store.dirty, false);
  assert.equal(await jst.ping(), true);
  assert.equal(store.dirty, true);
  assert.deepEqual(store.cookies(), [{ name: 'auth', value: 'NEW' }]);
  assert.equal(jst.sessionMtime(), 0);
});

test('ping: asks for one session with no ids; 401 → SessionExpired; bad shape → ShapeError', async () => {
  let seen;
  const ok = createJstClient({
    sessionStore: memoryStore([{ name: 'auth', value: 'T' }]),
    fetch: fakeFetch({ 'POST /iim/getSessions': (req) => ((seen = req.body), res({ success: true, data: { data: [] } })) }),
  });
  assert.equal(await ok.ping(), true);
  assert.equal(seen.page_size, 1);
  assert.deepEqual(seen.precise_query_ms_ids, []);
  assert.equal(seen.is_precise_query, false);

  const expired = createJstClient({ sessionStore: memoryStore(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res('', { status: 401 }) }) });
  await assert.rejects(expired.ping(), SessionExpired);

  const odd = createJstClient({ sessionStore: memoryStore(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res({ success: true, data: {} }) }) });
  await assert.rejects(odd.ping(), ShapeError);
});
```

- [ ] **Step 6: รันให้เห็นว่าล้ม**

Run: `node --test jst-client.test.mjs`
Expected: test ใหม่ 2 ตัว FAIL (`jst.ping is not a function`) · test เดิมผ่าน

- [ ] **Step 7: แก้ `tools/jst-worker/jst-client.mjs`**

(ก) แทนบรรทัด import ของ `node:fs`:

```js
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
```
ด้วย
```js
import { fileStore } from './session-store.mjs';
```

(ข) ใน `createJstClient({ … })` เพิ่มพารามิเตอร์ `sessionStore` ต่อจาก `sessionFile,` และหลังบรรทัด `const jar = new Map();` เพิ่ม:

```js
  // ที่เก็บ cookie: ส่ง sessionStore มาเอง (โหมดรอบ) หรือใช้ไฟล์ sessionFile แบบเดิม
  const store = sessionStore || (sessionFile ? fileStore(sessionFile) : null);
```

(ค) แทนฟังก์ชัน `loadSession` และ `saveSession` ทั้งสองตัวด้วย:

```js
  function loadSession() {
    jar.clear();
    if (!store) return false;
    for (const c of store.load()) jar.set(c.name, c.value);
    return jar.size > 0;
  }

  function saveSession() {
    if (store) store.save([...jar].map(([name, value]) => ({ name, value })));
  }
```

(ง) แทนฟังก์ชัน `sessionMtime` ด้วย:

```js
  const sessionMtime = () => (store && typeof store.mtime === 'function' ? store.mtime() : 0);
```

(จ) เพิ่มฟังก์ชัน `ping` ก่อนบรรทัด `/** ข้อความล่าสุด 20 รายการของห้อง */`:

```js
  /** ยืนยันว่า session ยังใช้ได้: ขอ 1 ห้องแล้วทิ้งผล (session หลุด → SessionExpired จาก post) */
  async function ping() {
    const body = await post('/iim/getSessions', { ...sessionBody(0, false), precise_query_ms_ids: [] });
    requireSuccess('/iim/getSessions', body);
    if (!Array.isArray(body.data?.data)) throw new ShapeError('/iim/getSessions: data.data is not an array');
    return true;
  }
```

(ฉ) ใน object ที่ `return` เพิ่ม `ping,` ต่อจาก `searchByBuyerId,`

- [ ] **Step 8: รัน test ทั้งโฟลเดอร์ให้ผ่าน**

Run: `node --test`
Expected: `# fail 0` (test เดิมของ `jst-client` ที่อ่านไฟล์ `.session.json` ต้องผ่านโดยไม่แก้)

- [ ] **Step 9: Commit**

```bash
git add tools/jst-worker/session-store.mjs tools/jst-worker/session-store.test.mjs tools/jst-worker/jst-client.mjs tools/jst-worker/jst-client.test.mjs
git commit -m "feat(worker): pluggable JST session store and ping()

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `worker-core` — สถานะข้ามรอบ และ `tick()`

**Files:**
- Create: `tools/jst-worker/worker-tick.test.mjs`
- Modify: `tools/jst-worker/worker-core.mjs`

- [ ] **Step 1: เขียน test `tools/jst-worker/worker-tick.test.mjs`**

```js
// node --test — โหมดรอบ (Vercel): initialState / exportState / tick (fake jst / queue / clock)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaRequired, JstError, SessionExpired } from './jst-client.mjs';
import { createWorker } from './worker-core.mjs';

const ROOM = { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'P', name: 'คุณเอ', expired: false };
const job = (over = {}) => ({
  id: 'q1', ms_id: 555, target_ms_id: 555, test_redirect: false, page: 'P', provider: 'Line',
  chat_name: 'คุณเอ', message: 'สวัสดีค่ะ', attempts: 1, enqueued_at: '2026-11-20T03:00:00.000Z', requested_by: 'u1', ...over,
});
const targets = (n) => Array.from({ length: n }, (_, i) => ({ buyer_id: `buyer${i + 1}`, shop_prefix: 'LOA' }));
const T0 = Date.parse('2026-11-26T04:00:00Z');
const copy = (x) => JSON.parse(JSON.stringify(x));

function setup({ jobs = [], linkTargets = [], jst = {}, initialState, config = {} } = {}) {
  const queue = {
    jobs: [...jobs], targets: [...linkTargets], reports: [], heartbeats: [], saves: [], claims: 0, claimError: null, reportError: null,
    async claim() {
      queue.claims++;
      if (queue.claimError) throw queue.claimError;
      return queue.jobs.shift() ?? null;
    },
    async report(id, status, error, jstMsgId) {
      if (queue.reportError) throw queue.reportError;
      queue.reports.push({ id, status, error, jstMsgId });
    },
    async heartbeat(workerId, state, sessionOk, lastError) {
      queue.heartbeats.push({ workerId, state, sessionOk, lastError });
    },
    async linkTargets() {
      const t = queue.targets;
      queue.targets = [];
      return t;
    },
    async linkSave(w, id, rooms) {
      queue.saves.push(id);
      return rooms.length;
    },
  };
  const j = {
    sends: [], searches: [], pings: 0, logins: 0,
    async room(msId) {
      return { ...ROOM, msId: Number(msId) };
    },
    async recentMessages() {
      return [];
    },
    async send(room, text) {
      j.sends.push(text);
      return { ok: true, raw: { success: true, data: { msg_id: 1 } } };
    },
    async searchByBuyerId(id) {
      j.searches.push(id);
      return [];
    },
    async ping() {
      j.pings++;
      return true;
    },
    async login() {
      j.logins++;
    },
    sessionMtime: () => 0,
    ...jst,
  };
  const clock = { t: T0, now: () => clock.t };
  const worker = createWorker({
    jst: j, queue, clock, log: () => {},
    sleep: async (ms) => {
      clock.t += ms;
    },
    config: { workerId: 'w1', ...config },
    initialState,
  });
  return { worker, queue, jst: j, clock };
}

test('exportState → initialState keeps a pause across workers', async () => {
  const failing = { async send() { throw new JstError('boom'); } };
  const a = setup({ jobs: [1, 2, 3, 4, 5].map((n) => job({ id: `q${n}` })), jst: failing });
  for (let i = 0; i < 5; i++) await a.worker.processOne();
  const saved = copy(a.worker.exportState());
  assert.equal(saved.state, 'paused');
  assert.equal(saved.failures, 5);

  const b = setup({ jobs: [job()], initialState: saved });
  assert.equal(await b.worker.processOne(), 'paused');
  assert.equal(b.queue.claims, 0);
  b.clock.t += 16 * 60_000;
  assert.equal(await b.worker.processOne(), 'sent');
});

test('needs_login survives; state set back to running (session upload) resumes', async () => {
  const a = setup({
    jobs: [job()],
    jst: { async room() { throw new SessionExpired(); }, async login() { throw new CaptchaRequired(); } },
  });
  assert.equal(await a.worker.processOne(), 'requeued');
  const saved = copy(a.worker.exportState());
  assert.equal(saved.state, 'needs_login');
  assert.equal(saved.sessionOk, false);

  const b = setup({ jobs: [job()], initialState: saved });
  assert.equal(await b.worker.processOne(), 'needs_login');
  assert.equal(b.queue.claims, 0);

  const c = setup({ jobs: [job()], initialState: { ...saved, state: 'running' } });
  assert.equal(await c.worker.processOne(), 'sent');
});

test('a report that could not be delivered is flushed by the next worker before it claims', async () => {
  const a = setup({ jobs: [job()] });
  a.queue.reportError = new Error('supabase down');
  await assert.rejects(a.worker.processOne(), /queue_unavailable/);
  const saved = copy(a.worker.exportState());
  assert.equal(saved.pendingReports.length, 1);
  assert.equal(saved.pendingReports[0].status, 'sent');

  const b = setup({ initialState: saved });
  assert.equal(await b.worker.processOne(), 'idle');
  assert.deepEqual(b.queue.reports.map((r) => [r.id, r.status]), [['q1', 'sent']]);
  assert.equal(b.worker.exportState().pendingReports.length, 0);
});

test('tick sends at most one job, heartbeats once and does not ping after a JST call', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job(), job({ id: 'q2' })] });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'sent');
  assert.equal(out.state, 'running');
  assert.equal(jst.sends.length, 1);
  assert.equal(queue.jobs.length, 1);
  assert.equal(jst.pings, 0);
  assert.deepEqual(queue.heartbeats, [{ workerId: 'w1', state: 'running', sessionOk: true, lastError: null }]);
  assert.equal(worker.exportState().lastJstOkAt, clock.t);
});

test('tick with no job links up to maxLinks and keeps the rest for the next tick', async () => {
  const { worker, jst, clock } = setup({ linkTargets: targets(5) });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000, maxLinks: 3 });
  assert.equal(out.result, 'linked');
  assert.equal(out.links, 3);
  assert.deepEqual(jst.searches, ['buyer1', 'buyer2', 'buyer3']);
  assert.deepEqual(worker.exportState().linkTargets.map((t) => t.buyer_id), ['buyer4', 'buyer5']);
});

test('tick stops linking when the next lookup would pass the deadline', async () => {
  const { worker, jst, clock } = setup({ linkTargets: targets(5) });
  const out = await worker.tick({ deadlineMs: clock.t + 2000, maxLinks: 10 }); // ห่างกัน 1.5 วินาที → ได้ 2 รหัส
  assert.equal(out.links, 2);
  assert.equal(jst.searches.length, 2);
});

test('a quiet tick pings JST when the last success is older than pingAfterMs, then not again', async () => {
  const { worker, queue, jst, clock } = setup();
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'idle');
  assert.equal(out.pinged, true);
  assert.equal(jst.pings, 1);
  assert.equal(queue.heartbeats[0].sessionOk, true);
  clock.t += 60_000;
  const again = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(again.pinged, false);
  assert.equal(jst.pings, 1);
});

test('ping: an expired session logs in again; a captcha puts the worker in needs_login', async () => {
  let first = true;
  const a = setup({
    jst: {
      async ping() {
        if (first) {
          first = false;
          throw new SessionExpired();
        }
        return true;
      },
    },
  });
  await a.worker.tick({ deadlineMs: a.clock.t + 40_000 });
  assert.equal(a.jst.logins, 1);
  assert.deepEqual(a.queue.heartbeats[0], { workerId: 'w1', state: 'running', sessionOk: true, lastError: null });

  const b = setup({ jst: { async ping() { throw new SessionExpired(); }, async login() { throw new CaptchaRequired(); } } });
  const out = await b.worker.tick({ deadlineMs: b.clock.t + 40_000 });
  assert.equal(out.state, 'needs_login');
  assert.equal(b.queue.heartbeats[0].state, 'needs_login');
  assert.equal(b.queue.heartbeats[0].sessionOk, false);
});

test('the login limit (3 per hour) carries over between ticks', async () => {
  const { worker, queue, jst, clock } = setup({
    jst: { async ping() { throw new SessionExpired(); } },
    initialState: { loginTimes: [T0 - 60_000, T0 - 120_000, T0 - 180_000] },
  });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(jst.logins, 0);
  assert.equal(out.state, 'needs_login');
  assert.match(queue.heartbeats[0].lastError, /^login_limit/);
});

test('a stopped worker stays stopped: no claim, no ping, heartbeat says stopped', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job()], initialState: { state: 'stopped', lastError: 'ShapeError: x' } });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'stopped');
  assert.equal(queue.claims, 0);
  assert.equal(jst.pings, 0);
  assert.deepEqual(queue.heartbeats[0], { workerId: 'w1', state: 'stopped', sessionOk: null, lastError: 'ShapeError: x' });
});

test('Supabase down during a tick: result queue_error, nothing sent', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job()] });
  queue.claimError = new Error('fetch failed');
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'queue_error');
  assert.equal(jst.sends.length, 0);
});

test('garbage in initialState is ignored', () => {
  const { worker } = setup({ initialState: { state: 'weird', failures: 'x', loginTimes: 'no', pendingReports: [{}], linkTargets: [{ nope: 1 }], lastJstOkAt: 'x' } });
  assert.deepEqual(worker.exportState(), {
    state: 'running', sessionOk: null, lastError: null, failures: 0, pausedUntil: 0, loginTimes: [],
    pendingReports: [], linkTargets: [], linkPausedUntil: 0, lastJstOkAt: 0,
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `node --test worker-tick.test.mjs`
Expected: FAIL ทุก test (`worker.exportState is not a function` / `worker.tick is not a function`)

- [ ] **Step 3: แก้ `tools/jst-worker/worker-core.mjs`**

(ก) บรรทัดประกาศ `createWorker` เปลี่ยนเป็น:

```js
export function createWorker({ jst, queue, clock = { now: () => Date.now() }, sleep, log = () => {}, config = {}, initialState = null }) {
```

(ข) ใน object `s` เพิ่มบรรทัดต่อจาก `linksWritten: 0,`:

```js
    lastJstOkAt: 0, // เวลาที่เรียก JST สำเร็จครั้งล่าสุด — tick ใช้ตัดสินว่าต้อง ping หรือไม่
```

(ค) หลังบรรทัดที่ประกาศ `const canLink = …;` (จบที่ `typeof jst.searchByBuyerId === 'function';`) เพิ่ม:

```js
  /* ---------- สถานะข้ามรอบ (โหมดรอบบน Vercel) ---------- */

  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  /** รับค่าที่ exportState() ของรอบก่อนบันทึกไว้ — ค่าที่รูปแบบผิดถูกข้าม */
  function importState(src) {
    if (!src || typeof src !== 'object') return;
    if (Object.values(STATES).includes(src.state)) s.state = src.state;
    if (typeof src.sessionOk === 'boolean') s.sessionOk = src.sessionOk;
    if (typeof src.lastError === 'string') s.lastError = src.lastError;
    for (const k of ['failures', 'pausedUntil', 'linkPausedUntil', 'lastJstOkAt']) if (num(src[k])) s[k] = src[k];
    if (Array.isArray(src.loginTimes)) s.loginTimes = src.loginTimes.filter(num);
    if (Array.isArray(src.pendingReports)) {
      s.pendingReports = src.pendingReports
        .filter((r) => r && typeof r === 'object' && r.id && typeof r.status === 'string')
        .map((r) => ({ id: r.id, status: r.status, error: r.error ?? null, jstMsgId: r.jstMsgId ?? null }));
    }
    if (Array.isArray(src.linkTargets)) {
      s.linkTargets = src.linkTargets.filter((t) => t && typeof t.buyer_id === 'string' && t.buyer_id.trim() !== '');
    }
  }
  importState(initialState);

  /** ค่าที่ต้องจำข้ามรอบ (ต้องแปลงเป็น JSON ได้) */
  function exportState() {
    return {
      state: s.state, sessionOk: s.sessionOk, lastError: s.lastError, failures: s.failures, pausedUntil: s.pausedUntil,
      loginTimes: [...s.loginTimes], pendingReports: s.pendingReports.map((r) => ({ ...r })),
      linkTargets: s.linkTargets.map((t) => ({ ...t })), linkPausedUntil: s.linkPausedUntil, lastJstOkAt: s.lastJstOkAt,
    };
  }

  function jstOk() {
    s.sessionOk = true;
    s.lastJstOkAt = clock.now();
  }
```

(ง) แทน `s.sessionOk = true;` 3 จุดด้วย `jstOk();`:
- ใน `relogin()` บรรทัดหลัง `await jst.login();`
- ใน `attempt(job)` บรรทัดหลัง `const r = await jst.room(job.target_ms_id);`
- ใน `linkOne()` บรรทัดหลังบล็อก `try { rooms = await search(); } catch (e) { … rooms = await search(); }` (บรรทัด `s.sessionOk = true;` ก่อน `} catch (e) {` ตัวนอก)

(จ) ก่อนบรรทัด `/* ---------- ลูป ---------- */` เพิ่ม:

```js
  /* ---------- หนึ่งรอบ (โหมดรอบ) ---------- */

  /** ไม่ได้เรียก JST สำเร็จเกิน maxAgeMs → ping หนึ่งครั้ง (session หลุด = ล็อกอินใหม่ตามกติกาเดิม) · คืน true ถ้าได้ลอง */
  async function pingIfQuiet(maxAgeMs) {
    if (s.state !== STATES.running || typeof jst.ping !== 'function') return false;
    if (clock.now() - s.lastJstOkAt < maxAgeMs) return false;
    try {
      try {
        await jst.ping();
      } catch (e) {
        if (!(e instanceof SessionExpired)) throw e;
        s.sessionOk = false;
        log('warn', 'JST session expired (ping) — logging in again');
        const lr = await relogin();
        if (!lr.ok) return true;
        await jst.ping();
      }
      jstOk();
    } catch (e) {
      s.sessionOk = false;
      if (e instanceof ShapeError) setState(STATES.stopped, `ShapeError: ${clip(e.message)}`);
      else if (e instanceof SessionExpired) enterNeedsLogin(`SessionExpired after re-login: ${clip(e.message)}`);
      else if (e instanceof CaptchaRequired || e instanceof LoginFailed || e instanceof LoginUnavailable) enterNeedsLogin(`${e.name}: ${clip(e.message)}`);
      else s.lastError = `ping: ${clip(e?.message || e)}`;
    }
    return true;
  }

  /**
   * หนึ่งรอบ: งานส่งไม่เกิน 1 งาน (processOne) · ไม่มีงานส่ง = ผูกห้องต่อจนครบ maxLinks หรือใกล้ deadlineMs
   * แล้ว ping ถ้าเงียบนาน และ heartbeat 1 ครั้ง → { result, links, pinged, state }
   */
  async function tick({ deadlineMs = clock.now() + 40_000, maxLinks = 10, pingAfterMs = 600_000 } = {}) {
    s.ticks++;
    const out = { result: null, links: 0, pinged: false };
    try {
      out.result = await processOne();
      s.backoffMs = 0;
      if (out.result === 'linked') {
        out.links = 1;
        while (out.links < maxLinks && clock.now() + cfg.linkIntervalMs < deadlineMs) {
          await sleep(cfg.linkIntervalMs);
          if ((await linkOne()) !== 'linked') break;
          out.links++;
        }
      }
      out.pinged = await pingIfQuiet(pingAfterMs);
    } catch (e) {
      if (!(e instanceof QueueUnavailable)) throw e;
      s.lastError = clip(e.message);
      log('warn', 'supabase unavailable during tick', { error: clip(e.message) });
      out.result = 'queue_error';
    }
    await heartbeat({ force: true });
    return { ...out, state: s.state };
  }
```

(ฉ) ใน object ที่ `return` ท้าย `createWorker` เพิ่ม `tick,` และ `exportState,` ต่อจาก `run,`

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test`
Expected: `# fail 0` — ทั้ง `worker-tick.test.mjs` และ `worker-core.test.mjs` เดิม (ไม่ได้แก้)

- [ ] **Step 5: Commit**

```bash
git add tools/jst-worker/worker-core.mjs tools/jst-worker/worker-tick.test.mjs
git commit -m "feat(worker): carry worker state between runs and add a single-tick entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `queue-client` — RPC สถานะ และล็อกอินใหม่เมื่อ token เก่า

**Files:**
- Modify: `tools/jst-worker/queue-client.mjs`
- Test: `tools/jst-worker/queue-client.test.mjs` (เพิ่ม test ท้ายไฟล์)

- [ ] **Step 1: เพิ่ม test ท้าย `tools/jst-worker/queue-client.test.mjs`**

```js
test('state RPCs use the contract args; begin returns null when the lease is held', async () => {
  const log = [];
  const begun = { runtime: { failures: 1 }, cookies: [{ name: 'a', value: '1' }] };
  let n = 0;
  const q = createQueueClient({
    ...base,
    createClient: fakeCreateClient(log, { rpcResult: (name) => ({ data: name === 'dsales_worker_state_begin' && n++ === 0 ? begun : null, error: null }) }),
  });
  assert.deepEqual(await q.stateBegin('vercel'), begun);
  assert.equal(await q.stateBegin('vercel', 30), null);
  await q.stateEnd('vercel', { state: 'running' });
  await q.stateEnd('vercel', { state: 'running' }, [{ name: 'a', value: '2' }]);
  await q.sessionPut('vercel', [{ name: 'b', value: '3' }]);
  assert.deepEqual(log.filter((l) => l.rpc).map((r) => [r.rpc, r.args]), [
    ['dsales_worker_state_begin', { p_worker: 'vercel', p_lease_seconds: 90 }],
    ['dsales_worker_state_begin', { p_worker: 'vercel', p_lease_seconds: 30 }],
    ['dsales_worker_state_end', { p_worker: 'vercel', p_runtime: { state: 'running' }, p_cookies: null }],
    ['dsales_worker_state_end', { p_worker: 'vercel', p_runtime: { state: 'running' }, p_cookies: [{ name: 'a', value: '2' }] }],
    ['dsales_worker_session_put', { p_worker: 'vercel', p_cookies: [{ name: 'b', value: '3' }] }],
  ]);
});

test('autoRefreshToken false: no refresh timer, and a sign-in older than 45 minutes is redone', async () => {
  const log = [];
  let t = 1_000_000;
  const q = createQueueClient({ ...base, autoRefreshToken: false, now: () => t, createClient: fakeCreateClient(log) });
  assert.deepEqual(log[0].create.opts, { db: { schema: 'dsales' }, auth: { persistSession: false, autoRefreshToken: false } });
  await q.claim('w1');
  t += 44 * 60_000;
  await q.claim('w1');
  assert.equal(log.filter((l) => l.signIn).length, 1);
  t += 2 * 60_000;
  await q.claim('w1');
  assert.equal(log.filter((l) => l.signIn).length, 2);
});

test('autoRefreshToken true (office loop): the sign-in is kept however old it is', async () => {
  const log = [];
  let t = 0;
  const q = createQueueClient({ ...base, now: () => t, createClient: fakeCreateClient(log) });
  await q.claim('w1');
  t += 5 * 3600_000;
  await q.claim('w1');
  assert.equal(log.filter((l) => l.signIn).length, 1);
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `node --test queue-client.test.mjs`
Expected: test ใหม่ 2 ตัวแรก FAIL (`q.stateBegin is not a function`, opts `autoRefreshToken: true`) · ตัวที่สามและ test เดิมผ่าน

- [ ] **Step 3: แก้ `tools/jst-worker/queue-client.mjs`**

(ก) แทนบรรทัดประกาศฟังก์ชันและการสร้าง client:

```js
export function createQueueClient({ supabaseUrl, anonKey, email, password, createClient }) {
  if (typeof createClient !== 'function') throw new Error('createClient is required');
  if (!supabaseUrl || !anonKey) throw new Error('supabase url / anonKey missing');
  const client = createClient(supabaseUrl, anonKey, {
    db: { schema: 'dsales' },
    auth: { persistSession: false, autoRefreshToken: true },
  });
  let signedIn = null; // Promise ของการล็อกอินที่สำเร็จ

  function ensureAuth() {
    if (!signedIn) {
```
ด้วย
```js
/**
 * autoRefreshToken: true = ลูปบนเครื่อง worker (supabase-js ต่ออายุ token เอง)
 * false = โหมดรอบบน Vercel (ไม่มี timer ข้ามรอบ) → ล็อกอินใหม่เมื่อ token อายุเกิน maxSessionAgeMs (token อยู่ได้ 1 ชม.)
 */
export function createQueueClient({
  supabaseUrl, anonKey, email, password, createClient,
  autoRefreshToken = true, now = () => Date.now(), maxSessionAgeMs = 45 * 60_000,
}) {
  if (typeof createClient !== 'function') throw new Error('createClient is required');
  if (!supabaseUrl || !anonKey) throw new Error('supabase url / anonKey missing');
  const client = createClient(supabaseUrl, anonKey, {
    db: { schema: 'dsales' },
    auth: { persistSession: false, autoRefreshToken },
  });
  let signedIn = null; // Promise ของการล็อกอินที่สำเร็จ
  let signedInAt = 0;

  function ensureAuth() {
    if (signedIn && !autoRefreshToken && now() - signedInAt > maxSessionAgeMs) signedIn = null;
    if (!signedIn) {
```

(ข) ใน `ensureAuth` แทนบรรทัด `return data;` ด้วย:

```js
        signedInAt = now();
        return data;
```

(ค) ใน object ที่ `return` เพิ่มก่อน `async heartbeat(`:

```js
    /** เริ่มรอบ: null = รอบอื่นถือ lease อยู่ · ไม่เช่นนั้น { runtime, cookies } */
    async stateBegin(workerId, leaseSeconds = 90) {
      const data = await rpc('dsales_worker_state_begin', { p_worker: workerId, p_lease_seconds: leaseSeconds });
      return data ?? null;
    },
    /** จบรอบ: บันทึก runtime · cookies = null คือไม่เปลี่ยน */
    async stateEnd(workerId, runtime, cookies = null) {
      await rpc('dsales_worker_state_end', { p_worker: workerId, p_runtime: runtime ?? {}, p_cookies: cookies ?? null });
    },
    /** อัปโหลด session ที่คนล็อกอินเอง (import-session.mjs --upload) */
    async sessionPut(workerId, cookies) {
      await rpc('dsales_worker_session_put', { p_worker: workerId, p_cookies: cookies });
    },
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test`
Expected: `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/jst-worker/queue-client.mjs tools/jst-worker/queue-client.test.mjs
git commit -m "feat(worker): state RPCs in the queue client; re-sign-in when the token is old

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `tick.mjs` — ลำดับขั้นของหนึ่งรอบ

**Files:**
- Create: `tools/jst-worker/tick.mjs`, `tools/jst-worker/tick.test.mjs`

- [ ] **Step 1: เขียน test `tools/jst-worker/tick.test.mjs`**

```js
// node --test — runTick: lease → worker.tick → บันทึกสถานะ (fake queue / jst)
import test from 'node:test';
import assert from 'node:assert/strict';
import { runTick } from './tick.mjs';

const ROOM = { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'P', name: 'คุณเอ', expired: false };
const JOB = {
  id: 'q1', ms_id: 555, target_ms_id: 555, test_redirect: false, page: 'P', provider: 'Line',
  chat_name: 'คุณเอ', message: 'สวัสดีค่ะ', attempts: 1, enqueued_at: '2026-11-20T03:00:00.000Z', requested_by: 'u1',
};

function fakeQueue({ begun, jobs = [] } = {}) {
  const q = {
    begins: [], ends: [], reports: [], heartbeats: [], claims: 0, jobs: [...jobs],
    async stateBegin(workerId, lease) {
      q.begins.push([workerId, lease]);
      return begun === undefined ? { runtime: {}, cookies: [] } : begun;
    },
    async stateEnd(workerId, runtime, cookies) {
      q.ends.push({ workerId, runtime, cookies });
    },
    async claim() {
      q.claims++;
      return q.jobs.shift() ?? null;
    },
    async report(id, status) {
      q.reports.push([id, status]);
    },
    async heartbeat(workerId, state, sessionOk) {
      q.heartbeats.push([workerId, state, sessionOk]);
    },
    async linkTargets() {
      return [];
    },
    async linkSave() {
      return 0;
    },
  };
  return q;
}

/** createJst ปลอม: เก็บ options ที่ได้รับ · onPing ใช้จำลอง JST เปลี่ยน cookie */
function fakeJstFactory({ onPing = () => {} } = {}) {
  const seen = { opts: null, sends: [] };
  const create = (opts) => {
    seen.opts = opts;
    return {
      async room(msId) {
        return { ...ROOM, msId: Number(msId) };
      },
      async recentMessages() {
        return [];
      },
      async send(room, text) {
        seen.sends.push(text);
        return { ok: true, raw: { success: true, data: { msg_id: 9 } } };
      },
      async searchByBuyerId() {
        return [];
      },
      async ping() {
        onPing(opts.sessionStore);
        return true;
      },
      async login() {},
      sessionMtime: () => 0,
    };
  };
  return { create, seen };
}

const args = (over) => ({ workerId: 'vercel', jstConfig: { accountId: 'u', password: 'p' }, now: () => 1_000_000, sleep: async () => {}, ...over });

test('lease held → skipped, nothing else is called', async () => {
  const queue = fakeQueue({ begun: null });
  const { create, seen } = fakeJstFactory();
  assert.deepEqual(await runTick(args({ queue, createJst: create })), { skipped: 'busy' });
  assert.equal(seen.opts, null);
  assert.equal(queue.claims, 0);
  assert.equal(queue.ends.length, 0);
});

test('normal tick: stored cookies and runtime go in, one job is sent, state is saved without cookies', async () => {
  const queue = fakeQueue({ begun: { runtime: { failures: 2 }, cookies: [{ name: 'a', value: '1' }] }, jobs: [JOB] });
  const { create, seen } = fakeJstFactory();
  const out = await runTick(args({ queue, createJst: create }));
  assert.deepEqual(queue.begins, [['vercel', 90]]);
  assert.equal(seen.opts.accountId, 'u');
  assert.deepEqual(seen.opts.sessionStore.load(), [{ name: 'a', value: '1' }]);
  assert.deepEqual(seen.sends, ['สวัสดีค่ะ']);
  assert.deepEqual(queue.reports, [['q1', 'sent']]);
  assert.equal(out.skipped, null);
  assert.equal(out.result, 'sent');
  assert.equal(out.cookiesSaved, false);
  assert.equal(queue.ends.length, 1);
  assert.equal(queue.ends[0].workerId, 'vercel');
  assert.equal(queue.ends[0].runtime.state, 'running');
  assert.equal(queue.ends[0].runtime.failures, 0); // ส่งสำเร็จ = ล้างตัวนับ
  assert.equal(queue.ends[0].cookies, null);
});

test('cookies changed during the tick are written back', async () => {
  const queue = fakeQueue();
  const { create } = fakeJstFactory({ onPing: (store) => store.save([{ name: 'a', value: '2' }]) });
  const out = await runTick(args({ queue, createJst: create }));
  assert.equal(out.pinged, true);
  assert.equal(out.cookiesSaved, true);
  assert.deepEqual(queue.ends[0].cookies, [{ name: 'a', value: '2' }]);
});

test('state is still saved when the tick throws, and the error is rethrown', async () => {
  const queue = fakeQueue();
  const { create } = fakeJstFactory();
  const createWorkerFn = () => ({
    async tick() {
      throw new Error('boom');
    },
    exportState: () => ({ state: 'running', failures: 7 }),
  });
  await assert.rejects(runTick(args({ queue, createJst: create, createWorkerFn })), /boom/);
  assert.deepEqual(queue.ends, [{ workerId: 'vercel', runtime: { state: 'running', failures: 7 }, cookies: null }]);
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `node --test tick.test.mjs`
Expected: FAIL `Cannot find module … tick.mjs`

- [ ] **Step 3: เขียน `tools/jst-worker/tick.mjs`**

```js
// หนึ่งรอบของ worker (โหมดรอบบน Vercel): ถือ lease → โหลดสถานะ → worker.tick() → บันทึกสถานะ
// ไม่มี I/O ของตัวเอง — รับ queue / ตัวสร้าง jst เข้ามา (app/api/cron/outreach-tick/route.ts เป็นผู้ประกอบ)
import { createJstClient } from './jst-client.mjs';
import { memoryStore } from './session-store.mjs';
import { createWorker } from './worker-core.mjs';

/**
 * → { skipped: 'busy' } เมื่อรอบก่อนยังไม่จบ
 * → { skipped: null, result, links, pinged, state, cookiesSaved }
 */
export async function runTick({
  workerId,
  queue,
  jstConfig = {},
  now = () => Date.now(),
  sleep,
  log = () => {},
  budgetMs = 40_000,
  maxLinks = 10,
  leaseSeconds = 90,
  createJst = createJstClient,
  createWorkerFn = createWorker,
}) {
  const started = now();
  const begun = await queue.stateBegin(workerId, leaseSeconds);
  if (!begun) return { skipped: 'busy' };

  const store = memoryStore(begun.cookies);
  const jst = createJst({ ...jstConfig, sessionStore: store });
  const worker = createWorkerFn({ jst, queue, clock: { now }, sleep, log, config: { workerId }, initialState: begun.runtime });

  let out;
  let failure = null;
  try {
    out = await worker.tick({ deadlineMs: started + budgetMs, maxLinks });
  } catch (e) {
    failure = e;
  }
  // บันทึกเสมอ (ปล่อย lease + เก็บ pendingReports) · cookie เขียนกลับเฉพาะเมื่อ JST เปลี่ยนค่า
  await queue.stateEnd(workerId, worker.exportState(), store.dirty ? store.cookies() : null);
  if (failure) throw failure;
  return { skipped: null, ...out, cookiesSaved: store.dirty };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test`
Expected: `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/jst-worker/tick.mjs tools/jst-worker/tick.test.mjs
git commit -m "feat(worker): runTick — lease, one worker tick, save state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Route ที่ถูกปลุก + การตรวจรหัสลับ

**Files:**
- Create: `lib/cron/auth.ts`, `lib/cron/auth.test.ts`, `app/api/cron/outreach-tick/route.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: เขียน test `lib/cron/auth.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bearerMatches } from './auth';

describe('bearerMatches', () => {
  it('accepts only the exact bearer token', () => {
    expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
    expect(bearerMatches('Bearer s3cret ', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer other1', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer s3cre', 's3cret')).toBe(false);
    expect(bearerMatches('s3cret', 's3cret')).toBe(false);
    expect(bearerMatches('bearer s3cret', 's3cret')).toBe(false);
  });
  it('rejects everything when no secret is configured or no header is sent', () => {
    expect(bearerMatches('Bearer ', '')).toBe(false);
    expect(bearerMatches('Bearer x', undefined)).toBe(false);
    expect(bearerMatches(null, 's3cret')).toBe(false);
    expect(bearerMatches(undefined, 's3cret')).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run (รากโปรเจกต์): `npx vitest run lib/cron/auth.test.ts`
Expected: FAIL `Failed to resolve import "./auth"`

- [ ] **Step 3: เขียน `lib/cron/auth.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

/** header `Authorization: Bearer <secret>` ตรงกับ secret หรือไม่ (เทียบแบบเวลาคงที่) · ไม่มี secret = ปฏิเสธเสมอ */
export function bearerMatches(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const m = /^Bearer (.+)$/.exec(header ?? '');
  if (!m) return false;
  const got = Buffer.from(m[1]);
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run lib/cron/auth.test.ts`
Expected: 2 passed

- [ ] **Step 5: เขียน `app/api/cron/outreach-tick/route.ts`**

```ts
// ถูกปลุกทุกนาทีจาก pg_cron (dsales.dsales_tick_kick) — worker ส่งข้อความ/ผูกห้องหนึ่งรอบ
// spec: docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md · ห้าม log cookie รหัสผ่าน หรือเนื้อความข้อความ
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { bearerMatches } from '@/lib/cron/auth';
import { createQueueClient } from '@/tools/jst-worker/queue-client.mjs';
import { runTick } from '@/tools/jst-worker/tick.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WORKER_ID = 'vercel';

// ใช้ client เดิมเมื่อ instance ยังอุ่น (ไม่ต้องล็อกอิน Supabase ทุกรอบ)
let queue: ReturnType<typeof createQueueClient> | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function log(level: string, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, msg, worker: WORKER_ID, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const env = process.env;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.DSALES_WORKER_EMAIL;
  const password = env.DSALES_WORKER_PASSWORD;
  if (!supabaseUrl || !anonKey || !email || !password) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }
  queue ??= createQueueClient({ supabaseUrl, anonKey, email, password, createClient, autoRefreshToken: false });
  try {
    const out = await runTick({
      workerId: WORKER_ID,
      queue,
      jstConfig: { accountId: env.JST_USER || '', password: env.JST_PASSWORD || '' },
      sleep,
      log,
    });
    return NextResponse.json({ ok: true, region: env.VERCEL_REGION ?? null, ...out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = String((e as Error)?.message || e).slice(0, 300);
    log('error', 'tick failed', { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
```

- [ ] **Step 6: แก้ `middleware.ts`**

หลังบรรทัด

```ts
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') return NextResponse.next();
```
เพิ่ม
```ts
  // route ที่ pg_cron ปลุก ไม่ใช้ session ของ Supabase — ตรวจรหัสลับเองใน route (lib/cron/auth.ts)
  if (request.nextUrl.pathname.startsWith('/api/cron/')) return NextResponse.next();
```

- [ ] **Step 7: typecheck, lint, build**

Run: `npm run typecheck`
Expected: ไม่มี error

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build` (ถ้าไม่มี `.env.local` ใน worktree ให้ตั้ง `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy` นำหน้าคำสั่ง)
Expected: build ผ่าน และตารางเส้นทางมี `ƒ /api/cron/outreach-tick`

- [ ] **Step 8: ยิง route จริงบนเครื่อง**

เพิ่ม configuration ใน `C:\Claude Ai\Directsale\.claude\launch.json`:

```json
{
  "name": "directsale-worker",
  "runtimeExecutable": "cmd",
  "runtimeArgs": ["/c", "set CRON_SECRET=local-test&& cd directsales-web-worker && npx next dev -p 3250"],
  "port": 3250
}
```

เปิดด้วย preview `directsale-worker` แล้วรัน:

```bash
curl -s -X POST -w ' http=%{http_code}\n' http://localhost:3250/api/cron/outreach-tick
curl -s -X POST -H 'Authorization: Bearer wrong' -w ' http=%{http_code}\n' http://localhost:3250/api/cron/outreach-tick
curl -s -X POST -H 'Authorization: Bearer local-test' -w ' http=%{http_code}\n' http://localhost:3250/api/cron/outreach-tick
```
Expected: `{"error":"unauthorized"} http=401` สองบรรทัดแรก (ไม่ใช่ redirect ไป `/login`) · บรรทัดที่สาม `{"ok":false,"error":"not_configured"} http=500` (เครื่อง dev ไม่ได้ตั้งบัญชี worker ใน env ของ server นี้)
ปิด preview หลังตรวจ

- [ ] **Step 9: Commit**

```bash
git add lib/cron/auth.ts lib/cron/auth.test.ts app/api/cron/outreach-tick/route.ts middleware.ts
git commit -m "feat(web): cron-triggered outreach tick route guarded by a bearer secret

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `import-session.mjs --upload`

**Files:**
- Create: `tools/jst-worker/config.mjs`, `tools/jst-worker/config.test.mjs`
- Modify: `tools/jst-worker/worker.mjs`, `tools/jst-worker/import-session.mjs`

- [ ] **Step 1: เขียน test `tools/jst-worker/config.test.mjs`**

```js
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSupabaseConfig, readEnvFile } from './config.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'jstcfg-'));

test('readEnvFile parses KEY=VALUE lines and strips quotes; a missing file is empty', () => {
  const p = join(dir(), '.env.local');
  writeFileSync(p, 'A=1\n# c\nB="two words"\n\nbad line\nC=\n');
  assert.deepEqual(readEnvFile(p), { A: '1', B: 'two words', C: '' });
  assert.deepEqual(readEnvFile(join(dir(), 'none')), {});
});

test('loadSupabaseConfig: config.json first, then process env, then .env.local', () => {
  const d = dir();
  const configPath = join(d, 'config.json');
  const envPath = join(d, '.env.local');
  writeFileSync(configPath, JSON.stringify({ supabase: { url: 'https://c.supabase.co', email: '' } }));
  writeFileSync(envPath, 'NEXT_PUBLIC_SUPABASE_ANON_KEY=file-key\nDSALES_WORKER_EMAIL=file@x\nDSALES_WORKER_PASSWORD=file-pw\n');
  const got = loadSupabaseConfig({ configPath, envPath, env: { DSALES_WORKER_EMAIL: 'env@x' } });
  assert.deepEqual(got, { url: 'https://c.supabase.co', anonKey: 'file-key', email: 'env@x', password: 'file-pw' });
});

test('loadSupabaseConfig works without config.json and names what is missing', () => {
  const d = dir();
  assert.throws(
    () => loadSupabaseConfig({ configPath: join(d, 'config.json'), envPath: join(d, '.env.local'), env: { NEXT_PUBLIC_SUPABASE_URL: 'https://e.supabase.co' } }),
    /supabase\.anonKey, supabase\.email, supabase\.password/,
  );
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd tools/jst-worker && node --test config.test.mjs`
Expected: FAIL `Cannot find module … config.mjs`

- [ ] **Step 3: เขียน `tools/jst-worker/config.mjs`**

```js
// อ่านค่าตั้งของ worker: config.json (นอก git) → environment → .env.local ที่รากโปรเจกต์
import { existsSync, readFileSync } from 'node:fs';

/** KEY=VALUE จากไฟล์ env (ไม่มีไฟล์ = {}) */
export function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** ค่าที่ใช้ล็อกอิน Supabase ด้วยบัญชี worker — ไม่ต้องมี config.json (ใช้กับ import-session.mjs --upload) */
export function loadSupabaseConfig({ configPath, envPath, env = process.env }) {
  let c = {};
  if (configPath && existsSync(configPath)) c = JSON.parse(readFileSync(configPath, 'utf8'))?.supabase || {};
  const e = { ...readEnvFile(envPath), ...env };
  const out = {
    url: c.url || e.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: c.anonKey || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    email: c.email || e.DSALES_WORKER_EMAIL || '',
    password: c.password || e.DSALES_WORKER_PASSWORD || '',
  };
  const missing = Object.entries(out).filter(([, v]) => !v).map(([k]) => `supabase.${k}`);
  if (missing.length) throw new Error(`ขาดค่า: ${missing.join(', ')} (config.json หรือ .env.local)`);
  return out;
}
```

- [ ] **Step 4: ให้ `worker.mjs` ใช้ `readEnvFile` จาก `config.mjs`**

ใน `tools/jst-worker/worker.mjs`: ลบฟังก์ชัน `readEnvFile` ทั้งตัว (รวมบรรทัด comment `/** KEY=VALUE จาก .env.local … */` เหนือมัน) และเพิ่ม import ต่อจากบรรทัด `import { createClient } from '@supabase/supabase-js';`:

```js
import { readEnvFile } from './config.mjs';
```

- [ ] **Step 5: แก้ `tools/jst-worker/import-session.mjs`**

(ก) เพิ่มบรรทัดในคอมเมนต์หัวไฟล์ ต่อจากบรรทัด `--profile <dir>`:

```js
//   node import-session.mjs --login --upload vercel   ล็อกอินเองแล้วส่ง session ให้ worker บน Vercel (dsales_worker_session_put)
```

(ข) ใน `main()` หลังบรรทัด `console.log(\`บันทึก ${jar.length} cookie ลง ${out} แล้ว — …\`);` เพิ่ม:

```js
    if (args.upload !== undefined) {
      if (typeof args.upload !== 'string') {
        console.error('ระบุชื่อ worker ด้วย เช่น --upload vercel');
        process.exitCode = 1;
        return;
      }
      const { createClient } = await import('@supabase/supabase-js');
      const { createQueueClient } = await import('./queue-client.mjs');
      const { loadSupabaseConfig } = await import('./config.mjs');
      const sb = loadSupabaseConfig({
        configPath: resolve(ROOT, typeof args.config === 'string' ? args.config : 'config.json'),
        envPath: resolve(ROOT, '..', '..', '.env.local'),
      });
      const queue = createQueueClient({ supabaseUrl: sb.url, anonKey: sb.anonKey, email: sb.email, password: sb.password, createClient });
      await queue.sessionPut(args.upload, jar);
      console.log(`ส่ง ${jar.length} cookie ให้ worker "${args.upload}" แล้ว — รอบถัดไป (ไม่เกิน 1 นาที) จะทำงานต่อเอง`);
    }
```

- [ ] **Step 6: รัน test ทั้งโฟลเดอร์ และลองเปิด worker แบบไม่มี config**

Run: `node --test`
Expected: `# fail 0`

Run: `node worker.mjs --once --config does-not-exist.json`
Expected: บรรทัด log `"msg":"fatal"` พร้อมข้อความ `ไม่พบ … does-not-exist.json` และ exit code 1 (ยืนยันว่า `worker.mjs` ยังโหลดได้หลังย้าย `readEnvFile`)

- [ ] **Step 7: Commit**

```bash
git add tools/jst-worker/config.mjs tools/jst-worker/config.test.mjs tools/jst-worker/worker.mjs tools/jst-worker/import-session.mjs
git commit -m "feat(worker): import-session --upload sends a hand-made JST session to a cloud worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: การ์ด Worker — ตัวหลัก/ตัวสำรอง และปุ่ม

**Files:**
- Modify: `lib/api/types.ts`, `lib/api/rpc.ts`, `lib/api/errors.ts`, `lib/domain/outreach.ts`, `lib/domain/outreach.test.ts`, `components/setup/OutreachPanels.tsx`, `lib/fixtures/outreach.ts`, `e2e/outreach.spec.ts`

- [ ] **Step 1: เพิ่ม test ใน `lib/domain/outreach.test.ts`**

เพิ่ม `CLOUD_WORKER_ID, workerRole` ในรายการ import จาก `./outreach` และเพิ่มใน `describe('worker', …)`:

```ts
  it('labels the primary and the standby; no label when no primary is set', () => {
    expect(workerRole(worker({ worker_id: 'vercel', is_primary: true }), 'vercel')).toBe('ตัวหลัก');
    expect(workerRole(worker({ worker_id: 'office-1', is_primary: false }), 'vercel')).toBe('ตัวสำรอง');
    expect(workerRole(worker({ worker_id: 'office-1' }), 'office-1')).toBe('ตัวหลัก'); // server รุ่นเก่าไม่ส่ง is_primary
    expect(workerRole(worker({ worker_id: 'office-1' }), null)).toBeNull();
    expect(workerRole(worker({ worker_id: 'office-1' }), '')).toBeNull();
  });
  it('an offline cloud worker gets its own hint (there is no machine to restart)', () => {
    const now = Date.parse('2026-11-26T03:00:00Z');
    expect(CLOUD_WORKER_ID).toBe('vercel');
    expect(workerBadge(worker({ worker_id: 'vercel', online: false, heartbeat_at: '2026-11-26T02:30:00Z' }), now).hint)
      .toBe('ขาดการติดต่อ 30 นาที — ตรวจ cron dsales-outreach-tick และ deployment บน Vercel');
  });
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run lib/domain/outreach.test.ts`
Expected: FAIL (`workerRole is not a function` / type error ของ `is_primary`)

- [ ] **Step 3: แก้ type, RPC wrapper และข้อความ error**

`lib/api/types.ts` — แทน `WorkerRow` และ `WorkerStatus`:

```ts
export interface WorkerRow {
  worker_id: string; state: WorkerState; jst_session_ok: boolean | null; heartbeat_at: string | null; online: boolean;
  sent_last_hour: number; queue_waiting: number; last_error: string | null;
  /** ตัวหลักตามค่า worker_primary (ไม่มี = server ยังไม่ส่ง) */
  is_primary?: boolean;
}
```
```ts
export interface WorkerStatus {
  workers: WorkerRow[];
  /** worker_id ของตัวหลัก · null/ไม่มี = ไม่ได้ตั้ง (ทุกตัวรับงานได้) */
  primary?: string | null;
  queue: { queued: number; sending: number; sent_last_hour: number; line_sent_this_month: number };
  settings: WorkerSettings;
}
```

`lib/api/rpc.ts` — เพิ่มต่อจากบรรทัด `export const findWorkerRooms = …`:

```ts
/** หัวหน้า: ตั้ง worker ตัวหลัก (ตัวอื่นเป็นตัวสำรอง) */
export const setWorkerPrimary = (workerId: string) => call<WorkerStatus>('dsales_worker_primary_set', { p_worker: workerId });
/** หัวหน้า: ล้างสถานะของ worker บน Vercel ที่หยุด (แทนการรีสตาร์ท) */
export const resetWorkerState = (workerId: string) => call<WorkerStatus>('dsales_worker_state_reset', { p_worker: workerId });
```

`lib/api/errors.ts` — เพิ่มต่อจากบรรทัด `not_worker: …`:

```ts
  unknown_worker: 'ไม่พบ worker นี้ (ต้องเคยส่งสัญญาณเข้ามาก่อน)',
  invalid_worker: 'ชื่อ worker ไม่ถูกต้อง',
```

- [ ] **Step 4: แก้ `lib/domain/outreach.ts`**

(ก) เพิ่มต่อจากบรรทัด `export const WORKER_ONLINE_MS = 3 * 60_000;`:

```ts
/** worker ที่รันเป็นฟังก์ชันบน Vercel (ไม่มีเครื่องให้เปิดใหม่) */
export const CLOUD_WORKER_ID = 'vercel';
```

(ข) แทนฟังก์ชัน `workerBadge` ทั้งตัว:

```ts
/** ป้ายสถานะการ์ด Worker: ออฟไลน์ = "ไม่ได้ทำงาน" เสมอ (state ที่เห็นคือค่าสุดท้ายที่เครื่องส่งมาก่อนหายไป) + บอกว่าขาดการติดต่อนานเท่าไร */
export function workerBadge(
  w: Pick<WorkerRow, 'heartbeat_at' | 'state'> & { online?: boolean | null; worker_id?: string }, now: number = Date.now(),
): { cls: string; text: string; hint: string | null } {
  if (isWorkerOnline(w, now)) return { cls: workerStateBadge(w.state), text: workerStateLabel(w.state), hint: null };
  const t = w.heartbeat_at ? Date.parse(w.heartbeat_at) : NaN;
  const min = Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60_000)) : null;
  const ago = min === null ? '' : min < 60 ? `${min} นาที` : min < 1440 ? `${Math.floor(min / 60)} ชั่วโมง` : `${Math.floor(min / 1440)} วัน`;
  const fix = w.worker_id === CLOUD_WORKER_ID
    ? 'ตรวจ cron dsales-outreach-tick และ deployment บน Vercel'
    : 'เปิด worker ใหม่ที่เครื่องนี้ (run-worker.cmd หรือ task "JST Outreach Worker")';
  return { cls: 's-lost', text: 'ไม่ได้ทำงาน', hint: `${ago ? `ขาดการติดต่อ ${ago} — ` : ''}${fix}` };
}

/** ป้ายบทบาทบนการ์ด Worker · ไม่ได้ตั้งตัวหลัก = ไม่แสดง */
export function workerRole(w: Pick<WorkerRow, 'worker_id' | 'is_primary'>, primary: string | null | undefined): 'ตัวหลัก' | 'ตัวสำรอง' | null {
  if (!primary) return null;
  const isPrimary = typeof w.is_primary === 'boolean' ? w.is_primary : w.worker_id === primary;
  return isPrimary ? 'ตัวหลัก' : 'ตัวสำรอง';
}
```

- [ ] **Step 5: รัน test ของ domain ให้ผ่าน**

Run: `npx vitest run lib/domain/outreach.test.ts`
Expected: ผ่านทั้งไฟล์ (test เดิมของ `workerBadge` ที่ไม่ส่ง `worker_id` ยังได้ข้อความเดิม)

- [ ] **Step 6: แก้ `components/setup/OutreachPanels.tsx`**

(ก) ใน import จาก `@/lib/api/rpc` เพิ่ม `resetWorkerState, setWorkerPrimary` · ใน import จาก `@/lib/domain/outreach` เพิ่ม `CLOUD_WORKER_ID, workerRole`

(ข) ใน `WorkerPanel` เพิ่ม state ต่อจาก `const [searching, setSearching] = useState(false);`:

```tsx
  const [busyWorker, setBusyWorker] = useState('');
```

(ค) เพิ่มฟังก์ชันก่อน `const label = (id: number) => {`:

```tsx
  /** ปุ่มของ worker แต่ละตัว: ตั้งตัวหลัก / เริ่มใหม่ — ทั้งคู่คืนสถานะล่าสุด */
  async function workerAction(id: string, run: (workerId: string) => Promise<WorkerStatus>, done: string) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once(`worker-act-${id}`, async () => {
      setBusyWorker(id);
      try {
        setLiveStatus(await run(id));
        toast(done);
      } catch (e2) {
        toastError(e2);
      } finally {
        setBusyWorker('');
      }
    });
  }
```

(ง) แทนบล็อก `status.workers.map((w) => { … })` (ตั้งแต่ `status.workers.map((w) => {` ถึง `})` ก่อน `) : (` ของกรณีไม่มี worker) ด้วย:

```tsx
              status.workers.map((w) => {
                const on = isWorkerOnline(w);
                const badge = workerBadge(w);
                const role = workerRole(w, status.primary);
                const canReset = w.worker_id === CLOUD_WORKER_ID && w.state === 'stopped';
                return (
                  <div key={w.worker_id} className="list-row" data-worker={w.worker_id}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: on ? 'var(--ok)' : 'var(--bad)' }} />
                    <div>
                      <b>{w.worker_id}</b>{role ? <> <span className="chip" data-role>{role}</span></> : null}{' '}
                      <span className="sub">{on ? 'ออนไลน์' : 'ออฟไลน์'} · ล่าสุด {stamp(w.heartbeat_at)}</span>
                      <div className="sub">
                        JST {w.jst_session_ok ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้ล็อกอิน'} · ส่งชั่วโมงนี้ {Number(w.sent_last_hour || 0).toLocaleString('th-TH')} · คิวรอ {Number(w.queue_waiting || 0).toLocaleString('th-TH')}
                      </div>
                      {badge.hint ? <div className="sub" style={{ color: 'var(--bad)' }}>{badge.hint}</div> : null}
                      {w.last_error ? <div className="sub" style={{ color: 'var(--bad)' }}>error ล่าสุด: {w.last_error}</div> : null}
                      {role !== 'ตัวหลัก' || canReset ? (
                        <div className="toolbar" style={{ marginTop: 6 }}>
                          {role !== 'ตัวหลัก' ? (
                            <button type="button" className="btn sm" data-act="primary" disabled={!!busyWorker}
                              onClick={() => void workerAction(w.worker_id, setWorkerPrimary, `ตั้ง ${w.worker_id} เป็นตัวหลักแล้ว`)}>
                              ตั้งเป็นตัวหลัก
                            </button>
                          ) : null}
                          {canReset ? (
                            <button type="button" className="btn sm" data-act="reset" disabled={!!busyWorker}
                              onClick={() => void workerAction(w.worker_id, resetWorkerState, `เริ่ม ${w.worker_id} ใหม่แล้ว — รอบถัดไปจะทำงานต่อ`)}>
                              เริ่มใหม่
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className={`badge plain ${badge.cls}`}>{badge.text}</span>
                  </div>
                );
              })
```

- [ ] **Step 7: แก้ fixture และ e2e**

`lib/fixtures/outreach.ts` — แทนบล็อก `workers: [ … ],` ของ `worker` ด้วย:

```ts
    primary: 'vercel',
    workers: [
      {
        worker_id: 'vercel', state: 'running', jst_session_ok: true, heartbeat_at: '2026-11-04T02:20:30Z', online: true,
        sent_last_hour: 2, queue_waiting: 2, last_error: null, is_primary: true,
      },
      {
        worker_id: 'office-pc-1', state: 'running', jst_session_ok: true, heartbeat_at: '2026-11-04T02:20:00Z', online: true,
        sent_last_hour: 2, queue_waiting: 2, last_error: null, is_primary: false,
      },
    ],
```

`e2e/outreach.spec.ts` — ต่อจากบรรทัด `await expect(page.locator('[data-worker=office-pc-1] .badge')).toHaveText('กำลังทำงาน');` เพิ่ม:

```ts
      await expect(page.locator('[data-worker=vercel] [data-role]')).toHaveText('ตัวหลัก');
      await expect(page.locator('[data-worker=office-pc-1] [data-role]')).toHaveText('ตัวสำรอง');
      await expect(page.locator('[data-worker=vercel] [data-act=primary]')).toHaveCount(0);
      await page.locator('[data-worker=office-pc-1] [data-act=primary]').click();
      await expect(page.locator('#toast')).toHaveText(FIXTURE_NO_WRITE);
```

- [ ] **Step 8: ตรวจทั้งชุด**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ไม่มี error · Vitest ผ่านทุกไฟล์

Run: `npx playwright test e2e/outreach.spec.ts e2e/mobile-fit.spec.ts`
Expected: ข้อความ/ปุ่มผ่าน · ภาพของหน้าตั้งค่าอาจต่างจาก baseline เพราะการ์ด Worker มี 2 แถว → รัน `npx playwright test e2e/outreach.spec.ts --update-snapshots=changed` แล้ว**เปิดดูภาพที่เปลี่ยนด้วยตา**ก่อน commit (ภาพ `send-outreach-*` / `outreach-*` ไม่ตรง baseline อยู่ก่อนแล้วตาม "งานค้าง" ใน `CLAUDE.md` — ไม่ต้องแก้ในงานนี้ และห้ามอัปเดตภาพจากเครื่องที่โหลดฟอนต์ Google ไม่ได้)

เปิดหน้าตั้งค่าในโหมด fixture ด้วย launch config ใหม่ `directsale-worker-fixtures` (`cmd /c "set NEXT_PUBLIC_FIXTURES=1&& cd directsales-web-worker && npx next dev -p 3251"`, port 3251) ที่ 390px และ 1440px ถ่ายภาพการ์ด Worker ยืนยันว่าป้ายและปุ่มไม่ล้นแถว แล้วปิด preview

- [ ] **Step 9: Commit**

```bash
git add lib/api/types.ts lib/api/rpc.ts lib/api/errors.ts lib/domain/outreach.ts lib/domain/outreach.test.ts components/setup/OutreachPanels.tsx lib/fixtures/outreach.ts e2e/outreach.spec.ts e2e/__screenshots__
git commit -m "feat(web): worker card shows primary/standby, set-primary and restart buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: เอกสาร

**Files:**
- Modify: `tools/jst-worker/README.md`, `CLAUDE.md`, `docs/DATABASE.md`, `.env.example`

- [ ] **Step 1: `tools/jst-worker/README.md`**

(ก) ในตารางไฟล์ (หัวไฟล์) เพิ่มแถวต่อจากแถว `queue-client.mjs`:

```markdown
| `session-store.mjs` | ที่เก็บ cookie ของ JST: ไฟล์ `.session.json` (เครื่อง worker) หรือหน่วยความจำ (โหมดรอบ) |
| `tick.mjs` | หนึ่งรอบของ worker บน Vercel: ถือ lease → `worker.tick()` → บันทึกสถานะลง DB |
| `config.mjs` | อ่านค่าตั้งจาก `config.json` / environment / `.env.local` |
```

(ข) เพิ่มหัวข้อใหม่ก่อน `## ความปลอดภัย`:

```markdown
## ตัวหลักบน Vercel + เครื่องนี้เป็นตัวสำรอง
สเปก: `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`

- worker ตัวหลักชื่อ `vercel` รันเป็น route `POST /api/cron/outreach-tick` ที่ pg_cron (`dsales-outreach-tick`) ปลุกทุกนาที — หนึ่งรอบส่งได้ไม่เกิน 1 ข้อความ หรือผูกห้องไม่เกิน 10 รหัส ใช้โค้ดชุดเดียวกับลูปของเครื่องนี้
- ค่า `worker_primary` ใน `dsales_settings` (ตั้งจากการ์ด Worker หน้าตั้งค่า) บอกว่าใครเป็นตัวหลัก · ตัวที่ไม่ใช่ตัวหลักจะได้ `claim` เป็น `null` และไม่ได้รหัสให้ค้น ตราบที่ตัวหลักยัง `running` และ heartbeat ไม่เกิน 3 นาที — เกินนั้นเครื่องนี้รับงานเอง ไม่ต้องสั่ง
- เครื่องสำรองตั้ง `"pollSeconds": 30` ใน `config.json` (ไม่ต้องถามคิวถี่) ค่าอื่นเหมือนเดิม
- ปิดตัวปลุกชั่วคราว: ตั้ง `worker_tick_enabled` เป็น `false` (ตัวสำรองจะรับช่วงภายใน 3–4 นาที)
- สถานะข้ามรอบของ `vercel` อยู่ในตาราง `dsales_worker_state` และ cookie ของ JST อยู่ใน Supabase Vault (`dsales_jst_session_vercel`)

### เมื่อ `vercel` ขึ้น `needs_login` (JST ขอ captcha)
รันจากเครื่องไหนก็ได้ที่มี repo นี้และ Chrome:
```powershell
node import-session.mjs --login --upload vercel
```
ล็อกอิน JST ในหน้าต่างที่เปิดขึ้น สคริปต์จะส่ง cookie ขึ้นฐานข้อมูล แล้ว `vercel` ทำงานต่อในรอบถัดไป · ถ้าการ์ดยังเป็น `needs_login` หลัง 2 นาที ให้รันซ้ำ (การอัปโหลดอาจชนกับรอบที่กำลังจบพอดี) · ใช้บัญชี worker ของ Supabase จาก `config.json` หรือ `.env.local`

### เมื่อ `vercel` ขึ้น `stopped`
JST เปลี่ยนรูปแบบ response — ให้ dev ตรวจ log ของ function บน Vercel และแก้โค้ดก่อน แล้วหัวหน้ากด **เริ่มใหม่** บนการ์ด Worker (ไม่มีโปรเซสให้รีสตาร์ท)
```

(ค) ในหัวข้อ `## ความปลอดภัย` เพิ่มบรรทัดท้ายรายการ:

```markdown
- worker บน Vercel: รหัสผ่าน JST / บัญชี worker อยู่ใน env ของ Vercel (Production, Sensitive) และ route รับเฉพาะคำขอที่มี `Authorization: Bearer <CRON_SECRET>` (ต้องตรงกับ Vault `dsales_cron_secret`)
```

- [ ] **Step 2: `CLAUDE.md`**

(ก) ในรายการ "Migration เพิ่มเติมที่มีอยู่แล้ว" เพิ่มบรรทัดก่อนบรรทัด `20261123140000_dsales_reset_trial_data.sql`:

```markdown
  - `20261126120000_dsales_worker_tick.sql` — **worker ตัวหลักบน Vercel + `office-1` เป็นตัวสำรอง** (spec `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`): cron `dsales-outreach-tick` ทุกนาที → `dsales_tick_kick()` → `POST /api/cron/outreach-tick` (`app/api/cron/outreach-tick/route.ts` → `tools/jst-worker/tick.mjs`) · ทำงานเมื่อ `worker_tick_enabled = true` และ Vault มี `dsales_app_url` + `dsales_cron_secret` · สถานะข้ามรอบ: ตาราง `dsales_worker_state` (ภายใน ไม่มี grant) + cookie JST ใน Vault `dsales_jst_session_<worker>` ผ่าน `dsales_worker_state_begin` / `_state_end` / `_session_put` (worker เท่านั้น) · `worker_primary`: ตัวที่ไม่ใช่ตัวหลักได้ `claim` = null และ `link_targets` ว่าง ตราบที่ตัวหลัก `running` + heartbeat < 3 นาที (`dsales_worker_is_standby`) · หัวหน้า: `dsales_worker_primary_set` / `dsales_worker_state_reset` (ปุ่มบนการ์ด Worker); test `28_worker_primary_standby.sql`, `29_worker_state.sql`, `30_tick_kick.sql`
```

(ข) ในกฎความปลอดภัย เพิ่ม `dsales_worker_state` ในวงเล็บรายการตารางภายในที่ห้าม grant (ต่อจาก `dsales_worker_status`)

(ค) ในหัวข้อ Environment Variables เพิ่มในบล็อก `.env.local`:

```bash
# ฝั่ง server เท่านั้น (Vercel Production) — worker บน Vercel: route /api/cron/outreach-tick
JST_USER=
JST_PASSWORD=
DSALES_WORKER_EMAIL=
DSALES_WORKER_PASSWORD=
CRON_SECRET=                                       # ต้องตรงกับ Vault secret dsales_cron_secret
```

(ง) ในหัวข้อ "เอกสาร" เพิ่ม:

```markdown
- Worker บน Vercel + ตัวสำรอง: spec `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`, แผน `docs/superpowers/plans/2026-11-26-cloud-tick-worker.md`
```

- [ ] **Step 3: `docs/DATABASE.md`**

(ก) ต่อจากแถว `dsales_worker_status` ในตารางของตาราง เพิ่ม:

```markdown
| `dsales_worker_state` | worker_id (PK), runtime (jsonb: state, sessionOk, lastError, failures, pausedUntil, loginTimes, pendingReports, linkTargets, linkPausedUntil, lastJstOkAt), lease_until, updated_at | ภายใน — สถานะข้ามรอบของ worker บน Vercel ผ่าน `dsales_worker_state_begin` / `_state_end` เท่านั้น · cookie ของ JST อยู่ใน Vault `dsales_jst_session_<worker_id>` |
```

(ข) ต่อจากแถว `dsales_worker_claim … / dsales_worker_heartbeat …` ในตาราง RPC เพิ่ม:

```markdown
| `dsales_worker_state_begin(p_worker, p_lease_seconds)` / `dsales_worker_state_end(p_worker, p_runtime, p_cookies)` / `dsales_worker_session_put(p_worker, p_cookies)` | **worker เท่านั้น**: เริ่มรอบ (คืน `null` ถ้ารอบอื่นถือ lease อยู่ ไม่เช่นนั้น `{runtime, cookies}` และถือ lease 90 วินาที) / จบรอบ (บันทึก runtime, เขียน cookie ลง Vault เมื่อไม่เป็น null, ปล่อย lease) / อัปโหลด session ที่คนล็อกอินเอง (ปลด `needs_login`) · `invalid_worker`, `invalid_runtime`, `invalid_cookies` | `tools/jst-worker/tick.mjs`, `import-session.mjs --upload` |
| `dsales_worker_primary_set(p_worker)` / `dsales_worker_state_reset(p_worker)` | หัวหน้า: ตั้งตัวหลัก (`''` = ไม่มีตัวหลัก, `unknown_worker` ถ้าไม่เคยส่ง heartbeat) / ล้าง runtime + lease ของ worker บน Vercel ที่ `stopped` · คืนผลแบบ `dsales_worker_status_get` (`forbidden`) | หน้าตั้งค่า (การ์ด Worker) |
| `dsales_worker_is_standby`, `dsales_worker_session_write`, `dsales_tick_kick` | ภายใน (ไม่มี grant): กติกาตัวสำรองที่ `dsales_worker_claim` / `dsales_worker_link_targets` ใช้ · เขียน Vault · ตัวปลุกของ cron `dsales-outreach-tick` | — |
```

(ค) ในย่อหน้า settings ของ worker เพิ่มท้ายบรรทัด: `` · `worker_primary` (`"office-1"` → เปลี่ยนเป็น `"vercel"` ตอนขึ้นระบบ), `worker_tick_enabled` (`false`) ``

(ง) ในแถวของ `dsales_worker_status_get()` เพิ่มข้อความ: `` · ผลมี `primary` และ `is_primary` ต่อ worker ``

- [ ] **Step 4: `.env.example`**

เพิ่มท้ายไฟล์:

```bash
# ฝั่ง server เท่านั้น (ห้าม NEXT_PUBLIC_) — worker บน Vercel (/api/cron/outreach-tick) ตั้งใน Vercel Production
JST_USER=
JST_PASSWORD=
DSALES_WORKER_EMAIL=
DSALES_WORKER_PASSWORD=
# ต้องตรงกับ Vault secret dsales_cron_secret ใน Supabase
CRON_SECRET=
```

- [ ] **Step 5: Commit**

```bash
git add tools/jst-worker/README.md CLAUDE.md docs/DATABASE.md .env.example
git commit -m "docs: Vercel tick worker, primary/standby and session upload

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: ตรวจทั้งระบบ แล้วขึ้นระบบ (ต้องมีผู้ใช้)

- [ ] **Step 1: ตรวจครบชุดก่อนขอ push**

Run: `cd tools/jst-worker && node --test` → `# fail 0`
Run (รากโปรเจกต์): `npm run typecheck && npm run lint && npm test && npm run build && npm run check:fixtures` → ผ่านทั้งหมด
ใช้ superpowers:requesting-code-review กับ diff `main...feat/cloud-tick-worker` แล้วแก้ข้อที่พบ

- [ ] **Step 2: ถามผู้ใช้ → push → เปิด PR เข้า `main`**

PR body ระบุ: migration ลง production แล้ว (ค่าเริ่มไม่เปลี่ยนพฤติกรรม), สิ่งที่ผู้ใช้ต้องตั้งก่อนเปิดใช้ (Step 3), ขั้นตอนขึ้นระบบ (Step 4–8)

- [ ] **Step 3: ผู้ใช้ตั้งค่าเอง (ผู้ช่วยกรอกรหัสผ่านแทนไม่ได้)**

- Vercel → Environment Variables → **Production**, Sensitive: `JST_USER`, `JST_PASSWORD`, `DSALES_WORKER_EMAIL`, `DSALES_WORKER_PASSWORD`, `CRON_SECRET` (สุ่มยาว ≥ 32 ตัวอักษร)
- Supabase → Vault: secret `dsales_app_url` = `https://directsales-web.vercel.app` และ `dsales_cron_secret` = ค่าเดียวกับ `CRON_SECRET`

ตรวจชื่อ env ด้วย Vercel MCP `filter_project_envs` (ดูเฉพาะชื่อ ไม่ถอดรหัส) และตรวจ Vault ด้วย `select name from vault.secrets where name in ('dsales_app_url','dsales_cron_secret');` → ได้ 2 แถว

- [ ] **Step 4: ถามผู้ใช้ → merge → production deploy ผ่าน**

ยิงตรวจจากเครื่อง: `curl -s -X POST -w ' http=%{http_code}\n' https://directsales-web.vercel.app/api/cron/outreach-tick` → `{"error":"unauthorized"} http=401`

- [ ] **Step 5: เปิดตัวปลุกโดยให้ `vercel` เป็นตัวสำรองก่อน**

ถามผู้ใช้ แล้วรัน: `update dsales.dsales_settings set value = 'true'::jsonb, updated_at = now() where key = 'worker_tick_enabled';`
รอ 2 นาที แล้วตรวจ:

```sql
select worker_id, state, jst_session_ok, now() - heartbeat_at as age, left(coalesce(last_error, ''), 120) as last_error
from dsales.dsales_worker_status where worker_id in ('vercel', 'office-1');
-- net._http_response holds the responses of every system that posts through pg_net (others post every minute): keep this route's only
select status_code, left(content, 200) as body, created from net._http_response
 where content like '%cookiesSaved%' or content like '%"skipped"%' or content ~ 'unauthorized|not_configured|tick_failed'
 order by created desc limit 3;
```
Expected: `vercel` = `running`, `jst_session_ok = true`, age < 1 นาที · response ล่าสุด `status_code = 200` และ body มี `"ok":true` กับ `"region":"icn1"` · `office-1` ยัง `running`
ถ้า `vercel` เป็น `needs_login` (JST ขอ captcha จาก IP ของโซล) → ทำตาม README หัวข้อ "เมื่อ `vercel` ขึ้น `needs_login`"

- [ ] **Step 6: สลับตัวหลักเป็น `vercel` และส่งชุดทดสอบ**

ผู้ใช้กด "ตั้งเป็นตัวหลัก" ที่แถว `vercel` บนการ์ด Worker (โหมดทดสอบต้องเปิดอยู่) แล้วส่งชุดทดสอบ 2–3 รายการจากหน้าเว็บ ตรวจ:

```sql
select status, locked_by, attempts, sent_at, left(coalesce(error, ''), 80) as error
from dsales.dsales_outreach_queue order by enqueued_at desc limit 3;
```
Expected: `sent` ทุกแถว ห่างกันราว 1 นาที และข้อความ `[ทดสอบ → …]` ถึงห้องทดสอบ — นี่คือการทดสอบ `SendMsg` จาก Vercel ครั้งแรก
(`locked_by` ถูกล้างเมื่อส่งเสร็จ จึงยืนยันผู้ส่งจาก log ของ function บน Vercel: บรรทัด `"msg":"job sent"` ที่มี `"worker":"vercel"`)

- [ ] **Step 7: ทดสอบการรับช่วง**

ถามผู้ใช้ แล้วปิดตัวปลุก: `update dsales.dsales_settings set value = 'false'::jsonb, updated_at = now() where key = 'worker_tick_enabled';`
ส่งชุดทดสอบ 1 รายการ → ภายใน 3–4 นาที `office-1` ต้องส่ง (ดู `logs/worker-YYYY-MM-DD.jsonl` บนเครื่องออฟฟิศ หรือสถานะ `sent` ในคิว) → เปิดตัวปลุกกลับเป็น `true` แล้วยืนยันว่า `vercel` กลับมา online

- [ ] **Step 8: งานบนเครื่องออฟฟิศและเก็บกวาด (ผู้ใช้)**

- `office-1` (ที่ `C:\Users\Dev\Directsale\directsales-web`): `git fetch`, `git switch main`, `git pull`, ตั้ง `"pollSeconds": 30` ใน `tools\jst-worker\config.json`, รีสตาร์ท worker
- ลบของ spike: branch `spike/jst-from-vercel` (GitHub + worktree `directsales-web-spike`), Preview 2 ตัว, env `JST_USER` / `JST_PASSWORD` ของ Preview บน Vercel, ไฟล์ session ในโฟลเดอร์ชั่วคราว, config `directsale-spike` ใน `.claude/launch.json`
- อัปเดต memory ของโปรเจกต์: ตัวหลัก = `vercel`, ตัวสำรอง = `office-1`

**ย้อนกลับได้ทุกขั้น:** กด "ตั้งเป็นตัวหลัก" ที่ `office-1` หรือปิด `worker_tick_enabled` — มีผลรอบถัดไป ไม่ต้อง deploy
