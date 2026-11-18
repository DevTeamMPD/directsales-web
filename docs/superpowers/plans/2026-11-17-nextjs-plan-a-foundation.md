# Direct Sale Next.js · แผน A: ฐานราก Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** วางฐานของเว็บ Next.js ที่จะแทน prototype: DB ให้เข้าใช้ได้เฉพาะสมาชิก active, ย้าย prototype ไป `legacy/`, โครง Next.js 15 + CSS/ฟอนต์เดิม, helper/ค่าคงที่, ชั้นเรียก RPC, ล็อกอินครั้งเดียว + middleware, หน้า "ยังไม่มีสิทธิ์", shell (sidebar/topbar/me/toast/modal) ที่ทุกเมนูเปิดได้ (เนื้อหาหน้าเป็น placeholder), ชุดทดสอบเทียบหน้าตากับ prototype และ `CLAUDE.md` ของโปรเจกต์

**Architecture:** DB แก้ใน schema `dsales` ด้วย migration + SQL test แบบ `begin … rollback` เหมือนแผนเฟส 0–1 หน้าเว็บเป็น Next.js App Router ที่ดึงข้อมูลฝั่ง client (`AppProvider` = context + reducer โหลด `dsales_me` → `dsales_team` / `dsales_campaigns` / `dsales_my_leads` ครั้งเดียว) ใช้ `styles/prototype.css` (สำเนา `styles.css`) และ class name เดิมทุกจุด session อยู่ใน cookie ผ่าน `@supabase/ssr` และ middleware กันทุกหน้าที่ยังไม่ล็อกอิน โหมด fixture (เฉพาะ `next dev` + `NEXT_PUBLIC_FIXTURES=1`) ใช้ข้อมูลจาก `legacy/data.js` ให้ Playwright เทียบภาพกับ prototype

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, `@supabase/ssr` 0.10 + `@supabase/supabase-js` 2.107 (เวอร์ชันเดียวกับโปรเจกต์ Inventory), Tailwind CSS 3 (ปิด preflight), Vitest 3, Playwright, PostgreSQL 15 (Supabase), Node.js 20+

**Spec:** `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md` (ข้อ 1, 2 ส่วน Shell, 4, 5, 6) + `docs/superpowers/specs/2026-11-17-prototype-inventory.md` (ข้อ 1, 5, 8, 9, 10)

---

## ข้อมูลที่ตรวจแล้วก่อนเขียนแผน (2026-11-17)

- Supabase project id: `nroyacasuchqniaiuirk` (ใช้ร่วมกับระบบอื่น = production)
- `dsales.dsales_members` มี 1 แถว เป็น `role = 'admin'`, `active = true` อยู่แล้ว คอลัมน์: `user_id uuid PK (FK auth.users on delete cascade)`, `role text default 'sales' check in ('admin','sales')`, `display_name text`, `active boolean default true`, `created_at timestamptz`, `jst_tags text[] default '{}'`
- `dsales.dsales_uid()` ตอนนี้: plpgsql, ไม่ใช่ security definer, ไม่ตั้ง `search_path`, เช็กแค่ `auth.uid() is null` → `not_authenticated` (28000)
- `dsales.dsales_register()` ตอนนี้ insert ทุกคนที่ล็อกอินเป็น `sales` (และ `dsales_claim_customer` เรียก `perform dsales.dsales_register()` อยู่)
- `dsales.dsales_me()` คืน `(user_id, email, display_name, is_admin)` จาก `auth.users` left join `dsales_members` / `public.profiles` ไม่เรียก `dsales_uid()` สิทธิ์ execute: `authenticated`, `service_role`, `postgres`
- `dsales.dsales_is_admin()` เช็ก `role = 'admin' and active` อยู่แล้ว
- **RPC ที่อ่านข้อมูลลูกค้าแต่ไม่เรียก `dsales_uid()`** (คนที่ล็อกอินได้ทุกคนเรียกได้): `dsales_customer_purchases`, `dsales_customer_channels`, `dsales_customer_chats`, `dsales_customer_pool_v3` ส่วน `dsales_assign_lead` กันด้วย `dsales_is_admin()` แล้ว
- โปรเจกต์ Inventory ใช้ `next` ^15.3.0 (ติดตั้งจริง 15.5.19), `react` ^19.0.0, `@supabase/ssr` ^0.10.3, `@supabase/supabase-js` ^2.107.0, `tailwindcss` ^3.4.1, `eslint` ^9 + `eslint-config-next` ^15.3.0 แบบ FlatCompat
- `legacy/data.js` สร้างข้อมูลตัวอย่างด้วยเลขสุ่มแบบ seed คงที่ ใช้วันที่ `2026-11-04T09:00:00` ตามเขตเวลาของเครื่อง (จึงต้องแปลงและเปิดเบราว์เซอร์ทดสอบที่ `Asia/Bangkok` ทั้งคู่) และตอน `route()` ครั้งแรก prototype รัน `applyAuto` กับแคมเปญ `auto` (`c-host-nov`) ซึ่งเปลี่ยนเจ้าของลีด
- ไฟล์ prototype ใช้ CRLF (`styles.css`, `app.js`, `index.html`)

## การตัดสินใจในแผนนี้ (ต่างจาก/เพิ่มจาก spec)

- **กันคนนอกทีมใน RPC อ่านข้อมูลลูกค้า 4 ตัวด้วย** (`dsales_customer_purchases/_channels/_chats/_pool_v3`) โดยเพิ่ม `dsales.dsales_uid() is not null` ใน `where` (แบบเดียวกับ `dsales_team`) ไม่อย่างนั้นพนักงาน ~150 คนที่ไม่ใช่เซลล์ยังเรียกดูประวัติซื้อ/แชตได้ ซึ่งขัดกับ spec ข้อ 5 ("เรียก RPC ที่อ่าน/แก้ข้อมูลลูกค้าไม่ได้")
- **ต้องเหลือหัวหน้า active อย่างน้อย 1 คนเสมอ:** `dsales_add_member` (ลดบทบาทหัวหน้าเป็น `sales`) และ `dsales_set_member_active` (ปิดหัวหน้า) โยน `last_admin` ถ้าทำแล้วไม่เหลือหัวหน้า active; ข้อความไทย "ต้องมีหัวหน้าอย่างน้อย 1 คน"
- env ใช้ชื่อ `NEXT_PUBLIC_SUPABASE_ANON_KEY` เหมือนโปรเจกต์ Inventory แต่ค่าเป็น publishable key (`sb_publishable_…`) — มีหมายเหตุใน `.env.example`
- `dsales_uid()` เปลี่ยนเป็น `security definer` + `search_path = dsales, public` เพื่ออ่าน `dsales_members` ได้เสมอไม่ว่าใครเรียก
- `dsales_me()` คืนแถวเฉพาะผู้ใช้ที่มีใน `auth.users` (เหมือนเดิม) test จึงใช้บัญชีพนักงานจริงที่ไม่ใช่สมาชิก (ไม่ใช่ uuid สุ่ม) ตอนตรวจ `is_member = false`
- เมนูใหม่ "ลูกค้าของฉัน" / "ถังกลาง" อยู่ในกลุ่มใหม่ชื่อ "ฐานลูกค้าเก่า" วางระหว่าง "ข้อมูลลูกค้าเก่า" กับ "แคมเปญ" (ตำแหน่งเดียวกับแผนเฟส 0–1 Task 11)
- ข้อความ `.brand-sub` คงเป็น "MPD Group · Preview v0.1" ตาม prototype (แผน C ค่อยตัดสินใจเปลี่ยน)
- ข้อมูล fixture = `legacy/data.js` **หลัง** `applyAuto` (ทำในสคริปต์แปลง) เพื่อให้ตรงกับสิ่งที่ prototype โหมดตัวอย่างแสดงจริง
- เทียบภาพด้วย Playwright `toHaveScreenshot` โดยใช้ภาพที่ถ่ายจาก prototype เป็น baseline (เขียนลง `e2e/.legacy-shots/` ทุกครั้งที่รัน) ก่อนถ่าย prototype จะถูกปรับเฉพาะส่วนที่ตั้งใจต่าง: เพิ่มกลุ่มเมนูใหม่, กล่อง me แบบ "เข้าสู่ระบบแล้ว", ลบปุ่มดูตัวอย่าง และซ่อนเนื้อหาหน้า/ปุ่ม topbar ทั้งสองฝั่ง
- "fixture ไม่ถูก build เข้า production" ตรวจ 2 ชั้น: unit test ตรวจว่าทุกจุดที่อ่าน `NEXT_PUBLIC_FIXTURES` เขียนเป็นเงื่อนไขตรงตัว `process.env.NODE_ENV === 'development' && …` (Next แทนค่าเป็น `false` ตอน build แล้ว webpack ตัดทิ้งพร้อม dynamic import) และสคริปต์ `npm run check:fixtures` สแกน `.next/` หลัง build
- `Lead` เก็บ `claimedAtIso` (เวลาเดิมจาก server) เพิ่ม เพราะ prototype ส่ง `claimedAt` ที่แปลงเป็นเวลาท้องถิ่นแบบไม่มีเขตเวลาให้ `dsales_customer_chats(p_since)` ซึ่งทำให้เลื่อน 7 ชม. (แผน B ใช้ค่านี้)
- ไม่มี wrapper ของ `dsales_register` ในเว็บใหม่ (ไม่จำเป็นแล้ว คงฟังก์ชันใน DB ไว้ให้หน้า legacy)
- ไม่ใช้ `@tailwind base` (preflight ปิดอยู่แล้ว) จึงห้ามใช้ utility ของ Tailwind ที่พึ่งตัวแปร `--tw-*` (shadow/ring/transform) — หน้าตาทั้งหมดใช้ class ของ prototype
- URL ที่ไม่รู้จักใน `(app)` redirect ไป `/leads` (เหมือน route ที่ไม่รู้จักของ prototype) และปุ่มใน topbar ของแต่ละหน้าใส่ผ่าน portal (`<TopbarActions>`) ซึ่งหายเองเมื่อเปลี่ยนหน้า (= `route()` ล้าง `#topbar-actions`)
- `ui.dirtyRows` ของ prototype ไม่ต้องมี เพราะ React วาดตารางใหม่เองเมื่อ state เปลี่ยน

## วิธีรัน

**Migration และ SQL test (เหมือนแผนเฟส 0–1)**
- **Apply migration:** ใช้ Supabase MCP `apply_migration` ด้วย `project_id = "nroyacasuchqniaiuirk"`, `name` = ชื่อไฟล์ไม่รวม `.sql` และเลขเวลา (`dsales_members_only`), `query` = เนื้อหาไฟล์ทั้งไฟล์ (รันใน transaction เดียว) หรือวางทั้งไฟล์ใน Supabase Dashboard → SQL Editor
- **Run SQL test:** ใช้ Supabase MCP `execute_sql` กับเนื้อหาไฟล์ test ทั้งไฟล์ (หรือ SQL Editor) ผ่าน = ไม่มี error · ไม่ผ่าน = `ERROR: P0004: <ข้อความ assert>` ทุกไฟล์ test ขึ้นต้นด้วย `begin;` และจบด้วย `rollback;` จึงไม่ทิ้งข้อมูลไว้
- **ขั้นตอนปลอดภัย (DB ใช้ร่วมกับระบบอื่น):** test ก่อน apply ต้องไม่ผ่าน → dry run `begin; <migration ทั้งไฟล์> <ตัว test โดยตัดบรรทัด begin; แรกและ rollback; สุดท้าย> rollback;` ใน `execute_sql` ครั้งเดียว ต้องสำเร็จ → `apply_migration` → test ต้องผ่าน → regression รัน `01_schema_move.sql`, `02_chat_messages_v.sql`, `03_chat_links.sql`, `05_base_rpcs.sql` **ทีละไฟล์** (ห้ามรัน `04_customer_base.sql` / `04b_customer_base_quality.sql` เพราะหนักบน production)

**หน้าเว็บ**
- ติดตั้ง: `npm install` · ตั้งค่า: `cp .env.example .env.local` แล้วใส่ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ค่า `key` ใน `legacy/config.js`)
- รัน dev: `npm run dev` (http://localhost:3000) · โหมด fixture: `NEXT_PUBLIC_FIXTURES=1 npm run dev`
- ตรวจ: `npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run build`, `npm run check:fixtures` (หลัง build), `npm run test:e2e` (Playwright; เปิด prototype ที่พอร์ต 4100 และ Next fixture ที่พอร์ต 3100 ให้เอง ต้องต่ออินเทอร์เน็ตเพราะ prototype โหลดฟอนต์/supabase-js จาก CDN)
- ทุกคำสั่งในแผนเขียนแบบ bash (Git Bash บน Windows ใช้ได้)

## Deploy (สำคัญ)

- **ห้าม push branch นี้ และห้ามเปลี่ยน Framework Preset ของ Vercel จนจบแผน C** — Task 2 ย้าย `index.html` ไป `legacy/` ถ้า deploy ไป เว็บที่ใช้อยู่ (static) จะหาย
- **Task 1 มีผลกับเว็บ prototype ที่ deploy อยู่ทันทีหลัง apply** (DB เดียวกัน ไม่มี staging): คนที่ล็อกอินแต่ไม่ใช่สมาชิกจะไม่ถูกเพิ่มเป็นเซลล์อัตโนมัติอีก และเห็น "โหลดข้อมูลจาก Supabase ไม่สำเร็จ: not_member" ส่วนสมาชิกเดิม (หัวหน้า 1 คน) ใช้ได้ตามปกติ
- ถ้าต้องเพิ่มเซลล์ก่อนแผน C (ยังไม่มีหน้าจอ): `dsales_add_member` ต้องเรียกจากผู้ใช้ที่ล็อกอิน ใน SQL Editor จึงใช้คำสั่งนี้แทน `insert into dsales.dsales_members (user_id, role, display_name) select id, 'sales', split_part(email::text, '@', 1) from auth.users where lower(email::text) = lower('<อีเมล>') on conflict (user_id) do update set active = true;`

## Branch

ทำงานบน branch ใหม่จาก `claude/serene-meitner-cprt82`:

```bash
git switch -c feat/nextjs-foundation claude/serene-meitner-cprt82
```

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20261117100000_dsales_members_only.sql` | `dsales_uid` เช็กสมาชิก active, `dsales_register` ไม่เพิ่มสมาชิก, `dsales_me` + `is_member`/`active`, `dsales_add_member`, `dsales_set_member_active`, กัน RPC อ่านข้อมูลลูกค้า 4 ตัว |
| `supabase/tests/06_members_only.sql` | SQL test ของ migration ข้างบน |
| `legacy/{index.html,app.js,styles.css,config.js,data.js,icons.js}` | prototype เดิม (ย้ายด้วย `git mv`) ใช้เทียบหน้าตา |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `next-env.d.ts`, `.gitignore`, `.env.example` | โครงโปรเจกต์ Next.js |
| `styles/prototype.css` | สำเนา `legacy/styles.css` แก้เฉพาะตัวแปรฟอนต์ |
| `app/globals.css`, `app/layout.tsx`, `app/page.tsx` | CSS รวม, root layout (ภาษา/ฟอนต์/viewport), `/` → `/leads` |
| `lib/format.ts`, `lib/constants.ts`, `lib/phone.ts`, `lib/icons.ts` (+ `*.test.ts`) | helper/ค่าคงที่จาก prototype, แปลงเบอร์ค้นหา, ไอคอนช่องทาง (สร้างด้วยสคริปต์) |
| `tools/port-legacy.mjs` | แปลง `legacy/icons.js` → `lib/icons.ts`, `legacy/data.js` → `lib/fixtures/data.ts` |
| `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` | Supabase client + กันหน้าที่ยังไม่ล็อกอิน |
| `app/login/page.tsx`, `app/login/LoginForm.tsx` | หน้าล็อกอิน (markup `.login-card` เดิม) |
| `components/auth/NoAccess.tsx` | การ์ด "ยังไม่มีสิทธิ์" / กำลังโหลด / โหลดไม่สำเร็จ |
| `lib/api/types.ts`, `lib/api/map.ts`, `lib/api/errors.ts`, `lib/api/rpc.ts`, `lib/api/test-helpers.ts` (+ `*.test.ts`) | type ของข้อมูล, แปลงผล RPC, ข้อความ error ไทย, wrapper RPC ทุกตัว |
| `lib/routes.ts`, `lib/nav.ts`, `lib/domain/badges.ts` (+ `*.test.ts`) | ชื่อ/คำอธิบายหน้า, เมนู, ตัวเลข badge |
| `lib/state/reducer.ts` (+ test), `lib/state/AppProvider.tsx` | state กลาง + โหลดข้อมูล + toast/modal/logout |
| `components/shell/{ShellContext,Shell,Sidebar,Topbar,TopbarActions,MeBox,Toast,ModalRoot,Placeholder}.tsx` | shell ตาม `legacy/index.html` |
| `app/(app)/layout.tsx`, `app/(app)/{leads,mine,pool,dashboard,setup}/page.tsx`, `app/(app)/campaigns/[brand]/page.tsx`, `app/(app)/[...slug]/page.tsx` | หน้าหลังล็อกอิน (placeholder) |
| `lib/fixtures/{types,data,load}.ts`, `lib/fixtures/{guard,load}.test.ts`, `tools/check-no-fixtures.mjs` | โหมด fixture + ตรวจว่าไม่หลุดเข้า production |
| `playwright.config.ts`, `e2e/visual-parity.spec.ts` | เทียบภาพ shell/login กับ prototype ที่ 375 และ 1280 px |
| `CLAUDE.md` | บริบทโปรเจกต์ให้ Claude Code (stack, โครงไฟล์, กติกา Supabase/schema `dsales`, migration/test, คำสั่ง, โหมด fixture, เอกสาร, conventions) |

---

### Task 1: DB เข้าใช้ได้เฉพาะสมาชิก active

**Files:**
- Create: `supabase/migrations/20261117100000_dsales_members_only.sql`
- Test: `supabase/tests/06_members_only.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/06_members_only.sql`:

```sql
begin;
-- คืน 'no error' หรือ '<sqlstate> <ข้อความ>' ของคำสั่งที่ส่งเข้าไป (อยู่ใน pg_temp และหายตอน rollback)
create function pg_temp.err_of(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'no error';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

do $$
declare v_admin uuid; v_admin_email text; v_out uuid; v_out_email text; v_me record; v_j jsonb; v_e text; v_sql text;
begin
  select user_id into v_admin from dsales.dsales_members order by created_at limit 1;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin;
  assert (select role = 'admin' and active from dsales.dsales_members where user_id = v_admin),
         'the existing member must be an active admin';
  select u.id, u.email::text into v_out, v_out_email
  from auth.users u
  where u.email is not null and not exists (select 1 from dsales.dsales_members m where m.user_id = u.id)
  order by u.created_at limit 1;
  assert v_out is not null, 'need at least one auth user who is not a member';

  -- ไม่ได้ล็อกอิน
  perform set_config('request.jwt.claims', '', true);
  v_e := pg_temp.err_of('select dsales.dsales_uid()');
  assert v_e = '28000 not_authenticated', format('anonymous: expected 28000 not_authenticated, got %s', v_e);

  -- ล็อกอินแต่ไม่มีแถวสมาชิก
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_e := pg_temp.err_of('select dsales.dsales_team()');
  assert v_e = '42501 not_member', format('unknown user: expected 42501 not_member from dsales_team, got %s', v_e);

  -- บัญชีพนักงานจริงที่ไม่ใช่สมาชิก: dsales_me ตอบได้ ส่วน RPC ข้อมูลลูกค้าถูกปิด
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  select * into v_me from dsales.dsales_me();
  assert v_me.user_id = v_out and v_me.is_member = false and v_me.active = false and v_me.is_admin = false,
         'dsales_me must describe a non-member without raising';
  v_e := pg_temp.err_of('select dsales.dsales_register()');
  assert v_e = '42501 not_member', format('dsales_register: expected 42501 not_member, got %s', v_e);
  assert not exists (select 1 from dsales.dsales_members where user_id = v_out), 'dsales_register must not add members any more';
  foreach v_sql in array array[
    'select dsales.dsales_my_leads(1, 0)',
    'select dsales.dsales_customer_purchases(''0812345678'')',
    'select dsales.dsales_customer_channels(''0812345678'')',
    'select dsales.dsales_customer_chats(''0812345678'', null)',
    'select dsales.dsales_customer_pool_v3(null, 1, 0, null, null, null)'
  ] loop
    v_e := pg_temp.err_of(v_sql);
    assert v_e = '42501 not_member', format('%s: expected 42501 not_member, got %s', v_sql, v_e);
  end loop;

  -- สมาชิกที่ถูกปิดใช้งาน
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  update dsales.dsales_members set active = false where user_id = v_admin;
  select * into v_me from dsales.dsales_me();
  assert v_me.is_member and not v_me.active and not v_me.is_admin, 'inactive member: is_member true, active false';
  v_e := pg_temp.err_of('select dsales.dsales_team()');
  assert v_e = '42501 not_member', format('inactive member: expected 42501 not_member, got %s', v_e);
  update dsales.dsales_members set active = true where user_id = v_admin;

  -- หัวหน้า active
  select * into v_me from dsales.dsales_me();
  assert v_me.is_member and v_me.active and v_me.is_admin, 'active admin: is_member, active, is_admin all true';
  perform dsales.dsales_customer_channels('0000000000'); -- สมาชิกยังเรียกได้ (เบอร์ซ้ำตัวเดียวจึงไม่ค้นจริง)
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', 'nobody-' || gen_random_uuid() || '@example.invalid', 'sales'));
  assert v_e = 'P0001 user_not_found', format('unknown email: expected P0001 user_not_found, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_out_email, 'boss'));
  assert v_e = 'P0001 invalid_role', format('bad role: expected P0001 invalid_role, got %s', v_e);
  -- หัวหน้าคนเดียว: ลดบทบาทหรือปิดตัวเองไม่ได้ (ต้องเหลือหัวหน้า active อย่างน้อย 1 คน)
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_admin_email, 'sales'));
  assert v_e = 'P0001 last_admin', format('demoting the only admin: expected P0001 last_admin, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, false)', v_admin));
  assert v_e = 'P0001 last_admin', format('deactivating the only admin: expected P0001 last_admin, got %s', v_e);
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, true)', gen_random_uuid()));
  assert v_e = 'P0001 member_not_found', format('unknown member: expected P0001 member_not_found, got %s', v_e);

  v_j := dsales.dsales_add_member(upper(v_out_email), 'sales');
  assert (v_j ->> 'user_id')::uuid = v_out and v_j ->> 'role' = 'sales' and (v_j ->> 'active')::boolean,
         format('add_member returned role %s active %s', v_j ->> 'role', v_j ->> 'active');
  assert exists (select 1 from dsales.dsales_members where user_id = v_out and role = 'sales' and active),
         'add_member must insert an active sales member';
  perform dsales.dsales_set_member_active(v_out, false);
  assert exists (select 1 from dsales.dsales_members where user_id = v_out and not active), 'set_member_active(false) must deactivate';
  perform dsales.dsales_set_member_active(v_out, true);

  -- มีหัวหน้า 2 คน: ปิดตัวเองยังไม่ได้ แต่ลดบทบาทหัวหน้าอีกคนได้
  v_j := dsales.dsales_add_member(v_out_email, 'admin');
  assert v_j ->> 'role' = 'admin', format('promote: expected role admin, got %s', v_j ->> 'role');
  v_e := pg_temp.err_of(format('select dsales.dsales_set_member_active(%L::uuid, false)', v_admin));
  assert v_e = 'P0001 cannot_deactivate_self', format('self with another admin: expected P0001 cannot_deactivate_self, got %s', v_e);
  v_j := dsales.dsales_add_member(v_out_email, 'sales');
  assert v_j ->> 'role' = 'sales', format('demoting a second admin must work, got role %s', v_j ->> 'role');

  -- เซลล์ (ไม่ใช่หัวหน้า) เพิ่มสมาชิกไม่ได้
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  v_e := pg_temp.err_of(format('select dsales.dsales_add_member(%L, %L)', v_out_email, 'admin'));
  assert v_e = 'P0001 forbidden', format('sales adding a member: expected P0001 forbidden, got %s', v_e);

  -- สิทธิ์ execute
  assert not has_function_privilege('anon', 'dsales.dsales_me()', 'execute'), 'anon must not execute dsales_me';
  assert has_function_privilege('authenticated', 'dsales.dsales_me()', 'execute'), 'authenticated must execute dsales_me';
  assert not has_function_privilege('anon', 'dsales.dsales_add_member(text, text)', 'execute'), 'anon must not execute dsales_add_member';
  assert has_function_privilege('authenticated', 'dsales.dsales_set_member_active(uuid, boolean)', 'execute'),
         'authenticated must execute dsales_set_member_active';
end $$;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน** — `execute_sql` กับทั้งไฟล์

Expected: `ERROR: P0004: unknown user: expected 42501 not_member from dsales_team, got no error`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261117100000_dsales_members_only.sql`:

```sql
-- Next.js spec ข้อ 5: เข้าใช้ได้เฉพาะสมาชิกที่หัวหน้าเพิ่มไว้และ active
-- ฟังก์ชันทุกตัวที่เรียก dsales_uid() จึงปิดให้คนนอกทีม/คนที่ถูกปิดใช้งานทันที (helper ตัวเดียว)

-- 1) helper: ต้องล็อกอิน และต้องเป็นสมาชิก active
create or replace function dsales.dsales_uid() returns uuid
language plpgsql stable security definer set search_path = dsales, public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from dsales.dsales_members m where m.user_id = u and m.active) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return u;
end $$;

-- 2) ไม่เพิ่มสมาชิกเองอีก (คงชื่อไว้ให้หน้า legacy และ dsales_claim_customer ที่ยังเรียกอยู่)
create or replace function dsales.dsales_register() returns void
language plpgsql security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
end $$;

-- 3) dsales_me: ทุกคนที่ล็อกอินเรียกได้ (ไม่เรียก dsales_uid) และบอกว่าเป็นสมาชิก/active หรือไม่
--    คอลัมน์เดิม 4 ตัวอยู่หน้าและลำดับเดิม; เปลี่ยน return type จึงต้อง drop แล้วสร้างใหม่
drop function dsales.dsales_me();
create function dsales.dsales_me()
returns table(user_id uuid, email text, display_name text, is_admin boolean, is_member boolean, active boolean)
language sql stable security definer set search_path = dsales, public as $$
  select u.id, u.email::text,
         coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1)),
         coalesce(m.role = 'admin' and m.active, false),
         m.user_id is not null,
         coalesce(m.active, false)
  from auth.users u
  left join dsales.dsales_members m on m.user_id = u.id
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid() $$;

-- 4) หัวหน้าเพิ่มสมาชิกด้วยอีเมล (บัญชีต้องมีใน auth.users แล้ว) เพิ่มซ้ำ = เปิดใช้งาน + ตั้งบทบาทใหม่
create or replace function dsales.dsales_add_member(p_email text, p_role text default 'sales') returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_role text := lower(btrim(coalesce(p_role, ''))); v_user uuid; v_email text; v_name text; v_res jsonb;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if v_role not in ('sales', 'admin') then raise exception 'invalid_role'; end if;
  select u.id, u.email::text, coalesce(nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1))
    into v_user, v_email, v_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email::text) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if v_user is null then raise exception 'user_not_found'; end if;
  -- ลดบทบาทหัวหน้าเป็นเซลล์ได้เมื่อยังเหลือหัวหน้า active คนอื่น
  if v_role = 'sales'
     and exists (select 1 from dsales.dsales_members where user_id = v_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> v_user) then
    raise exception 'last_admin';
  end if;
  insert into dsales.dsales_members as m (user_id, role, display_name, active)
  values (v_user, v_role, v_name, true)
  on conflict (user_id) do update
    set role = excluded.role, active = true,
        display_name = coalesce(nullif(btrim(m.display_name), ''), excluded.display_name);
  select jsonb_build_object('user_id', m.user_id, 'email', v_email, 'display_name', m.display_name, 'role', m.role, 'active', m.active)
    into v_res
  from dsales.dsales_members m where m.user_id = v_user;
  return v_res;
end $$;

-- 5) หัวหน้าปิด/เปิดใช้งานสมาชิก: ต้องเหลือหัวหน้า active อย่างน้อย 1 คน (last_admin) และปิดตัวเองไม่ได้
--    ตรวจ last_admin ก่อน: หัวหน้าคนเดียวที่ปิดตัวเองได้ last_admin, มีหัวหน้าหลายคนได้ cannot_deactivate_self
create or replace function dsales.dsales_set_member_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not coalesce(p_active, false)
     and exists (select 1 from dsales.dsales_members where user_id = p_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> p_user) then
    raise exception 'last_admin';
  end if;
  if p_user = me and not coalesce(p_active, false) then raise exception 'cannot_deactivate_self'; end if;
  update dsales.dsales_members set active = coalesce(p_active, false) where user_id = p_user;
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- 6) RPC อ่านข้อมูลลูกค้าที่ยังไม่เรียก dsales_uid(): เพิ่มเงื่อนไขสมาชิก (ตัวฟังก์ชันอื่นเหมือนเดิมทุกตัวอักษร)
create or replace function dsales.dsales_customer_purchases(p_phone text)
returns table(txn_date date, bill_no text, order_no text, sku text, product_name text, quantity numeric, amount numeric)
language sql stable security definer set search_path = dsales, public as $$
  select l.txn_date, l.bill_no, l.order_no, l.sku, l.product_name, l.quantity, coalesce(l.amount, l.estimated_amount)
  from public.lendi_purchase_lines l
  where dsales.dsales_uid() is not null and nullif(btrim(p_phone), '') is not null and l.phone = btrim(p_phone)
  order by l.txn_date desc nulls last, l.sale_id
  limit 200;
$$;

create or replace function dsales.dsales_customer_channels(p_phone text)
returns table(platform text, shop text, orders bigint, last_order timestamp with time zone, chat_name text)
language sql stable security definer set search_path = dsales, public as $$
  select coalesce(s.platform,
           case lower(btrim(coalesce(o.platform, '')))
             when 'shopee' then 'shopee' when 'lazada' then 'lazada' when 'tiktok' then 'tiktok' when 'line' then 'line'
             when 'facebook' then 'facebook' when 'instagram' then 'instagram'
             when 'shopify' then 'website' when 'minishop' then 'website' when 'shopss' then 'website' when 'sapo' then 'website'
             else 'other' end) as platform,
         o.shop, count(*) as orders, max(o.created_at) as last_order,
         max(nullif(btrim(o.buyer_name), '')) as chat_name
  from public.order_tracking o
  left join cdp.shops s on s.shop = o.shop
  where dsales.dsales_uid() is not null
    and btrim(coalesce(p_phone, '')) ~ '^[0-9]{9,10}$' and btrim(p_phone) !~ '^(.)\1+$' and o.phone = btrim(p_phone)
  group by 1, 2
  order by max(o.created_at) desc nulls last
  limit 20;
$$;

create or replace function dsales.dsales_customer_chats(p_phone text, p_since timestamp with time zone default null)
returns table(ms_id bigint, channel text, page text, chat_name text, last_time timestamp with time zone, msg_count integer,
              admin_msgs bigint, last_admin_time timestamp with time zone, last_admin_sender text, last_customer_time timestamp with time zone)
language sql stable security definer set search_path = dsales, public as $$
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
  where dsales.dsales_uid() is not null and nullif(btrim(s.customer), '') is not null
  order by s.last_time desc nulls last
  limit 20;
$$;

create or replace function dsales.dsales_customer_pool_v3(p_search text default null, p_limit integer default 50, p_offset integer default 0,
                                                          p_from date default null, p_to date default null, p_brand text default null)
returns table(identity_id uuid, name text, phone text, chat_name text, segment text, rfm_segment text, ltv numeric, order_count integer,
              last_order_date date, brands text[], total_count bigint)
language sql stable security definer set search_path = dsales, public as $$
  with s as (select lower(btrim(coalesce(p_search, ''))) as t, regexp_replace(coalesce(p_search, ''), '\D', '', 'g') as d),
  q as (
    select ci.id, ci.display_name, ci.primary_phone, ci.segment, ci.rfm_segment,
           coalesce(v.ltv_thb, ci.ltv) as ltv_v, v.order_count as oc, v.last_order_date as lod
    from public.customer_identities ci
    left join public.lendi_customer_value v on v.phone = ci.primary_phone
    cross join s
    where dsales.dsales_uid() is not null
      and ci.primary_phone is not null and ci.primary_phone <> ''
      and (p_from is null or v.last_order_date >= p_from)
      and (p_to is null or v.last_order_date <= p_to)
      and (
        nullif(btrim(p_brand), '') is null
        or exists (select 1 from public.identity_brands ib2 join public.brands b2 on b2.id = ib2.brand_id
                   where ib2.identity_id = ci.id and b2.code = lower(btrim(p_brand)))
      )
      and (
        s.t = ''
        or (ci.display_name is not null and position(s.t in lower(ci.display_name)) > 0)
        or (s.d <> '' and ci.primary_phone like '%' || s.d || '%')
        or ci.primary_phone in (select l.phone from public.lendi_purchase_lines l
                                where l.bill_no is not null and position(s.t in lower(l.bill_no)) > 0
                                   or l.order_no is not null and position(s.t in lower(l.order_no)) > 0)
        or ci.primary_phone in (select coalesce(c.phone_normalized, c.phone) from public.lds_customers c
                                where c.jst_chat_name is not null and position(s.t in lower(c.jst_chat_name)) > 0
                                   or c.buyer_account is not null and position(s.t in lower(c.buyer_account)) > 0)
      )
  )
  select q.id, coalesce(nullif(btrim(q.display_name), ''), 'ไม่ระบุชื่อ'), q.primary_phone,
         (select max(c.jst_chat_name) from public.lds_customers c where coalesce(c.phone_normalized, c.phone) = q.primary_phone and c.jst_chat_name is not null),
         q.segment, q.rfm_segment, q.ltv_v, q.oc, q.lod,
         (select array_agg(b.code order by b.code) from public.identity_brands ib join public.brands b on b.id = ib.brand_id where ib.identity_id = q.id),
         count(*) over ()
  from q
  order by q.ltv_v desc nulls last, q.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 7) ข้อมูล: สมาชิกเดิมคนเดียว (บัญชีที่ใช้อยู่) = หัวหน้า active
update dsales.dsales_members set role = 'admin', active = true
where (select count(*) from dsales.dsales_members) = 1;

-- 8) สิทธิ์
revoke all on function dsales.dsales_me(), dsales.dsales_add_member(text, text), dsales.dsales_set_member_active(uuid, boolean)
  from public, anon;
grant execute on function dsales.dsales_me(), dsales.dsales_add_member(text, text), dsales.dsales_set_member_active(uuid, boolean)
  to authenticated, service_role;
```

- [ ] **Step 4: Dry run** — `execute_sql` ครั้งเดียวด้วยข้อความ `begin;` + ทั้งไฟล์ migration + ไฟล์ test โดยตัดบรรทัด `begin;` แรกและ `rollback;` สุดท้ายของ test ออก + `rollback;`

Expected: สำเร็จ ไม่มี error (ยังไม่มีอะไรเปลี่ยนใน DB เพราะ rollback)

- [ ] **Step 5: Apply** — `apply_migration` ชื่อ `dsales_members_only`

- [ ] **Step 6: รัน test ให้ผ่าน** — `execute_sql` กับ `supabase/tests/06_members_only.sql` Expected: สำเร็จ

- [ ] **Step 7: Regression** — รัน `supabase/tests/01_schema_move.sql`, `02_chat_messages_v.sql`, `03_chat_links.sql`, `05_base_rpcs.sql` ทีละไฟล์ (ไม่รัน `04*`) Expected: สำเร็จทุกไฟล์

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261117100000_dsales_members_only.sql supabase/tests/06_members_only.sql
git commit -m "feat(db): restrict Direct Sale to active members and add admin member RPCs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ย้าย prototype ไป `legacy/`

**Files:**
- Move: `index.html`, `app.js`, `styles.css`, `config.js`, `data.js`, `icons.js` → `legacy/`

- [ ] **Step 1: ย้ายด้วย git**

```bash
mkdir legacy
git mv index.html app.js styles.css config.js data.js icons.js legacy/
git status --short
```

Expected:

```
R  app.js -> legacy/app.js
R  config.js -> legacy/config.js
R  data.js -> legacy/data.js
R  icons.js -> legacy/icons.js
R  index.html -> legacy/index.html
R  styles.css -> legacy/styles.css
```

(`tools/`, `supabase/`, `docs/`, `README.md` อยู่ที่เดิม)

- [ ] **Step 2: ตรวจว่า prototype ยังเปิดได้** — `legacy/index.html` โหลดไฟล์ข้างเคียงแบบ relative path จึงใช้ได้เหมือนเดิม เปิด `legacy/index.html` ในเบราว์เซอร์ (ดับเบิลคลิกไฟล์) → เห็นหน้าล็อกอิน → กด "ดูตัวอย่างโดยไม่ล็อกอิน" → เห็นหน้า Direct Sale พร้อมตารางลีดตัวอย่าง (Task 9 เปิดด้วย `http-server` อัตโนมัติอีกครั้ง)

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: move the static prototype into legacy/" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: โครง Next.js 15

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/page.tsx`
- Generated: `package-lock.json`, `next-env.d.ts`

- [ ] **Step 1: `package.json` (scripts เท่านั้น dependency เพิ่มด้วย npm ใน Step 2)**

```json
{
  "name": "directsales-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: ติดตั้ง dependency (เวอร์ชันหลักเดียวกับ Inventory)**

```bash
npm install next@^15.3.0 react@^19.0.0 react-dom@^19.0.0 @supabase/ssr@^0.10.3 @supabase/supabase-js@^2.107.0
npm install -D typescript@^5 @types/node@^20 @types/react@^19 @types/react-dom@^19 tailwindcss@^3.4.1 postcss@^8 autoprefixer@^10.0.1 eslint@^9 eslint-config-next@^15.3.0 @eslint/eslintrc@^3 vitest@^3.2.4 @playwright/test@^1.55.0 http-server@^14.1.1
npm ls --depth=0
```

Expected: ทั้งสองคำสั่งจบด้วย `added … packages` ไม่มี `npm ERR!`; `npm ls --depth=0` แสดงทุกแพ็กเกจข้างบน ไม่มี `UNMET` / `invalid` และ `next@15.x`, `@supabase/ssr@0.10.x`, `tailwindcss@3.x` (เวอร์ชันย่อยที่ได้จริงดูจากผล `npm ls` — ถ้า range ใดหาไม่เจอ ให้ใช้ major ล่าสุดของแพ็กเกจนั้นแล้วจดเวอร์ชันใน commit message)

- [ ] **Step 3: ไฟล์ config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "legacy", "tools"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false, // ปุ่ม dev ของ Next บังมุมจอและทำให้ภาพเทียบกับ prototype ต่างกัน
};

export default nextConfig;
```

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // ห้าม reset ทับหน้าตาของ styles/prototype.css
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

`eslint.config.mjs`:

```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: ['legacy/**', 'tools/**', '.next/**', 'playwright-report/**', 'test-results/**', 'e2e/.legacy-shots/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
```

`vitest.config.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': root } },
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
});
```

`.gitignore`:

```
node_modules/
.next/
out/
.env*.local
.vercel
*.tsbuildinfo
test-results/
playwright-report/
e2e/.legacy-shots/
```

`.env.example`:

```
# คัดลอกเป็น .env.local แล้วใส่ค่า
# NEXT_PUBLIC_SUPABASE_ANON_KEY ใช้ชื่อเดียวกับโปรเจกต์ Inventory แต่ค่าคือ publishable key (sb_publishable_…) เดียวกับ key ใน legacy/config.js
NEXT_PUBLIC_SUPABASE_URL=https://nroyacasuchqniaiuirk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_JST_HELPER_URL=http://127.0.0.1:47321
NEXT_PUBLIC_JST_URL_TEMPLATE=
# 1 = โหมด fixture (มีผลเฉพาะ next dev) ข้ามการล็อกอินและใช้ข้อมูลตัวอย่างจาก legacy/data.js
NEXT_PUBLIC_FIXTURES=0
```

- [ ] **Step 4: หน้าเริ่มต้นขั้นต่ำ** (Task 4 แทน `app/layout.tsx` ด้วยตัวเต็ม)

`app/layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/leads');
}
```

- [ ] **Step 5: ตั้งค่า env ในเครื่อง (ไม่ commit)**

```bash
cp .env.example .env.local
grep "key:" legacy/config.js
```

นำค่าใน `key: '…'` ไปใส่ `NEXT_PUBLIC_SUPABASE_ANON_KEY=` ใน `.env.local`

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: มี `✓ Compiled successfully` และ `Linting and checking validity of types` ผ่าน ตาราง Route มี `/` และ `/_not-found`; ไฟล์ `next-env.d.ts` ถูกสร้าง (ถ้า Next แจ้งว่าปรับ `tsconfig.json` ให้ commit ไฟล์ที่ Next แก้แล้ว)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts .gitignore .env.example next-env.d.ts app/layout.tsx app/page.tsx
git commit -m "chore(web): scaffold Next.js 15 app with TypeScript, Tailwind (no preflight), Vitest and Playwright" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: CSS เดิม + ฟอนต์ + root layout

**Files:**
- Create: `styles/prototype.css`, `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: คัดลอก stylesheet แบบไบต์ต่อไบต์**

```bash
mkdir -p styles
cp legacy/styles.css styles/prototype.css
```

- [ ] **Step 2: ให้ตัวแปรฟอนต์ใช้ฟอนต์จาก `next/font` ก่อน** — ใน `styles/prototype.css` แก้ 2 บรรทัด (บรรทัด 28–29)

```css
  --font: "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", Tahoma, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
```

เป็น

```css
  --font: var(--font-plex-thai), "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", Tahoma, system-ui, sans-serif;
  --mono: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
```

Run: `diff --strip-trailing-cr legacy/styles.css styles/prototype.css`
Expected: มีแค่

```
28,29c28,29
<   --font: "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", Tahoma, system-ui, sans-serif;
<   --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
---
>   --font: var(--font-plex-thai), "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", Tahoma, system-ui, sans-serif;
>   --mono: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
```

- [ ] **Step 3: `app/globals.css`**

```css
/* Tailwind เฉพาะ components/utilities: ไม่มี @tailwind base (preflight ปิดใน tailwind.config.ts) หน้าตาหลักมาจาก styles/prototype.css */
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: `app/layout.tsx` ตัวเต็ม**

```tsx
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from 'next/font/google';
import '@/styles/prototype.css';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-plex-thai',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({ weight: '500', subsets: ['latin'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = { title: 'MPD Direct Sale' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

(ตัวแปร `--font-plex-*` อยู่บน `<html>` ซึ่งเป็น `:root` ตัวเดียวกับที่ประกาศ `--font` จึง resolve ได้)

- [ ] **Step 5: Build** (ต้องต่ออินเทอร์เน็ต `next/font` ดาวน์โหลดฟอนต์ตอน build)

Run: `npm run build`
Expected: `✓ Compiled successfully` ไม่มี error เรื่องฟอนต์

- [ ] **Step 6: Commit**

```bash
git add styles/prototype.css app/globals.css app/layout.tsx
git commit -m "feat(web): reuse the prototype stylesheet with IBM Plex fonts via next/font" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: helper และค่าคงที่ (Vitest)

**Files:**
- Create: `lib/format.ts`, `lib/constants.ts`, `lib/phone.ts`, `tools/port-legacy.mjs`
- Generated: `lib/icons.ts`
- Test: `lib/format.test.ts`, `lib/constants.test.ts`, `lib/phone.test.ts`, `lib/icons.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baht, fmtDate, fmtDT, localStamp, nowStamp, todayBangkok } from './format';

describe('baht', () => {
  it('formats numbers like the prototype (th-TH + ".-")', () => {
    expect(baht(1234.5)).toBe('1,234.5.-');
    expect(baht(1234567)).toBe('1,234,567.-');
    expect(baht('2490')).toBe('2,490.-');
  });
  it('treats empty values as 0', () => {
    expect(baht(0)).toBe('0.-');
    expect(baht(null)).toBe('0.-');
    expect(baht(undefined)).toBe('0.-');
  });
});

describe('fmtDate / fmtDT', () => {
  it('fmtDate drops leading zeros and keeps the Gregorian year', () => {
    expect(fmtDate('2026-11-04')).toBe('4/11/2026');
    expect(fmtDate('2026-01-09T10:20')).toBe('9/1/2026');
  });
  it('fmtDate shows a dash for empty values', () => {
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(null)).toBe('—');
  });
  it('fmtDT adds HH:MM only when the string has a time', () => {
    expect(fmtDT('2026-11-04T09:05')).toBe('4/11/2026 09:05');
    expect(fmtDT('2026-11-04')).toBe('4/11/2026');
    expect(fmtDT(null)).toBe('—');
  });
});

describe('Asia/Bangkok time', () => {
  it('todayBangkok switches date at Bangkok midnight', () => {
    expect(todayBangkok(new Date('2026-11-03T16:59:00Z'))).toBe('2026-11-03');
    expect(todayBangkok(new Date('2026-11-03T17:00:00Z'))).toBe('2026-11-04');
  });
  it('nowStamp is today + Bangkok HH:MM', () => {
    expect(nowStamp(new Date('2026-11-04T02:05:00Z'))).toBe('2026-11-04T09:05');
    expect(nowStamp(new Date('2026-11-04T02:05:00Z'), '2026-11-01')).toBe('2026-11-01T09:05');
  });
  it('localStamp converts server timestamps to Bangkok YYYY-MM-DDTHH:MM', () => {
    expect(localStamp('2026-11-04T02:05:00+00:00')).toBe('2026-11-04T09:05');
    expect(localStamp('2026-11-04T17:00:00.123456+00:00')).toBe('2026-11-05T00:00');
    expect(localStamp(null)).toBeNull();
    expect(localStamp('')).toBe('');
    expect(localStamp('not a date')).toBe('not a date');
  });
});
```

`lib/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeSearchPhone } from './phone';

describe('normalizeSearchPhone (same rules as dsales.dsales_norm_phone)', () => {
  it('converts +66 / 66 / 660 forms to 0xxxxxxxxx', () => {
    expect(normalizeSearchPhone('+66 81 234 5678')).toBe('0812345678');
    expect(normalizeSearchPhone('66812345678')).toBe('0812345678');
    expect(normalizeSearchPhone('660812345678')).toBe('0812345678');
  });
  it('strips dashes, spaces and brackets and adds the missing 0 to 9-digit mobiles', () => {
    expect(normalizeSearchPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeSearchPhone('812345678')).toBe('0812345678');
    expect(normalizeSearchPhone('(02) 123 4567')).toBe('021234567');
  });
  it('keeps partial numbers as digits', () => {
    expect(normalizeSearchPhone(' 0812 ')).toBe('0812');
  });
  it('leaves names and chat names untouched (trimmed)', () => {
    expect(normalizeSearchPhone('  สุภาพร ใจดี ')).toBe('สุภาพร ใจดี');
    expect(normalizeSearchPhone('baby_love101')).toBe('baby_love101');
    expect(normalizeSearchPhone('')).toBe('');
  });
});
```

`lib/constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CRIT, JST_HELPER_URL, MODES, PAGE, STATUS, TH_MONTHS } from './constants';

describe('constants copied from the prototype', () => {
  it('keeps labels and order', () => {
    expect(Object.keys(STATUS)).toEqual(['new', 'following', 'callback', 'won', 'lost', 'unreachable']);
    expect(STATUS.won).toBe('ปิดการขายแล้ว');
    expect(MODES.auto).toBe('เด้งเข้าเซลล์ที่ขายล่าสุด');
    expect(PAGE).toBe(50);
    expect(TH_MONTHS).toHaveLength(12);
    expect(TH_MONTHS[10]).toBe('พ.ย.');
    expect(Object.keys(CRIT)).toEqual(['product', 'total', 'dates', 'order', 'times']);
    expect(CRIT.times.fields).toEqual([['number', 'min', 'มากกว่ากี่ครั้ง']]);
  });
  it('defaults the JST helper to the local port', () => {
    expect(JST_HELPER_URL).toBe('http://127.0.0.1:47321');
  });
});
```

`lib/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DS_ICONS, iconSrc } from './icons';

describe('channel icons', () => {
  it('ports every legacy icon', () => {
    expect(Object.keys(DS_ICONS).sort()).toEqual(['facebook', 'instagram', 'lazada', 'line', 'other', 'shopee', 'tiktok', 'website']);
    expect(DS_ICONS.line).toMatch(/^data:image\/png;base64,/);
    expect(DS_ICONS.tiktok).toMatch(/^data:image\/svg\+xml/);
  });
  it('falls back to the "other" icon', () => {
    expect(iconSrc('shopee')).toBe(DS_ICONS.shopee);
    expect(iconSrc('myspace')).toBe(DS_ICONS.other);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL ทั้ง 4 ไฟล์ — `Error: Failed to resolve import "./format" from "lib/format.test.ts". Does the file exist?` (และแบบเดียวกันกับ `./phone`, `./constants`, `./icons`)

- [ ] **Step 3: `lib/format.ts`**

```ts
// ตัวจัดรูปแบบจาก prototype (legacy/app.js L6-8, L412, L941) — วันที่/เวลาคิดตาม Asia/Bangkok เสมอ ไม่ขึ้นกับเครื่อง
const TZ = 'Asia/Bangkok';
const bkk = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function bangkokParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(bkk.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const baht = (n: number | string | null | undefined): string => Number(n || 0).toLocaleString('th-TH') + '.-';

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${+d}/${+m}/${y}`;
}

export function fmtDT(s: string | null | undefined): string {
  if (!s) return '—';
  return fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '');
}

/** วันนี้ (YYYY-MM-DD) ตามเวลาไทย */
export const todayBangkok = (now: Date = new Date()): string => bangkokParts(now).date;

/** today + เวลาไทย HH:MM (prototype ใช้ today ของ state ซึ่งในโหมด fixture = 2026-11-04) */
export function nowStamp(now: Date = new Date(), today?: string): string {
  const p = bangkokParts(now);
  return `${today || p.date}T${p.time}`;
}

/** timestamptz จาก server → 'YYYY-MM-DDTHH:MM' เวลาไทย (ค่าว่าง/อ่านไม่ได้คืนค่าเดิม) */
export function localStamp(iso: string | null | undefined): string | null {
  if (!iso) return iso ?? null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = bangkokParts(d);
  return `${p.date}T${p.time}`;
}
```

- [ ] **Step 4: `lib/constants.ts`**

```ts
// ค่าคงที่จาก prototype (legacy/app.js) — ข้อความต้องตรงตัวอักษร
export const BRAND = { bebeplay: 'Bebeplay', hosttail: 'Hosttail' } as const;
export type Brand = keyof typeof BRAND;

export const STATUS = {
  new: 'ยังไม่ติดต่อ',
  following: 'กำลังติดตาม',
  callback: 'รอติดต่อ',
  won: 'ปิดการขายแล้ว',
  lost: 'ไม่สนใจ',
  unreachable: 'ติดต่อไม่ได้',
} as const;
export type LeadStatus = keyof typeof STATUS;

export const MODES = { self: 'เซลล์จองเอง', assign: 'หัวหน้ามอบหมาย', auto: 'เด้งเข้าเซลล์ที่ขายล่าสุด' } as const;
export type ClaimMode = keyof typeof MODES;

export type Role = 'admin' | 'sales';

export const PLAT = {
  shopee: 'Shopee', line: 'LINE', facebook: 'Facebook', lazada: 'Lazada',
  tiktok: 'TikTok', instagram: 'Instagram', website: 'เว็บไซต์', other: 'อื่นๆ',
} as const;
export type Platform = keyof typeof PLAT;

export const PAGE = 50;

export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;

export type CritType = 'product' | 'total' | 'dates' | 'order' | 'times';
export type CritField = readonly ['text' | 'number' | 'date', string, string];
export const CRIT: Record<CritType, { label: string; fields: readonly CritField[] }> = {
  product: { label: 'เคยซื้อสินค้า (ชื่อ / SKU)', fields: [['text', 'kw', 'เช่น เตียงนอน หรือ BBP-BED']] },
  total: { label: 'ยอดซื้อรวม (บาท)', fields: [['number', 'min', 'ตั้งแต่'], ['number', 'max', 'ถึง']] },
  dates: { label: 'ซื้อเมื่อ (ช่วงวันที่)', fields: [['date', 'from', 'ตั้งแต่วันที่'], ['date', 'to', 'ถึงวันที่']] },
  order: { label: 'ยอดสั่งซื้อต่อบิลตั้งแต่ (บาท)', fields: [['number', 'min', 'ตั้งแต่ขึ้นไป']] },
  times: { label: 'ซื้อมากกว่า (ครั้ง)', fields: [['number', 'min', 'มากกว่ากี่ครั้ง']] },
};

export const JST_HELPER_URL = process.env.NEXT_PUBLIC_JST_HELPER_URL || 'http://127.0.0.1:47321';
export const JST_URL_TEMPLATE = process.env.NEXT_PUBLIC_JST_URL_TEMPLATE || '';

/** path ของ SVG 24x24 ที่ prototype ใช้ (index.html และ app.js) + เมนูใหม่ 2 รายการ */
export const PATHS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  grid: 'M3 3h8v10H3zm10 0h8v6h-8zM3 15h8v6H3zm10-4h8v10h-8z',
  gear: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  person: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z',
  list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
  logout: 'M10 17l1.4-1.4L8.8 13H20v-2H8.8l2.6-2.6L10 7l-5 5zM4 4h8V2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8v-2H4z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  chat: 'M4 4h16v12H7l-3 3z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
} as const;
```

- [ ] **Step 5: `lib/phone.ts`**

```ts
/**
 * แปลงคำค้นที่เป็นเบอร์ (+66 / 66 / ขีด / ช่องว่าง / วงเล็บ) เป็นรูป 0xxxxxxxxx ตามกติกาเดียวกับ dsales.dsales_norm_phone
 * คำค้นที่มีตัวอักษรอื่น (ชื่อ, ชื่อแชต, เลขบิลที่มีตัวอักษร) คืนค่าเดิมที่ trim แล้ว
 */
export function normalizeSearchPhone(q: string): string {
  const t = q.trim();
  if (!t || !/^[0-9+\-\s().]+$/.test(t)) return t;
  const d = t.replace(/\D/g, '');
  if (/^660?\d{9}$/.test(d)) return '0' + d.slice(-9);
  if (/^[689]\d{8}$/.test(d)) return '0' + d;
  return d;
}
```

- [ ] **Step 6: สคริปต์แปลงไฟล์ legacy** (ใช้ทั้งไอคอนตอนนี้และ fixture ใน Task 9)

`tools/port-legacy.mjs`:

```js
#!/usr/bin/env node
// แปลงไฟล์ prototype ใน legacy/ เป็น TypeScript ให้เว็บ Next.js ใช้ (ไฟล์ผลลัพธ์ห้ามแก้มือ รันใหม่ได้เสมอ)
//   node tools/port-legacy.mjs icons                      → lib/icons.ts
//   TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures   → lib/fixtures/data.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';

function loadLegacy(file, key) {
  const window = {};
  runInNewContext(readFileSync(file, 'utf8'), { window }, { filename: file });
  if (!window[key]) throw new Error(`${file} did not set window.${key}`);
  return window[key];
}

function write(out, body) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body);
  console.log(`wrote ${out} (${Buffer.byteLength(body)} bytes)`);
}

// เหมือน applyAuto ของ prototype (legacy/app.js L81-87) ที่รันใน route() ครั้งแรกของโหมดตัวอย่าง
function applyDemoAuto(data) {
  const reps = new Set(data.reps.map((r) => r.id));
  for (const c of data.campaigns.filter((x) => x.claimMode === 'auto')) {
    for (const l of data.leads.filter((x) => x.campaignId === c.id && !x.owner && !x.noCall && !x.autoSkip)) {
      const seller = l.purchases.find((p) => p.seller && reps.has(p.seller))?.seller || null;
      if (seller && !(l.releasedBy || []).includes(seller)) l.owner = seller;
    }
  }
  return data;
}

const what = process.argv[2];
if (what === 'icons') {
  const icons = loadLegacy('legacy/icons.js', 'DS_ICONS');
  write('lib/icons.ts',
    '/* สร้างจาก legacy/icons.js ด้วย `node tools/port-legacy.mjs icons` ห้ามแก้มือ */\n' +
    `export const DS_ICONS: Record<string, string> = ${JSON.stringify(icons, null, 1)};\n\n` +
    "export const iconSrc = (platform: string): string => DS_ICONS[platform] || DS_ICONS.other || '';\n");
} else if (what === 'fixtures') {
  if (new Date('2026-11-04T09:00:00').getTimezoneOffset() !== -420) {
    console.error('ต้องรันด้วย TZ=Asia/Bangkok (เช่น TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures) ให้วันที่ตรงกับ prototype ที่ Playwright เปิดในเขตเวลา Asia/Bangkok');
    process.exit(1);
  }
  const data = applyDemoAuto(loadLegacy('legacy/data.js', 'DS_DATA'));
  write('lib/fixtures/data.ts',
    '/* สร้างจาก legacy/data.js (หลัง applyAuto ครั้งแรก) ด้วย `TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures` ห้ามแก้มือ */\n' +
    "import type { FixtureData } from './types';\n\n" +
    `export const FIXTURE_DATA: FixtureData = ${JSON.stringify(data, null, 1)};\n`);
} else {
  console.error('usage: node tools/port-legacy.mjs icons|fixtures');
  process.exit(1);
}
```

- [ ] **Step 7: สร้าง `lib/icons.ts`**

Run: `node tools/port-legacy.mjs icons`
Expected: `wrote lib/icons.ts (… bytes)` (ประมาณ 17,000 bytes) และไฟล์ขึ้นต้นด้วย `/* สร้างจาก legacy/icons.js`

- [ ] **Step 8: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  4 passed (4)` · `Tests  16 passed (16)`

- [ ] **Step 9: Typecheck** — Run: `npm run typecheck` Expected: ไม่มี output (exit 0)

- [ ] **Step 10: Commit**

```bash
git add lib/format.ts lib/constants.ts lib/phone.ts lib/icons.ts lib/format.test.ts lib/constants.test.ts lib/phone.test.ts lib/icons.test.ts tools/port-legacy.mjs
git commit -m "feat(web): port prototype formatters, constants, channel icons and phone search normalization" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Supabase client, middleware, หน้าล็อกอิน, การ์ดยังไม่มีสิทธิ์

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`, `app/login/page.tsx`, `app/login/LoginForm.tsx`, `components/auth/NoAccess.tsx`

- [ ] **Step 1: `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

/** client ฝั่งเบราว์เซอร์ (session เก็บใน cookie ผ่าน @supabase/ssr ใช้ร่วมกับ middleware; ในเบราว์เซอร์เป็น singleton) */
export function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** ข้อมูล Direct Sale ทั้งหมดอยู่ใน schema dsales (supabase() ใช้เฉพาะ auth) */
export function db() {
  return supabase().schema('dsales');
}
```

- [ ] **Step 2: `lib/supabase/server.ts`** (แบบเดียวกับ Inventory ใช้ใน Server Component ภายหลัง)

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component set cookie ไม่ได้ — middleware ต่ออายุ session ให้แล้ว
        }
      },
    },
  });
}
```

- [ ] **Step 3: `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() ต่ออายุ session ใน cookie (ห้ามมีโค้ดอื่นคั่นระหว่าง createServerClient กับบรรทัดนี้)
  const { data: { user } } = await supabase.auth.getUser();
  const onLogin = request.nextUrl.pathname.startsWith('/login');
  if (!user && !onLogin) return redirectKeepingCookies(request, response, '/login');
  if (user && onLogin) return redirectKeepingCookies(request, response, '/leads');
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)'],
};
```

- [ ] **Step 4: หน้าล็อกอิน (markup เดียวกับ `#login` ใน `legacy/index.html` ไม่มีปุ่มดูตัวอย่าง)**

`app/login/page.tsx`:

```tsx
import LoginForm from './LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
```

`app/login/LoginForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setErr('');
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error || !data?.user) {
        setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
    } catch {
      setBusy(false);
      setErr('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return;
    }
    router.replace('/leads');
    router.refresh();
  }

  return (
    <div className="login" id="login">
      <form className="login-card" id="login-form" onSubmit={onSubmit}>
        <div className="brand-name">MPD Direct Sale</div>
        <p className="help">เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ลงทะเบียนไว้ใน Supabase</p>
        <div className="field">
          <label htmlFor="l-email">อีเมล</label>
          <input className="input" id="l-email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="l-pass">รหัสผ่าน</label>
          <input className="input" id="l-pass" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div className="login-err" id="l-err" role="alert" hidden={!err}>{err}</div>
        <button className="btn primary" id="l-submit" disabled={busy}>เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: `components/auth/NoAccess.tsx`** (การ์ดแบบ `.login-card` ใช้ทั้งตอนกำลังโหลด / ยังไม่มีสิทธิ์ / โหลดไม่สำเร็จ)

```tsx
'use client';

export const LOADING_TEXT = 'กำลังโหลดข้อมูล…';
export const NO_ACCESS_TEXT = 'ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า';
export const INACTIVE_TEXT = 'บัญชีนี้ถูกปิดใช้งาน ติดต่อหัวหน้า';

interface Props {
  message: string;
  email?: string;
  isError?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
}

export function NoAccess({ message, email, isError = false, onRetry, onLogout }: Props) {
  return (
    <div className="login" id="no-access">
      <div className="login-card">
        <div className="brand-name">MPD Direct Sale</div>
        {isError ? <div className="login-err" role="alert">{message}</div> : <p className="help">{message}</p>}
        {email ? <p className="help">บัญชีที่ใช้อยู่: {email}</p> : null}
        {onRetry ? <button className="btn primary" type="button" onClick={onRetry}>ลองใหม่</button> : null}
        {onLogout ? (
          <button className={onRetry ? 'btn' : 'btn primary'} type="button" id="logout" onClick={onLogout}>ออกจากระบบ</button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Build** — Run: `npm run build` Expected: สำเร็จ ตาราง Route มี `○ /login` และมี `ƒ Middleware`

- [ ] **Step 7: ตรวจ redirect** — เปิด `npm run dev` ในอีก terminal แล้วรัน

```bash
curl -sI http://localhost:3000/leads | grep -iE "^(HTTP|location)"
```

Expected:

```
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3000/login
```

และ `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login` ได้ `200` (ถ้ามีบัญชีจริง: ล็อกอินที่ http://localhost:3000/login ได้แล้วไปที่ `/leads` ซึ่งยังเป็น 404 จนถึง Task 8 — ปกติ) ปิด dev server

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts middleware.ts app/login/page.tsx app/login/LoginForm.tsx components/auth/NoAccess.tsx
git commit -m "feat(web): add cookie-based Supabase login, auth middleware and no-access card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ชั้นเรียก API (type, mapper, error, RPC)

**Files:**
- Create: `lib/api/types.ts`, `lib/api/map.ts`, `lib/api/errors.ts`, `lib/api/rpc.ts`, `lib/api/test-helpers.ts`
- Test: `lib/api/map.test.ts`, `lib/api/errors.test.ts`, `lib/api/rpc.test.ts`

- [ ] **Step 1: `lib/api/types.ts`** (type ล้วน ไม่มี logic)

```ts
import type { Brand, ClaimMode, CritType, LeadStatus, Role } from '@/lib/constants';

export type { Brand, ClaimMode, LeadStatus, Role } from '@/lib/constants';
export type LeadSource = 'self' | 'campaign';
export type ContactType = 'call' | 'chat';

export interface Channel { shop?: string; chat?: string; chat_name?: string; platform?: string; ms_id?: number | string | null }

/** รายการใน interactions ของ dsales_lead_json (ล่าสุด 30 รายการ เรียงเก่า→ใหม่) */
export interface InteractionJson {
  id: string; type: ContactType; date: string; rep: string | null;
  result: string | null; note: string | null; due: string | null; bills: string[] | null;
}
export interface Interaction {
  id: string; type: ContactType; date: string; rep: string | null;
  result: string; note: string; due?: string | null; bills?: string[] | null;
}

export interface Purchase { date: string; bill: string; sku: string; product: string; amount: number; seller: string | null }
export interface ChatCheck { at: string; sent: boolean; count: number }

/** ผลของ dsales.dsales_lead_json (supabase/migrations/20261117090100_dsales_schema_move.sql) */
export interface LeadJson {
  id: string; name: string; phone: string; address: string | null; shop: string | null; chatName: string | null; channels: Channel[] | null;
  brand: Brand; source: LeadSource; campaignId: string | null; owner: string | null; status: LeadStatus; callback: string | null;
  interest: string | null; closedBills: string[] | null; closedAmount: number | null; closedAt: string | null;
  claimedBy: string | null; claimedAt: string | null; noCall: boolean; noCallBy: string | null; noCallAt: string | null;
  releasedBy: string[] | null; autoSkip: boolean; identityId: string | null;
  bills: string[] | null; total: number | null; lastBuy: string | null; orders: number | null;
  interactions: InteractionJson[] | null;
}

/** ลีดใน state ฝั่ง client (หลัง mapLead หรือจาก fixture) */
export interface Lead {
  id: string; name: string; phone: string; address: string; shop: string; chatName: string; channels: Channel[];
  brand: Brand; source: LeadSource; campaignId: string | null; owner: string | null; status: LeadStatus; callback: string | null;
  interest: string; closedBills: string[]; closedAmount: number | null; closedAt: string | null;
  claimedBy?: string | null; claimedAt?: string | null; claimedAtIso?: string | null;
  noCall?: boolean; noCallBy?: string | null; noCallAt?: string | null; releasedBy?: string[]; autoSkip?: boolean; identityId?: string | null;
  bills?: string[]; total?: number | null; lastBuy?: string | null; orders?: number | null;
  interactions: Interaction[]; purchases: Purchase[];
  _pl?: 'loading' | 'done'; chatCheck?: ChatCheck | null;
}

export interface CampaignCriterion { type: CritType; kw?: string; min?: string; max?: string; from?: string; to?: string }
export interface CampaignRow {
  id: string; brand: Brand; name: string; description: string | null; start_date: string | null; end_date: string | null;
  claim_mode: ClaimMode; max_per_rep: number | null; active: boolean | null; criteria: CampaignCriterion[] | null; created_at?: string;
}
export type NewCampaign = Omit<CampaignRow, 'id' | 'created_at'>;
export interface Campaign {
  id: string; brand: Brand; name: string; note: string; start: string; end: string;
  claimMode: ClaimMode; maxPerRep: number | null; active: boolean; criteria: CampaignCriterion[];
}

export interface MeRow { user_id: string; email: string; display_name: string; is_admin: boolean; is_member: boolean; active: boolean }
export interface TeamRow { user_id: string; display_name: string | null; role: string; active: boolean; email: string | null }
export interface Rep { id: string; name: string; initials: string; role: Role; email?: string; active?: boolean }
export interface MemberJson { user_id: string; email: string; display_name: string; role: Role; active: boolean }

/** แถวของ dsales_customer_pool_v3/_v4 และ dsales_base_customers (2 คอลัมน์ท้ายมีเฉพาะ base_customers) */
export interface PoolRowJson {
  identity_id: string | null; name: string; phone: string; chat_name: string | null; segment: string | null; rfm_segment: string | null;
  ltv: number | string | null; order_count: number | null; last_order_date: string | null; brands: string[] | null;
  total_count: number | string; lead_id?: string | null; taken?: boolean; mine?: boolean; no_call?: boolean; reserved_by?: string | null;
  dormant_days?: number | null; owner_tag?: string | null;
}
export interface PoolRow {
  id: string; name: string; phone: string; segment: string; ltv: number; orders: number; last: string | null; brands: string[];
  chat: string; leadId: string | null; mine: boolean; noCall: boolean; takenName: string; taken: string | null;
  dormantDays: number | null; ownerTag: string | null;
}

export interface PurchaseRowJson {
  txn_date: string | null; bill_no: string | null; order_no: string | null; sku: string | null;
  product_name: string | null; quantity: number | null; amount: number | null;
}
export interface ChannelRowJson { platform: string; shop: string | null; orders: number; last_order: string | null; chat_name: string | null }
export interface ChatSessionJson {
  ms_id: number; channel: string | null; page: string | null; chat_name: string | null; last_time: string | null; msg_count: number | null;
  admin_msgs: number; last_admin_time: string | null; last_admin_sender: string | null; last_customer_time: string | null;
}
export interface JstTagRow { tag: string; sessions: number }
export interface MemberTagsRow { user_id: string; jst_tags: string[] }
```

- [ ] **Step 2: `lib/api/test-helpers.ts`** (ข้อมูลตัวอย่างรูปเดียวกับ `dsales_lead_json` ใช้ใน test)

```ts
import type { LeadJson } from './types';

export function leadJson(over: Partial<LeadJson> = {}): LeadJson {
  return {
    id: 'L1', name: 'สุภาพร ใจดี', phone: '0812345678', address: 'เขตบางนา', shop: 'SH_bebeplay', chatName: 'baby_love101_sh',
    channels: [{ shop: 'SH_bebeplay', chat: 'baby_love101_sh' }], brand: 'bebeplay', source: 'self', campaignId: null, owner: 'u1',
    status: 'following', callback: null, interest: 'เตียงนอนเด็ก', closedBills: [], closedAmount: null, closedAt: null,
    claimedBy: 'u1', claimedAt: '2026-11-04T02:05:00.123456+00:00', noCall: false, noCallBy: null, noCallAt: null, releasedBy: [],
    autoSkip: false, identityId: null, bills: ['310001'], total: 2490, lastBuy: '2026-10-01', orders: 1,
    interactions: [{ id: 'i1', type: 'call', date: '2026-11-04T03:00:00+00:00', rep: 'u1', result: null, note: null, due: null, bills: null }],
    ...over,
  };
}
```

- [ ] **Step 3: เขียน test ที่ยังไม่ผ่าน**

`lib/api/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toThaiError } from './errors';

describe('toThaiError', () => {
  it('maps every prototype LIVE_ERR key', () => {
    expect(toThaiError('taken')).toBe('ลูกค้ารายนี้มีคนจองไปแล้ว');
    expect(toThaiError('no_call')).toBe('ลูกค้ารายนี้ไม่สะดวกให้โทร');
    expect(toThaiError('forbidden')).toBe('ไม่มีสิทธิ์ทำรายการนี้');
    expect(toThaiError('bill_required')).toBe('ใส่เลขบิลก่อนปิดการขาย');
    expect(toThaiError('not_found')).toBe('ไม่พบข้อมูลรายการนี้');
    expect(toThaiError('invalid_phone')).toBe('เบอร์โทรของลูกค้าไม่ถูกต้อง');
    expect(toThaiError('invalid_user')).toBe('ผู้ใช้ไม่ถูกต้อง');
    expect(toThaiError('invalid_brand')).toBe('ไม่ทราบแบรนด์ของการจอง');
  });
  it('does not let not_found shadow the longer *_not_found keys', () => {
    expect(toThaiError('customer_not_found')).toBe('ไม่พบลูกค้ารายนี้');
    expect(toThaiError('member_not_found')).toBe('ไม่พบเซลล์รายนี้ในทีม');
    expect(toThaiError('user_not_found')).toBe('ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ');
  });
  it('maps membership errors', () => {
    expect(toThaiError('not_member')).toBe('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า');
    expect(toThaiError('not_authenticated')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
    expect(toThaiError('invalid_role')).toBe('บทบาทไม่ถูกต้อง');
    expect(toThaiError('cannot_deactivate_self')).toBe('ปิดใช้งานบัญชีของตัวเองไม่ได้');
    expect(toThaiError('last_admin')).toBe('ต้องมีหัวหน้าอย่างน้อย 1 คน');
  });
  it('names the tag in tag_taken', () => {
    expect(toThaiError('tag_taken: Admin_Ploy')).toBe('tag Admin_Ploy เป็นของเซลล์คนอื่นแล้ว');
  });
  it('finds the key inside a longer message', () => {
    expect(toThaiError('ERROR: not_member (SQLSTATE 42501)')).toBe('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า');
  });
  it('falls back to the raw message, or a generic text', () => {
    expect(toThaiError('JWT expired')).toBe('JWT expired');
    expect(toThaiError('constructor')).toBe('constructor');
    expect(toThaiError('')).toBe('ทำรายการไม่สำเร็จ');
    expect(toThaiError(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
});
```

`lib/api/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReps, mapCampaign, mapChannel, mapLead, mapPoolRow, mapPurchase, rowsTotal, upsertLead } from './map';
import { leadJson } from './test-helpers';
import type { CampaignRow, MeRow, PoolRowJson, TeamRow } from './types';

describe('mapLead', () => {
  it('fills prototype defaults and starts with no purchases', () => {
    const l = mapLead(leadJson({ address: null, shop: null, chatName: null, channels: null, interest: null, closedBills: null, releasedBy: null, bills: null, interactions: null }));
    expect(l).toMatchObject({ address: '', shop: '', chatName: '', channels: [], interest: '', closedBills: [], releasedBy: [], bills: [], purchases: [], interactions: [] });
  });
  it('converts claimedAt and interaction dates to Bangkok stamps and keeps the raw claim time', () => {
    const l = mapLead(leadJson());
    expect(l.claimedAt).toBe('2026-11-04T09:05');
    expect(l.claimedAtIso).toBe('2026-11-04T02:05:00.123456+00:00');
    expect(l.interactions[0]).toMatchObject({ date: '2026-11-04T10:00', note: '', result: '' });
  });
});

describe('upsertLead', () => {
  it('adds a new lead at the top', () => {
    const next = upsertLead([mapLead(leadJson({ id: 'L0' }))], leadJson({ id: 'L1' }));
    expect(next.map((l) => l.id)).toEqual(['L1', 'L0']);
  });
  it('replaces an existing lead but keeps purchases, _pl and chatCheck', () => {
    const old = {
      ...mapLead(leadJson()),
      purchases: [{ date: '2026-10-01', bill: '310001', sku: 'BBP-BED-03', product: 'เตียงนอนไม้', amount: 3290, seller: null }],
      _pl: 'done' as const,
      chatCheck: { at: '2026-11-04T09:10', sent: true, count: 2 },
    };
    const [l] = upsertLead([old], leadJson({ status: 'won' }));
    expect(l.status).toBe('won');
    expect(l.purchases).toBe(old.purchases);
    expect(l._pl).toBe('done');
    expect(l.chatCheck).toEqual({ at: '2026-11-04T09:10', sent: true, count: 2 });
  });
  it('does not mutate the input array', () => {
    const list = [mapLead(leadJson())];
    const copy = [...list];
    upsertLead(list, leadJson({ status: 'lost' }));
    expect(list).toEqual(copy);
    expect(list[0].status).toBe('following');
  });
});

describe('mapCampaign', () => {
  const row: CampaignRow = {
    id: 'c1', brand: 'hosttail', name: 'Hosttail Q4', description: 'โปรห้องน้ำแมว', start_date: '2026-11-01', end_date: '2026-11-30',
    claim_mode: 'auto', max_per_rep: 20, active: true, criteria: [{ type: 'times', min: '2' }], created_at: '2026-11-01T00:00:00+00:00',
  };
  it('maps columns and turns auto into self (live behaviour of the prototype)', () => {
    expect(mapCampaign(row)).toEqual({
      id: 'c1', brand: 'hosttail', name: 'Hosttail Q4', note: 'โปรห้องน้ำแมว', start: '2026-11-01', end: '2026-11-30',
      claimMode: 'self', maxPerRep: 20, active: true, criteria: [{ type: 'times', min: '2' }],
    });
  });
  it('fills empty optional columns', () => {
    expect(mapCampaign({ ...row, description: null, start_date: null, end_date: null, claim_mode: 'assign', max_per_rep: null, active: null, criteria: null }))
      .toMatchObject({ note: '', start: '', end: '', claimMode: 'assign', maxPerRep: null, active: true, criteria: [] });
  });
});

describe('mapPoolRow', () => {
  const pr = (over: Partial<PoolRowJson> = {}): PoolRowJson => ({
    identity_id: 'id-1', name: 'สุภาพร', phone: '0812345678', chat_name: null, segment: 'Loyal', rfm_segment: null, ltv: '12345.50',
    order_count: 3, last_order_date: '2026-09-01', brands: ['bebeplay'], total_count: '120', lead_id: null, taken: false, mine: false,
    no_call: false, reserved_by: null, ...over,
  });
  it('maps taken to me / other / null like the prototype', () => {
    expect(mapPoolRow(pr({ taken: true, mine: true }), 'u1').taken).toBe('u1');
    expect(mapPoolRow(pr({ taken: true, mine: false, reserved_by: 'กมลชนก' }), 'u1')).toMatchObject({ taken: 'other', takenName: 'กมลชนก' });
    expect(mapPoolRow(pr(), 'u1').taken).toBeNull();
  });
  it('normalizes numbers, segment and missing values', () => {
    expect(mapPoolRow(pr({ rfm_segment: 'Champions', dormant_days: 45, owner_tag: 'Admin_Ploy' }), 'u1')).toMatchObject({
      id: 'id-1', segment: 'Champions', ltv: 12345.5, orders: 3, chat: '', brands: ['bebeplay'], noCall: false, dormantDays: 45, ownerTag: 'Admin_Ploy',
    });
    expect(mapPoolRow(pr({ identity_id: null, segment: null, ltv: null, order_count: null, brands: null }), 'u1')).toMatchObject({
      id: '0812345678', segment: '', ltv: 0, orders: 0, brands: [], dormantDays: null, ownerTag: null,
    });
  });
  it('rowsTotal reads total_count from the first row', () => {
    expect(rowsTotal([pr(), pr()])).toBe(120);
    expect(rowsTotal([])).toBe(0);
  });
});

describe('buildReps', () => {
  const team: TeamRow[] = [
    { user_id: 'u1', display_name: 'หัวหน้าเอ', role: 'admin', active: true, email: 'a@example.com' },
    { user_id: 'u2', display_name: null, role: 'sales', active: true, email: 'sale.b@example.com' },
  ];
  const me: MeRow = { user_id: 'u1', email: 'a@example.com', display_name: 'Dev MPD', is_admin: true, is_member: true, active: true };
  it('maps team rows (name falls back to the email prefix, initials uppercase)', () => {
    expect(buildReps(team, me)[1]).toEqual({ id: 'u2', name: 'sale.b', initials: 'SA', role: 'sales', email: 'sale.b@example.com', active: true });
  });
  it('uses dsales_me for my own name, initials and role, adding me if missing', () => {
    expect(buildReps(team, me)[0]).toMatchObject({ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' });
    const reps = buildReps([team[1]], { ...me, user_id: 'u9', is_admin: false });
    expect(reps).toHaveLength(2);
    expect(reps[1]).toMatchObject({ id: 'u9', name: 'Dev MPD', role: 'sales' });
  });
});

describe('mapPurchase / mapChannel', () => {
  it('maps purchase and channel rows like the prototype', () => {
    expect(mapPurchase({ txn_date: '2026-10-01', bill_no: null, order_no: 'SO-1', sku: 'BBP-BED-03', product_name: 'เตียงนอนไม้', quantity: 1, amount: 3290 }))
      .toEqual({ date: '2026-10-01', bill: 'SO-1', sku: 'BBP-BED-03', product: 'เตียงนอนไม้', amount: 3290, seller: null });
    expect(mapChannel({ platform: 'line', shop: 'LOA_bebeplay', orders: 2, last_order: null, chat_name: null }))
      .toEqual({ platform: 'line', shop: 'LOA_bebeplay', chat: '' });
  });
});
```

`lib/api/rpc.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc }) }));

import { addMember, claimCustomer, getBaseCustomers, getMe } from './rpc';

beforeEach(() => rpc.mockReset());

describe('rpc wrappers', () => {
  it('getMe returns the first row, or null', async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: 'u1' }], error: null });
    await expect(getMe()).resolves.toEqual({ user_id: 'u1' });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(getMe()).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith('dsales_me', undefined);
  });
  it('passes RPC argument names exactly', async () => {
    rpc.mockResolvedValue({ data: { id: 'L1' }, error: null });
    await claimCustomer('0812345678', 'hosttail');
    expect(rpc).toHaveBeenCalledWith('dsales_claim_customer', { p_phone: '0812345678', p_brand: 'hosttail' });
    await addMember('  sale@example.com ', 'sales');
    expect(rpc).toHaveBeenLastCalledWith('dsales_add_member', { p_email: 'sale@example.com', p_role: 'sales' });
  });
  it('normalizes phone searches for mine/pool', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getBaseCustomers('pool', { search: '+66 81-234-5678', brand: 'bebeplay' });
    expect(rpc).toHaveBeenCalledWith('dsales_base_customers', { p_scope: 'pool', p_search: '0812345678', p_limit: 50, p_offset: 0, p_brand: 'bebeplay' });
    await getBaseCustomers('mine', { search: '  ' });
    expect(rpc).toHaveBeenLastCalledWith('dsales_base_customers', { p_scope: 'mine', p_search: null, p_limit: 50, p_offset: 0, p_brand: null });
  });
  it('throws the Thai message of the RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'customer_not_found' } });
    await expect(claimCustomer('0812345678', 'bebeplay')).rejects.toThrow('ไม่พบลูกค้ารายนี้');
  });
});
```

- [ ] **Step 4: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL 3 ไฟล์ — `Failed to resolve import "./errors"`, `"./map"`, `"./rpc"` (4 ไฟล์ของ Task 5 ยังผ่าน)

- [ ] **Step 5: `lib/api/errors.ts`**

```ts
/** ข้อความไทยของ error จาก RPC ใน schema dsales (เทียบทั้ง token จึงไม่มี key ไหนทับกัน ต่างจาก prototype ที่เทียบ substring) */
export const ERROR_TEXT: Readonly<Record<string, string>> = {
  taken: 'ลูกค้ารายนี้มีคนจองไปแล้ว',
  no_call: 'ลูกค้ารายนี้ไม่สะดวกให้โทร',
  forbidden: 'ไม่มีสิทธิ์ทำรายการนี้',
  bill_required: 'ใส่เลขบิลก่อนปิดการขาย',
  not_found: 'ไม่พบข้อมูลรายการนี้',
  invalid_phone: 'เบอร์โทรของลูกค้าไม่ถูกต้อง',
  customer_not_found: 'ไม่พบลูกค้ารายนี้',
  invalid_user: 'ผู้ใช้ไม่ถูกต้อง',
  invalid_brand: 'ไม่ทราบแบรนด์ของการจอง',
  member_not_found: 'ไม่พบเซลล์รายนี้ในทีม',
  not_authenticated: 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
  not_member: 'บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า',
  user_not_found: 'ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ',
  invalid_role: 'บทบาทไม่ถูกต้อง',
  cannot_deactivate_self: 'ปิดใช้งานบัญชีของตัวเองไม่ได้',
  last_admin: 'ต้องมีหัวหน้าอย่างน้อย 1 คน',
};

export function toThaiError(message: string | null | undefined): string {
  const msg = (message ?? '').trim();
  const tag = /^tag_taken:\s*(.+)$/.exec(msg);
  if (tag) return `tag ${tag[1]} เป็นของเซลล์คนอื่นแล้ว`;
  for (const token of msg.match(/[a-z_]+/g) ?? []) {
    if (Object.prototype.hasOwnProperty.call(ERROR_TEXT, token)) return ERROR_TEXT[token];
  }
  return msg || 'ทำรายการไม่สำเร็จ';
}
```

- [ ] **Step 6: `lib/api/map.ts`**

```ts
import { localStamp } from '@/lib/format';
import type {
  Campaign, CampaignRow, Channel, ChannelRowJson, Lead, LeadJson, MeRow, PoolRow, PoolRowJson, Purchase, PurchaseRowJson, Rep, TeamRow,
} from './types';

/** dsales_lead_json → Lead (prototype mapLead L943-946) + claimedAtIso สำหรับส่งกลับ server */
export function mapLead(j: LeadJson): Lead {
  return {
    ...j,
    address: j.address || '',
    shop: j.shop || '',
    chatName: j.chatName || '',
    channels: j.channels || [],
    interest: j.interest || '',
    closedBills: j.closedBills || [],
    releasedBy: j.releasedBy || [],
    bills: j.bills || [],
    purchases: [],
    claimedAt: localStamp(j.claimedAt),
    claimedAtIso: j.claimedAt,
    interactions: (j.interactions || []).map((i) => ({ ...i, date: localStamp(i.date) || i.date, note: i.note || '', result: i.result || '' })),
  };
}

/** แทนลีดเดิม (คง purchases/_pl/chatCheck ที่โหลดฝั่ง client) หรือเพิ่มไว้บนสุด — คืน array ใหม่ */
export function upsertLead(leads: Lead[], j: LeadJson): Lead[] {
  const m = mapLead(j);
  const i = leads.findIndex((x) => x.id === m.id);
  if (i < 0) return [m, ...leads];
  const o = leads[i];
  const next = leads.slice();
  next[i] = { ...m, purchases: o.purchases, _pl: o._pl, chatCheck: o.chatCheck };
  return next;
}

/** แถว dsales_campaigns → Campaign (โหมด auto ใช้เป็น self ตาม prototype ตอนใช้งานจริง) */
export function mapCampaign(c: CampaignRow): Campaign {
  return {
    id: c.id, brand: c.brand, name: c.name, note: c.description || '', start: c.start_date || '', end: c.end_date || '',
    claimMode: c.claim_mode === 'auto' ? 'self' : c.claim_mode, maxPerRep: c.max_per_rep ?? null,
    active: c.active !== false, criteria: c.criteria || [],
  };
}

/** แถวถังลูกค้า (pool_v4 / base_customers) → PoolRow (prototype poolLoad L631-633) */
export function mapPoolRow(r: PoolRowJson, meId: string): PoolRow {
  return {
    id: r.identity_id || r.phone,
    name: r.name,
    phone: r.phone,
    segment: r.rfm_segment || r.segment || '',
    ltv: Number(r.ltv ?? 0),
    orders: Number(r.order_count ?? 0),
    last: r.last_order_date,
    brands: r.brands || [],
    chat: r.chat_name || '',
    leadId: r.lead_id ?? null,
    mine: !!r.mine,
    noCall: !!r.no_call,
    takenName: r.reserved_by || '',
    taken: r.taken ? (r.mine ? meId : 'other') : null,
    dormantDays: r.dormant_days ?? null,
    ownerTag: r.owner_tag ?? null,
  };
}

/** total_count ของผลค้นหา (มีเฉพาะเมื่อหน้านั้นมีแถว) */
export const rowsTotal = (rows: ReadonlyArray<{ total_count: number | string }>): number => (rows.length ? Number(rows[0].total_count) : 0);

export function mapTeamRow(r: TeamRow): Rep {
  return {
    id: r.user_id,
    name: r.display_name || (r.email || '').split('@')[0],
    initials: (r.display_name || r.email || '?').slice(0, 2).toUpperCase(),
    role: r.role === 'admin' ? 'admin' : 'sales',
    email: r.email ?? undefined,
    active: r.active,
  };
}

/** ทีมจาก dsales_team + ตัวเราจาก dsales_me (prototype loadLive L974-977) */
export function buildReps(team: TeamRow[], me: MeRow): Rep[] {
  const name = me.display_name || me.email.split('@')[0];
  const self: Rep = { id: me.user_id, name, initials: name.slice(0, 2).toUpperCase(), role: me.is_admin ? 'admin' : 'sales', email: me.email, active: me.active };
  const reps = team.map(mapTeamRow);
  return reps.some((r) => r.id === me.user_id) ? reps.map((r) => (r.id === me.user_id ? { ...r, ...self } : r)) : [...reps, self];
}

export function mapPurchase(x: PurchaseRowJson): Purchase {
  return { date: x.txn_date ?? '', bill: x.bill_no || x.order_no || '', sku: x.sku || '', product: x.product_name || '', amount: Number(x.amount || 0), seller: null };
}

export function mapChannel(x: ChannelRowJson): Channel {
  return { platform: x.platform, shop: x.shop ?? '', chat: x.chat_name || '' };
}
```

- [ ] **Step 7: `lib/api/rpc.ts`** (ทุก RPC ใน inventory ข้อ 5 ยกเว้น `dsales_register` + RPC เฟส 1 + จัดการสมาชิก)

```ts
import { PAGE, type Brand, type ClaimMode, type Role } from '@/lib/constants';
import { normalizeSearchPhone } from '@/lib/phone';
import { db } from '@/lib/supabase/client';
import { toThaiError } from './errors';
import { rowsTotal } from './map';
import type {
  CampaignRow, ChannelRowJson, ChatSessionJson, ContactType, JstTagRow, LeadJson, LeadStatus, MeRow, MemberJson, MemberTagsRow,
  NewCampaign, PoolRowJson, PurchaseRowJson, TeamRow,
} from './types';

type Result<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(toThaiError(error.message));
  return data as T;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await db().rpc(fn, args));
}

/* ---------- ตัวตน / ทีม ---------- */
export async function getMe(): Promise<MeRow | null> {
  const rows = await call<MeRow[]>('dsales_me');
  return rows?.[0] ?? null;
}
export const getTeam = () => call<TeamRow[]>('dsales_team');
export const addMember = (email: string, role: Role) => call<MemberJson>('dsales_add_member', { p_email: email.trim(), p_role: role });
export async function setMemberActive(userId: string, active: boolean): Promise<void> {
  await call<null>('dsales_set_member_active', { p_user: userId, p_active: active });
}
export const getJstAdminTags = () => call<JstTagRow[]>('dsales_jst_admin_tags');
export const getMemberTags = () => call<MemberTagsRow[]>('dsales_member_tags');
export const setMemberTags = (userId: string, tags: string[]) => call<string[]>('dsales_set_member_tags', { p_user: userId, p_tags: tags });

/* ---------- ลีด ---------- */
export const getMyLeads = (limit = 1000, offset = 0) => call<LeadJson[]>('dsales_my_leads', { p_limit: limit, p_offset: offset });
export const claimLead = (leadId: string) => call<LeadJson>('dsales_claim_lead', { p_lead: leadId });
export const unclaimLead = (leadId: string) => call<LeadJson>('dsales_unclaim_lead', { p_lead: leadId });
export const assignLead = (leadId: string, userId: string) => call<LeadJson>('dsales_assign_lead', { p_lead: leadId, p_user: userId });
export const setNoCall = (leadId: string, on: boolean) => call<LeadJson>('dsales_set_nocall', { p_lead: leadId, p_on: on });
export interface LogInput {
  leadId: string; type: ContactType; result: string; note: string; status: LeadStatus;
  callback: string | null; interest: string; bills: string[]; amount: number | null;
}
export const logContact = (x: LogInput) =>
  call<LeadJson>('dsales_log', {
    p_lead: x.leadId, p_type: x.type, p_result: x.result, p_note: x.note, p_status: x.status,
    p_callback: x.callback, p_interest: x.interest, p_bills: x.bills, p_amount: x.amount,
  });

/* ---------- ลูกค้า / ถัง ---------- */
export const claimCustomer = (phone: string, brand: Brand) => call<LeadJson>('dsales_claim_customer', { p_phone: phone, p_brand: brand });
export async function getPoolGrandTotal(brand: Brand | null): Promise<number> {
  return rowsTotal(await call<PoolRowJson[]>('dsales_customer_pool_v3', { p_limit: 1, p_offset: 0, p_brand: brand || null }));
}
export interface PoolQuery { search?: string | null; limit?: number; offset?: number; brand?: Brand | null; from?: string | null; to?: string | null }
export const getCustomerPool = (q: PoolQuery) =>
  call<PoolRowJson[]>('dsales_customer_pool_v4', {
    p_search: q.search?.trim() || null, p_limit: q.limit ?? PAGE, p_offset: q.offset ?? 0, p_brand: q.brand || null,
    ...(q.from || q.to ? { p_from: q.from || null, p_to: q.to || null } : {}),
  });
export type BaseScope = 'mine' | 'pool' | 'team';
export const getBaseCustomers = (scope: BaseScope, q: Omit<PoolQuery, 'from' | 'to'>) =>
  call<PoolRowJson[]>('dsales_base_customers', {
    p_scope: scope, p_search: normalizeSearchPhone(q.search ?? '') || null, p_limit: q.limit ?? PAGE, p_offset: q.offset ?? 0, p_brand: q.brand || null,
  });
export const getCustomerPurchases = (phone: string) => call<PurchaseRowJson[]>('dsales_customer_purchases', { p_phone: phone });
export const getCustomerChannels = (phone: string) => call<ChannelRowJson[]>('dsales_customer_channels', { p_phone: phone });
export const getCustomerChats = (phone: string, sinceIso: string | null) =>
  call<ChatSessionJson[]>('dsales_customer_chats', { p_phone: phone, p_since: sinceIso });

/* ---------- แคมเปญ (ตาราง) ---------- */
export async function listCampaigns(): Promise<CampaignRow[]> {
  return unwrap<CampaignRow[]>(await db().from('dsales_campaigns').select('*').order('created_at'));
}
export async function createCampaign(input: NewCampaign): Promise<CampaignRow> {
  return unwrap<CampaignRow>(await db().from('dsales_campaigns').insert(input).select().single());
}
export async function setCampaignClaimMode(id: string, mode: ClaimMode): Promise<void> {
  unwrap(await db().from('dsales_campaigns').update({ claim_mode: mode }).eq('id', id));
}
```

- [ ] **Step 8: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  7 passed (7)` · `Tests  39 passed (39)`

- [ ] **Step 9: Typecheck + lint** — Run: `npm run typecheck && npm run lint` Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors` (Next 15.5 อาจพิมพ์เตือนว่า `next lint` deprecated เพิ่ม — ไม่ใช่ error)

- [ ] **Step 10: Commit**

```bash
git add lib/api
git commit -m "feat(web): add typed dsales RPC layer with lead/campaign/pool mappers and Thai error messages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shell + ตัวให้ข้อมูล

**Files:**
- Create: `lib/routes.ts`, `lib/nav.ts`, `lib/domain/badges.ts`, `lib/state/reducer.ts`, `lib/state/AppProvider.tsx`
- Create: `components/shell/{ShellContext,Shell,Sidebar,Topbar,TopbarActions,MeBox,Toast,ModalRoot,Placeholder}.tsx`
- Create: `app/(app)/layout.tsx`, `app/(app)/leads/page.tsx`, `app/(app)/mine/page.tsx`, `app/(app)/pool/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/setup/page.tsx`, `app/(app)/campaigns/[brand]/page.tsx`, `app/(app)/[...slug]/page.tsx`
- Test: `lib/routes.test.ts`, `lib/domain/badges.test.ts`, `lib/state/reducer.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routeKey, routeMeta } from './routes';

const camps = [{ brand: 'bebeplay' }, { brand: 'bebeplay' }, { brand: 'hosttail' }] as const;

describe('routes', () => {
  it('maps paths to prototype route keys; unknown paths fall back to leads', () => {
    expect(routeKey('/leads')).toBe('leads');
    expect(routeKey('/mine/')).toBe('mine');
    expect(routeKey('/campaigns/hosttail')).toBe('campaign-hosttail');
    expect(routeKey('/nope')).toBe('leads');
    expect(routeKey(null)).toBe('leads');
  });
  it('gives the prototype titles and subs', () => {
    expect(routeMeta('/leads', [])).toEqual({ key: 'leads', title: 'Direct Sale', sub: 'ลูกค้าเก่า Direct Sale Lead' });
    expect(routeMeta('/dashboard', [])).toEqual({ key: 'dashboard', title: 'Dashboard', sub: 'ภาพรวมทีม Direct Sale' });
    expect(routeMeta('/setup', [])).toEqual({ key: 'setup', title: 'ตั้งค่า', sub: '' });
    expect(routeMeta('/mine', [])).toEqual({ key: 'mine', title: 'ลูกค้าของฉัน', sub: '' });
    expect(routeMeta('/pool', [])).toEqual({ key: 'pool', title: 'ถังกลาง', sub: '' });
  });
  it('counts the brand campaigns in the campaign sub', () => {
    expect(routeMeta('/campaigns/bebeplay', camps)).toEqual({ key: 'campaign-bebeplay', title: 'แคมเปญ Bebeplay', sub: '2 แคมเปญ' });
    expect(routeMeta('/campaigns/hosttail', camps).sub).toBe('1 แคมเปญ');
  });
});
```

`lib/domain/badges.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Brand, LeadSource, LeadStatus } from '@/lib/api/types';
import { badgeCounts } from './badges';

const L = (owner: string | null, status: LeadStatus, brand: Brand = 'bebeplay', source: LeadSource = 'campaign') => ({ owner, status, brand, source });

describe('badgeCounts (prototype updateBadges)', () => {
  it('counts my open leads (new + callback) for Direct Sale', () => {
    expect(badgeCounts([L('me', 'new'), L('me', 'callback'), L('me', 'won'), L('other', 'new'), L(null, 'new')], 'me').leads).toBe(2);
  });
  it('counts unowned new campaign leads per brand', () => {
    const leads = [L(null, 'new', 'bebeplay'), L(null, 'new', 'hosttail'), L(null, 'new', 'hosttail'), L(null, 'following', 'hosttail'),
      L('me', 'new', 'hosttail'), L(null, 'new', 'bebeplay', 'self')];
    expect(badgeCounts(leads, 'me')).toEqual({ leads: 1, bebeplay: 1, hosttail: 2 });
  });
});
```

`lib/state/reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { leadJson } from '@/lib/api/test-helpers';
import type { Campaign } from '@/lib/api/types';
import { initialState, reducer, type AppState, type LoadedPayload } from './reducer';

const payload: LoadedPayload = {
  email: 'a@example.com', meId: 'u1', isAdmin: true, reps: [{ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' }],
  campaigns: [], leads: [], today: '2026-11-04',
};
const ready: AppState = reducer(initialState, { type: 'loaded', payload });

describe('reducer', () => {
  it('loaded → ready with the loaded data', () => {
    expect(ready).toMatchObject({ phase: 'ready', meId: 'u1', isAdmin: true, today: '2026-11-04', error: '' });
  });
  it('noAccess clears data and remembers the email', () => {
    expect(reducer(ready, { type: 'noAccess', email: 'x@example.com', inactive: false }))
      .toMatchObject({ phase: 'no-access', email: 'x@example.com', reps: [], isAdmin: false });
    expect(reducer(ready, { type: 'noAccess', email: 'x@example.com', inactive: true }).phase).toBe('inactive');
  });
  it('failed keeps the message', () => {
    expect(reducer(initialState, { type: 'failed', error: 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ: boom' }))
      .toMatchObject({ phase: 'error', error: 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ: boom' });
  });
  it('upsertLead / patchLead / removeLead update the lead list', () => {
    let s = reducer(ready, { type: 'upsertLead', lead: leadJson({ id: 'L1' }) });
    s = reducer(s, { type: 'patchLead', id: 'L1', patch: { purchases: [{ date: '2026-10-01', bill: '1', sku: 'S', product: 'P', amount: 1, seller: null }] } });
    s = reducer(s, { type: 'upsertLead', lead: leadJson({ id: 'L1', status: 'won' }) });
    expect(s.leads).toHaveLength(1);
    expect(s.leads[0].status).toBe('won');
    expect(s.leads[0].purchases).toHaveLength(1);
    expect(reducer(s, { type: 'removeLead', id: 'L1' }).leads).toEqual([]);
  });
  it('setUi merges filters; upsertCampaign inserts then replaces', () => {
    const s = reducer(initialState, { type: 'setUi', patch: { q: 'สุภาพร', status: 'won' } });
    expect(s.ui).toMatchObject({ q: 'สุภาพร', status: 'won', sort: 'due', period: { from: '', to: '', key: 'all' } });
    const c: Campaign = { id: 'c1', brand: 'bebeplay', name: 'A', note: '', start: '', end: '', claimMode: 'self', maxPerRep: null, active: true, criteria: [] };
    const s2 = reducer(reducer(s, { type: 'upsertCampaign', campaign: c }), { type: 'upsertCampaign', campaign: { ...c, name: 'B' } });
    expect(s2.campaigns).toEqual([{ ...c, name: 'B' }]);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL 3 ไฟล์ — `Failed to resolve import "./routes"`, `"./badges"`, `"./reducer"`

- [ ] **Step 3: `lib/routes.ts`**

```ts
import type { Campaign } from '@/lib/api/types';
import { BRAND } from '@/lib/constants';

/** key เดียวกับ data-route ของ prototype */
export type RouteKey = 'leads' | 'mine' | 'pool' | 'campaign-bebeplay' | 'campaign-hosttail' | 'dashboard' | 'setup';

const PATH_KEYS: Record<string, RouteKey> = {
  '/leads': 'leads', '/mine': 'mine', '/pool': 'pool', '/campaigns/bebeplay': 'campaign-bebeplay',
  '/campaigns/hosttail': 'campaign-hosttail', '/dashboard': 'dashboard', '/setup': 'setup',
};

const TITLES: Record<Exclude<RouteKey, 'campaign-bebeplay' | 'campaign-hosttail'>, [string, string]> = {
  leads: ['Direct Sale', 'ลูกค้าเก่า Direct Sale Lead'],
  mine: ['ลูกค้าของฉัน', ''],
  pool: ['ถังกลาง', ''],
  dashboard: ['Dashboard', 'ภาพรวมทีม Direct Sale'],
  setup: ['ตั้งค่า', ''],
};

export function routeKey(pathname: string | null): RouteKey {
  const p = (pathname || '/').replace(/\/+$/, '');
  return PATH_KEYS[p] ?? 'leads';
}

export function routeMeta(pathname: string | null, campaigns: ReadonlyArray<Pick<Campaign, 'brand'>>): { key: RouteKey; title: string; sub: string } {
  const key = routeKey(pathname);
  if (key === 'campaign-bebeplay' || key === 'campaign-hosttail') {
    const brand = key === 'campaign-bebeplay' ? 'bebeplay' : 'hosttail';
    return { key, title: `แคมเปญ ${BRAND[brand]}`, sub: `${campaigns.filter((c) => c.brand === brand).length} แคมเปญ` };
  }
  const [title, sub] = TITLES[key];
  return { key, title, sub };
}
```

- [ ] **Step 4: `lib/domain/badges.ts`**

```ts
import type { Lead } from '@/lib/api/types';

export interface BadgeCounts { leads: number; bebeplay: number; hosttail: number }

/** ตัวเลขบนเมนู (prototype updateBadges L151-160) นับจากลีดทั้งหมดใน state ไม่ผ่านตัวกรอง */
export function badgeCounts(leads: ReadonlyArray<Pick<Lead, 'owner' | 'status' | 'brand' | 'source'>>, meId: string): BadgeCounts {
  const pool = (b: Lead['brand']) => leads.filter((l) => l.brand === b && l.source === 'campaign' && l.status === 'new' && !l.owner).length;
  return {
    leads: leads.filter((l) => l.owner === meId && (l.status === 'new' || l.status === 'callback')).length,
    bebeplay: pool('bebeplay'),
    hosttail: pool('hosttail'),
  };
}
```

- [ ] **Step 5: `lib/state/reducer.ts`**

```ts
import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, Lead, LeadJson, Rep } from '@/lib/api/types';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all', period: { from: '', to: '', key: 'all' },
};

export interface LoadedPayload { email: string; meId: string; isAdmin: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[]; today: string }
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'error';
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, reps: [], campaigns: [], leads: [], today: '', ui: initialUi,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'setUi'; patch: Partial<UiFilters> };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      return { ...state, phase: 'error', error: action.error };
    case 'upsertLead':
      return { ...state, leads: upsertLead(state.leads, action.lead) };
    case 'patchLead':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) };
    case 'removeLead':
      return { ...state, leads: state.leads.filter((l) => l.id !== action.id) };
    case 'upsertCampaign': {
      const exists = state.campaigns.some((c) => c.id === action.campaign.id);
      return {
        ...state,
        campaigns: exists ? state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)) : [...state.campaigns, action.campaign],
      };
    }
    case 'setUi':
      return { ...state, ui: { ...state.ui, ...action.patch } };
  }
}
```

- [ ] **Step 6: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  10 passed (10)` · `Tests  49 passed (49)`

- [ ] **Step 7: `lib/nav.ts`** (ลำดับและข้อความตาม `legacy/index.html` + กลุ่มใหม่ "ฐานลูกค้าเก่า")

```ts
import { PATHS } from '@/lib/constants';
import type { BadgeCounts } from '@/lib/domain/badges';
import type { RouteKey } from '@/lib/routes';

export interface NavItem { key: RouteKey; href: string; label: string; icon: string; badge?: keyof BadgeCounts; id?: string }
export interface NavGroup { label: string; id?: string; adminOnly?: boolean; items: NavItem[] }

export const NAV: NavGroup[] = [
  { label: 'ข้อมูลลูกค้าเก่า', items: [{ key: 'leads', href: '/leads', label: 'Direct Sale', icon: PATHS.phone, badge: 'leads' }] },
  {
    label: 'ฐานลูกค้าเก่า',
    items: [
      { key: 'mine', href: '/mine', label: 'ลูกค้าของฉัน', icon: PATHS.person },
      { key: 'pool', href: '/pool', label: 'ถังกลาง', icon: PATHS.list },
    ],
  },
  {
    label: 'แคมเปญ',
    items: [
      { key: 'campaign-bebeplay', href: '/campaigns/bebeplay', label: 'Bebeplay', icon: PATHS.megaphone, badge: 'bebeplay' },
      { key: 'campaign-hosttail', href: '/campaigns/hosttail', label: 'Hosttail', icon: PATHS.megaphone, badge: 'hosttail' },
    ],
  },
  { label: 'Overview', items: [{ key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: PATHS.grid }] },
  { label: 'Tool', id: 'nav-tool', adminOnly: true, items: [{ key: 'setup', href: '/setup', label: 'ตั้งค่า', icon: PATHS.gear, id: 'nav-setup' }] },
];
```

- [ ] **Step 8: `lib/state/AppProvider.tsx`**

```tsx
'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode,
} from 'react';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { initialState, reducer, type Action, type AppState } from './reducer';

export interface ModalState { node: ReactNode; cls: string; seq: number }

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  toastMsg: string | null;
  toast: (msg: string) => void;
  modal: ModalState | null;
  openModal: (node: ReactNode, cls?: string) => void;
  closeModal: () => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ) */
async function loadLive(): Promise<Action | null> {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) {
    window.location.replace('/login');
    return null;
  }
  const email = user.email ?? '';
  const me = await getMe();
  if (!me || !me.is_member) return { type: 'noAccess', email, inactive: false };
  if (!me.active) return { type: 'noAccess', email, inactive: true };
  const [team, campaigns, leads] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [modal, setModal] = useState<ModalState | null>(null);
  const modalSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let action: Action | null;
      try {
        action = await loadLive();
      } catch (e) {
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (!cancelled && action) dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // toast ช่องเดียว แสดง 2.2 วิ ข้อความใหม่เริ่มนับใหม่ (prototype L124-127)
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const openModal = useCallback((node: ReactNode, cls = '') => {
    modalSeq.current += 1;
    setModal({ node, cls, seq: modalSeq.current });
  }, []);
  const closeModal = useCallback(() => setModal(null), []);

  // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
  const logout = useCallback(async () => {
    await supabase().auth.signOut();
    window.location.href = '/login';
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, toastMsg, toast, modal, openModal, closeModal, logout }),
    [state, toastMsg, toast, modal, openModal, closeModal, logout],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp ต้องอยู่ใน <AppProvider>');
  return v;
}
```

- [ ] **Step 9: component ของ shell**

`components/shell/ShellContext.tsx`:

```tsx
'use client';

import { createContext, useContext } from 'react';

export interface ShellValue {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  actionsEl: HTMLDivElement | null;
  setActionsEl: (el: HTMLDivElement | null) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell ต้องอยู่ใน <Shell>');
  return v;
}
```

`components/shell/Shell.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { INACTIVE_TEXT, LOADING_TEXT, NO_ACCESS_TEXT, NoAccess } from '@/components/auth/NoAccess';
import { useApp } from '@/lib/state/AppProvider';
import { ModalRoot } from './ModalRoot';
import { ShellContext } from './ShellContext';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { Topbar } from './Topbar';

export function Shell({ children }: { children: ReactNode }) {
  const { state, logout } = useApp();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setMenuOpen(false); // route() ของ prototype ปิดเมนูมือถือทุกครั้งที่เปลี่ยนหน้า
  }, [pathname]);

  const shell = useMemo(
    () => ({ menuOpen, openMenu: () => setMenuOpen(true), closeMenu: () => setMenuOpen(false), actionsEl, setActionsEl }),
    [menuOpen, actionsEl],
  );

  if (state.phase === 'loading') return <NoAccess message={LOADING_TEXT} />;
  if (state.phase === 'no-access' || state.phase === 'inactive') {
    return <NoAccess message={state.phase === 'inactive' ? INACTIVE_TEXT : NO_ACCESS_TEXT} email={state.email} onLogout={logout} />;
  }
  if (state.phase === 'error') {
    return <NoAccess message={state.error} isError onRetry={() => window.location.reload()} onLogout={logout} />;
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className="app">
        <Sidebar />
        <div className={`scrim${menuOpen ? ' open' : ''}`} id="scrim" onClick={shell.closeMenu} />
        <main className="main">
          <Topbar />
          <section className="content" id="view">{children}</section>
        </main>
      </div>
      <ModalRoot />
      <Toast />
    </ShellContext.Provider>
  );
}
```

`components/shell/Sidebar.tsx`:

```tsx
'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { badgeCounts } from '@/lib/domain/badges';
import { NAV } from '@/lib/nav';
import { routeKey } from '@/lib/routes';
import { useApp } from '@/lib/state/AppProvider';
import { MeBox } from './MeBox';
import { useShell } from './ShellContext';

export function Sidebar() {
  const { state } = useApp();
  const { menuOpen } = useShell();
  const active = routeKey(usePathname());
  const badges = badgeCounts(state.leads, state.meId);

  return (
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="sidebar">
      <div className="brand">
        <div className="brand-name">MPD Direct Sale</div>
        <div className="brand-sub">MPD Group · Preview v0.1</div>
      </div>
      <nav className="nav" id="nav">
        {NAV.filter((g) => !g.adminOnly || state.isAdmin).map((g) => (
          <Fragment key={g.label}>
            <div className="nav-group" id={g.id}>{g.label}</div>
            {g.items.map((it) => (
              <Link key={it.key} className={`nav-item${active === it.key ? ' active' : ''}`} href={it.href} data-route={it.key} id={it.id}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={it.icon} /></svg>
                <span>{it.label}</span>
                {it.badge ? (
                  <b className={`nav-badge${it.badge === 'leads' ? '' : ' soft'}`} id={`badge-${it.badge}`}>{badges[it.badge] || ''}</b>
                ) : null}
              </Link>
            ))}
          </Fragment>
        ))}
      </nav>
      <MeBox />
    </aside>
  );
}
```

`components/shell/MeBox.tsx`:

```tsx
'use client';

import { PATHS } from '@/lib/constants';
import { useApp } from '@/lib/state/AppProvider';

export function MeBox() {
  const { state, logout } = useApp();
  const me = state.reps.find((r) => r.id === state.meId);
  return (
    <div className="me">
      <div className="avatar" id="me-avatar">{(me?.initials || '?').slice(0, 2)}</div>
      <div className="me-info">
        <label htmlFor="me-select" className="me-label" id="me-label">เข้าสู่ระบบแล้ว</label>
        <select id="me-select" className="me-select" disabled>
          <option>{me?.name || state.email}</option>
        </select>
      </div>
      <button className="icon-btn logout" id="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={() => void logout()}>
        <svg viewBox="0 0 24 24"><path d={PATHS.logout} /></svg>
      </button>
    </div>
  );
}
```

`components/shell/Topbar.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { PATHS } from '@/lib/constants';
import { routeMeta } from '@/lib/routes';
import { useApp } from '@/lib/state/AppProvider';
import { useShell } from './ShellContext';

export function Topbar() {
  const { state } = useApp();
  const { openMenu, setActionsEl } = useShell();
  const { title, sub } = routeMeta(usePathname(), state.campaigns);
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" id="menu-btn" aria-label="เปิดเมนู" onClick={openMenu}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS.menu} /></svg>
      </button>
      <div className="topbar-title">
        <h1 id="page-title">{title}</h1>
        <span id="page-sub" className="page-sub">{sub}</span>
      </div>
      <div className="topbar-actions" id="topbar-actions" ref={setActionsEl} />
    </header>
  );
}
```

`components/shell/TopbarActions.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useShell } from './ShellContext';

/** ปุ่มของแต่ละหน้าใน #topbar-actions (หายเองเมื่อออกจากหน้า = prototype ล้าง #topbar-actions ทุก route) */
export function TopbarActions({ children }: { children: ReactNode }) {
  const { actionsEl } = useShell();
  return actionsEl ? createPortal(children, actionsEl) : null;
}
```

`components/shell/Toast.tsx`:

```tsx
'use client';

import { useApp } from '@/lib/state/AppProvider';

export function Toast() {
  const { toastMsg } = useApp();
  return <div className="toast" id="toast" hidden={!toastMsg}>{toastMsg}</div>;
}
```

`components/shell/ModalRoot.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useApp } from '@/lib/state/AppProvider';

/** popup ตาม prototype openModal/closeModal (L385-393): mousedown ที่พื้นหลัง, Esc, [data-close] ปิด; เปิดแล้ว focus ช่องแรก */
export function ModalRoot() {
  const { modal, closeModal } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) return;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button.btn')?.focus();
  }, [modal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeModal]);

  return (
    <div
      className="modal-root"
      id="modal-root"
      hidden={!modal}
      ref={ref}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-close]')) closeModal();
      }}
    >
      {modal ? (
        <div key={modal.seq} className={`modal ${modal.cls}`.trim()} role="dialog" aria-modal="true">
          {modal.node}
        </div>
      ) : null}
    </div>
  );
}
```

`components/shell/Placeholder.tsx`:

```tsx
/** เนื้อหาชั่วคราวของหน้าที่ยังไม่ย้าย (แผน B / C) */
export function Placeholder({ plan }: { plan: 'B' | 'C' }) {
  return (
    <div className="card">
      <p className="empty">หน้านี้จะย้ายจาก prototype ในแผน {plan}</p>
    </div>
  );
}
```

- [ ] **Step 10: หน้าใน `(app)`**

`app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/Shell';
import { AppProvider } from '@/lib/state/AppProvider';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
```

`app/(app)/leads/page.tsx`:

```tsx
import { Placeholder } from '@/components/shell/Placeholder';

export default function LeadsPage() {
  return <Placeholder plan="B" />;
}
```

`app/(app)/mine/page.tsx`:

```tsx
import { Placeholder } from '@/components/shell/Placeholder';

export default function MinePage() {
  return <Placeholder plan="C" />;
}
```

`app/(app)/pool/page.tsx`:

```tsx
import { Placeholder } from '@/components/shell/Placeholder';

export default function PoolPage() {
  return <Placeholder plan="C" />;
}
```

`app/(app)/dashboard/page.tsx`:

```tsx
import { Placeholder } from '@/components/shell/Placeholder';

export default function DashboardPage() {
  return <Placeholder plan="C" />;
}
```

`app/(app)/setup/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Placeholder } from '@/components/shell/Placeholder';
import { useApp } from '@/lib/state/AppProvider';

export default function SetupPage() {
  const { state } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!state.isAdmin) router.replace('/leads'); // หลังบ้านเฉพาะหัวหน้า (prototype route L140)
  }, [state.isAdmin, router]);
  if (!state.isAdmin) return null;
  return <Placeholder plan="C" />;
}
```

`app/(app)/campaigns/[brand]/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { Placeholder } from '@/components/shell/Placeholder';

export default async function CampaignPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (brand !== 'bebeplay' && brand !== 'hosttail') redirect('/leads');
  return <Placeholder plan="B" />;
}
```

`app/(app)/[...slug]/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

/** URL ที่ไม่รู้จัก → Direct Sale (prototype: hash ที่ไม่รู้จักแสดงหน้า leads) */
export default function UnknownPage() {
  redirect('/leads');
}
```

- [ ] **Step 11: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: ทั้งหมดผ่าน; ตาราง Route ของ build มี `/leads`, `/mine`, `/pool`, `/dashboard`, `/setup`, `/campaigns/[brand]`, `/[...slug]`, `/login` และ `ƒ Middleware`

- [ ] **Step 12: ตรวจกับบัญชีจริง (ถ้ามีบัญชีหัวหน้าในเครื่อง ไม่มีให้ข้ามไป Task 11)** — `npm run dev` → ล็อกอิน → เห็น sidebar ครบ 5 กลุ่ม (มี Tool), ชื่อในกล่อง me, คลิกทุกเมนูแล้วชื่อหน้า/คำอธิบายเปลี่ยนตาม `lib/routes.ts`, ปุ่ม back ของเบราว์เซอร์กลับหน้าก่อนได้, จอแคบ ≤760px ปุ่ม ☰ เปิดเมนูและคลิกพื้นหลังปิด

- [ ] **Step 13: Commit**

```bash
git add lib/routes.ts lib/routes.test.ts lib/nav.ts lib/domain lib/state components/shell "app/(app)"
git commit -m "feat(web): add app shell, data provider, nav badges and placeholder pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: โหมด fixture + ทดสอบเทียบหน้าตา

**Files:**
- Create: `lib/fixtures/types.ts`, `lib/fixtures/load.ts`, `tools/check-no-fixtures.mjs`, `playwright.config.ts`, `e2e/visual-parity.spec.ts`
- Generated: `lib/fixtures/data.ts`
- Modify: `lib/state/AppProvider.tsx`, `middleware.ts`, `package.json`
- Test: `lib/fixtures/guard.test.ts`, `lib/fixtures/load.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/fixtures/guard.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Next แทน process.env.* ที่เขียนตรงตัวด้วยค่าตอน build (production → "production" / undefined)
// webpack จึงตัดทิ้งทั้ง if และ dynamic import ของ fixture — เงื่อนไขต้องเขียนแบบนี้เท่านั้น ห้ามย้ายไปเป็นตัวแปร/ฟังก์ชัน
const GUARD = "process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'";

describe('fixture mode stays out of production builds', () => {
  it('every NEXT_PUBLIC_FIXTURES check is the literal dev-only guard', () => {
    for (const file of ['middleware.ts', 'lib/state/AppProvider.tsx']) {
      const src = readFileSync(file, 'utf8');
      const uses = src.split('NEXT_PUBLIC_FIXTURES').length - 1;
      expect(uses, file).toBeGreaterThan(0);
      expect(src.split(GUARD).length - 1, file).toBe(uses);
    }
  });
  it('fixture data is reached only by a dynamic import inside the guard', () => {
    const src = readFileSync('lib/state/AppProvider.tsx', 'utf8');
    expect(src).not.toMatch(/^import[^\n]*lib\/fixtures/m);
    const at = src.indexOf("import('@/lib/fixtures/load')");
    expect(at).toBeGreaterThan(-1);
    const guardAt = src.lastIndexOf(GUARD, at);
    expect(guardAt).toBeGreaterThan(-1);
    expect(at - guardAt).toBeLessThan(200);
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)))
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('fixtures') && !f.endsWith('.test.ts') && !f.endsWith('AppProvider.tsx'))
      .filter((f) => readFileSync(f, 'utf8').includes('lib/fixtures'));
    expect(offenders).toEqual([]);
  });
});
```

`lib/fixtures/load.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixturePayload } from './load';

describe('fixturePayload', () => {
  it('starts as the prototype demo user (Dev MPD, admin) on 2026-11-04', () => {
    const p = fixturePayload();
    expect(p).toMatchObject({ meId: 'r4', isAdmin: true, today: '2026-11-04' });
    expect(p.reps.find((r) => r.id === 'r4')?.name).toBe('Dev MPD');
    expect(p.leads).toHaveLength(28);
    expect(p.campaigns.map((c) => c.id)).toEqual(['c-bebe-nov', 'c-host-nov', 'c-bebe-oct']);
    expect(p.campaigns.every((c) => c.active && c.maxPerRep === null && c.criteria.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL 2 ไฟล์ — `guard.test.ts` ตกทั้ง 2 test (`expected 0 to be greater than 0` และ `expected -1 to be greater than -1` เพราะยังไม่มีเงื่อนไข fixture) และ `load.test.ts`: `Failed to resolve import "./load"`

- [ ] **Step 3: `lib/fixtures/types.ts`**

```ts
import type { Campaign, Channel, Lead, Purchase, Rep } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';

/** รูปของ window.DS_DATA ใน legacy/data.js */
export interface FixtureCustomer {
  id: string; name: string; phone: string; address: string; brand: Brand; shop: string; chatName: string; channels: Channel[]; purchases: Purchase[];
}
export interface FixtureData {
  reps: Rep[];
  campaigns: Pick<Campaign, 'id' | 'brand' | 'claimMode' | 'name' | 'start' | 'end' | 'note'>[];
  leads: Lead[];
  customers: FixtureCustomer[];
  today: string;
}
```

- [ ] **Step 4: สร้าง `lib/fixtures/data.ts`**

Run: `TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures`
Expected: `wrote lib/fixtures/data.ts (… bytes)` และ `grep -c '"today": "2026-11-04"' lib/fixtures/data.ts` ได้ `1` (ถ้าสคริปต์ขึ้นข้อความ "ต้องรันด้วย TZ=Asia/Bangkok" แปลว่า Node ไม่รับ `TZ` — ใน PowerShell ใช้ `$env:TZ='Asia/Bangkok'; node tools/port-legacy.mjs fixtures`)

- [ ] **Step 5: `lib/fixtures/load.ts`**

```ts
import type { LoadedPayload } from '@/lib/state/reducer';
import { FIXTURE_DATA } from './data';

/** prototype โหมดตัวอย่างเริ่มที่ "Dev MPD" (หัวหน้า) */
export const FIXTURE_ME_ID = 'r4';

export function fixturePayload(): LoadedPayload {
  const d = structuredClone(FIXTURE_DATA);
  const me = d.reps.find((r) => r.id === FIXTURE_ME_ID);
  if (!me) throw new Error(`fixture rep ${FIXTURE_ME_ID} is missing`);
  return {
    email: 'dev@fixtures.test',
    meId: me.id,
    isAdmin: me.role === 'admin',
    reps: d.reps,
    campaigns: d.campaigns.map((c) => ({ ...c, maxPerRep: null, active: true, criteria: [] })),
    leads: d.leads,
    today: d.today,
  };
}
```

- [ ] **Step 6: ใส่โหมด fixture ใน `lib/state/AppProvider.tsx`** — แก้

```tsx
        action = await loadLive();
```

เป็น

```tsx
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') {
          const { fixturePayload } = await import('@/lib/fixtures/load');
          action = { type: 'loaded', payload: fixturePayload() };
        } else {
          action = await loadLive();
        }
```

และแก้

```tsx
    await supabase().auth.signOut();
```

เป็น

```tsx
    if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
```

- [ ] **Step 7: middleware ข้ามการล็อกอินในโหมด fixture** — ใน `middleware.ts` แก้

```ts
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
```

เป็น

```ts
export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') return NextResponse.next();
  let response = NextResponse.next({ request });
```

- [ ] **Step 8: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  12 passed (12)` · `Tests  52 passed (52)`

- [ ] **Step 9: สคริปต์ตรวจ build** `tools/check-no-fixtures.mjs`

```js
#!/usr/bin/env node
// ตรวจว่า production build ไม่มีข้อมูล fixture (Next.js spec ข้อ 6) — รันหลัง `npm run build` และก่อน `npm run test:e2e`
// (next dev ของ e2e เขียนทับ .next ด้วยไฟล์โหมด dev)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['c-bebe-nov', 'c-host-nov', 'dev@fixtures.test']; // id แคมเปญตัวอย่างใน legacy/data.js + อีเมลของโหมด fixture
if (!existsSync('.next/BUILD_ID')) {
  console.error('ยังไม่มี production build: รัน npm run build ก่อน');
  process.exit(1);
}
const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|rsc|body|txt)$/.test(name) && MARKERS.some((m) => readFileSync(p, 'utf8').includes(m))) hits.push(p);
  }
}
for (const root of ['.next/static', '.next/server']) if (existsSync(root)) walk(root);
if (hits.length) {
  console.error('พบข้อมูล fixture ใน build:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server');
```

ใน `package.json` แก้

```json
    "test:e2e": "playwright test"
```

เป็น

```json
    "test:e2e": "playwright test",
    "check:fixtures": "node tools/check-no-fixtures.mjs"
```

Run: `npm run build && npm run check:fixtures`
Expected: build ผ่าน แล้ว `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server`

- [ ] **Step 10: Playwright config** `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // baseline = ภาพจาก prototype ที่ test ถ่ายเองทุกครั้ง (ไม่ commit)
  snapshotPathTemplate: '{testDir}/.legacy-shots/{arg}{ext}',
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    timezoneId: 'Asia/Bangkok',
    locale: 'th-TH',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  webServer: [
    {
      command: 'npx http-server legacy -p 4100 -c-1 -s',
      url: 'http://127.0.0.1:4100/index.html',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx next dev -p 3100 -H 127.0.0.1',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_FIXTURES: '1' },
    },
  ],
});
```

- [ ] **Step 11: test เทียบภาพ** `e2e/visual-parity.spec.ts`

```ts
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { PATHS } from '../lib/constants';

const LEGACY = 'http://127.0.0.1:4100/index.html';
const APP = 'http://127.0.0.1:3100';
const SIZES = [
  { tag: 'mobile', width: 375, height: 812 },
  { tag: 'desktop', width: 1280, height: 800 },
] as const;
// เกณฑ์ผ่าน: พิกเซลที่ต่างไม่เกิน 0.5% ของภาพ (threshold 0.1 = ความต่างสีต่อพิกเซลที่ยังนับว่าเหมือน) ห้ามขยายเกณฑ์เพื่อให้ผ่าน
const SAME = { maxDiffPixelRatio: 0.005, threshold: 0.1 } as const;
// แผน A เทียบเฉพาะ shell: ซ่อนเนื้อหาหน้าและปุ่มของหน้าใน topbar ทั้งสองฝั่ง
const HIDE_WORK_AREA = '#view > *, #topbar-actions > * { display: none !important; }';

const legacyShot = (name: string) => path.join(__dirname, '.legacy-shots', `${name}.png`);

async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_WORK_AREA });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function shootLegacy(page: Page, name: string) {
  await page.screenshot({ path: legacyShot(name), animations: 'disabled', caret: 'hide' });
}

async function openLegacyShell(page: Page) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  // ส่วนที่เว็บใหม่ตั้งใจต่างจาก prototype: กลุ่มเมนู "ฐานลูกค้าเก่า" และกล่อง me แบบล็อกอินแล้ว
  await page.evaluate(({ person, list }) => {
    const campaigns = Array.from(document.querySelectorAll('.nav-group')).find((g) => g.textContent === 'แคมเปญ');
    campaigns?.insertAdjacentHTML(
      'beforebegin',
      '<div class="nav-group">ฐานลูกค้าเก่า</div>' +
        `<a class="nav-item" href="#mine" data-route="mine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${person}"></path></svg><span>ลูกค้าของฉัน</span></a>` +
        `<a class="nav-item" href="#pool" data-route="pool"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${list}"></path></svg><span>ถังกลาง</span></a>`,
    );
    const label = document.querySelector('#me-label');
    if (label) label.textContent = 'เข้าสู่ระบบแล้ว';
    const select = document.querySelector<HTMLSelectElement>('#me-select');
    if (select) {
      select.innerHTML = '<option>Dev MPD</option>';
      select.disabled = true;
    }
  }, { person: PATHS.person, list: PATHS.list });
  await settle(page);
}

async function openAppShell(page: Page) {
  await page.goto(`${APP}/leads`);
  await expect(page.locator('#page-title')).toHaveText('Direct Sale', { timeout: 60_000 });
  await expect(page.locator('.nav-item.active')).toHaveAttribute('data-route', 'leads');
  await settle(page);
}

for (const s of SIZES) {
  test.describe(`${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('shell matches the prototype', async ({ page }) => {
      const name = `shell-${s.tag}`;
      await openLegacyShell(page);
      await shootLegacy(page, name);
      await openAppShell(page);
      await expect(page).toHaveScreenshot(`${name}.png`, SAME);
    });

    if (s.tag === 'mobile') {
      test('shell with the menu open matches the prototype', async ({ page }) => {
        const name = 'shell-menu-mobile';
        await openLegacyShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(/\bopen\b/);
        await shootLegacy(page, name);
        await openAppShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(/\bopen\b/);
        await expect(page).toHaveScreenshot(`${name}.png`, SAME);
      });
    }

    test('login matches the prototype (without the demo button)', async ({ page }) => {
      const name = `login-${s.tag}`;
      await page.goto(LEGACY);
      await expect(page.locator('#login')).toBeVisible();
      await page.evaluate(() => {
        document.querySelector('#l-demo')?.remove();
        const err = document.querySelector<HTMLElement>('#l-err');
        if (err) {
          err.hidden = true;
          err.textContent = '';
        }
      });
      await settle(page);
      await shootLegacy(page, name);
      await page.goto(`${APP}/login`);
      await expect(page.locator('#login-form')).toBeVisible({ timeout: 60_000 });
      await settle(page);
      await expect(page).toHaveScreenshot(`${name}.png`, SAME);
    });
  });
}
```

- [ ] **Step 12: ติดตั้งเบราว์เซอร์ของ Playwright** (ดาวน์โหลด Chromium ราว 150 MB จาก CDN ของ Playwright — ขออนุญาตผู้ใช้ก่อน)

Run: `npx playwright install chromium`
Expected: จบด้วย `Chromium … downloaded to …` (หรือไม่มี output ถ้าติดตั้งไว้แล้ว)

- [ ] **Step 13: รัน e2e** (ต่ออินเทอร์เน็ต; พอร์ต 3100 และ 4100 ต้องว่าง)

Run: `npm run test:e2e`
Expected: `5 passed` (mobile: shell, shell with the menu open, login · desktop: shell, login)

ถ้าไม่ผ่าน: `npx playwright show-report` ดูภาพ `-expected` (prototype) / `-actual` (Next) / `-diff` แล้วแก้ markup/CSS ฝั่ง Next ให้ตรง (ไม่แก้ `styles/prototype.css` นอกจากบรรทัดฟอนต์ และไม่ขยาย `SAME`)

- [ ] **Step 14: Commit**

```bash
git add lib/fixtures lib/state/AppProvider.tsx middleware.ts package.json tools/check-no-fixtures.mjs playwright.config.ts e2e/visual-parity.spec.ts
git commit -m "test(web): add dev-only fixture mode and Playwright visual parity for shell and login" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `CLAUDE.md` ของโปรเจกต์

**Files:**
- Create: `CLAUDE.md` (root ของ repo; แบบเดียวกับ `C:\Claude Ai\Claude workshop\Inventory_master\CLAUDE.md`)

- [ ] **Step 1: เขียน `CLAUDE.md`**

````markdown
# CLAUDE.md — MPD Direct Sale

บริบทสำหรับ Claude Code อ่านก่อนทำงานในโปรเจกต์นี้ทุกครั้ง

## โปรเจกต์นี้คืออะไร

เว็บแอป Direct Sale ของ MPD Group (แบรนด์ Bebeplay / Hosttail) ให้ทีมเซลล์โทร/แชตหาลูกค้าเก่า จองลูกค้าจากถัง ติดตามแคมเปญ และให้หัวหน้าดูภาพรวมทีม
- กำลังย้ายจาก prototype (HTML/JS ล้วน) เป็น Next.js ตามแผน A (ฐานราก) → B (หน้าลีด/แคมเปญ) → C (ลูกค้าของฉัน/ถังกลาง, Dashboard, ตั้งค่า, deploy)
- **`legacy/` คือต้นแบบหน้าตาและการทำงาน (UX reference)** หน้า Next.js ต้องเหมือน prototype ทุกจุดและใช้ class name เดิมจาก `styles/prototype.css` ห้ามออกแบบใหม่เอง สงสัยให้เปิด `legacy/index.html` (กด "ดูตัวอย่างโดยไม่ล็อกอิน") หรืออ่าน `legacy/app.js` ตามเลขบรรทัดใน inventory
- ห้ามแก้ไฟล์ใน `legacy/` จะลบทิ้งหลัง deploy Next.js และผู้ใช้ตรวจ production ครบ (แผน C)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| UI | `styles/prototype.css` (สำเนา stylesheet ของ prototype) + Tailwind CSS 3 แบบปิด preflight (ใช้ให้น้อยที่สุด) |
| ฟอนต์ | IBM Plex Sans Thai / IBM Plex Mono ผ่าน `next/font/google` |
| Database / Auth | Supabase (PostgreSQL 15) ผ่าน `@supabase/ssr` (session ใน cookie) |
| Test | Vitest (unit) + Playwright (เทียบภาพกับ prototype) |
| Hosting | Vercel |
| DB Access (Claude) | Supabase MCP |

## Architecture

```
app/
  layout.tsx                    # <html lang="th">, ฟอนต์, CSS
  login/                        # หน้าล็อกอิน (markup .login-card เดิม)
  (app)/layout.tsx              # AppProvider + Shell (sidebar/topbar/toast/modal)
  (app)/leads|mine|pool|dashboard|setup/page.tsx
  (app)/campaigns/[brand]/page.tsx
middleware.ts                   # ไม่มี session → /login
components/
  auth/NoAccess.tsx             # การ์ดยังไม่มีสิทธิ์ / กำลังโหลด / โหลดไม่สำเร็จ
  shell/                        # Shell, Sidebar, Topbar, TopbarActions, MeBox, Toast, ModalRoot
lib/
  supabase/client.ts            # supabase() ใช้กับ auth, db() = schema('dsales')
  supabase/server.ts
  api/                          # types, map (mapLead/mapCampaign/mapPoolRow), errors (toThaiError), rpc (wrapper ทุก RPC)
  state/                        # reducer + AppProvider (โหลด dsales_me → team/campaigns/my_leads ครั้งเดียว)
  domain/                       # กติกาลีด/ตัวกรอง/สถิติ (ฟังก์ชันล้วน มี test)
  fixtures/                     # โหมด fixture (next dev เท่านั้น)
  format.ts constants.ts phone.ts icons.ts routes.ts nav.ts
styles/prototype.css
legacy/                         # prototype เดิม (UX reference)
supabase/migrations/            # migration ของ schema dsales
supabase/tests/                 # SQL test (begin … rollback)
tools/                          # port-legacy.mjs, check-no-fixtures.mjs, jst-helper/, db/
e2e/                            # Playwright visual parity
docs/                           # spec, plan, DATABASE.md
```

ดึงข้อมูลฝั่ง client เป็นหลักเหมือน prototype: ทุก RPC เรียกผ่าน `lib/api/rpc.ts` (โยน `Error` ข้อความไทยจาก `toThaiError`) และหลังแก้ข้อมูลให้ `dispatch({ type: 'upsertLead', lead })` แทนการโหลดใหม่ทั้งหน้า

## Supabase (ใช้ร่วมกับระบบอื่น — ระวัง)

- Project `nroyacasuchqniaiuirk` เป็น **production ที่ใช้ร่วมกับระบบอื่นของบริษัท** (บัญชีพนักงาน ~150 คน, ตาราง JST / order / CDP ของระบบอื่น)
- **ของ Direct Sale อยู่ใน schema `dsales` เท่านั้น** (ชื่อขึ้นต้น `dsales_`) **ห้ามแก้ตาราง/function/view ของ schema อื่น** (`public`, `cdp`, `auth` …) อ่านได้อย่างเดียวผ่าน function `security definer` ใน `dsales`
- เข้าใช้ได้เฉพาะสมาชิกใน `dsales.dsales_members` ที่ `active = true` (`dsales_uid()` โยน `not_member`) และต้องมีหัวหน้า active อย่างน้อย 1 คนเสมอ (`last_admin`)
- RPC ใหม่ทุกตัว: `security definer`, `set search_path = dsales, public`, เรียก `dsales.dsales_uid()`, `revoke … from public, anon` แล้ว `grant execute … to authenticated`
- `iim_messages.time` เร็วกว่าจริง 7 ชม. ให้ใช้ view `dsales.dsales_chat_messages_v`

## Migration และ SQL test (ทำตามลำดับนี้เสมอ)

1. เขียน test `supabase/tests/NN_name.sql` (ขึ้นต้น `begin;` จบ `rollback;` ใช้ `assert` ของ plpgsql)
2. รัน test ด้วย MCP `execute_sql` ให้เห็นว่าไม่ผ่านก่อน
3. Dry run: `execute_sql` ครั้งเดียว = `begin;` + migration ทั้งไฟล์ + ตัว test (ตัด `begin;`/`rollback;` ของ test) + `rollback;`
4. `apply_migration` (`project_id = "nroyacasuchqniaiuirk"`, `name` = ชื่อไฟล์ไม่รวมเลขเวลาและ `.sql`)
5. รัน test ให้ผ่าน แล้วรัน regression **ทีละไฟล์ (1 ไฟล์ต่อการเรียก `execute_sql` 1 ครั้ง)**

- **`04_customer_base.sql` และ `04b_customer_base_quality.sql` หนักมาก (คำนวณฐานลูกค้าใหม่ทั้งหมด) ห้ามรันเล่น ๆ บน production** รันเฉพาะเมื่อแก้ `dsales_customer_base` และบอกผู้ใช้ก่อน
- ห้ามรัน SQL ที่เขียนข้อมูลจริงนอก migration โดยไม่ถามผู้ใช้

## Environment Variables

```bash
# .env.local (ห้าม commit) — ดู .env.example
NEXT_PUBLIC_SUPABASE_URL=https://nroyacasuchqniaiuirk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # ชื่อเดียวกับ Inventory แต่ค่าคือ publishable key
NEXT_PUBLIC_JST_HELPER_URL=http://127.0.0.1:47321
NEXT_PUBLIC_JST_URL_TEMPLATE=
NEXT_PUBLIC_FIXTURES=0
```

## Commands

```bash
npm run dev              # dev server (localhost:3000)
npm run build            # production build
npm start                # รัน production build
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm test                 # Vitest
npm run check:fixtures   # หลัง build: ตรวจว่าไม่มีข้อมูล fixture ใน .next
npm run test:e2e         # Playwright เทียบภาพกับ legacy/ (เปิดพอร์ต 4100 และ 3100 เอง ต้องต่ออินเทอร์เน็ต)
node tools/port-legacy.mjs icons                     # สร้าง lib/icons.ts ใหม่
TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures  # สร้าง lib/fixtures/data.ts ใหม่
```

## โหมด fixture

- `NEXT_PUBLIC_FIXTURES=1 npm run dev` → ข้ามการล็อกอิน (middleware) และใช้ข้อมูลตัวอย่างจาก `legacy/data.js` (ผู้ใช้ "Dev MPD" หัวหน้า, วันนี้ = 2026-11-04) ใช้พัฒนาหน้าตาและรัน Playwright
- มีผลเฉพาะ `next dev`: เงื่อนไขต้องเขียนตรงตัว `process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'` และโหลด fixture ด้วย dynamic import ในเงื่อนไขนั้นเท่านั้น (`lib/fixtures/guard.test.ts` ตรวจ) ห้าม import `lib/fixtures` แบบปกติจากโค้ดหน้าเว็บ
- `lib/fixtures/data.ts` และ `lib/icons.ts` สร้างด้วยสคริปต์ ห้ามแก้มือ

## เอกสาร

- Spec ระบบรวม: `docs/superpowers/specs/2026-11-17-direct-sale-design.md`
- Spec หน้าเว็บ Next.js: `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md`
- รายการ feature ของ prototype (อ้างเลขบรรทัด `legacy/app.js`): `docs/superpowers/specs/2026-11-17-prototype-inventory.md`
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A)
- ฐานข้อมูล: `docs/DATABASE.md`
- ตัวช่วยเปิดแชต JST บนเครื่องเซลล์: `tools/jst-helper/README.md`

## Coding Conventions

1. **ข้อความบนหน้าจอเป็นภาษาไทย** ตรงตัวอักษรกับ prototype (ดู inventory) error จาก RPC แปลงผ่าน `toThaiError` เท่านั้น
2. **เวลา Asia/Bangkok:** "วันนี้"/เวลาทุกจุดใช้ `lib/format.ts` (`todayBangkok`, `nowStamp`, `localStamp`) ห้ามพึ่งเขตเวลาของเครื่อง วันที่เทียบเป็นข้อความ `YYYY-MM-DD`
3. **หน้าตา = prototype:** ใช้ class เดิมจาก `styles/prototype.css` ไม่แก้ไฟล์นั้น (ยกเว้นตัวแปรฟอนต์) ไม่ใช้ shadcn/ui และใช้ Tailwind utility ให้น้อยที่สุด (ไม่มี preflight/base)
4. **TypeScript strict** ห้าม `any`; logic ที่ทดสอบได้อยู่ใน `lib/` เป็นฟังก์ชันล้วนพร้อม `*.test.ts` (เขียน test ก่อน)
5. **Client Component** เฉพาะส่วนที่มี state/effect; state กลางอยู่ใน `AppProvider` (`useApp()`)
6. **Commit:** ข้อความอังกฤษแบบ conventional (`feat(web): …`, `feat(db): …`) จบด้วยบรรทัดว่าง + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ผู้เขียน git = DevTeamMPD ห้าม push/merge หรือเปลี่ยนการตั้งค่า Vercel โดยไม่ถามผู้ใช้
````

- [ ] **Step 2: ตรวจว่าทุก path ที่อ้างถึงมีอยู่จริง**

```bash
for f in docs/superpowers/specs/2026-11-17-direct-sale-design.md docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md \
         docs/superpowers/specs/2026-11-17-prototype-inventory.md docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md \
         docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md docs/DATABASE.md tools/jst-helper/README.md \
         tools/port-legacy.mjs tools/check-no-fixtures.mjs lib/fixtures/guard.test.ts styles/prototype.css legacy/index.html; do
  test -e "$f" || echo "missing: $f"
done
```

Expected: ไม่มี output

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with stack, dsales schema rules, test procedure and conventions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: ตรวจรอบสุดท้าย

**Files:** ไม่มีไฟล์ใหม่ (แก้เฉพาะถ้าเจอปัญหา)

- [ ] **Step 1: ตรวจอัตโนมัติตามลำดับ**

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:fixtures
npm run test:e2e
```

Expected:
- `typecheck`: ไม่มี output
- `lint`: `✔ No ESLint warnings or errors`
- `test`: `Test Files  12 passed (12)` · `Tests  52 passed (52)`
- `build`: สำเร็จ
- `check:fixtures`: `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server`
- `test:e2e`: `5 passed`

(หลัง `test:e2e` โฟลเดอร์ `.next` เป็นของโหมด dev ถ้าจะใช้ `npm start` ให้ `npm run build` ใหม่)

- [ ] **Step 2: Checklist ให้ผู้ใช้ทดสอบด้วยบัญชีจริง** — `.env.local` ตั้งค่าครบ และ `NEXT_PUBLIC_FIXTURES=0`; รัน `npm run build && npm start` แล้วเปิด http://localhost:3000

1. เปิด http://localhost:3000 → ไปหน้า `/login` เอง หน้าตาเหมือนหน้าล็อกอิน prototype (ไม่มีปุ่ม "ดูตัวอย่าง")
2. ใส่รหัสผิด → "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
3. ล็อกอินด้วยบัญชีหัวหน้า → ไป `/leads` เห็นชื่อตัวเองในกล่อง me ข้อความ "เข้าสู่ระบบแล้ว" และมีกลุ่มเมนู Tool → ตั้งค่า
4. กด F5 และปิด-เปิดเบราว์เซอร์ใหม่ → ยังล็อกอินอยู่ ไม่ต้องใส่รหัสซ้ำ
5. คลิกทุกเมนู → ชื่อหน้า/คำอธิบายถูก (แคมเปญแสดง "N แคมเปญ") ปุ่ม back ของเบราว์เซอร์ใช้ได้ ตัวเลข badge ตรงกับลีดที่มี
6. จอมือถือ (DevTools 375px) → ปุ่ม ☰ เปิดเมนู คลิกพื้นหลังหรือเปลี่ยนหน้าแล้วเมนูปิด
7. (ถ้ามีบัญชีพนักงานอื่นที่ไม่ใช่สมาชิก) ล็อกอินบัญชีนั้น → เห็น "ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า" + ปุ่มออกจากระบบ และใน DevTools → Network ไม่มีการเรียก `dsales_team` / `dsales_my_leads`
8. กด "ออกจากระบบ" → กลับหน้า `/login`; เปิด http://localhost:3000/leads ตรง ๆ → ถูกส่งกลับ `/login`

- [ ] **Step 3: Commit (เฉพาะถ้ามีการแก้จาก Step 1–2)**

```bash
git add -A
git commit -m "fix(web): address final verification findings for the Next.js foundation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## สิ่งที่แผนนี้ยังไม่ทำ (แผน B และ C)

**แผน B — หน้าลีดและแคมเปญ (parity กับ prototype)**
- `lib/domain/*`: `visible`, `mineOrAll`, `releasedByMe`, `isDnc`, `periodOk`, `contactedIn`, `wonIn`, `presetRange`, `filtered`, `sortLeads`, `canUnclaim`, `canUnclaimAny`, `bills`, `total` + unit test เทียบผลกับ `legacy/data.js`
- `lib/jst.ts`: `platformOf`, `channelsOf`, `jstTarget`, `jstOpen` (helper → urlTemplate → คัดลอก, timeout 2500 ms), ปุ่มโทร (`tel:` + คัดลอกเบอร์), `chatCheckFor` (ส่ง `claimedAtIso` เป็น `p_since`), `verifyMine` (สูงสุด 10 ลีด ทีละรายการ)
- การ์ดช่วงเวลา, toolbar ลีด, ตารางลีด 9 คอลัมน์, หน้า `/leads`, หน้า `/campaigns/[brand]` (การ์ดแคมเปญ, quota, ถังลูกค้าทั้งหมด debounce 300 ms + แบ่งหน้า 50)
- popup: รายละเอียดลูกค้า (แท็บ), บันทึกโทร/แชต, ยืนยันยกเลิกจอง, เลือกจากถัง, รายละเอียดลูกค้าในถัง, ตัวสร้างแคมเปญ
- ตอบสนอง RPC ในโหมด fixture สำหรับหน้าข้างบน และขยาย e2e ให้เทียบทุกหน้า/ทุก popup ของแผน B ที่ 375/1280 px

**แผน C — หน้าใหม่เฟส 1, Dashboard, ตั้งค่า และ deploy**
- `/mine` และ `/pool` (`dsales_base_customers`, ปุ่มเริ่มติดตาม/จอง/ยกเลิกจอง, `no_call` disabled, แบรนด์สำหรับจอง, "เป็นลูกค้าของ <ชื่อ/tag>", `total_count` จากหน้าแรก)
- `/dashboard` (KPI, เปรียบเทียบแบรนด์, ตารางค่าคอมรายเดือน + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด)
- `/setup`: ทีมเซลล์ (เพิ่มด้วยอีเมล `dsales_add_member`, ปิด/เปิด `dsales_set_member_active`), วิธีจองลีดของแคมเปญ, การ์ดผูก tag JST (`dsales_jst_admin_tags` / `dsales_member_tags` / `dsales_set_member_tags`)
- e2e เทียบภาพหน้าที่เหลือ, checklist ทุกหน้ากับข้อมูลจริง, อัปเดต README และ `CLAUDE.md` (ตัด `legacy/` ออกจากโครงไฟล์หลังลบ)
- Deploy: เปลี่ยน Framework Preset ของ Vercel เป็น Next.js + ตั้ง env, merge (ถามผู้ใช้ก่อน push/merge), ไล่ checklist บน production แล้วลบ `legacy/`
