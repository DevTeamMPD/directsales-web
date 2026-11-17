# Direct Sale เฟส 0–1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายของ Direct Sale ทั้งหมดเข้า schema `dsales`, แก้เวลาแชต JST ที่เพี้ยน 7 ชม., สร้างฐานลูกค้าเก่า (`customer_base`) ที่ผูกเจ้าของตาม tag `Admin_*` และเพิ่มหน้า "ลูกค้าของฉัน" / "ถังกลาง" + หน้าผูก tag ให้หัวหน้า ใช้ได้ทั้งมือถือและคอม

**Architecture:** ทุกอย่างฝั่งข้อมูลอยู่ใน Supabase schema `dsales` (SQL migrations ใน `supabase/migrations/`, ทดสอบด้วยไฟล์ SQL ที่ใช้ `assert` ใน transaction แล้ว `rollback`) ตารางต้นทางของระบบอื่นอ่านอย่างเดียว หน้าเว็บ static เดิม (`app.js`) เปลี่ยนไปเรียก `sb.schema('dsales')` และนำ UI ถังลูกค้าเดิม (`poolPanel`/`poolLoad`) มาใช้ซ้ำด้วยค่า `scope`

**Tech Stack:** PostgreSQL 15 (Supabase) + pg_cron, supabase-js 2.45.4 (UMD), vanilla JS/CSS, Node.js 18+ (`node --test`) สำหรับสคริปต์แปลง migration

**Spec:** `docs/superpowers/specs/2026-11-17-direct-sale-design.md` (เฟส 0 และ 1 ในข้อ 13)

---

## ข้อมูลที่ตรวจแล้วก่อนเขียนแผน (2026-11-17)

- Supabase project id: `nroyacasuchqniaiuirk`
- ตาราง `public.dsales_*` ยังว่าง (leads 0, interactions 0, campaigns 0, members 1) ย้ายได้โดยไม่ต้องย้ายข้อมูล
- ไม่มี function / view / cron นอกกลุ่ม `dsales_*` ที่อ้างถึง `dsales_` → ย้าย schema ไม่กระทบระบบอื่น
- `iim_messages.time` เร็วกว่าจริง 7 ชม. คงที่: ข้อความ 90 วันล่าสุด 456,193 ข้อความ ลบ 7 ชม. แล้วเหลือ 1 ข้อความที่เวลาเลยเวลาดึง (`iim_sessions.fetched_at`)
- มี extension `pg_cron` 1.6.4 แล้ว ไม่มี `pgtap` (จึงใช้ `assert` ของ plpgsql)
- ผู้ใช้เพิ่ม `dsales` ใน Dashboard → Data API → Exposed schemas แล้ว (API ฝั่ง `public` ยังตอบปกติ)
- function `public.dsales_customer_pool` และ `_v2` ไม่มีโค้ดไหนเรียกแล้ว → ลบทิ้งตอนย้าย

## การตัดสินใจในแผนนี้ (ต่างจาก spec เล็กน้อย)

- **คงชื่อ object เดิมไว้** (`dsales.dsales_leads`, `dsales.dsales_claim_customer` …) ไม่ตัด prefix ตาม spec ข้อ 5.1 เพื่อให้แปลง function เดิม 21 ตัวด้วยการแทนข้อความแบบเดียว (`public.dsales_` → `dsales.dsales_`) ได้อย่างปลอดภัย ตัด prefix ค่อยทำทีหลังถ้าต้องการ
- **ยังไม่เพิ่มค่า `source` ใหม่ใน `dsales_leads`** (spec ข้อ 8.2) เพราะเฟสนี้ลีดยังเกิดจากการจอง (`self`) และแคมเปญเท่านั้น ค่อยเพิ่มในแผนเฟส 2
- `owner_id` ใน `customer_base` = เจ้าของตาม tag เท่านั้น เจ้าของจริงที่หน้าเว็บใช้ = `coalesce(dsales_leads.owner_id, customer_base.owner_id)` (ลีดที่หัวหน้ามอบหมาย/เซลล์จองชนะ tag)

## วิธีรัน migration และ test

- **Apply migration:** ใช้ Supabase MCP `apply_migration` ด้วย `project_id = "nroyacasuchqniaiuirk"`, `name` = ชื่อไฟล์ไม่รวม `.sql` และเลขเวลา (เช่น `dsales_schema_move`), `query` = เนื้อหาไฟล์ทั้งไฟล์ (รันใน transaction เดียว) หรือวางทั้งไฟล์ใน Supabase Dashboard → SQL Editor
- **Run SQL test:** ใช้ Supabase MCP `execute_sql` กับเนื้อหาไฟล์ test ทั้งไฟล์ (หรือ SQL Editor) ผ่าน = ไม่มี error · ไม่ผ่าน = `ERROR: P0004: <ข้อความ assert>` ทุกไฟล์ test ขึ้นต้นด้วย `begin;` และจบด้วย `rollback;` จึงไม่ทิ้งข้อมูลไว้
- **Run JS test:** `node --test tools/db/rewrite-dsales.test.mjs`

## Deploy (สำคัญ)

Task 3 (ย้าย schema) ทำให้หน้าเว็บที่ deploy อยู่ (`directsales-web.vercel.app`) เรียก RPC ใน `public` ไม่ได้ทันที ต้อง **apply Task 3 แล้ว deploy หน้าเว็บจาก Task 4 ต่อกันทันที** (ตาราง Direct Sale ยังว่าง ผลกระทบคือหน้าเว็บใช้ไม่ได้ช่วงสั้น ๆ เท่านั้น)

## Branch

ทำงานบน branch ใหม่จาก `claude/serene-meitner-cprt82`:

```bash
git switch -c feat/dsales-phase-0-1
```

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `tools/db/dump-dsales-functions.sql` | query ดึงนิยาม function `public.dsales_*` ทั้งหมดเป็น SQL ข้อความเดียว |
| `tools/db/rewrite-dsales.mjs` | แปลงไฟล์ baseline → migration ย้าย schema |
| `tools/db/rewrite-dsales.test.mjs` | test ของสคริปต์แปลง |
| `supabase/migrations/20261117090000_baseline_public_dsales_functions.sql` | snapshot function เดิม (อ้างอิงเท่านั้น ห้ามรัน) |
| `supabase/migrations/20261117090100_dsales_schema_move.sql` | สร้าง schema + ย้ายตาราง/function (สร้างโดยสคริปต์) |
| `supabase/migrations/20261117090200_dsales_settings_chat_view.sql` | ตาราง `dsales_settings` + view `dsales_chat_messages_v` |
| `supabase/migrations/20261117090300_dsales_customer_chats_tz.sql` | ให้ `dsales_customer_chats` ใช้เวลาที่แก้แล้ว |
| `supabase/migrations/20261117090400_dsales_tags_chat_links.sql` | `dsales_members.jst_tags`, ตาราง `dsales_chat_links`, function seed |
| `supabase/migrations/20261117090500_dsales_customer_base.sql` | ตาราง + function refresh `dsales_customer_base` |
| `supabase/migrations/20261117090600_dsales_base_rpcs.sql` | RPC หน้า "ของฉัน/ถังกลาง", RPC ผูก tag, `claim_customer` เคารพเจ้าของตาม tag |
| `supabase/migrations/20261117090700_dsales_cron.sql` | งาน pg_cron ทุกชั่วโมง |
| `supabase/tests/01_schema_move.sql` … `05_base_rpcs.sql` | SQL test |
| `app.js` | เรียก schema `dsales`, หน้าใหม่ 2 หน้า, การ์ดผูก tag |
| `index.html` | เมนูใหม่ 2 รายการ |
| `docs/DATABASE.md`, `README.md`, `supabase/live-part1.sql` | อัปเดตเอกสาร |

---

### Task 1: สคริปต์แปลง baseline → migration ย้าย schema

**Files:**
- Create: `tools/db/rewrite-dsales.mjs`
- Test: `tools/db/rewrite-dsales.test.mjs`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`tools/db/rewrite-dsales.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFunctions, rewriteDef, buildMigration } from './rewrite-dsales.mjs';

const BASELINE = `-- baseline
-- FUNCTION: dsales_is_admin()
CREATE OR REPLACE FUNCTION public.dsales_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.dsales_members m where m.user_id = auth.uid());
$function$
;
-- FUNCTION: dsales_customer_pool(p_search text, p_limit integer, p_offset integer)
CREATE OR REPLACE FUNCTION public.dsales_customer_pool(p_search text, p_limit integer, p_offset integer)
 RETURNS void LANGUAGE sql AS $function$ select $function$
;
-- FUNCTION: dsales_lead_json(l dsales_leads)
CREATE OR REPLACE FUNCTION public.dsales_lead_json(l dsales_leads)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public'
AS $function$ select to_jsonb(l) || jsonb_build_object('x', (select count(*) from public.lds_customers)) $function$
;
`;

test('splitFunctions reads name, args and body of each function', () => {
  const fns = splitFunctions(BASELINE);
  assert.deepEqual(fns.map(f => f.name), ['dsales_is_admin', 'dsales_customer_pool', 'dsales_lead_json']);
  assert.equal(fns[1].args, 'p_search text, p_limit integer, p_offset integer');
  assert.equal(fns[2].args, 'l dsales_leads');
  assert.ok(fns[0].def.startsWith('CREATE OR REPLACE FUNCTION public.dsales_is_admin()'));
  assert.ok(fns[0].def.endsWith(';'));
});

test('rewriteDef moves dsales references and search_path but keeps other public tables', () => {
  const out = rewriteDef(splitFunctions(BASELINE)[2].def);
  assert.match(out, /CREATE OR REPLACE FUNCTION dsales\.dsales_lead_json\(l dsales_leads\)/);
  assert.match(out, /SET search_path TO 'dsales', 'public'/);
  assert.match(out, /public\.lds_customers/);
  assert.doesNotMatch(out, /public\.dsales_/);
});

test('buildMigration drops unused pool functions, moves tables and functions, then recreates bodies', () => {
  const sql = buildMigration(BASELINE);
  assert.match(sql, /create schema if not exists dsales;/);
  assert.match(sql, /drop function if exists public\.dsales_customer_pool\(p_search text, p_limit integer, p_offset integer\);/);
  for (const t of ['dsales_members', 'dsales_campaigns', 'dsales_leads', 'dsales_interactions']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} set schema dsales;`));
  }
  assert.match(sql, /set local search_path = dsales, public;/);
  assert.match(sql, /alter function public\.dsales_lead_json\(l dsales_leads\) set schema dsales;/);
  assert.doesNotMatch(sql, /alter function public\.dsales_customer_pool\(/);
  assert.doesNotMatch(sql, /FUNCTION dsales\.dsales_customer_pool\(/);
  assert.ok(sql.indexOf('set local search_path') < sql.indexOf('alter function'));
  assert.ok(sql.lastIndexOf('alter function') < sql.indexOf('CREATE OR REPLACE FUNCTION dsales.dsales_is_admin'));
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `node --test tools/db/rewrite-dsales.test.mjs`
Expected: FAIL — `Cannot find module '.../tools/db/rewrite-dsales.mjs'`

- [ ] **Step 3: เขียนสคริปต์**

`tools/db/rewrite-dsales.mjs`:

```js
#!/usr/bin/env node
// แปลง snapshot function public.dsales_* (จาก tools/db/dump-dsales-functions.sql) เป็น migration ย้ายเข้า schema dsales
// ใช้: node tools/db/rewrite-dsales.mjs <baseline.sql> <out.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SKIP = new Set(['dsales_customer_pool', 'dsales_customer_pool_v2']); // ไม่มีโค้ดเรียกแล้ว
export const TABLES = ['dsales_members', 'dsales_campaigns', 'dsales_leads', 'dsales_interactions'];

export function splitFunctions(sql) {
  const marks = [...sql.matchAll(/^-- FUNCTION: (\w+)\((.*)\)$/gm)];
  return marks.map((m, i) => ({
    name: m[1],
    args: m[2],
    def: sql.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : sql.length).trim(),
  }));
}

export function rewriteDef(def) {
  return def
    .replace(/\bpublic\.(dsales_\w+)/g, 'dsales.$1')
    .replace(/SET search_path TO 'public'/g, "SET search_path TO 'dsales', 'public'");
}

export function buildMigration(baseline) {
  const fns = splitFunctions(baseline);
  const keep = fns.filter(f => !SKIP.has(f.name));
  const drop = fns.filter(f => SKIP.has(f.name));
  return [
    '-- สร้างโดย tools/db/rewrite-dsales.mjs จาก 20261117090000_baseline_public_dsales_functions.sql (ห้ามแก้มือ ให้แก้สคริปต์แล้วสร้างใหม่)',
    'create schema if not exists dsales;',
    'grant usage on schema dsales to anon, authenticated, service_role;',
    '',
    ...drop.map(f => `drop function if exists public.${f.name}(${f.args});`),
    '',
    ...TABLES.map(t => `alter table public.${t} set schema dsales;`),
    '',
    'set local search_path = dsales, public;',
    ...keep.map(f => `alter function public.${f.name}(${f.args}) set schema dsales;`),
    '',
    ...keep.map(f => rewriteDef(f.def) + '\n'),
  ].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output] = process.argv;
  if (!input || !output) { console.error('usage: node tools/db/rewrite-dsales.mjs <baseline.sql> <out.sql>'); process.exit(2); }
  writeFileSync(output, buildMigration(readFileSync(input, 'utf8')));
  console.log(`wrote ${output}`);
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test tools/db/rewrite-dsales.test.mjs`
Expected: `# pass 3` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/db/rewrite-dsales.mjs tools/db/rewrite-dsales.test.mjs
git commit -m "feat(db): add script to rewrite public dsales functions into dsales schema"
```

---

### Task 2: Snapshot function เดิม (baseline)

**Files:**
- Create: `tools/db/dump-dsales-functions.sql`
- Create: `supabase/migrations/20261117090000_baseline_public_dsales_functions.sql`

- [ ] **Step 1: เขียน query ดึง function**

`tools/db/dump-dsales-functions.sql`:

```sql
-- ดึงนิยาม function public.dsales_* ทั้งหมดเป็นข้อความเดียว (คอลัมน์ sql) เรียงตามชื่อ
select string_agg(
         '-- FUNCTION: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\n'
         || pg_get_functiondef(p.oid) || ';',
         E'\n' order by p.proname, pg_get_function_identity_arguments(p.oid)) as sql
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'dsales\_%';
```

- [ ] **Step 2: รัน query และบันทึกผล**

รัน `tools/db/dump-dsales-functions.sql` ด้วย `execute_sql` แล้วเขียนค่าในคอลัมน์ `sql` (ตัวอักษรตรงตามผล ไม่ต้อง escape เพิ่ม) ลงไฟล์ `supabase/migrations/20261117090000_baseline_public_dsales_functions.sql` โดยใส่หัวไฟล์ 2 บรรทัดนี้ไว้ก่อน:

```sql
-- SNAPSHOT ของ function public.dsales_* ณ 2026-11-17 ก่อนย้ายเข้า schema dsales
-- อ้างอิงเท่านั้น: function เหล่านี้มีอยู่ใน DB แล้ว ห้ามรันไฟล์นี้
```

- [ ] **Step 3: ตรวจไฟล์**

Run: `grep -c "^-- FUNCTION: " supabase/migrations/20261117090000_baseline_public_dsales_functions.sql`
Expected: `23`

Run: `grep -o "^-- FUNCTION: [a-z_0-9]*" supabase/migrations/20261117090000_baseline_public_dsales_functions.sql | sort | head -3`
Expected:
```
-- FUNCTION: dsales_assign_lead
-- FUNCTION: dsales_claim_customer
-- FUNCTION: dsales_claim_lead
```

- [ ] **Step 4: Commit**

```bash
git add tools/db/dump-dsales-functions.sql supabase/migrations/20261117090000_baseline_public_dsales_functions.sql
git commit -m "chore(db): snapshot public dsales functions before schema move"
```

---

### Task 3: Migration ย้ายเข้า schema `dsales`

**Files:**
- Create: `supabase/migrations/20261117090100_dsales_schema_move.sql` (สร้างด้วยสคริปต์)
- Test: `supabase/tests/01_schema_move.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/01_schema_move.sql`:

```sql
begin;
do $$
declare v_user uuid; v_me record;
begin
  assert to_regclass('dsales.dsales_leads') is not null, 'dsales.dsales_leads should exist';
  assert to_regclass('dsales.dsales_members') is not null, 'dsales.dsales_members should exist';
  assert to_regclass('dsales.dsales_campaigns') is not null, 'dsales.dsales_campaigns should exist';
  assert to_regclass('dsales.dsales_interactions') is not null, 'dsales.dsales_interactions should exist';
  assert to_regclass('public.dsales_leads') is null, 'public.dsales_leads should be gone';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname like 'dsales\_%'), 'no dsales function left in public';
  assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'dsales' and p.proname like 'dsales\_%') >= 21, 'expected at least the 21 moved functions in dsales';
  assert to_regprocedure('dsales.dsales_customer_pool(text, integer, integer)') is null, 'unused dsales_customer_pool must be dropped';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'dsales' and pg_get_functiondef(p.oid) ~ 'public\.dsales_'),
         'no function body may still reference public.dsales_';

  select user_id into v_user from dsales.dsales_members order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  select * into v_me from dsales.dsales_me();
  assert v_me.user_id = v_user, 'dsales_me() should work after the move';
  perform dsales.dsales_team();
  perform dsales.dsales_my_leads(10, 0);
  perform dsales.dsales_customer_pool_v4(null, 1, 0, null, null, null);
end $$;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

รัน `supabase/tests/01_schema_move.sql`
Expected: `ERROR: P0004: dsales.dsales_leads should exist`

- [ ] **Step 3: สร้าง migration ด้วยสคริปต์**

```bash
node tools/db/rewrite-dsales.mjs supabase/migrations/20261117090000_baseline_public_dsales_functions.sql supabase/migrations/20261117090100_dsales_schema_move.sql
```

Expected: `wrote supabase/migrations/20261117090100_dsales_schema_move.sql`

ตรวจ:

```bash
grep -c "^alter function public\." supabase/migrations/20261117090100_dsales_schema_move.sql
grep -c "public\.dsales_" supabase/migrations/20261117090100_dsales_schema_move.sql
```

Expected: บรรทัดแรก `21` · บรรทัดที่สองต้องเท่ากับ `27` (2 บรรทัด `drop function` + 4 บรรทัด `alter table` + 21 บรรทัด `alter function`; ไม่มี `public.dsales_` เหลือในเนื้อ function)

- [ ] **Step 4: Apply migration**

apply `supabase/migrations/20261117090100_dsales_schema_move.sql` ชื่อ `dsales_schema_move`

- [ ] **Step 5: รัน test ให้ผ่าน**

รัน `supabase/tests/01_schema_move.sql`
Expected: สำเร็จ ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261117090100_dsales_schema_move.sql supabase/tests/01_schema_move.sql
git commit -m "feat(db): move Direct Sale tables and functions into dsales schema"
```

---

### Task 4: หน้าเว็บเรียก schema `dsales`

**Files:**
- Modify: `app.js` (ทุกจุดที่เรียก `sb.rpc(` / `sb.from(` และบรรทัดสร้าง client)

- [ ] **Step 1: เปลี่ยนทุกการเรียกข้อมูลไปที่ `db`**

```bash
sed -i 's/\bsb\.rpc(/db.rpc(/g; s/\bsb\.from(/db.from(/g' app.js
```

ตรวจ:

```bash
grep -c "sb\.rpc(\|sb\.from(" app.js
grep -c "db\.rpc(\|db\.from(" app.js
```

Expected: บรรทัดแรก `0` · บรรทัดที่สอง `13` (นับเป็นบรรทัด: มี 15 จุดเรียก แต่บรรทัด `loadLive` มี 3 จุดในบรรทัดเดียว)

- [ ] **Step 2: สร้าง `db`**

ใน `app.js` แก้

```js
  const sb = wantAuth && window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;
```

เป็น

```js
  const sb = wantAuth && window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;
  const db = sb ? sb.schema('dsales') : null; // ข้อมูล Direct Sale ทั้งหมดอยู่ใน schema dsales (sb ใช้เฉพาะ auth)
```

- [ ] **Step 3: ตรวจ syntax**

Run: `node --check app.js`
Expected: ไม่มี output (ผ่าน)

- [ ] **Step 4: ตรวจในเบราว์เซอร์**

เปิด `index.html` ผ่าน local server (เช่น `npx serve .` แล้วเปิด `http://localhost:3000`) ล็อกอินด้วยบัญชีที่อยู่ใน `dsales_members` แล้วตรวจ:
1. เข้าหน้า Direct Sale ได้ ไม่มี toast error
2. เมนู แคมเปญ → Bebeplay: การ์ด "ลูกค้าทั้งหมด" แสดงจำนวนและตารางลูกค้า (มาจาก `dsales_customer_pool_v4`)
3. DevTools → Network: request ไป `/rest/v1/rpc/...` มี header `Accept-Profile: dsales` / `Content-Profile: dsales` และตอบ 200

- [ ] **Step 5: Commit และ deploy ทันทีหลัง Task 3**

```bash
git add app.js
git commit -m "feat(web): call Direct Sale data through the dsales schema"
```

deploy หน้าเว็บตามช่องทางที่ใช้อยู่ (Vercel project ของ `directsales-web`)

---

### Task 5: ตั้งค่า + view เวลาแชตที่แก้แล้ว

**Files:**
- Create: `supabase/migrations/20261117090200_dsales_settings_chat_view.sql`
- Test: `supabase/tests/02_chat_messages_v.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/02_chat_messages_v.sql`:

```sql
begin;
do $$
declare v_raw timestamptz; v_fixed timestamptz; v_late bigint;
begin
  assert (select value #>> '{}' from dsales.dsales_settings where key = 'dormant_days') = '30', 'dormant_days should default to 30';
  assert (select value #>> '{}' from dsales.dsales_settings where key = 'window_days') = '30', 'window_days should default to 30';

  select m.time, v.time into v_raw, v_fixed
  from public.iim_messages m join dsales.dsales_chat_messages_v v on v.id = m.id
  order by m.id desc limit 1;
  assert v_raw - v_fixed = interval '7 hours', format('expected a 7 hour correction, got %s', v_raw - v_fixed);

  select count(*) into v_late
  from dsales.dsales_chat_messages_v v join public.iim_sessions s on s.ms_id = v.ms_id
  where v.time >= now() - interval '30 days' and v.time > s.fetched_at + interval '5 minutes';
  assert v_late <= 5, format('corrected times should not be after the fetch time, found %s', v_late);
end $$;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Expected: `ERROR: 42P01: relation "dsales.dsales_settings" does not exist`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117090200_dsales_settings_chat_view.sql`:

```sql
-- ค่าตั้งของ Direct Sale + view ข้อความแชต JST ที่แก้เวลาแล้ว (iim_messages.time บันทึกเวลาไทยเป็น UTC จึงเร็วไป 7 ชม.)
create table if not exists dsales.dsales_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into dsales.dsales_settings (key, value) values
  ('dormant_days', '30'),
  ('window_days', '30'),
  ('worker_rate_per_hour', '60'),
  ('chat_tz_offset', '"7 hours"')
on conflict (key) do nothing;

create or replace view dsales.dsales_chat_messages_v as
select m.id, m.ms_id,
       m.time - (select (s.value #>> '{}')::interval from dsales.dsales_settings s where s.key = 'chat_tz_offset') as time,
       m.time as raw_time, m.dir, m.fmt, m.text, m.sender
from public.iim_messages m;

revoke all on dsales.dsales_settings, dsales.dsales_chat_messages_v from anon, authenticated;
```

- [ ] **Step 4: Apply** ชื่อ `dsales_settings_chat_view`

- [ ] **Step 5: รัน test ให้ผ่าน** — Expected: สำเร็จ

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261117090200_dsales_settings_chat_view.sql supabase/tests/02_chat_messages_v.sql
git commit -m "feat(db): add dsales settings and timezone-corrected chat messages view"
```

---

### Task 6: `dsales_customer_chats` ใช้เวลาที่แก้แล้ว

**Files:**
- Create: `supabase/migrations/20261117090300_dsales_customer_chats_tz.sql`
- Modify test: `supabase/tests/02_chat_messages_v.sql`

- [ ] **Step 1: เพิ่ม test** — ใน `supabase/tests/02_chat_messages_v.sql` เพิ่มบรรทัดนี้ก่อน `end $$;`

```sql
  assert pg_get_functiondef('dsales.dsales_customer_chats(text, timestamptz)'::regprocedure) ~ 'dsales_chat_messages_v'
     and pg_get_functiondef('dsales.dsales_customer_chats(text, timestamptz)'::regprocedure) !~ 'public\.iim_messages',
         'dsales_customer_chats must read the corrected view';
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน** — Expected: `ERROR: P0004: dsales_customer_chats must read the corrected view`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117090300_dsales_customer_chats_tz.sql`:

```sql
-- เหมือนเดิมทุกอย่าง ยกเว้นอ่านข้อความจาก dsales_chat_messages_v (เวลาแก้แล้ว) แทน public.iim_messages
-- ทำให้ p_since (เวลาที่จอง) เทียบกับเวลาข้อความได้ถูกต้อง
create or replace function dsales.dsales_customer_chats(p_phone text, p_since timestamp with time zone default null::timestamp with time zone)
 returns table(ms_id bigint, channel text, page text, chat_name text, last_time timestamp with time zone, msg_count integer, admin_msgs bigint, last_admin_time timestamp with time zone, last_admin_sender text, last_customer_time timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'dsales', 'public'
as $function$
  with names as (
    select distinct lower(btrim(n)) as k from (
      select o.buyer_name as n from public.order_tracking o where o.phone = btrim(p_phone)
      union all select ci.display_name from public.customer_identities ci where ci.primary_phone = btrim(p_phone)
      union all select c.jst_chat_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
      union all select c.buyer_name from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = btrim(p_phone)
    ) x
    where nullif(btrim(n), '') is not null and length(btrim(n)) >= 3
      and btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$'
  )
  select s.ms_id, s.channel, s.page, s.customer, s.last_time, s.msg_count,
         (select count(*) from dsales.dsales_chat_messages_v m
           where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')
             and (p_since is null or m.time >= p_since)) as admin_msgs,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error')) as last_admin_time,
         (select m.sender from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'admin' and m.fmt not in ('autoreply', 'system', 'error') order by m.time desc limit 1) as last_admin_sender,
         (select max(m.time) from dsales.dsales_chat_messages_v m where m.ms_id = s.ms_id and m.dir = 'customer') as last_customer_time
  from public.iim_sessions s
  join names on lower(btrim(s.customer)) = names.k
  where nullif(btrim(s.customer), '') is not null
  order by s.last_time desc nulls last
  limit 20;
$function$;
```

- [ ] **Step 4: Apply** ชื่อ `dsales_customer_chats_tz`

- [ ] **Step 5: รัน test ให้ผ่าน** — Expected: สำเร็จ

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261117090300_dsales_customer_chats_tz.sql supabase/tests/02_chat_messages_v.sql
git commit -m "fix(db): compare chat times after timezone correction in dsales_customer_chats"
```

---

### Task 7: tag ของเซลล์ + ตารางผูกห้องแชตกับเบอร์

**Files:**
- Create: `supabase/migrations/20261117090400_dsales_tags_chat_links.sql`
- Test: `supabase/tests/03_chat_links.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/03_chat_links.sql`:

```sql
begin;
do $$
declare v_n integer; v_dup bigint;
begin
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'dsales' and table_name = 'dsales_members' and column_name = 'jst_tags'),
         'dsales_members.jst_tags should exist';

  v_n := dsales.dsales_seed_chat_links_by_name();
  assert v_n > 1000, format('expected more than 1000 sessions linked by unique chat name, got %s', v_n);

  -- ชื่อแชตที่ซ้ำหลายเบอร์ต้องไม่ถูกผูก: 1 ห้องที่ผูกด้วยชื่อแชตต้องมีเบอร์เดียว
  select count(*) into v_dup from (
    select ms_id from dsales.dsales_chat_links where method = 'chat_name' group by ms_id having count(*) > 1) x;
  assert v_dup = 0, format('%s sessions were linked to more than one phone by name', v_dup);

  assert dsales.dsales_seed_chat_links_by_name() = 0, 'seeding twice must not insert duplicates';
end $$;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน** — Expected: `ERROR: P0004: dsales_members.jst_tags should exist`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117090400_dsales_tags_chat_links.sql`:

```sql
-- tag JST ที่ผูกกับเซลล์ (เช่น {Admin_Sao}) และตารางผูกห้องแชต JST กับเบอร์ลูกค้า
alter table dsales.dsales_members add column if not exists jst_tags text[] not null default '{}';

-- ไม่ใส่ foreign key ไป public.iim_sessions เพื่อไม่แตะตารางของระบบอื่น
create table if not exists dsales.dsales_chat_links (
  ms_id bigint not null,
  phone_normalized text not null,
  method text not null check (method in ('order_no', 'buyer_id', 'chat_name', 'manual')),
  evidence text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  linked_at timestamptz not null default now(),
  primary key (ms_id, phone_normalized)
);
create index if not exists dsales_chat_links_phone_idx on dsales.dsales_chat_links (phone_normalized);
revoke all on dsales.dsales_chat_links from anon, authenticated;

-- ผูกด้วยชื่อแชต: ใช้เฉพาะชื่อ (ยาว >= 3 ตัวอักษร) ที่ชี้ไปเบอร์เดียวเท่านั้น ชื่อซ้ำหลายเบอร์ไม่ผูก
create or replace function dsales.dsales_seed_chat_links_by_name() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare v_rows integer;
begin
  with names as (
    select lower(btrim(x.n)) as k, btrim(x.phone) as phone from (
      select o.buyer_name as n, o.phone from public.order_tracking o
      union all select ci.display_name, ci.primary_phone from public.customer_identities ci
      union all select c.jst_chat_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
      union all select c.buyer_name, coalesce(c.phone_normalized, c.phone) from public.lds_customers c
    ) x
    where length(btrim(coalesce(x.n, ''))) >= 3 and dsales.dsales_valid_phone(x.phone)
  ),
  uniq as (select k, min(phone) as phone from names group by k having count(distinct phone) = 1)
  insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence)
  select s.ms_id, u.phone, 'chat_name', s.customer, 'medium'
  from public.iim_sessions s
  join uniq u on u.k = lower(btrim(s.customer))
  where nullif(btrim(s.customer), '') is not null
  on conflict (ms_id, phone_normalized) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function dsales.dsales_seed_chat_links_by_name() from public, anon, authenticated;
```

- [ ] **Step 4: Apply** ชื่อ `dsales_tags_chat_links`

- [ ] **Step 5: รัน test ให้ผ่าน** — Expected: สำเร็จ (ถ้า assert `> 1000` ไม่ผ่าน ให้ดูจำนวนจริงด้วย `select dsales.dsales_seed_chat_links_by_name();` ในอีก transaction ที่ rollback แล้วรายงาน ห้ามลดเกณฑ์เอง)

- [ ] **Step 6: Seed ข้อมูลจริงครั้งแรก**

รันด้วย `execute_sql`: `select dsales.dsales_seed_chat_links_by_name();` แล้วจดจำนวนที่ได้ไว้ในข้อความ commit

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261117090400_dsales_tags_chat_links.sql supabase/tests/03_chat_links.sql
git commit -m "feat(db): add member JST tags and chat-to-phone links seeded by unique chat name"
```

---

### Task 8: ฐานลูกค้าเก่า `dsales_customer_base`

**Files:**
- Create: `supabase/migrations/20261117090500_dsales_customer_base.sql`
- Test: `supabase/tests/04_customer_base.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/04_customer_base.sql`:

```sql
begin;
do $$
declare v_days integer; v_user uuid; v_owned bigint; v_rows integer;
begin
  update dsales.dsales_members set jst_tags = '{}'; -- เริ่มจากไม่มีใครถือ tag (rollback ตอนจบ)
  v_rows := dsales.dsales_refresh_customer_base();
  assert v_rows > 15000, format('customer_base should hold the CRM customers, got %s', v_rows);
  assert v_rows = (select count(*) from dsales.dsales_customer_base), 'refresh must return the row count';

  v_days := (select (value #>> '{}')::integer from dsales.dsales_settings where key = 'dormant_days');
  assert not exists (select 1 from dsales.dsales_customer_base
                     where eligible <> (last_order_date is not null and dormant_days >= v_days)),
         'eligible must mean dormant for at least dormant_days';
  assert not exists (select 1 from dsales.dsales_customer_base where not dsales.dsales_valid_phone(phone_normalized)),
         'only valid phones';
  assert exists (select 1 from dsales.dsales_customer_base where eligible), 'there must be eligible customers';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_id is not null),
         'no owner before any member has tags';

  -- ผูกทุก tag Admin_* ให้สมาชิกคนแรก แล้วลูกค้าที่มี tag ต้องเป็นของคนนั้น
  select user_id into v_user from dsales.dsales_members order by created_at limit 1;
  update dsales.dsales_members m set jst_tags = (
    select array_agg(distinct e.value ->> 'text') from public.iim_sessions s cross join jsonb_array_elements(s.tags) e
    where e.value ->> 'text' ilike 'admin\_%') where m.user_id = v_user;
  perform dsales.dsales_refresh_customer_base();
  select count(*) into v_owned from dsales.dsales_customer_base where owner_tag is not null;
  assert v_owned > 0, 'some customers must get an Admin_ tag through chat links';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_tag is not null and owner_id is distinct from v_user),
         'every tagged customer must belong to the member holding that tag';
  assert not exists (select 1 from dsales.dsales_customer_base where owner_tag is null and owner_id is not null),
         'owner requires a tag';

  -- เปลี่ยนเกณฑ์วันแล้ว eligible ต้องเปลี่ยนตาม
  update dsales.dsales_settings set value = '100000' where key = 'dormant_days';
  perform dsales.dsales_refresh_customer_base();
  assert not exists (select 1 from dsales.dsales_customer_base where eligible), 'dormant_days setting must drive eligible';
end $$;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน** — Expected: `ERROR: 42883: function dsales.dsales_refresh_customer_base() does not exist`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117090500_dsales_customer_base.sql`:

```sql
-- ฐานลูกค้า 1 แถวต่อเบอร์ คำนวณใหม่ทุกชั่วโมง (Task 10) เพื่อให้หน้าเว็บไม่ต้อง join ตารางใหญ่ทุกครั้ง
create table if not exists dsales.dsales_customer_base (
  phone_normalized text primary key,
  identity_id uuid,
  name text not null,
  chat_name text,
  last_order_date date,
  dormant_days integer,
  order_count integer,
  ltv numeric,
  segment text,
  rfm_segment text,
  brands text[] not null default '{}',
  owner_tag text,          -- tag Admin_* ของห้องแชตล่าสุดที่ผูกกับเบอร์นี้
  owner_id uuid,           -- เซลล์ที่ถือ tag นั้น (null = ไม่มีเจ้าของตาม tag)
  eligible boolean not null default false, -- ไม่ได้ซื้อมา >= dormant_days วัน
  refreshed_at timestamptz not null default now()
);
create index if not exists dsales_customer_base_owner_idx on dsales.dsales_customer_base (owner_id) where eligible;
create index if not exists dsales_customer_base_ltv_idx on dsales.dsales_customer_base (ltv desc nulls last);
revoke all on dsales.dsales_customer_base from anon, authenticated;

create or replace function dsales.dsales_refresh_customer_base() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare
  v_days integer := (select (value #>> '{}')::integer from dsales.dsales_settings where key = 'dormant_days');
  v_rows integer;
begin
  delete from dsales.dsales_customer_base; -- delete (ไม่ใช่ truncate) เพื่อให้คนที่อ่านอยู่ยังเห็นข้อมูลชุดเดิมจนกว่าจะ commit
  insert into dsales.dsales_customer_base
    (phone_normalized, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv,
     segment, rfm_segment, brands, owner_tag, owner_id, eligible, refreshed_at)
  with ids as (
    select distinct on (ci.primary_phone) ci.primary_phone as phone, ci.id, ci.display_name, ci.segment, ci.rfm_segment, ci.ltv
    from public.customer_identities ci
    where dsales.dsales_valid_phone(ci.primary_phone)
    order by ci.primary_phone, ci.updated_at desc nulls last
  ),
  ot as (
    select distinct btrim(o.phone) as phone from public.order_tracking o where dsales.dsales_valid_phone(o.phone)
  ),
  st as ( -- บิลจริง: sales_transaction.bill_no = order_tracking.online_order
    select btrim(o.phone) as phone, max(s.txn_date) as last_bill, count(distinct s.bill_no)::integer as bills
    from public.sales_transaction s
    join public.order_tracking o on btrim(o.online_order) = btrim(s.bill_no)
    where s.bill_no is not null and dsales.dsales_valid_phone(o.phone)
    group by 1
  ),
  val as (
    select v.phone, max(v.order_count) as order_count, max(v.ltv_thb) as ltv_thb, max(v.last_order_date) as last_order_date
    from public.lendi_customer_value v group by 1
  ),
  chat as (
    select coalesce(c.phone_normalized, c.phone) as phone, max(c.jst_chat_name) as chat_name
    from public.lds_customers c where c.jst_chat_name is not null group by 1
  ),
  br as (
    select ib.identity_id, array_agg(distinct b.code order by b.code) as codes
    from public.identity_brands ib join public.brands b on b.id = ib.brand_id group by 1
  ),
  tagged as ( -- tag Admin_* ตัวแรกของห้องแชตที่ last_time ล่าสุด ต่อเบอร์
    select distinct on (cl.phone_normalized) cl.phone_normalized as phone, t.tag
    from dsales.dsales_chat_links cl
    join public.iim_sessions s on s.ms_id = cl.ms_id
    cross join lateral (
      select e.value ->> 'text' as tag
      from jsonb_array_elements(s.tags) with ordinality as e(value, ord)
      where e.value ->> 'text' ilike 'admin\_%'
      order by e.ord limit 1
    ) t
    order by cl.phone_normalized, s.last_time desc nulls last
  ),
  tagmap as (
    select distinct on (lower(t.tag)) lower(t.tag) as tag, m.user_id
    from dsales.dsales_members m cross join unnest(m.jst_tags) as t(tag)
    where m.active
    order by lower(t.tag), m.user_id
  ),
  phones as (select phone from ids union select phone from ot)
  select p.phone, ids.id, coalesce(nullif(btrim(ids.display_name), ''), 'ไม่ระบุชื่อ'), chat.chat_name,
         lo.d, current_date - lo.d,
         coalesce(val.order_count, st.bills), coalesce(val.ltv_thb, ids.ltv), ids.segment, ids.rfm_segment,
         coalesce(br.codes, '{}'), tagged.tag, tagmap.user_id,
         lo.d is not null and current_date - lo.d >= v_days, now()
  from phones p
  left join ids on ids.phone = p.phone
  left join st on st.phone = p.phone
  left join val on val.phone = p.phone
  left join chat on chat.phone = p.phone
  left join br on br.identity_id = ids.id
  left join tagged on tagged.phone = p.phone
  left join tagmap on tagmap.tag = lower(tagged.tag)
  cross join lateral (select greatest(val.last_order_date, st.last_bill) as d) lo;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function dsales.dsales_refresh_customer_base() from public, anon, authenticated;
```

- [ ] **Step 4: Apply** ชื่อ `dsales_customer_base`

- [ ] **Step 5: รัน test ให้ผ่าน** — Expected: สำเร็จ

- [ ] **Step 6: วัดเวลาและเติมข้อมูลจริง**

รัน `select dsales.dsales_refresh_customer_base();` ด้วย `execute_sql` แล้วจดจำนวนแถวและเวลาที่ใช้ (ถ้าเกิน 60 วินาที ให้หยุดและรายงาน เพราะงาน cron ใน Task 10 รันทุกชั่วโมง)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261117090500_dsales_customer_base.sql supabase/tests/04_customer_base.sql
git commit -m "feat(db): add dsales_customer_base with dormancy and JST tag ownership"
```

---

### Task 8b: แก้คุณภาพข้อมูลฐานลูกค้า (จาก review ของ Task 7–8)

**Files:**
- Create: `supabase/migrations/20261117090510_dsales_customer_base_quality.sql` (create or replace function เท่านั้น รูปตารางไม่เปลี่ยน)
- Create: `supabase/tests/04b_customer_base_quality.sql`
- Modify: `supabase/tests/03_chat_links.sql`

**สิ่งที่เปลี่ยน:**
- เพิ่ม `dsales.dsales_norm_phone(text)` (IMMUTABLE): ตัดอักขระที่ไม่ใช่ตัวเลข, `66` + 9 หลัก หรือ `660` + 9 หลัก → `0` + 9 หลัก, มือถือ 9 หลักขึ้นต้น 6/8/9 → เติม `0`, เบอร์ที่มี `*` (ถูกปิดบัง) หรือไม่ผ่าน `dsales_valid_phone` → `null` ใช้แปลงเบอร์จากทุกแหล่ง (`order_tracking`, `customer_identities`, `lendi_customer_value`, `lds_customers`) ก่อน join
- บิลจริงผูกด้วย `sales_transaction.bill_no` **หรือ** `order_no` = `order_tracking.online_order` (2 equi-join ต่อด้วย union all แล้ว group ไม่ใช้ join แบบ OR) และตัดเลขที่สั้นกว่า 8 ตัว (ชนกันข้ามออร์เดอร์)
- `dsales_seed_chat_links_by_name()` ลบลิงก์ `chat_name` เดิมแล้วสร้างใหม่ทุกครั้ง (วิธีอื่นไม่แตะ) และไม่ใช้ชื่อคำเดียวที่สั้นกว่า 6 ตัว, `facebook user`, ชื่อที่มี `*`, ชื่อที่เป็นตัวเลขล้วน
- `order_count` = `greatest(lendi.order_count, จำนวนบิลจริง)` (lendi เก็บ 0 ไว้หลายเบอร์)
- `name` = `customer_identities.display_name` → `order_tracking.buyer_name` ล่าสุดที่ไม่ว่าง → `'ไม่ระบุชื่อ'`; `chat_name` = `lds_customers.jst_chat_name` → ชื่อห้องแชตล่าสุดที่ผูกกับเบอร์
- tag = tag `Admin_*` ตัวแรกของห้องล่าสุดที่มี tag `Admin_*` (เรียง `last_time` แล้ว `ms_id`)
- `dsales_refresh_customer_base()` ล็อก `pg_advisory_xact_lock` กันรันซ้อน, ใช้วันที่ไทย `(now() at time zone 'Asia/Bangkok')::date`, และ raise exception ถ้าไม่มีค่า `dormant_days`
- test 03 รันซ้ำได้ (seed ครั้งที่สองได้จำนวนเท่าครั้งแรก) และตรวจว่าไม่มีห้องที่ผูกด้วยชื่อหลวม; test 04b ตรวจการแปลงเบอร์, ลูกค้าที่เพิ่งซื้อไม่ eligible, จำนวน `last_order_date is null` ลดลงอย่างน้อย 1,000 และ error เมื่อไม่มี `dormant_days`

**ผลกับข้อมูลจริง (2026-11-17):** ลิงก์ชื่อแชต 2,376 → 2,289 · ลูกค้า 18,740 → 18,744 · ไม่มี `last_order_date` 11,424 → 9,458 · eligible 6,630 → 8,612 · มี tag 1,755 → 1,694 (eligible 1,308 → 1,408) · มี `chat_name` 1 → 2,083 · seed ~1.1 s, refresh ~1.8 s

---

### Task 9: RPC หน้า "ลูกค้าของฉัน / ถังกลาง", ผูก tag และการจองที่เคารพเจ้าของตาม tag

**Files:**
- Create: `supabase/migrations/20261117090600_dsales_base_rpcs.sql`
- Test: `supabase/tests/05_base_rpcs.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/05_base_rpcs.sql`:

```sql
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
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน** — Expected: `ERROR: 42883: function dsales.dsales_jst_admin_tags() does not exist`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117090600_dsales_base_rpcs.sql`:

```sql
-- รายชื่อ tag Admin_* ที่มีใน JST (หัวหน้าใช้เลือกผูกกับเซลล์)
create or replace function dsales.dsales_jst_admin_tags() returns table(tag text, sessions bigint)
language sql stable security definer set search_path = dsales, public as $$
  select e.value ->> 'text', count(*)
  from public.iim_sessions s cross join jsonb_array_elements(s.tags) e
  where dsales.dsales_uid() is not null and dsales.dsales_is_admin() and e.value ->> 'text' ilike 'admin\_%'
  group by 1 order by 2 desc $$;

-- tag ของสมาชิก (หัวหน้าเห็นทุกคน เซลล์เห็นของตัวเอง)
create or replace function dsales.dsales_member_tags() returns table(user_id uuid, jst_tags text[])
language sql stable security definer set search_path = dsales, public as $$
  select m.user_id, m.jst_tags from dsales.dsales_members m
  where dsales.dsales_uid() is not null and (dsales.dsales_is_admin() or m.user_id = auth.uid()) $$;

-- หัวหน้าผูก tag กับเซลล์ (1 tag มีเจ้าของได้คนเดียว) แล้วคำนวณ customer_base ใหม่ทันที
create or replace function dsales.dsales_set_member_tags(p_user uuid, p_tags text[]) returns text[]
language plpgsql security definer set search_path = dsales, public as $$
declare
  v_tags text[] := (select coalesce(array_agg(distinct btrim(t) order by btrim(t)), '{}')
                    from unnest(coalesce(p_tags, '{}')) as t where nullif(btrim(t), '') is not null);
  v_conflict text;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from dsales.dsales_members where user_id = p_user) then raise exception 'member_not_found'; end if;
  select t into v_conflict
  from dsales.dsales_members m cross join unnest(m.jst_tags) as t
  where m.user_id <> p_user and lower(t) in (select lower(x) from unnest(v_tags) as x)
  limit 1;
  if v_conflict is not null then raise exception 'tag_taken: %', v_conflict; end if;
  update dsales.dsales_members set jst_tags = v_tags where user_id = p_user;
  perform dsales.dsales_refresh_customer_base();
  return v_tags;
end $$;

-- ลูกค้าเก่าที่เข้าเกณฑ์ตาม scope: mine = ของฉัน (ลีดที่ฉันถือ หรือ tag ของฉัน), pool = ไม่มีเจ้าของ, team = ทั้งหมด (หัวหน้า)
-- คอลัมน์ 16 ตัวแรกเหมือน dsales_customer_pool_v4 เพื่อให้หน้าเว็บใช้โค้ดเดิมได้
create or replace function dsales.dsales_base_customers(p_scope text, p_search text default null, p_limit integer default 50, p_offset integer default 0, p_brand text default null)
returns table(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer,
              last_order_date date, brands text[], total_count bigint, lead_id uuid, taken boolean, mine boolean, no_call boolean,
              reserved_by text, dormant_days integer, owner_tag text)
language sql stable security definer set search_path = dsales, public as $$
  with me as (select dsales.dsales_uid() as uid, dsales.dsales_is_admin() as admin),
  s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d),
  cand as (
    select b.*, l.id as l_id, coalesce(l.no_call, false) as l_no_call, coalesce(l.owner_id, b.owner_id) as eff_owner
    from dsales.dsales_customer_base b
    left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
    cross join s
    where b.eligible
      and (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
      and (s.t = '' or position(s.t in lower(b.name)) > 0 or position(s.t in lower(coalesce(b.chat_name, ''))) > 0
           or (s.d <> '' and b.phone_normalized like '%' || s.d || '%'))
  ),
  scoped as (
    select c.* from cand c cross join me
    where case p_scope when 'mine' then c.eff_owner = me.uid
                       when 'pool' then c.eff_owner is null
                       when 'team' then me.admin
                       else false end
  )
  select x.identity_id, x.name, x.phone_normalized, x.chat_name, x.segment, x.rfm_segment, x.ltv, x.order_count,
         x.last_order_date, x.brands, count(*) over (), x.l_id, x.eff_owner is not null, x.eff_owner = (select uid from me),
         x.l_no_call,
         case when (select admin from me) and x.eff_owner is not null
              then (select m.display_name from dsales.dsales_members m where m.user_id = x.eff_owner) end,
         x.dormant_days, x.owner_tag
  from scoped x
  order by x.ltv desc nulls last, x.phone_normalized
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0) $$;

-- เหมือนเดิม + ห้ามจองลูกค้าที่เป็นของเซลล์คนอื่นตาม tag
create or replace function dsales.dsales_claim_customer(p_phone text, p_brand text) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); l dsales.dsales_leads; ident record; ph text := btrim(coalesce(p_phone, ''));
        v_tag_owner uuid;
begin
  perform dsales.dsales_register();
  if not dsales.dsales_valid_phone(ph) then raise exception 'invalid_phone'; end if;
  if p_brand not in ('bebeplay','hosttail') then raise exception 'invalid_brand'; end if;
  select b.owner_id into v_tag_owner from dsales.dsales_customer_base b where b.phone_normalized = ph;
  if v_tag_owner is not null and v_tag_owner <> me then raise exception 'taken'; end if;
  select * into l from dsales.dsales_leads where phone_normalized = ph for update;
  if found then
    if l.no_call then raise exception 'no_call'; end if;
    if l.owner_id is not null and l.owner_id <> me then raise exception 'taken'; end if;
    update dsales.dsales_leads set owner_id = me, claimed_by = me, claimed_at = coalesce(claimed_at, now()), released_by = array_remove(released_by, me), updated_at = now()
      where id = l.id returning * into l;
  else
    select ci.id, coalesce(nullif(btrim(ci.display_name), ''), 'ไม่ระบุชื่อ') as nm into ident from public.customer_identities ci where ci.primary_phone = ph limit 1;
    if not found then raise exception 'customer_not_found'; end if;
    insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, identity_id, owner_id, claimed_by, claimed_at, last_seller_id, created_by)
      values ('self', p_brand, ident.nm, ph, ph, ident.id, me, me, now(), me, me) returning * into l;
  end if;
  return dsales.dsales_lead_json(l);
end $$;

revoke all on function dsales.dsales_jst_admin_tags(), dsales.dsales_member_tags(), dsales.dsales_set_member_tags(uuid, text[]),
  dsales.dsales_base_customers(text, text, integer, integer, text) from public, anon;
grant execute on function dsales.dsales_jst_admin_tags(), dsales.dsales_member_tags(), dsales.dsales_set_member_tags(uuid, text[]),
  dsales.dsales_base_customers(text, text, integer, integer, text) to authenticated;
```

- [ ] **Step 4: Apply** ชื่อ `dsales_base_rpcs`

- [ ] **Step 5: รัน test ให้ผ่าน** — Expected: สำเร็จ

- [ ] **Step 6: รัน test ทั้งหมดซ้ำ** — รัน `supabase/tests/01_schema_move.sql` ถึง `05_base_rpcs.sql` ทีละไฟล์ Expected: สำเร็จทุกไฟล์

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261117090600_dsales_base_rpcs.sql supabase/tests/05_base_rpcs.sql
git commit -m "feat(db): add mine/pool customer RPCs, JST tag mapping and tag-aware claiming"
```

---

### Task 10: งานตั้งเวลา (pg_cron)

**Files:**
- Create: `supabase/migrations/20261117090700_dsales_cron.sql`

- [ ] **Step 1: เขียน migration**

`supabase/migrations/20261117090700_dsales_cron.sql`:

```sql
-- ทุกชั่วโมง นาทีที่ 5: ผูกห้องแชตใหม่ด้วยชื่อแชต แล้วคำนวณฐานลูกค้าใหม่
select cron.schedule(
  'dsales-refresh-customer-base',
  '5 * * * *',
  $$select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();$$
);
```

- [ ] **Step 2: Apply** ชื่อ `dsales_cron`

- [ ] **Step 3: ตรวจว่าตั้งแล้ว**

รัน: `select jobname, schedule, active from cron.job where jobname = 'dsales-refresh-customer-base';`
Expected: 1 แถว `5 * * * *`, `active = true`

- [ ] **Step 4: ตรวจว่ารันจริง (หลังนาทีที่ 5 ของชั่วโมงถัดไป)**

รัน: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'dsales-refresh-customer-base') order by start_time desc limit 1;`
Expected: `status = succeeded`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261117090700_dsales_cron.sql
git commit -m "feat(db): refresh chat links and customer base hourly with pg_cron"
```

---

### Task 11: หน้า "ลูกค้าของฉัน" และ "ถังกลาง"

**Files:**
- Modify: `index.html` (เมนู)
- Modify: `app.js` (routes, `ui.pool`, `renderCampaign`, `poolLoad`, `poolPanel`, `poolAction`, `poolClaimLive`, ฟังก์ชันใหม่ `renderBase`)

- [ ] **Step 1: เพิ่มเมนู** — ใน `index.html` แก้

```html
      <div class="nav-group">แคมเปญ</div>
```

เป็น

```html
      <div class="nav-group">ฐานลูกค้าเก่า</div>
      <a class="nav-item" href="#mine" data-route="mine">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z"/></svg>
        <span>ลูกค้าของฉัน</span>
      </a>
      <a class="nav-item" href="#pool" data-route="pool">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>
        <span>ถังกลาง</span>
      </a>
      <div class="nav-group">แคมเปญ</div>
```

- [ ] **Step 2: เพิ่ม route** — ใน `app.js` แก้

```js
    leads: { title: 'Direct Sale', sub: 'ลูกค้าเก่า Direct Sale Lead', render: renderLeads },
```

เป็น

```js
    leads: { title: 'Direct Sale', sub: 'ลูกค้าเก่า Direct Sale Lead', render: renderLeads },
    mine: { title: 'ลูกค้าของฉัน', sub: '', render: () => renderBase('mine') },
    pool: { title: 'ถังกลาง', sub: '', render: () => renderBase('pool') },
```

- [ ] **Step 3: เพิ่ม `scope` ใน state ของถัง** — แก้

```js
  ui.pool = { brand: null, q: '', page: 0,
```

เป็น

```js
  ui.pool = { scope: 'all', brand: null, q: '', page: 0,
```

- [ ] **Step 4: หน้าแคมเปญรีเซ็ตกลับเป็น scope `all`** — แก้

```js
    if (ui.pool.brand !== brand) Object.assign(ui.pool, { brand, loaded
```

เป็น

```js
    if (ui.pool.brand !== brand || ui.pool.scope !== 'all') Object.assign(ui.pool, { scope: 'all', brand, loaded
```

- [ ] **Step 5: `poolLoad` เลือก RPC ตาม scope** — แก้ 4 จุด

(ก) หัวฟังก์ชัน:

```js
  async function poolLoad(redraw, keepFocus) {
    const P = ui.pool; P.loading = true; P.err = '';
```

เป็น

```js
  async function poolLoad(redraw, keepFocus) {
    const P = ui.pool; P.loading = true; P.err = '';
    if (!isLive() && P.scope !== 'all') { // โหมดตัวอย่างไม่มีฐานลูกค้าเก่าจริง
      Object.assign(P, { live: false, total: 0, rows: [], loaded: true, loading: false }); redraw(keepFocus); return;
    }
```

(ข) จำนวนลูกค้าทั้งแบรนด์ใช้เฉพาะหน้าแคมเปญ:

```js
      if (isLive() && P.grandFor !== P.brand) {
```

เป็น

```js
      if (isLive() && P.scope === 'all' && P.grandFor !== P.brand) {
```

(ค) การเรียก RPC:

```js
        const { data, error } = await db.rpc('dsales_customer_pool_v4', { p_search: P.q.trim() || null, p_limit: PAGE, p_offset: P.page * PAGE, p_brand: P.brand || null, ...(hasPeriod() ? { p_from: ui.period.from || null, p_to: ui.period.to || null } : {}) });
```

เป็น

```js
        const { data, error } = P.scope === 'all'
          ? await db.rpc('dsales_customer_pool_v4', { p_search: P.q.trim() || null, p_limit: PAGE, p_offset: P.page * PAGE, p_brand: P.brand || null, ...(hasPeriod() ? { p_from: ui.period.from || null, p_to: ui.period.to || null } : {}) })
          : await db.rpc('dsales_base_customers', { p_scope: P.scope, p_search: P.q.trim() || null, p_limit: PAGE, p_offset: P.page * PAGE, p_brand: P.brand || null });
```

(ง) การแปลงแถว:

```js
        P.rows = data.map(r => ({ id: r.identity_id, name: r.name,
```

เป็น

```js
        P.rows = data.map(r => ({ id: r.identity_id || r.phone, dormant: r.dormant_days ?? null, ownerTag: r.owner_tag || '', name: r.name,
```

- [ ] **Step 6: คอลัมน์ที่สองของตารางถัง** — ใน `poolPanel` แก้

```js
      <td>${poolCampCell(r)}</td>
```

เป็น

```js
      <td>${P.scope === 'all' ? poolCampCell(r) : (r.dormant == null ? '—' : `${r.dormant} วัน`)}${r.ownerTag ? `<div class="sub">${esc(r.ownerTag)}</div>` : ''}</td>
```

และแก้หัวตาราง

```js
<tr><th>ชื่อ / เบอร์</th><th>แคมเปญ</th><th>กลุ่มลูกค้า</th><th class="r">ยอดซื้อสะสม</th>
```

เป็น

```js
<tr><th>ชื่อ / เบอร์</th><th>${P.scope === 'all' ? 'แคมเปญ' : 'ไม่ซื้อมา / tag'}</th><th>กลุ่มลูกค้า</th><th class="r">ยอดซื้อสะสม</th>
```

- [ ] **Step 7: ปุ่มในหน้า "ลูกค้าของฉัน"** — ลูกค้าตาม tag ของฉันที่ยังไม่มีลีดจะมี `taken = true, mine = true, leadId = null` ต้องเห็นปุ่ม "เริ่มติดตาม" (กดแล้วสร้างลีดผ่าน `dsales_claim_customer`) แก้ใน `poolAction` 2 จุด (เฉพาะใน `if (isLive()) { … }`)

(ก) แก้

```js
      if (r.mine) { const L = lead(r.leadId);
```

เป็น

```js
      if (r.mine && r.leadId) { const L = lead(r.leadId);
```

(ข) แก้ 2 บรรทัดนี้ (คู่แรกในไฟล์ ที่ย่อหน้า 6 ช่อง)

```js
      if (r.taken) return `<button class="btn sm" disabled>${isAdmin() && r.takenName ? 'จองโดย ' + esc(r.takenName) : 'จองแล้ว'}</button>`;
      return `<button class="btn sm outline" data-pool-claim="${esc(r.id)}">จอง</button>`;
```

เป็น

```js
      if (r.taken && !r.mine) return `<button class="btn sm" disabled>${isAdmin() && r.takenName ? 'จองโดย ' + esc(r.takenName) : 'จองแล้ว'}</button>`;
      return `<button class="btn sm outline" data-pool-claim="${esc(r.id)}">${ui.pool.scope === 'mine' ? 'เริ่มติดตาม' : 'จอง'}</button>`;
```

- [ ] **Step 8: การจองต้องมีแบรนด์ที่ใช้ได้** — ใน `poolClaimLive` แก้

```js
      const l = await mut('dsales_claim_customer', { p_phone: r.phone, p_brand: ui.pool.brand || r.brands[0] || '' });
```

เป็น

```js
      const brand = ui.pool.brand || r.brands.find(b => BRAND[b]) || '';
      if (!brand) { toast('เลือกแบรนด์ที่ช่องด้านบนก่อนจอง'); return; }
      const l = await mut('dsales_claim_customer', { p_phone: r.phone, p_brand: brand });
```

- [ ] **Step 9: เพิ่ม `renderBase`** — วางต่อจากฟังก์ชัน `renderCampaign` (ก่อนบรรทัด `/* ---------- dashboard ---------- */`)

```js
  // หน้า "ลูกค้าของฉัน" (scope=mine) และ "ถังกลาง" (scope=pool): ลูกค้าเก่าที่ไม่ได้ซื้อมา 30 วันขึ้นไป ใช้ตารางถังเดิม
  function renderBase(scope) {
    if (ui.pool.scope !== scope) Object.assign(ui.pool, { scope, brand: null, loaded: false, page: 0, q: '', total: null, rows: [] });
    ui.pool.loaded = false;
    const note = scope === 'mine'
      ? 'ลูกค้าตาม tag JST ของคุณ และที่คุณจอง/ได้รับมอบหมาย ที่ไม่ได้ซื้อมา 30 วันขึ้นไป'
      : 'ลูกค้าที่ไม่ได้ซื้อมา 30 วันขึ้นไปและยังไม่มีเจ้าของ กดจองเพื่อเริ่มติดตาม';
    const draw = (keepFocus) => {
      const P = ui.pool;
      if (!P.loaded && !P.loading) poolLoad(draw);
      $('#page-sub').textContent = P.total == null ? '' : `${P.total.toLocaleString('th-TH')} ราย`;
      $('#view').innerHTML = `<div class="demo-note">${note}</div>
        ${isLive() ? '' : '<div class="demo-note">โหมดตัวอย่างไม่มีข้อมูลส่วนนี้ ล็อกอินเพื่อดูข้อมูลจริง</div>'}
        <div class="toolbar"><select class="select" id="base-brand" aria-label="แบรนด์"><option value="">ทุกแบรนด์</option>${Object.entries(BRAND).map(([k, v]) => `<option value="${k}" ${P.brand === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        ${poolPanel()}`;
      $('#base-brand').onchange = (e) => { P.brand = e.target.value || null; P.page = 0; poolLoad(draw); };
      bindPool(draw);
      if (keepFocus) { const q = $('#pool-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    };
    draw();
  }
```

- [ ] **Step 10: ตรวจ syntax** — Run: `node --check app.js` Expected: ไม่มี output

- [ ] **Step 11: ตรวจในเบราว์เซอร์ (ล็อกอินบัญชีหัวหน้า)**
1. เมนู "ถังกลาง": ตารางขึ้น หัวข้อรองแสดงจำนวนราย คอลัมน์ที่สองเป็น "N วัน" ทุกแถว ≥ 30
2. ค้นหาเบอร์บางส่วนในช่องค้นหา → ผลลัพธ์กรองตาม
3. เลือกแบรนด์ Bebeplay → กดจองลูกค้า 1 ราย → toast "จองแล้ว…" ลูกค้าหายจากถังกลาง และไปโผล่ในเมนู "ลูกค้าของฉัน" พร้อมปุ่ม "ยกเลิกจอง"
4. กด "ยกเลิกจอง" ในหน้า "ลูกค้าของฉัน" → ลูกค้ากลับไปถังกลาง
5. เมนู แคมเปญ → Bebeplay → การ์ด "ลูกค้าทั้งหมด" ยังทำงานเหมือนเดิม (คอลัมน์ที่สองเป็น "แคมเปญ")
6. ออกจากระบบ → "ดูตัวอย่างโดยไม่ล็อกอิน" → เมนู "ถังกลาง" แสดงข้อความ "โหมดตัวอย่างไม่มีข้อมูลส่วนนี้" ไม่มี error ใน console

- [ ] **Step 12: Commit**

```bash
git add index.html app.js
git commit -m "feat(web): add My customers and Shared pool pages for dormant customers"
```

---

### Task 12: การ์ดผูก tag JST กับเซลล์ (หัวหน้า)

**Files:**
- Modify: `app.js` (`renderSetup` + ฟังก์ชันใหม่ `loadTagMap`)

- [ ] **Step 1: เพิ่มการ์ด** — ใน `renderSetup` แก้

```js
      <div class="panel"><div class="panel-h"><h2>แคมเปญ</h2></div><div class="panel-b">
```

เป็น

```js
      ${LIVE && isAdmin() ? '<div class="panel"><div class="panel-h"><h2>ผูก tag JST กับเซลล์</h2></div><div class="panel-b" id="tag-map"><span class="sub">กำลังโหลด…</span></div></div>' : ''}
      <div class="panel"><div class="panel-h"><h2>แคมเปญ</h2></div><div class="panel-b">
```

และแก้บรรทัดสุดท้ายของ `renderSetup`

```js
    $('#reset').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  }
```

เป็น

```js
    $('#reset').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
    if (LIVE && isAdmin()) loadTagMap();
  }
  // หัวหน้าเลือก tag Admin_* ใน JST ให้เซลล์แต่ละคน (1 tag มีเจ้าของได้คนเดียว) บันทึกแล้วระบบคำนวณเจ้าของลูกค้าใหม่ทันที
  async function loadTagMap() {
    const box = $('#tag-map'); if (!box) return;
    const [tg, mt] = await Promise.all([db.rpc('dsales_jst_admin_tags'), db.rpc('dsales_member_tags')]);
    if (tg.error || mt.error) { box.innerHTML = `<div class="login-err">${esc((tg.error || mt.error).message)}</div>`; return; }
    const tagsOf = Object.fromEntries(mt.data.map(r => [r.user_id, r.jst_tags || []]));
    const all = tg.data.map(r => r.tag);
    box.innerHTML = state.reps.map(r => `<div class="list-row"><div><b>${esc(r.name)}</b><div class="sub">${esc((tagsOf[r.id] || []).join(', ') || 'ยังไม่ผูก tag')}</div></div>
        <select class="select" multiple size="3" data-tags-for="${esc(r.id)}" aria-label="tag ของ ${esc(r.name)}">${all.map(t => `<option value="${esc(t)}" ${(tagsOf[r.id] || []).includes(t) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <button class="btn sm" data-save-tags="${esc(r.id)}">บันทึก</button></div>`).join('')
      + '<p class="help">บันทึกแล้วหน้า "ลูกค้าของฉัน" ของเซลล์คนนั้นจะอัปเดตทันที</p>';
    box.querySelectorAll('[data-save-tags]').forEach(b => b.onclick = async () => {
      const id = b.dataset.saveTags, sel = box.querySelector(`[data-tags-for="${id}"]`);
      b.disabled = true;
      const { error } = await db.rpc('dsales_set_member_tags', { p_user: id, p_tags: [...sel.selectedOptions].map(o => o.value) });
      b.disabled = false;
      if (error) return toast((error.message || '').includes('tag_taken') ? 'tag นี้ผูกกับเซลล์คนอื่นแล้ว' : (error.message || 'บันทึกไม่สำเร็จ'));
      toast('บันทึก tag แล้ว'); loadTagMap();
    });
  }
```

- [ ] **Step 2: ตรวจ syntax** — Run: `node --check app.js` Expected: ไม่มี output

- [ ] **Step 3: ตรวจในเบราว์เซอร์ (บัญชีหัวหน้า)**
1. เมนู ตั้งค่า → การ์ด "ผูก tag JST กับเซลล์" แสดงรายชื่อทีม และตัวเลือก tag (`Admin_Sao`, `Admin_Taew`, `Admin_Pop`, …)
2. เลือก tag 1 ตัวให้ตัวเอง → บันทึก → toast "บันทึก tag แล้ว" ใต้ชื่อแสดง tag นั้น
3. เมนู "ลูกค้าของฉัน" → มีลูกค้าที่คอลัมน์ที่สองแสดง tag นั้น และปุ่ม "เริ่มติดตาม"
4. กลับไปลบ tag ออก (ไม่เลือกอะไร) → บันทึก → หน้า "ลูกค้าของฉัน" ไม่มีลูกค้าตาม tag แล้ว

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(web): let admins map JST Admin_ tags to sales reps"
```

---

### Task 13: ตรวจบนมือถือ

**Files:**
- Modify (เฉพาะเมื่อพบปัญหา): `styles.css` ในบล็อก `@media (max-width: 760px)`

- [ ] **Step 1: เปิดที่ความกว้าง 375px** (DevTools device toolbar หรือ browser pane ขนาด mobile) ล็อกอินแล้วตรวจทีละหน้า: Direct Sale, ลูกค้าของฉัน, ถังกลาง, แคมเปญ Bebeplay, Dashboard, ตั้งค่า

เกณฑ์ผ่านทุกหน้า:
1. ไม่มี scroll แนวนอนของทั้งหน้า (ตารางเลื่อนแนวนอนในกรอบ `.table-wrap` ได้)
2. ปุ่มเมนู ☰ เปิด/ปิด sidebar ได้ และแตะเมนูแล้ว sidebar ปิด
3. ช่องค้นหา, ตัวเลือกแบรนด์ และปุ่ม จอง/เริ่มติดตาม/บันทึก กดได้ ไม่ถูกบัง
4. popup ลูกค้าเปิดเต็มจอและปิดได้
5. ปุ่มโทร (`tel:`) อยู่ในพื้นที่กดได้

- [ ] **Step 2: ถ้ามีข้อใดไม่ผ่าน** แก้ใน `styles.css` เฉพาะใน `@media (max-width: 760px) { … }` แล้วตรวจซ้ำข้อที่ไม่ผ่าน (ถ้าทุกข้อผ่าน ข้ามไป Step 3)

- [ ] **Step 3: Commit (ถ้ามีการแก้)**

```bash
git add styles.css
git commit -m "fix(web): mobile layout fixes for 375px screens"
```

---

### Task 14: อัปเดตเอกสาร

**Files:**
- Modify: `docs/DATABASE.md`, `README.md`, `supabase/live-part1.sql`

- [ ] **Step 1: `supabase/live-part1.sql`** — เพิ่มบรรทัดแรกสุด

```sql
-- เลิกใช้แล้ว (2026-11-17): ของทั้งหมดย้ายไป schema dsales ดู supabase/migrations/ ห้ามรันไฟล์นี้ซ้ำ
```

- [ ] **Step 2: `docs/DATABASE.md`** — ในหัวข้อ `## 3.` และ `## 4.` แทนข้อความ `public.dsales_` และชื่อหัวข้อ "`dsales_*`" ให้ระบุว่าอยู่ใน schema `dsales` และเพิ่มหัวข้อย่อยใหม่ต่อท้ายหัวข้อ 3:

```markdown
### ตารางใหม่ (เฟส 0–1)
| ตาราง | หน้าที่ |
|---|---|
| `dsales.dsales_settings` | ค่าตั้ง: dormant_days, window_days, worker_rate_per_hour, chat_tz_offset |
| `dsales.dsales_chat_links` | ห้องแชต JST ↔ เบอร์ (method: chat_name/order_no/buyer_id/manual) |
| `dsales.dsales_customer_base` | ลูกค้า 1 แถวต่อเบอร์ + หายไปกี่วัน + เจ้าของตาม tag คำนวณใหม่ทุกชั่วโมง (pg_cron `dsales-refresh-customer-base`) |
| `dsales.dsales_chat_messages_v` (view) | `iim_messages` ที่แก้เวลา −7 ชม. แล้ว |
```

และในหัวข้อ 5.2 เพิ่มบรรทัด: `**สถานะ:** ตรวจแล้วว่าเพี้ยน +7 ชม. คงที่ ใช้ view dsales.dsales_chat_messages_v แทน (ไม่แก้ตารางต้นทาง)`

- [ ] **Step 3: `README.md`** — เพิ่มหัวข้อท้ายไฟล์

```markdown
## ฐานข้อมูล
- ข้อมูล Direct Sale อยู่ใน Supabase schema `dsales` (ต้องเปิดใน Dashboard → Data API → Exposed schemas) หน้าเว็บเรียกผ่าน `sb.schema('dsales')`
- migration อยู่ใน `supabase/migrations/` และ test อยู่ใน `supabase/tests/` (รันใน transaction แล้ว rollback)
- โครงสร้างข้อมูล: `docs/DATABASE.md` · ออกแบบ: `docs/superpowers/specs/2026-11-17-direct-sale-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add docs/DATABASE.md README.md supabase/live-part1.sql
git commit -m "docs: document dsales schema, migrations and phase 0-1 tables"
```

---

## สิ่งที่แผนนี้ยังไม่ทำ (แผนถัดไป)

- เฟส 2: บันทึกโทรแบบใหม่, `qualified_contacts_v`, `attribute_orders()`, `dsales_attributions`, KPI, เป้า, Dashboard, view ให้ Project Commission, ค่า `source` ใหม่ของลีด
- เฟส 3: templates, batch, `outreach_queue`, RPC ของ worker
- เฟส 4: JST Worker (spec แยก หลังดูหน้า JST จริง)
- เฟส 5: RLS
