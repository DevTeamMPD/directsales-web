# Outreach D1 — ขั้น 0 (เก็บข้อมูลจริงจาก JST) + ฐานข้อมูลคิวส่งข้อความ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เก็บรูปแบบคำขอล็อกอินและ `/iim/SendMsg` ของ JST จากการใช้งานจริงบนเครื่อง dev แล้วสร้างฐานข้อมูลคิวส่งข้อความเป็นชุด (template, batch, queue, RPC ของเว็บและของ worker) ใน schema `dsales`

**Architecture:** ขั้น 0 ใช้สคริปต์ Playwright ใน `tools/jst-worker-spike` (มีอยู่แล้ว + เพิ่ม `capture-login.mjs`) ผู้ใช้ล็อกอิน/ยืนยันการส่งเอง ผลลัพธ์ (ลบข้อมูลลับแล้ว) เป็น input ของแผน D2 (worker) ฐานข้อมูลทำเป็น migration ต่อจากของเดิม แต่ละ RPC มี SQL test แบบ `begin … rollback` ตามขั้นตอนในโปรเจกต์ (test ล้มก่อน → dry-run → apply → regression ทีละไฟล์)

**Tech Stack:** Node.js 24 + Playwright 1.65 (เฉพาะขั้น 0), Postgres/Supabase (plpgsql, security definer RPC), Supabase MCP `execute_sql` / `apply_migration`

**Spec:** `docs/superpowers/specs/2026-11-20-jst-outreach-worker-design.md` · แผนถัดไป: D2 worker (เขียนหลังขั้น 0), D3 หน้าเว็บ

---

## กติกาที่ต้องทำตามตลอดแผน (จาก `CLAUDE.md`)

- Supabase project `nroyacasuchqniaiuirk` เป็น **production ที่ใช้ร่วมกับระบบอื่น** · แก้ได้เฉพาะ schema `dsales` · ตาราง `public.*` อ่านอย่างเดียว · role `authenticated` มี statement_timeout 8 วินาที
- Migration ทุกตัว: (1) เขียน test ให้ล้มก่อน (รันด้วย `execute_sql`) (2) dry-run: `begin;` + SQL ของ migration + body ของ test + `rollback;` ใน `execute_sql` ครั้งเดียว ต้องเห็น `OK …` (3) **ถามผู้ใช้ก่อน apply ครั้งแรกของแผนนี้** (ยืนยันครั้งเดียวสำหรับชุด migration ของ D1 ตามที่ผู้ใช้ตกลงไว้ใน spec ข้อ 9) แล้ว `apply_migration` ด้วยชื่อไฟล์ไม่มีเลขนำหน้า (4) รัน test ทั้งหมดใหม่ทีละไฟล์ (`execute_sql` ครั้งละไฟล์) **ห้ามรัน 04/04b** (หนัก ใช้ตอน refresh เท่านั้น)
- ไฟล์ migration ใช้ LF (`.gitattributes` มี `*.sql text eol=lf` แล้ว)
- commit: ข้อความอังกฤษ conventional + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · ห้าม push จนผู้ใช้อนุญาต

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `tools/jst-worker-spike/capture-login.mjs` (ใหม่) | เปิดหน้าล็อกอิน JST ด้วยโปรไฟล์ชั่วคราว บันทึกคำขอ `/Org/Account/*` (ลบค่า password/captcha) |
| `tools/jst-worker-spike/lib.mjs` (แก้) | เพิ่ม `redactForm()` |
| `tools/jst-worker-spike/lib.test.mjs` (แก้) | test ของ `redactForm()` |
| `docs/superpowers/plans/2026-11-20-jst-worker-spike.md` (แก้) | กรอกผลขั้น 0 |
| `supabase/migrations/20261120100000_dsales_outreach_tables.sql` | ตาราง templates/batches/queue/worker_status, คอลัมน์ `interactions.outreach_id`, settings, helper `dsales_setting`, `dsales_worker_uid` |
| `supabase/migrations/20261120100100_dsales_templates.sql` | `dsales_templates_list`, `dsales_template_save` |
| `supabase/migrations/20261120100200_dsales_outreach_room.sql` | `dsales_outreach_room(phone, brand)` เลือกห้องแชต |
| `supabase/migrations/20261120100300_dsales_outreach_enqueue.sql` | `dsales_outreach_plan` (ภายใน), `dsales_outreach_preview`, `dsales_enqueue_outreach` |
| `supabase/migrations/20261120100400_dsales_outreach_batches.sql` | `dsales_outreach_batches_mine`, `dsales_outreach_batch`, `dsales_outreach_cancel` |
| `supabase/migrations/20261120100500_dsales_worker_rpcs.sql` | `dsales_worker_claim`, `dsales_worker_report`, `dsales_worker_heartbeat` |
| `supabase/migrations/20261120100600_dsales_worker_settings.sql` | `dsales_worker_status_get`, `dsales_worker_settings_set`, `dsales_worker_find_rooms` (contract §1) |
| `supabase/tests/08_outreach_tables.sql` … `08g_worker_settings.sql` | test ต่อ migration |
| `docs/DATABASE.md`, `CLAUDE.md` (แก้) | รายการตาราง/RPC/migration ใหม่ |

ค่าคงที่ที่ใช้ใน test: user_id ของ `dev@mpdgroup.co` = `431a49cf-1382-426a-bb61-4eec43a9279b` (admin คนเดียวใน `dsales_members` ณ 2026-11-20) — test หา admin จากตารางเอง ไม่ hard-code

---

## ขั้น 0 — เก็บข้อมูลจริงจาก JST (ต้องมีผู้ใช้อยู่ด้วย)

### Task 0.1: `redactForm` + `capture-login.mjs`

**Files:**
- Modify: `tools/jst-worker-spike/lib.mjs`
- Modify: `tools/jst-worker-spike/lib.test.mjs`
- Create: `tools/jst-worker-spike/capture-login.mjs`

- [ ] **Step 1: เขียน test ที่ล้ม** — ต่อท้าย `tools/jst-worker-spike/lib.test.mjs` และเพิ่ม `redactForm` ใน import บรรทัดบน (`import { allowedChat, isLoginUrl, loadConfig, parseArgs, redactExchange, redactForm } from './lib.mjs';`)

```js
test('redactForm hides password/captcha values but keeps field names and value lengths', () => {
  const json = redactForm('{"account":"dev@x.co","password":"QUJD","captchaCode":"","remember":true}');
  assert.deepEqual(json, { account: 'dev@x.co', password: '<redacted len=4>', captchaCode: '<redacted len=0>', remember: true });
  const form = redactForm('account=dev%40x.co&password=secret&code=1234');
  assert.deepEqual(form, { account: 'dev@x.co', password: '<redacted len=6>', code: '<redacted len=4>' });
  assert.equal(redactForm(null), null);
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `node --test tools/jst-worker-spike/lib.test.mjs`
Expected: FAIL — `redactForm` is not exported (SyntaxError: does not provide an export named 'redactForm')

- [ ] **Step 3: เขียน `redactForm`** — เพิ่มใน `tools/jst-worker-spike/lib.mjs` ใต้ `redactExchange`

```js
/** ฟอร์มล็อกอิน (JSON หรือ urlencoded) → object ที่ซ่อนค่าลับ เหลือชื่อ field และความยาวค่า */
const SECRET_FIELD = /pass|pwd|captcha|code|token|secret/i;
export function redactForm(body) {
  if (body == null || body === '') return null;
  let obj;
  try {
    obj = JSON.parse(body);
  } catch {
    obj = Object.fromEntries(new URLSearchParams(String(body)));
  }
  if (obj === null || typeof obj !== 'object') return String(body).slice(0, 200);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SECRET_FIELD.test(k) ? `<redacted len=${String(v ?? '').length}>` : v]),
  );
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test tools/jst-worker-spike/lib.test.mjs`
Expected: `ℹ pass 5` `ℹ fail 0`

- [ ] **Step 5: เขียน `capture-login.mjs`**

```js
// ขั้น 0: บันทึกคำขอล็อกอินจริงของ JST (ผู้ใช้ล็อกอินเอง) → logs/login-capture.json
// ใช้โปรไฟล์ชั่วคราว (ไม่ทับ .profile) · เก็บ path / method / ชื่อ field / ความยาวค่า / status / response (ตัดค่าลับ) · ไม่เก็บ header/cookie
// node capture-login.mjs
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, LOG_DIR, redactForm } from './lib.mjs';

const config = loadConfig();
const { chromium } = await import('playwright');
const dir = mkdtempSync(join(tmpdir(), 'jst-capture-'));
const context = await chromium.launchPersistentContext(dir, { headless: false, channel: config.channel, viewport: { width: 1300, height: 850 } });
const page = context.pages()[0] || (await context.newPage());
const seen = [];
page.on('response', async (res) => {
  const req = res.request();
  const url = new URL(res.url());
  if (!/^\/org\/account\//i.test(url.pathname) || req.method() !== 'POST') return;
  let response = null;
  try {
    const t = await res.text();
    response = redactForm(t) ?? t.slice(0, 500);
  } catch {
    /* ปิดไปแล้ว */
  }
  seen.push({
    path: url.pathname, method: req.method(), status: res.status(),
    contentType: req.headers()['content-type'] || null, request: redactForm(req.postData()), response,
    setsCookieNames: (await res.headerValue('set-cookie').catch(() => null) || '').split(/,(?=[^;]+=)/).map((c) => c.split('=')[0].trim()).filter(Boolean),
  });
});
await page.goto('https://asia-web.jsterp.com/Org/Account/Login/index?ReturnUrl=' + encodeURIComponent(config.jstUrl));
console.log('ล็อกอิน JST ด้วย User Dev ในหน้าต่างที่เปิดขึ้น (รอได้ 10 นาที)…');
try {
  await page.waitForURL(/\/iim\/index/i, { timeout: 10 * 60 * 1000 });
} catch {
  console.error('ไม่ได้ไปหน้าแชตภายใน 10 นาที — บันทึกเท่าที่เห็น');
}
mkdirSync(LOG_DIR, { recursive: true });
const file = join(LOG_DIR, 'login-capture.json');
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), requests: seen }, null, 2));
console.log(`บันทึก ${seen.length} คำขอไว้ที่ ${file} — ตรวจว่าไม่มีรหัสผ่านก่อนแชร์`);
await context.close();
rmSync(dir, { recursive: true, force: true });
```

- [ ] **Step 6: commit**

```bash
git add tools/jst-worker-spike/lib.mjs tools/jst-worker-spike/lib.test.mjs tools/jst-worker-spike/capture-login.mjs
git commit -m "feat(worker-spike): capture the real JST login request with secrets redacted"
```

### Task 0.2: เก็บคำขอล็อกอินจริง (ผู้ใช้ล็อกอินเอง)

- [ ] **Step 1:** แจ้งผู้ใช้ว่าจะเปิดหน้าต่าง Chrome ให้ล็อกอิน JST ด้วย User Dev (Claude ไม่พิมพ์รหัสผ่าน) แล้วรัน (background)

Run: `cd tools/jst-worker-spike && node capture-login.mjs`
Expected: `บันทึก N คำขอไว้ที่ …\logs\login-capture.json` (N ≥ 2: `IsNeedCaptcha` และคำขอล็อกอิน)

- [ ] **Step 2:** อ่าน `logs/login-capture.json` ยืนยันว่าทุก field ลับเป็น `<redacted len=…>` แล้วจดลงแผน spike (Task 0.4): path ของคำขอล็อกอิน, content-type, ชื่อ field ทั้งหมด, ความยาว password ที่ส่ง (คาดว่า 344 = base64 ของ 256 ไบต์), รูปแบบ response สำเร็จ, ชื่อ cookie ที่ได้

### Task 0.3: ส่งข้อความทดสอบไปห้องของผู้ใช้ + วัดความหน่วง

- [ ] **Step 1:** ขอชื่อห้องแชตของผู้ใช้ใน JST แล้วหา ms_id

Run: `cd tools/jst-worker-spike && node open-chat.mjs --chat "<ชื่อแชตของผู้ใช้>"`
Expected: `"found": true` พร้อม `room.ms` — ยืนยันกับผู้ใช้ว่าใช่ห้องของเขา (ชื่อ/ช่องทาง/เพจ) แล้วใส่ใน `config.json` → `testChats: [{ "name": "<ชื่อ>", "msId": <ms>, "note": "<provider>" }]`

- [ ] **Step 2: dry-run**

Run: `node send-test.mjs --ms <ms> --text "ทดสอบระบบ Direct Sale (dry-run)"`
Expected: `"outcome": "dry-run: เปิดห้องและพิมพ์ได้ …"`, exit 0

- [ ] **Step 3: ถามผู้ใช้ก่อนส่งจริง** ("จะส่งข้อความ 'ทดสอบระบบ Direct Sale <เวลา>' ไปห้อง <ชื่อ> ในนาม User Dev ยืนยันไหม") แล้วรันพร้อมจดเวลาเริ่ม

Run: `node send-test.mjs --ms <ms> --text "ทดสอบระบบ Direct Sale 14:05" --confirm`
Expected: `sendStatus: 200`, `messages[0].status` เป็นสถานะส่งสำเร็จ, มีไฟล์ `logs/send-*.json` ที่ `exchanges[0].path = "/iim/SendMsg"`

- [ ] **Step 4:** ถามผู้ใช้ว่าข้อความถึงมือถือเมื่อไร → ความหน่วง = เวลาถึงมือถือ − เวลาเริ่มรัน และจาก log: เวลาที่ JST ตอบ SendMsg

### Task 0.4: สรุปผลขั้น 0 + ตัดสินไปต่อ

**Files:** Modify: `docs/superpowers/plans/2026-11-20-jst-worker-spike.md`

- [ ] **Step 1:** เพิ่มหัวข้อ `## ผลขั้น 0 (outreach D1)` ในไฟล์นั้น: ตารางคำขอล็อกอิน (path, content-type, fields, response), payload `SendMsg` ของข้อความตัวอักษร (ทุก field ที่ส่งจริง), response ของ SendMsg, สถานะใน getMsgs, ความหน่วง (JST ตอบกี่ ms / ถึงมือถือกี่วินาที)
- [ ] **Step 2:** ตัดสิน: ถ้า SendMsg ต้องใช้ค่าที่สร้างจากหน้าเว็บเท่านั้น (token ฝังหน้า, signature) หรือส่งไม่ถึงมือถือ → **หยุด** แจ้งผู้ใช้และกลับไปทบทวน spec · ถ้าผ่าน → ทำ Task 1 ต่อ และใช้ผลนี้เขียนแผน D2
- [ ] **Step 3:** คัดลอก `logs/login-capture.json` และ `logs/send-*.json` (ลบค่าลับแล้ว ตรวจด้วยตาอีกครั้ง) ไปที่ `tools/jst-worker-spike/fixtures/` สำหรับ D2 แล้ว commit

```bash
git add docs/superpowers/plans/2026-11-20-jst-worker-spike.md tools/jst-worker-spike/fixtures
git commit -m "docs(worker-spike): record the real JST login and SendMsg formats"
```

---

## ฐานข้อมูล

> **อัปเดต 2026-11-20 (apply แล้ว):** SQL ในแต่ละ Task ด้านล่างตรงกับไฟล์ที่ apply จริง รวมการเปลี่ยนตาม `2026-11-20-outreach-contract.md` §1 — คิวมี `test_redirect` / `target_ms_id`, โหมดทดสอบ = ส่งไปห้องทดสอบแทน (Task 6), เพิ่ม `dsales_worker_find_rooms` (Task 7)

### Task 1: ตารางคิว + settings + helper

**Files:**
- Create: `supabase/tests/08_outreach_tables.sql`
- Create: `supabase/migrations/20261120100000_dsales_outreach_tables.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08_outreach_tables.sql`

```sql
begin;
-- outreach tables exist, are closed to the API roles, settings seeded, helpers behave
do $$
declare v_admin uuid; v_other uuid; v_ok boolean;
begin
  assert to_regclass('dsales.dsales_templates') is not null, 'dsales_templates missing';
  assert to_regclass('dsales.dsales_outreach_batches') is not null, 'dsales_outreach_batches missing';
  assert to_regclass('dsales.dsales_outreach_queue') is not null, 'dsales_outreach_queue missing';
  assert to_regclass('dsales.dsales_worker_status') is not null, 'dsales_worker_status missing';
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_interactions' and column_name = 'outreach_id'),
         'dsales_interactions.outreach_id missing';
  -- test mode redirect columns (contract §1)
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_outreach_queue'
                 and column_name = 'test_redirect' and data_type = 'boolean' and is_nullable = 'NO'), 'queue.test_redirect missing';
  assert exists (select 1 from information_schema.columns where table_schema = 'dsales' and table_name = 'dsales_outreach_queue'
                 and column_name = 'target_ms_id' and data_type = 'bigint'), 'queue.target_ms_id missing';
  assert not has_table_privilege('authenticated', 'dsales.dsales_outreach_queue', 'select'), 'queue must not be readable by authenticated';
  assert not has_table_privilege('anon', 'dsales.dsales_templates', 'select'), 'templates must not be readable by anon';
  assert (select value from dsales.dsales_settings where key = 'outreach_test_mode') = 'true'::jsonb, 'test mode must default to true';
  assert (select (value #>> '{}')::int from dsales.dsales_settings where key = 'worker_interval_seconds') = 60, 'interval default 60';
  assert (select (value #>> '{}')::int from dsales.dsales_settings where key = 'outreach_max_batch') = 50, 'max batch default 50';
  assert (select jsonb_array_length(value -> 'bebeplay') from dsales.dsales_settings where key = 'page_brand_map') >= 5, 'page_brand_map bebeplay';
  assert not has_function_privilege('authenticated', 'dsales.dsales_setting(text)', 'execute'), 'dsales_setting is internal';

  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  assert exists (select 1 from dsales.dsales_settings, jsonb_array_elements_text(value) u where key = 'worker_user_ids' and u = v_admin::text),
         'worker_user_ids must contain the dev admin';

  -- dsales_worker_uid: admin listed -> ok; another user -> not_worker
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_uid() = v_admin, 'worker_uid returns the caller';
  select id into v_other from auth.users where id <> v_admin limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_uid(); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'non-listed user must get not_worker';
  raise notice 'OK 08_outreach_tables';
end $$;
rollback;
```

- [ ] **Step 2: รันให้ล้ม** — `execute_sql` กับเนื้อหาไฟล์ทั้งไฟล์ · Expected: ERROR `dsales_templates missing`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100000_dsales_outreach_tables.sql`

```sql
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
```

- [ ] **Step 4: dry-run** — `execute_sql`: `begin;` + migration ทั้งไฟล์ + ส่วน `do $$ … $$;` ของ test + `rollback;` · Expected: `NOTICE: OK 08_outreach_tables`
- [ ] **Step 5: ถามผู้ใช้ (ครั้งเดียวสำหรับ migration ทั้งชุดของ D1)** แล้ว `apply_migration` name `dsales_outreach_tables` · รัน test 08 อีกครั้ง → `OK 08_outreach_tables`
- [ ] **Step 6: commit**

```bash
git add supabase/migrations/20261120100000_dsales_outreach_tables.sql supabase/tests/08_outreach_tables.sql
git commit -m "feat(db): outreach queue tables, settings and worker gate"
```

### Task 2: Template RPC

**Files:**
- Create: `supabase/tests/08b_templates.sql`
- Create: `supabase/migrations/20261120100100_dsales_templates.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08b_templates.sql`

```sql
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
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_template_save(…) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100100_dsales_templates.sql`

```sql
-- Message templates per brand (admin manages, everyone reads active ones)

create or replace function dsales.dsales_template_json(t dsales.dsales_templates) returns jsonb
language sql immutable set search_path = dsales, public as $$
  select jsonb_build_object('id', t.id, 'brand', t.brand, 'name', t.name, 'body', t.body, 'active', t.active, 'updated_at', t.updated_at)
$$;
revoke all on function dsales.dsales_template_json(dsales.dsales_templates) from public, anon, authenticated;

create or replace function dsales.dsales_templates_list(p_brand text default null) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_admin boolean;
begin
  perform dsales.dsales_uid();
  v_admin := dsales.dsales_is_admin();
  return coalesce((
    select jsonb_agg(dsales.dsales_template_json(t) order by t.brand, t.name)
    from dsales.dsales_templates t
    where (p_brand is null or t.brand = p_brand) and (t.active or v_admin)
  ), '[]'::jsonb);
end $$;

create or replace function dsales.dsales_template_save(p_id uuid, p_brand text, p_name text, p_body text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); t dsales.dsales_templates;
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_brand, '') not in ('bebeplay', 'hosttail') or nullif(btrim(coalesce(p_name, '')), '') is null
     or nullif(btrim(coalesce(p_body, '')), '') is null or length(btrim(p_name)) > 100 or length(btrim(p_body)) > 2000 then
    raise exception 'invalid_template';
  end if;
  if p_id is null then
    insert into dsales.dsales_templates (brand, name, body, active, created_by)
    values (p_brand, btrim(p_name), btrim(p_body), coalesce(p_active, true), me) returning * into t;
  else
    update dsales.dsales_templates set brand = p_brand, name = btrim(p_name), body = btrim(p_body),
           active = coalesce(p_active, active), updated_at = now()
    where id = p_id returning * into t;
    if not found then raise exception 'not_found'; end if;
  end if;
  return dsales.dsales_template_json(t);
end $$;

revoke all on function dsales.dsales_templates_list(text), dsales.dsales_template_save(uuid, text, text, text, boolean) from public, anon;
grant execute on function dsales.dsales_templates_list(text), dsales.dsales_template_save(uuid, text, text, text, boolean) to authenticated;
```

- [ ] **Step 4: dry-run** (migration + test body ใน `begin … rollback`) · Expected: `OK 08b_templates`
- [ ] **Step 5:** `apply_migration` name `dsales_templates` · รัน 08b → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100100_dsales_templates.sql supabase/tests/08b_templates.sql && git commit -m "feat(db): message templates per brand"`

### Task 3: เลือกห้องแชต `dsales_outreach_room`

**Files:**
- Create: `supabase/tests/08c_outreach_room.sql`
- Create: `supabase/migrations/20261120100200_dsales_outreach_room.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08c_outreach_room.sql` (หาข้อมูลจริงจากตาราง ไม่ hard-code เบอร์)

```sql
begin;
do $$
declare v_phone text; r record; v_fb text; v_none text;
begin
  -- a phone that has a Bebeplay LINE room
  select l.phone_normalized into v_phone
  from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
  where s.page = 'Bebeplayofficial' and lower(s.channel) = 'line' limit 1;
  assert v_phone is not null, 'need a phone with a Bebeplayofficial LINE room';
  select * into r from dsales.dsales_outreach_room(v_phone, 'bebeplay');
  assert r.skip is null and r.ms_id is not null and lower(r.provider) = 'line', format('expected a LINE room, got %s', to_jsonb(r));

  -- same phone, other brand -> no room of that brand (unless it also has one)
  select * into r from dsales.dsales_outreach_room(v_phone, 'hosttail');
  assert r.skip is null or r.skip in ('no_chat_room', 'window_closed'), 'hosttail lookup returns a room or a reason';

  -- a phone whose only bebeplay room is Facebook with no customer message in the last 24 h -> window_closed
  select l.phone_normalized into v_fb
  from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
  where s.page = 'Bebeplay' and lower(s.channel) = 'facebook'
    and not exists (select 1 from dsales.dsales_chat_links l2 join public.iim_sessions s2 on s2.ms_id = l2.ms_id
                    where l2.phone_normalized = l.phone_normalized and s2.ms_id <> s.ms_id)
    and not exists (select 1 from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer' and m.time > now() - interval '24 hours')
  limit 1;
  if v_fb is not null then
    select * into r from dsales.dsales_outreach_room(v_fb, 'bebeplay');
    assert r.skip = 'window_closed' and r.ms_id is null, format('expected window_closed, got %s', to_jsonb(r));
  end if;

  -- a phone with no chat link -> no_chat_room
  select b.phone_normalized into v_none from dsales.dsales_customer_base b
  where not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized) limit 1;
  select * into r from dsales.dsales_outreach_room(v_none, 'bebeplay');
  assert r.skip = 'no_chat_room', 'no link -> no_chat_room';
  assert not has_function_privilege('authenticated', 'dsales.dsales_outreach_room(text,text)', 'execute'), 'room picker is internal';
  raise notice 'OK 08c_outreach_room';
end $$;
rollback;
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_outreach_room(text, unknown) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100200_dsales_outreach_room.sql`

```sql
-- Pick the JST chat room to message for a phone and brand (spec §4.4):
-- linked rooms on that brand's pages; LINE first, then marketplace chats, then Facebook/Instagram;
-- newest activity first. Facebook/Instagram rooms whose last customer message is older than 24 h are
-- closed for shop-initiated messages and are skipped. Returns one row: a room, or skip = reason.

create or replace function dsales.dsales_outreach_room(p_phone text, p_brand text)
returns table (ms_id bigint, page text, provider text, chat_name text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_any boolean;
begin
  return query
  with pages as (
    select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand) as page
  ), rooms as (
    select s.ms_id, s.page, s.channel as provider, s.customer as chat_name, s.last_time,
           case lower(s.channel) when 'line' then 1 when 'shopee' then 2 when 'lazada' then 2 when 'tiktok' then 2 else 3 end as rnk,
           lower(s.channel) in ('facebook', 'instagram')
             and coalesce((select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer'),
                          '-infinity'::timestamptz) < now() - interval '24 hours' as closed
    from dsales.dsales_chat_links l
    join public.iim_sessions s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone and s.page in (select p.page from pages p)
  )
  select r.ms_id, r.page, r.provider, r.chat_name, null::text
  from rooms r where not r.closed order by r.rnk, r.last_time desc nulls last limit 1;
  if found then return; end if;

  select exists (
    select 1 from dsales.dsales_chat_links l join public.iim_sessions s on s.ms_id = l.ms_id
    where l.phone_normalized = p_phone
      and s.page in (select jsonb_array_elements_text(dsales.dsales_setting('page_brand_map') -> p_brand))
  ) into v_any;
  return query select null::bigint, null::text, null::text, null::text, case when v_any then 'window_closed' else 'no_chat_room' end;
end $$;
revoke all on function dsales.dsales_outreach_room(text, text) from public, anon, authenticated;
```

- [ ] **Step 4: dry-run** · Expected: `OK 08c_outreach_room`
- [ ] **Step 5:** `apply_migration` name `dsales_outreach_room` · รัน 08c → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100200_dsales_outreach_room.sql supabase/tests/08c_outreach_room.sql && git commit -m "feat(db): pick the JST chat room for outreach"`

### Task 4: Preview + Enqueue

**Files:**
- Create: `supabase/tests/08d_outreach_enqueue.sql`
- Create: `supabase/migrations/20261120100300_dsales_outreach_enqueue.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08d_outreach_enqueue.sql`

```sql
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
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_outreach_preview(text[], uuid) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100300_dsales_outreach_enqueue.sql`

```sql
-- Preview and enqueue a batch (spec §4.3). dsales_outreach_plan is the shared, read-only step:
-- dedupe phones, check ownership, pick the room, render the template. Enqueue then claims pool
-- customers (same rules as dsales_claim_customer) and writes the batch + queue rows.
-- "ห้ามโทร" (no_call) leads the rep already owns stay sendable (the flag only blocks phone calls);
-- an unowned no_call lead cannot be claimed, so enqueue skips it with reason no_call.

create or replace function dsales.dsales_outreach_plan(p_phones text[], p_template uuid, p_me uuid)
returns table (phone text, name text, lead_id uuid, ms_id bigint, page text, provider text, chat_name text, message text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare
  t dsales.dsales_templates; v_max int := coalesce((dsales.dsales_setting('outreach_max_batch') #>> '{}')::int, 50);
  ph text; v_skip text; v_msg text; v_product text;
  v_in_base boolean; v_base_name text; v_base_owner uuid;
  v_lead uuid; v_lead_owner uuid; v_lead_name text;
  v_ms bigint; v_page text; v_prov text; v_chat text;
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  if (select count(distinct btrim(x)) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null) > v_max then
    raise exception 'batch_too_large';
  end if;

  for ph in select distinct btrim(x) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null loop
    v_skip := null; v_msg := null; v_ms := null; v_page := null; v_prov := null; v_chat := null;
    v_base_name := null; v_base_owner := null; v_lead := null; v_lead_owner := null; v_lead_name := null;
    select c.name, c.owner_id into v_base_name, v_base_owner from dsales.dsales_customer_base c where c.phone_normalized = ph;
    v_in_base := found;
    select x.id, x.owner_id, x.name into v_lead, v_lead_owner, v_lead_name from dsales.dsales_leads x where x.phone_normalized = ph;
    if not v_in_base and v_lead is null then v_skip := 'customer_not_found';
    elsif v_base_owner is not null and v_base_owner <> p_me then v_skip := 'taken';
    elsif v_lead_owner is not null and v_lead_owner <> p_me then v_skip := 'taken';
    elsif exists (select 1 from dsales.dsales_outreach_queue q where q.phone_normalized = ph and q.status in ('queued', 'sending')) then
      v_skip := 'already_queued';
    else
      select r.ms_id, r.page, r.provider, r.chat_name, r.skip into v_ms, v_page, v_prov, v_chat, v_skip
      from dsales.dsales_outreach_room(ph, t.brand) r;
    end if;
    if v_skip is null then
      v_product := '';
      if position('{สินค้าล่าสุด}' in t.body) > 0 then
        select coalesce(p.product_name, '') into v_product from dsales.dsales_customer_purchases(ph) p order by p.txn_date desc nulls last limit 1;
      end if;
      v_msg := replace(replace(replace(t.body,
                 '{ชื่อ}', coalesce(nullif(btrim(coalesce(v_lead_name, v_base_name)), ''), '')),
                 '{ร้าน}', coalesce(v_page, '')),
                 '{สินค้าล่าสุด}', coalesce(v_product, ''));
    end if;
    return query select ph, coalesce(v_lead_name, v_base_name), v_lead, v_ms, v_page, v_prov, v_chat, v_msg, v_skip;
  end loop;
end $$;
revoke all on function dsales.dsales_outreach_plan(text[], uuid, uuid) from public, anon, authenticated;

create or replace function dsales.dsales_outreach_preview(p_phones text[], p_template uuid) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('phone', x.phone, 'name', x.name, 'ms_id', x.ms_id, 'page', x.page, 'provider', x.provider,
                                        'chat_name', x.chat_name, 'message', x.message, 'skip', x.skip) order by x.skip nulls first, x.phone)
    from dsales.dsales_outreach_plan(p_phones, p_template, me) x
  ), '[]'::jsonb);
end $$;

create or replace function dsales.dsales_enqueue_outreach(p_phones text[], p_template uuid) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_uid(); t dsales.dsales_templates; v_batch uuid; x record; v_lead uuid; v_owner uuid;
  v_skipped jsonb := '[]'::jsonb; v_queued int := 0;
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (me, t.id, t.brand) returning id into v_batch;

  for x in select * from dsales.dsales_outreach_plan(p_phones, p_template, me) loop
    if x.skip is not null then
      v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', x.skip);
      continue;
    end if;
    v_lead := x.lead_id;
    v_owner := null;
    if v_lead is not null then
      select l.owner_id into v_owner from dsales.dsales_leads l where l.id = v_lead;
    end if;
    if v_lead is null or v_owner is null then
      begin
        v_lead := (dsales.dsales_claim_customer(x.phone, t.brand) ->> 'id')::uuid;
      exception when others then
        v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', case when sqlerrm in ('taken', 'no_call', 'customer_not_found') then sqlerrm else 'claim_failed' end);
        continue;
      end;
    end if;
    insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, page, provider, chat_name, message_text, requested_by)
    values (v_batch, v_lead, x.phone, x.ms_id, x.page, x.provider, x.chat_name, x.message, me);
    v_queued := v_queued + 1;
  end loop;

  update dsales.dsales_outreach_batches set total = v_queued, skipped = v_skipped where id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'queued', v_queued, 'skipped', v_skipped);
end $$;

revoke all on function dsales.dsales_outreach_preview(text[], uuid), dsales.dsales_enqueue_outreach(text[], uuid) from public, anon;
grant execute on function dsales.dsales_outreach_preview(text[], uuid), dsales.dsales_enqueue_outreach(text[], uuid) to authenticated;
```

- [ ] **Step 4: dry-run** · Expected: `NOTICE: enqueue 21 phones took … s` (< 5) และ `OK 08d_outreach_enqueue` — ถ้าช้าเกิน 5 วินาที ให้หยุดดูว่าส่วนไหนช้า (`explain analyze` ของ `dsales_outreach_room` ต่อเบอร์ / `dsales_customer_purchases`) ก่อนไปต่อ
- [ ] **Step 5:** `apply_migration` name `dsales_outreach_enqueue` · รัน 08d → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100300_dsales_outreach_enqueue.sql supabase/tests/08d_outreach_enqueue.sql && git commit -m "feat(db): preview and enqueue outreach batches"`

### Task 5: ดูความคืบหน้า + ยกเลิก

**Files:**
- Create: `supabase/tests/08e_outreach_batches.sql`
- Create: `supabase/migrations/20261120100400_dsales_outreach_batches.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08e_outreach_batches.sql`

```sql
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
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_outreach_batches_mine(integer, integer) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100400_dsales_outreach_batches.sql`

```sql
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
```

- [ ] **Step 4: dry-run** · Expected: `OK 08e_outreach_batches`
- [ ] **Step 5:** `apply_migration` name `dsales_outreach_batches` · รัน 08e → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100400_dsales_outreach_batches.sql supabase/tests/08e_outreach_batches.sql && git commit -m "feat(db): outreach batch progress and cancel"`

### Task 6: RPC ของ worker (claim / report / heartbeat)

**Files:**
- Create: `supabase/tests/08f_worker_rpcs.sql`
- Create: `supabase/migrations/20261120100500_dsales_worker_rpcs.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08f_worker_rpcs.sql`

```sql
begin;
-- worker claim / report / heartbeat: gate, single flight, pacing, rotation between reps,
-- test mode = redirect to the first test room (contract §1), requeue cap, stale release
do $$
declare
  v_admin uuid; v_s1 uuid; v_s2 uuid; v_tpl uuid; v_b1 uuid; v_b2 uuid; v_lead1 uuid; v_lead2 uuid;
  c jsonb; c2 jsonb; v_ok boolean; v_id uuid; v_m1 uuid;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_s1 from auth.users where id not in (select user_id from dsales.dsales_members) order by id limit 1;
  select id into v_s2 from auth.users where id not in (select user_id from dsales.dsales_members) and id <> v_s1 order by id limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_s1, 'sales', 'S1', true), (v_s2, 'sales', 'S2', true);
  -- clean slate for the worker gate and pacing (rolled back)
  update dsales.dsales_outreach_queue set status = 'cancelled' where status in ('queued', 'sending');
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 day' where sent_at > now() - interval '1 day';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '0'::jsonb where key = 'line_monthly_cap';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_settings set value = '[999, 998]'::jsonb where key = 'outreach_test_ms_ids';

  insert into dsales.dsales_templates (brand, name, body, created_by) values ('bebeplay', 't', 'x', v_admin) returning id into v_tpl;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ1', '0899999991', '0899999991', v_s1, v_s1, now(), v_s1) returning id into v_lead1;
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ2', '0899999992', '0899999992', v_s1, v_s1, now(), v_s1) returning id into v_lead2;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_s1, v_tpl, 'bebeplay') returning id into v_b1;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (v_s2, v_tpl, 'bebeplay') returning id into v_b2;
  insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, provider, chat_name, message_text, requested_by, enqueued_at) values
    (v_b1, v_lead1, '0899999991', 111, 'Line', null, 'm1', v_s1, now() - interval '3 min'),
    (v_b1, v_lead2, '0899999992', 222, 'Line', 'คุณสอง', 'm2', v_s1, now() - interval '2 min'),
    (v_b2, null,    '0899999993', 333, 'Shopee', 'ลูกค้า ก', 'm3', v_s2, now() - interval '1 min'),
    (v_b2, null,    '0899999994', 444, 'Line', '', 'm4', v_s2, now());

  set local role authenticated;
  -- sales cannot use worker RPCs
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin perform dsales.dsales_worker_claim('w1'); exception when others then v_ok := sqlerrm = 'not_worker'; end;
  assert v_ok, 'sales -> not_worker';

  -- test mode with test rooms: oldest item, redirected to the first test room with a prefix
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');
  assert (select array_agg(k order by k) from jsonb_object_keys(c) k)
         = array['attempts', 'chat_name', 'enqueued_at', 'id', 'message', 'ms_id', 'page', 'provider', 'requested_by', 'target_ms_id', 'test_redirect'],
         format('claim keys must match the contract, got %s', c);
  assert (c ->> 'ms_id')::bigint = 111 and (c ->> 'attempts')::int = 1, format('oldest first, got %s', c);
  assert (c ->> 'target_ms_id')::bigint = 999 and (c ->> 'test_redirect')::boolean, format('redirected to the first test room, got %s', c);
  assert c ->> 'message' = '[ทดสอบ → 0899999991] m1', format('prefix uses the phone when chat_name is empty, got %s', c ->> 'message');
  v_m1 := (c ->> 'id')::uuid;
  -- single flight: nothing else is handed out while one is sending
  assert dsales.dsales_worker_claim('w1') is null, 'one item at a time';
  perform dsales.dsales_worker_report(v_m1, 'sent', null, 'jst-1');
  -- fairness: s1 just got a send, so s2's item comes next even though s1's m2 is older
  c2 := dsales.dsales_worker_claim('w1');
  assert (c2 ->> 'ms_id')::bigint = 333, format('rotate between reps, got %s', c2);
  assert c2 ->> 'message' = '[ทดสอบ → ลูกค้า ก] m3', format('prefix uses chat_name, got %s', c2 ->> 'message');
  perform dsales.dsales_worker_report((c2 ->> 'id')::uuid, 'requeue', 'jst 500', null);
  c2 := dsales.dsales_worker_claim('w1');
  assert (c2 ->> 'ms_id')::bigint = 333 and (c2 ->> 'attempts')::int = 2, format('requeued item is claimable again, got %s', c2);
  v_id := (c2 ->> 'id')::uuid;
  perform dsales.dsales_worker_report(v_id, 'failed', 'window_closed', null);
  v_ok := false;
  begin perform dsales.dsales_worker_report(v_id, 'sent', null, null); exception when others then v_ok := sqlerrm = 'invalid_state'; end;
  assert v_ok, 'report on a non-sending item -> invalid_state';

  -- pacing: interval 60 s and a send just happened -> nothing
  reset role;
  update dsales.dsales_settings set value = '60'::jsonb where key = 'worker_interval_seconds';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_claim('w1') is null, 'respects worker_interval_seconds';
  perform dsales.dsales_worker_heartbeat('w1', 'running', true, null);
  reset role;

  assert (select status from dsales.dsales_outreach_queue where id = v_m1) = 'sent', 'm1 sent';
  assert (select jst_msg_id from dsales.dsales_outreach_queue where id = v_m1) = 'jst-1', 'jst msg id stored';
  assert (select test_redirect and target_ms_id = 999 from dsales.dsales_outreach_queue where id = v_m1), 'queue row records the redirect';
  assert not exists (select 1 from dsales.dsales_interactions i where i.outreach_id = v_m1), 'test-redirect send writes no interaction';
  assert (select status from dsales.dsales_leads where id = v_lead1) = 'new', 'test-redirect send leaves the lead status';
  assert (select status from dsales.dsales_outreach_queue where id = v_id) = 'failed', 'failed recorded';
  assert (select state from dsales.dsales_worker_status where worker_id = 'w1') = 'running', 'heartbeat upserted';

  -- test mode without test rooms -> nothing is sent
  update dsales.dsales_settings set value = '0'::jsonb where key = 'worker_interval_seconds';
  update dsales.dsales_settings set value = '[]'::jsonb where key = 'outreach_test_ms_ids';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert dsales.dsales_worker_claim('w1') is null, 'test mode with no test rooms -> null';

  -- normal mode: real room, message unchanged, sent writes an interaction for the requester
  reset role;
  update dsales.dsales_settings set value = 'false'::jsonb where key = 'outreach_test_mode';
  update dsales.dsales_outreach_queue set sent_at = now() - interval '1 hour' where id = v_m1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');   -- s2 has no send yet -> m4 before s1's m2
  assert (c ->> 'ms_id')::bigint = 444 and (c ->> 'target_ms_id')::bigint = 444 and not (c ->> 'test_redirect')::boolean,
         format('normal mode targets the real room, got %s', c);
  assert c ->> 'message' = 'm4', 'normal mode message has no prefix';
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'sent', null, 'jst-4');
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'ms_id')::bigint = 222 and (c ->> 'target_ms_id')::bigint = 222 and c ->> 'message' = 'm2', format('m2 next, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'sent', null, 'jst-2');
  reset role;
  assert exists (select 1 from dsales.dsales_interactions i where i.outreach_id = (c ->> 'id')::uuid
                 and i.type = 'chat' and i.rep_id = v_s1 and i.lead_id = v_lead2), 'sent writes a chat interaction for the requester';
  assert (select status from dsales.dsales_leads where id = v_lead2) = 'following', 'new lead moves to following';
  assert (select not test_redirect from dsales.dsales_outreach_queue where id = (c ->> 'id')::uuid), 'normal send is not a redirect';

  -- stale sending (> 10 min) is released on the next claim; attempts cap at 3 -> failed
  update dsales.dsales_outreach_queue set status = 'sending', locked_at = now() - interval '11 min', attempts = 1 where ms_id = 333;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'ms_id')::bigint = 333 and (c ->> 'attempts')::int = 2, format('stale item released and reclaimed, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'e', null);
  c := dsales.dsales_worker_claim('w1');
  assert (c ->> 'attempts')::int = 3, format('third attempt, got %s', c);
  perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'requeue', 'e', null);
  v_ok := false;
  begin perform dsales.dsales_worker_report((c ->> 'id')::uuid, 'bogus', null, null); exception when others then v_ok := sqlerrm = 'invalid_status'; end;
  assert v_ok, 'unknown report status -> invalid_status';
  reset role;
  assert (select status from dsales.dsales_outreach_queue where ms_id = 333) = 'failed', 'third failure -> failed';
  raise notice 'OK 08f_worker_rpcs';
end $$;
rollback;
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_worker_claim(unknown) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100500_dsales_worker_rpcs.sql`

```sql
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
```

- [ ] **Step 4: dry-run** · Expected: `OK 08f_worker_rpcs`
- [ ] **Step 5:** `apply_migration` name `dsales_worker_rpcs` · รัน 08f → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100500_dsales_worker_rpcs.sql supabase/tests/08f_worker_rpcs.sql && git commit -m "feat(db): worker claim, report and heartbeat RPCs"`

### Task 7: สถานะ worker + ตั้งค่า (หน้าตั้งค่า)

**Files:**
- Create: `supabase/tests/08g_worker_settings.sql`
- Create: `supabase/migrations/20261120100600_dsales_worker_settings.sql`

- [ ] **Step 1: เขียน test ที่ล้ม** — `supabase/tests/08g_worker_settings.sql`

```sql
begin;
do $$
declare v_admin uuid; v_sales uuid; j jsonb; v_ok boolean; v_q text; v_t0 timestamptz; v_secs numeric;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  insert into dsales.dsales_worker_status (worker_id, state, jst_session_ok, heartbeat_at) values ('w-test', 'running', true, now() - interval '5 min');
  -- a real customer name prefix (2 chars) from the JST rooms
  select left(btrim(s.customer), 2) into v_q from public.iim_sessions s
  where length(btrim(coalesce(s.customer, ''))) >= 2 order by s.last_time desc nulls last limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  j := dsales.dsales_worker_settings_set(30, 500, true, array[130427]::bigint[]);
  assert (j -> 'settings' ->> 'interval_seconds')::int = 30 and (j -> 'settings' ->> 'line_monthly_cap')::int = 500, 'settings saved';
  assert (j -> 'settings' -> 'test_ms_ids' ->> 0)::bigint = 130427, 'test ids saved';
  j := dsales.dsales_worker_status_get();
  assert exists (select 1 from jsonb_array_elements(j -> 'workers') w where w ->> 'worker_id' = 'w-test' and (w ->> 'online')::boolean = false),
         'heartbeat older than 3 min -> offline';
  assert (j -> 'queue' ? 'queued') and (j -> 'queue' ? 'sent_last_hour'), 'queue counts present';
  v_ok := false;
  begin perform dsales.dsales_worker_settings_set(1, 0, true, null); exception when others then v_ok := sqlerrm = 'invalid_setting'; end;
  assert v_ok, 'interval below 5 s rejected';

  -- find rooms (admin): at most 20 rooms with the contract keys, fast
  v_t0 := clock_timestamp();
  j := dsales.dsales_worker_find_rooms(v_q);
  v_secs := extract(epoch from clock_timestamp() - v_t0);
  perform set_config('test.find_rooms_secs', round(v_secs, 3)::text, true);
  assert v_secs < 2, format('find_rooms too slow: %s s', v_secs);
  assert jsonb_typeof(j) = 'array' and jsonb_array_length(j) between 1 and 20, format('find_rooms returns 1..20 rooms, got %s', jsonb_array_length(j));
  assert (select array_agg(k order by k) from jsonb_object_keys(j -> 0) k) = array['channel', 'customer', 'last_time', 'ms_id', 'page'],
         format('find_rooms keys, got %s', j -> 0);
  assert dsales.dsales_worker_find_rooms(left(v_q, 1)) = '[]'::jsonb, '1-char query -> []';
  assert dsales.dsales_worker_find_rooms(null) = '[]'::jsonb, 'null query -> []';

  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  j := dsales.dsales_worker_status_get();
  assert j ? 'workers', 'sales can read worker status';
  v_ok := false;
  begin perform dsales.dsales_worker_settings_set(60, 0, false, null); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot change worker settings';
  v_ok := false;
  begin perform dsales.dsales_worker_find_rooms(v_q); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'sales cannot search rooms';
  reset role;
  raise notice 'OK 08g_worker_settings';
end $$;
rollback;
```

- [ ] **Step 2: รันให้ล้ม** · Expected: ERROR `function dsales.dsales_worker_settings_set(integer, integer, boolean, bigint[]) does not exist`

- [ ] **Step 3: เขียน migration** — `supabase/migrations/20261120100600_dsales_worker_settings.sql`

```sql
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
```

- [ ] **Step 4: dry-run** · Expected: `OK 08g_worker_settings`
- [ ] **Step 5:** `apply_migration` name `dsales_worker_settings` · รัน 08g → OK
- [ ] **Step 6: commit** — `git add supabase/migrations/20261120100600_dsales_worker_settings.sql supabase/tests/08g_worker_settings.sql && git commit -m "feat(db): worker status and settings RPCs"`

### Task 8: Regression + เอกสาร

**Files:**
- Modify: `docs/DATABASE.md` (หัวข้อ 3 ตาราง Direct Sale, หัวข้อ 4 ตาราง RPC)
- Modify: `CLAUDE.md` (รายการ migration และ test)

- [ ] **Step 1: regression ทีละไฟล์** — `execute_sql` ครั้งละไฟล์: `01_schema_move.sql`, `02_chat_messages_v.sql`, `03_chat_links.sql`, `05_base_rpcs.sql`, `06_members_only.sql`, `06b_access_hardening.sql`, `07_member_tags_fast.sql`, `08_outreach_tables.sql`, `08b_templates.sql`, `08c_outreach_room.sql`, `08d_outreach_enqueue.sql`, `08e_outreach_batches.sql`, `08f_worker_rpcs.sql`, `08g_worker_settings.sql` (ข้าม 04/04b) · Expected: ทุกไฟล์ `OK …`
- [ ] **Step 2: advisors** — `get_advisors` type `security` · Expected: ไม่มีคำเตือนใหม่เกี่ยวกับตาราง/ฟังก์ชัน `dsales_outreach_*`, `dsales_templates`, `dsales_worker_*` (ตารางเปิด RLS แต่ไม่มี policy = ตั้งใจ ปิดการเข้าถึงตรง)
- [ ] **Step 3: `docs/DATABASE.md`** — ในหัวข้อ 3 เพิ่มย่อหน้า `### คิวส่งข้อความ (outreach)` อธิบาย 4 ตารางใหม่ + `interactions.outreach_id` + settings ใหม่ (ค่าเริ่ม, โหมดทดสอบเปิดอยู่) และในตาราง RPC หัวข้อ 4 เพิ่มแถว: `dsales_templates_list`/`dsales_template_save` (หน้าตั้งค่า), `dsales_outreach_preview`/`dsales_enqueue_outreach` (popup ส่งข้อความ), `dsales_outreach_batches_mine`/`dsales_outreach_batch`/`dsales_outreach_cancel` (หน้า /outreach), `dsales_worker_status_get`/`dsales_worker_settings_set` (หน้าตั้งค่า), `dsales_worker_claim`/`dsales_worker_report`/`dsales_worker_heartbeat` (worker เท่านั้น — `worker_user_ids`), `dsales_outreach_room`/`dsales_outreach_plan`/`dsales_setting` (ภายใน ไม่มี grant)
- [ ] **Step 4: `CLAUDE.md`** — ในรายการ "Migration เพิ่มเติมที่มีอยู่แล้ว" เพิ่มบรรทัด `20261120100000`–`20261120100600` (หนึ่งบรรทัดสรุป: คิวส่งข้อความเป็นชุดผ่าน JST worker + RPC ของเว็บ/worker; test `08_*`–`08g_*`; RPC ของ worker ตรวจ `worker_user_ids`; โหมดทดสอบเปิดเป็นค่าเริ่ม)
- [ ] **Step 5: commit**

```bash
git add docs/DATABASE.md CLAUDE.md
git commit -m "docs: outreach queue tables and RPCs"
```

---

## หลังจบแผนนี้
- เขียนแผน **D2 (worker)** จากผลขั้น 0: `tools/jst-worker/` (`jst-client.mjs` ล็อกอิน RSA + getSessions/getMsgs/SendMsg ตาม fixture จริง, `queue-client.mjs`, `worker.mjs`, `import-session.mjs`) + test กับ fixture
- เขียนแผน **D3 (เว็บ)**: การ์ด Template/Worker ในหน้าตั้งค่า, ติ๊กเลือก + popup ส่งข้อความใน /mine /pool, หน้า /outreach
- ไม่ push / deploy จนผู้ใช้อนุญาต
