# CLAUDE.md — MPD Direct Sale

บริบทสำหรับ Claude Code อ่านก่อนทำงานในโปรเจกต์นี้ทุกครั้ง

## โปรเจกต์นี้คืออะไร

เว็บแอป Direct Sale ของ MPD Group (แบรนด์ Bebeplay / Hosttail) ให้ทีมเซลล์โทร/แชตหาลูกค้าเก่า จองลูกค้าจากถัง ติดตามแคมเปญ และให้หัวหน้าดูภาพรวมทีม
- กำลังย้ายจาก prototype (HTML/JS ล้วน) เป็น Next.js ตามแผน A (ฐานราก) → B (หน้าลีด `/leads` + popup ลีด) → C (แคมเปญ + ถังลูกค้า, ลูกค้าของฉัน/ถังกลาง, Dashboard, ตั้งค่า, deploy)
- **หน้าตา (look & feel) = ดีไซน์ "Direct Sale CRM"** (Design canvas https://claude.ai/artifact/N7DcekkiVt4LcQSNYYLKWz ผู้ใช้เลือกเมื่อ 2026-11-20) ใช้เฉพาะสี ฟอนต์ ระยะ มุมโค้ง และสไตล์ของชิป/ปุ่ม/การ์ด ไม่ได้เปลี่ยนโครงหน้าหรือการทำงาน — ฟีเจอร์ในดีไซน์ที่ไม่มีข้อมูลรองรับหรือไม่เหมาะกับทีม (หน้าแชท, kanban/pipeline) ตัดออกแล้ว ห้ามเพิ่มกลับโดยไม่ถาม
- **`legacy/` เหลือไว้อ้างอิงการทำงานและข้อความเท่านั้น (ไม่ใช่หน้าตา)** e2e ยังเทียบข้อความ/ช่องกรอก/ปุ่มกับ prototype สงสัยการทำงานให้เปิด `legacy/index.html` (กด "ดูตัวอย่างโดยไม่ล็อกอิน") หรืออ่าน `legacy/app.js` ตามเลขบรรทัดใน inventory
- ห้ามแก้ไฟล์ใน `legacy/` จะลบทิ้งหลัง deploy Next.js และผู้ใช้ตรวจ production ครบ (แผน C)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| UI | `styles/tokens.css` (สี/มุมโค้ง/เงา light + dark) + `styles/app.css` (class เดิมของ prototype ปรับเป็นดีไซน์ใหม่) + Tailwind CSS 3 แบบปิด preflight (ใช้ให้น้อยที่สุด) |
| ฟอนต์ | IBM Plex Sans Thai / IBM Plex Mono ผ่าน `next/font/google` |
| Database / Auth | Supabase (PostgreSQL 15) ผ่าน `@supabase/ssr` (session ใน cookie) |
| Test | Vitest (unit) + Playwright (ภาพเทียบ baseline ของตัวเอง + เนื้อหาเทียบ prototype) |
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
  ui/                           # ChIcon, CloseButton, StatusBadge/DueTag
  leads/                        # PeriodCard, LeadToolbar, ContactBar, LeadTable, LeadsPage, useJst, useLeadActions, useVerifyMine
  campaigns/                    # CampaignPage, CampaignCards, PoolPanel, BasePage (/mine /pool), RowButton, BrandTags, useCustomerClaim
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal, PoolDetailModal (E), CampaignFormModal (F)
  dashboard/DashboardPage.tsx   # KPI, เปรียบเทียบแบรนด์, ค่าคอม + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด
  setup/SetupPage.tsx           # ทีม (เพิ่มด้วยอีเมล/ปิดใช้งาน), วิธีจองของแคมเปญ, ผูก tag JST
lib/
  supabase/client.ts            # supabase() ใช้กับ auth, db() = schema('dsales')
  supabase/server.ts
  api/                          # types, map (mapLead/mapCampaign/mapPoolRow), errors (toThaiError), rpc (wrapper ทุก RPC)
  state/                        # reducer + AppProvider (context แยก state / actions / toast / modal) + session.ts, toast.ts, busy.ts
  domain/                       # period, leads, log, campaigns, pool, dashboard, setup (ฟังก์ชันล้วน มี test)
  jst.ts                        # ช่องทางแชต, jstOpen, ตรวจทักแชท (chatCheckFor / verifyMine)
  fixtures/                     # โหมด fixture (next dev เท่านั้น)
  format.ts constants.ts phone.ts icons.ts routes.ts nav.ts
styles/tokens.css styles/app.css # design tokens + stylesheet ทั้งแอป
legacy/                         # prototype เดิม (อ้างอิงการทำงาน/ข้อความ)
supabase/migrations/            # migration ของ schema dsales
supabase/tests/                 # SQL test (begin … rollback)
tools/                          # port-legacy.mjs, check-no-fixtures.mjs, jst-helper/, db/
e2e/                            # Playwright: visual (baseline ใน e2e/__screenshots__/), mobile-fit (390px), outreach
docs/                           # spec, plan, DATABASE.md
```

ดึงข้อมูลฝั่ง client เป็นหลักเหมือน prototype: ทุก RPC เรียกผ่าน `lib/api/rpc.ts` (โยน `RpcError` ข้อความไทยจาก `toThaiError`) และหลังแก้ข้อมูลให้ `upsertLead(lead)` แทนการโหลดใหม่ทั้งหน้า แล้ว `dispatch({ type: 'invalidatePool' })` (ถังลูกค้าโหลดใหม่ = `ui.pool.loaded = false` ของ prototype)
- component ที่ไม่ต้องอ่าน state ใช้ `useActions()` (คงที่ ไม่ re-render) อ่าน state ด้วย `useAppState()`; toast/modal อยู่คนละ context
- error ระหว่างใช้งานหน้าแสดงด้วย `toastError(e)` เท่านั้น (reducer ไม่รับ `failed` หลัง phase `ready`)
- ถังลูกค้า: ส่วนที่คงค่าข้ามหน้า (แบรนด์/คำค้น/หน้า/จำนวนรวม) อยู่ใน `state.pool` (`setPool`) แถวที่โหลดอยู่ใน `PoolPanel` / `BasePage` และโหลดใหม่เมื่อ mount / `poolVersion` / คำค้น (debounce 300 ms) / หน้า / ช่วงวันที่เปลี่ยน
- `rpc.ts` โยน `RpcError` (ข้อความไทย + `kind`): `toastError` / `handleAuthError` เปลี่ยนเป็นการ์ด "หมดเวลาการเข้าสู่ระบบ" (`auth`) หรือ "ถูกปิดใช้งาน" (`member`) เอง — โค้ดที่ catch error แล้วไม่ใช้ `toastError` ต้องเรียก `handleAuthError(e)` ก่อนแสดง error ในหน้า
- ปุ่มที่เรียก RPC เขียนข้อมูลกันกดซ้ำด้วย `once(key, fn)` ของ `useActions()`
- ตรวจแชตอัตโนมัติ (`useVerifyMine`) ตั้งใจให้รันเฉพาะตอนเข้าหน้า / เมื่อชุดลีดที่ต้องตรวจเปลี่ยน โดยชุดลีดเดิมต้องห่างกันอย่างน้อย 30 วินาที ส่วนชุดที่เปลี่ยนรันทันที (รอรอบที่กำลังรันจบก่อน) ห้ามแก้กลับเป็นตรวจทุกครั้งที่ render (ฐานข้อมูล production ใช้ร่วมกัน)

## Supabase (ใช้ร่วมกับระบบอื่น — ระวัง)

- Project `nroyacasuchqniaiuirk` เป็น **production ที่ใช้ร่วมกับระบบอื่นของบริษัท** (บัญชีพนักงาน ~150 คน, ตาราง JST / order / CDP ของระบบอื่น)
- **ของ Direct Sale อยู่ใน schema `dsales` เท่านั้น** (ชื่อขึ้นต้น `dsales_`) **ห้ามแก้ตาราง/function/view ของ schema อื่น** (`public`, `cdp`, `auth` …) อ่านได้อย่างเดียวผ่าน function `security definer` ใน `dsales`
- เข้าใช้ได้เฉพาะสมาชิกใน `dsales.dsales_members` ที่ `active = true` (`dsales_uid()` โยน `not_member`) และต้องมีหัวหน้า active อย่างน้อย 1 คนเสมอ (`last_admin`)
- RPC ใหม่ทุกตัว: `security definer`, `set search_path = dsales, public`, เรียก `dsales.dsales_uid()`, `revoke … from public, anon` แล้ว `grant execute … to authenticated`
- **กฎความปลอดภัยสำหรับงานต่อไป:** RPC ใหม่ทุกตัวที่คืนข้อมูลลูกค้าต้องเรียก `dsales.dsales_uid()` (ประตูสมาชิกเท่านั้น; RPC ของ worker ใช้ `dsales.dsales_worker_uid()`) และ **ห้าม grant สิทธิ์ตารางภายใน** (`dsales_customer_base`, `dsales_chat_links`, `dsales_settings`, `dsales_templates`, `dsales_outreach_batches`, `dsales_outreach_queue`, `dsales_worker_status`) ให้ `authenticated`/`anon` เด็ดขาด
- Migration เพิ่มเติมที่มีอยู่แล้ว (นอกเหนือจาก `dsales_members_only`):
  - `20261117100100_dsales_access_hardening.sql` — RLS ต้องเป็นสมาชิก active ผ่าน `dsales.dsales_is_member()`, ห้ามเขียน `dsales_members` ตรง ๆ (ต้องผ่าน RPC), RPC จัดการสมาชิกใช้ advisory lock
  - `20261117100200_dsales_revoke_truncate.sql` — ถอน TRUNCATE/TRIGGER/REFERENCES จาก `authenticated`/`anon`
  - test คู่กัน: `supabase/tests/06_members_only.sql`, `supabase/tests/06b_access_hardening.sql`
  - `20261119120000_dsales_diff_refresh.sql` (มาจาก PR #3 บน `main`) — refresh เขียนเฉพาะแถวที่เปลี่ยน + cron เปลี่ยนเป็นวันละ 3 รอบ
  - `20261119130000_dsales_set_member_tags_fast.sql` — `dsales_set_member_tags` / `dsales_set_member_active` ไม่เรียก `dsales_refresh_customer_base()` แล้ว (หนัก เกิน `statement_timeout` 8 วินาทีของ `authenticated`) แต่อัปเดต `dsales_customer_base.owner_id` ในที่เดิมจาก `owner_tag` (~0.04 วินาที) บันทึก tag/ปิด-เปิดสมาชิกมีผลกับความเป็นเจ้าของทันที ส่วนการเปลี่ยน tag ฝั่ง JST ของลูกค้ายังรอ cron รอบถัดไป; test คู่กัน: `supabase/tests/07_member_tags_fast.sql`
  - `20261120100000`–`20261120100600` (`dsales_outreach_tables`, `dsales_templates`, `dsales_outreach_room`, `dsales_outreach_enqueue`, `dsales_outreach_batches`, `dsales_worker_rpcs`, `dsales_worker_settings`) — คิวส่งข้อความเป็นชุดผ่าน JST worker: ตาราง `dsales_templates` / `dsales_outreach_batches` / `dsales_outreach_queue` / `dsales_worker_status` (ภายใน ไม่มี grant), RPC ของเว็บ (template, preview/enqueue, ความคืบหน้า/ยกเลิก, สถานะ/ตั้งค่า worker, `dsales_worker_find_rooms` ค้นห้องทดสอบ — หัวหน้าเท่านั้น) และของ worker (`dsales_worker_claim` / `_report` / `_heartbeat` ตรวจ `worker_user_ids` ผ่าน `dsales_worker_uid()`); **โหมดทดสอบเปิดเป็นค่าเริ่ม และ = ส่งไปห้องทดสอบแทน** (claim คืน `target_ms_id` = ห้องแรกใน `outreach_test_ms_ids` + ข้อความขึ้นต้น `[ทดสอบ → …]`, รายงาน sent ไม่เขียน interaction/ไม่เปลี่ยนสถานะลีด, ไม่มีห้องทดสอบ = claim คืน null) worker ต้องส่งไปที่ `target_ms_id` เสมอ; test คู่กัน `supabase/tests/08_*`–`08g_*`; สัญญา DB/worker/เว็บ `docs/superpowers/plans/2026-11-20-outreach-contract.md`
  - `20261120150000_dsales_buyer_id_room_links.sql` — ผูกห้องแชตด้วยรหัสผู้ซื้อ (`order_tracking.buyer_account_no` = `outer_user_id` ของห้อง JST): worker ค้น JST ตอนไม่มีงานส่ง (`dsales_worker_link_targets` / `_link_save`), ตาราง `dsales_jst_rooms` / `dsales_buyer_lookups` (ภายใน ไม่มี grant), view `dsales_rooms_v` (= `iim_sessions` + ห้องที่มีเฉพาะใน JST) ที่ฟังก์ชันเลือกห้องทุกตัวอ่าน; test `supabase/tests/10_buyer_id_room_links.sql` (รายละเอียด `docs/DATABASE.md`); ตามด้วย `20261123060000_dsales_sendable_rooms_fast.sql` / `20261123063000_dsales_room_lookup_fast.sql` (ฟังก์ชันรายเบอร์อ่านห้องผ่าน `dsales_room_of(ms_id)` ที่ inline ได้ — **ห้าม join `dsales_rooms_v` รายเบอร์ตรง ๆ** planner จะ hash ทั้ง view ช้าเป็นสิบวินาที)
- cron `dsales-refresh-customer-base` รันวันละ 3 รอบ 07:05, 12:05, 16:05 น. (`5 0,5,9 * * *` UTC, เปลี่ยนใน production 2026-11-19) และเขียนเฉพาะแถวที่เปลี่ยน — DB ใช้ร่วมหลายแอป อย่าเพิ่มรอบโดยไม่จำเป็น (ดู `docs/DATABASE.md` หัวข้อ 3)
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
npm run test:e2e         # Playwright (เปิดพอร์ต 4100 = legacy/ และ 3100 = next dev โหมด fixture เอง ต้องต่ออินเทอร์เน็ต)
node tools/port-legacy.mjs icons                     # สร้าง lib/icons.ts ใหม่
TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures  # สร้าง lib/fixtures/data.ts ใหม่
```

- e2e ครอบคลุม `/leads`, หน้าแคมเปญ + ถังลูกค้า, `/mine` `/pool` `/outreach`, Dashboard, ตั้งค่า และ popup A–F ที่ 390×844 และ 1440×900: **ภาพ**เทียบกับ baseline ของตัวเองที่ commit ไว้ใน `e2e/__screenshots__/` (ตั้งใจเปลี่ยนหน้าตา → `npx playwright test --update-snapshots=changed` แล้วตรวจภาพด้วยตาก่อน commit) ส่วน**ข้อความ/ช่องกรอก/ปุ่ม/focus**ยังเทียบกับ `legacy/` ตรงตัว
- `e2e/mobile-fit.spec.ts`: ทุกหน้าที่ 390px ต้องไม่เลื่อนแนวนอน, topbar อยู่แถวเดียว, ชิปสถานะอยู่แถวเดียว (เลื่อนข้าง) และปุ่ม/ช่องกรอกสูง ≥ 44px — เมนู/ปุ่มบนมือถือต้องสั้น (ปุ่ม topbar ที่ข้อความยาวใช้ `.lbl-long` + `.lbl-short`)
- teeth check (`PARITY_INJECT_CSS`): ฉีด CSS เข้าฝั่ง Next แล้ว test ภาพต้องล้ม (เช่น `.kpi-value { font-size: 26px; }`)
- **หลัง `npm run test:e2e` ให้รัน `npm run build` ใหม่ก่อน `npm run check:fixtures` เสมอ** (e2e เขียนทับ `.next` ด้วยผลลัพธ์ของ dev)

## โหมด fixture

- `NEXT_PUBLIC_FIXTURES=1 npm run dev` → ข้ามการล็อกอิน (middleware) และใช้ข้อมูลตัวอย่างจาก `legacy/data.js` (ผู้ใช้ "Dev MPD" หัวหน้า, วันนี้ = 2026-11-04) ใช้พัฒนาหน้าตาและรัน Playwright
- มีผลเฉพาะ `next dev`: เงื่อนไขต้องเขียนตรงตัว `process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'` และโหลด fixture ด้วย dynamic import ในเงื่อนไขนั้นเท่านั้น (`lib/fixtures/guard.test.ts` ตรวจ) ห้าม import `lib/fixtures` แบบปกติจากโค้ดหน้าเว็บ
- `lib/fixtures/data.ts` และ `lib/icons.ts` สร้างด้วยสคริปต์ ห้ามแก้มือ
- `state.live = false` ในโหมด fixture: ฝั่งอ่านทำแบบโหมดตัวอย่างของ prototype (ไม่โหลดประวัติซื้อ, ไม่รัน verifyMine, ตรวจแชตจากบันทึกในแอป) ปุ่มที่เขียนข้อมูลแสดง toast "โหมด fixture: ไม่ได้บันทึกลง Supabase"
- `state.customers` = ลูกค้าตัวอย่างของ `legacy/data.js` (โหมด fixture เท่านั้น ล็อกอินจริงเป็น `[]` เหมือน prototype) ใช้กับถังลูกค้า (`demoPool`), การ์ดถัง, funnel ของตัวสร้างแคมเปญ และ `/mine` `/pool` (`demoBase`)
- `/leads?claim=<leadId>` (เฉพาะโหมด fixture) ทำเหมือน Dev MPD จองลีดนั้น — e2e ใช้เปิด popup ยกเลิกจอง

## เอกสาร

- Spec ระบบรวม: `docs/superpowers/specs/2026-11-17-direct-sale-design.md`
- Spec หน้าเว็บ Next.js: `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md`
- รายการ feature ของ prototype (อ้างเลขบรรทัด `legacy/app.js`): `docs/superpowers/specs/2026-11-17-prototype-inventory.md`
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A), `docs/superpowers/plans/2026-11-18-nextjs-plan-b-leads.md` (แผน B), `docs/superpowers/plans/2026-11-19-nextjs-plan-c1-campaigns-pool.md` / `2026-11-19-nextjs-plan-c2-dashboard-setup-deploy.md` (แผน C)
- ส่งข้อความเป็นชุดผ่าน JST worker: spec `docs/superpowers/specs/2026-11-20-jst-outreach-worker-design.md`, แผน DB `docs/superpowers/plans/2026-11-20-outreach-d1-capture-db.md`, สัญญา DB/worker/เว็บ `docs/superpowers/plans/2026-11-20-outreach-contract.md`
- ฐานข้อมูล: `docs/DATABASE.md` (schema `dsales`, สิทธิ์สมาชิก, RPC ทั้งหมด)
- ตัวช่วยเปิดแชต JST บนเครื่องเซลล์: `tools/jst-helper/README.md`

## Coding Conventions

1. **ข้อความบนหน้าจอเป็นภาษาไทย** ข้อความเดิมคงตัวอักษรตาม prototype (ดู inventory) ข้อความใหม่ตามดีไซน์ error จาก RPC แปลงผ่าน `toThaiError` เท่านั้น
2. **เวลา Asia/Bangkok:** "วันนี้"/เวลาทุกจุดใช้ `lib/format.ts` (`todayBangkok`, `nowStamp`, `localStamp`) ห้ามพึ่งเขตเวลาของเครื่อง วันที่เทียบเป็นข้อความ `YYYY-MM-DD`
3. **หน้าตา = ดีไซน์ "Direct Sale CRM":** สี/มุมโค้ง/เงาใช้ตัวแปรจาก `styles/tokens.css` เท่านั้น ห้าม hard-code สีใน component หรือ `styles/app.css` (ยกเว้น `#fff` บนพื้นสีทึบ) และต้องมีค่า dark mode ทุกตัวแปร · class อยู่ใน `styles/app.css` · บนมือถือ (≤ 760px) จุดแตะ ≥ 44px (`--tap`), ช่องกรอก 16px, popup เปิดเป็น bottom sheet · ไม่ใช้ shadcn/ui และใช้ Tailwind utility ให้น้อยที่สุด (ไม่มี preflight/base)
4. **TypeScript strict** ห้าม `any`; logic ที่ทดสอบได้อยู่ใน `lib/` เป็นฟังก์ชันล้วนพร้อม `*.test.ts` (เขียน test ก่อน)
5. **Client Component** เฉพาะส่วนที่มี state/effect; state กลางอยู่ใน `AppProvider` (`useApp()`)
6. **Commit:** ข้อความอังกฤษแบบ conventional (`feat(web): …`, `feat(db): …`) จบด้วยบรรทัดว่าง + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ผู้เขียน git = DevTeamMPD ห้าม push/merge หรือเปลี่ยนการตั้งค่า Vercel โดยไม่ถามผู้ใช้
7. **Deploy:** Vercel production = branch `main` ของ GitHub (ไม่ใช่ `claude/serene-meitner-cprt82`) branch อื่นได้แค่ Preview deployment · `vercel.json` กำหนด `framework: nextjs` ต่อ deployment เอง (ไม่ต้องเปลี่ยน Framework Preset ของโปรเจกต์) · ขึ้น production = merge PR #2 (`claude/serene-meitner-cprt82` → `main`) — ถามผู้ใช้ก่อนทุกครั้งทั้ง push และ merge
8. **Tailwind:** ห้ามใช้ utility ที่ชื่อชนกับ class ใน `styles/app.css` (มีใน `blocklist` ของ `tailwind.config.ts` เช่น `outline`) เจอชื่อชนเพิ่มให้เพิ่มใน blocklist
9. อย่ารัน `npm run test:e2e` ขณะเปิด `npm start` อยู่ (ใช้ `.next` ร่วมกัน)

## งานค้าง (หลังแผน C)

- funnel ของตัวสร้างแคมเปญเป็น 0 ตอนล็อกอินจริง และแคมเปญยังไม่สร้างลีดจาก `criteria` (ต้องมี RPC ใหม่ — เฟส 2)
- โหมด `auto` ยังอ่านเป็น `self` และปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" ขึ้น "ไม่มีลีดที่ต้องจัดสรร" เสมอ (ยังไม่มีการผูกผู้ขายล่าสุดกับเซลล์)
- ผลตรวจทักแชตไม่ถูกบันทึกลง DB (ดู `docs/DATABASE.md` ข้อ 5.5)
- `dsales_set_member_tags` / `dsales_set_member_active` ยังไม่ถือ advisory lock ของ refresh: ถ้าหัวหน้าบันทึกตรงกับช่วง ~3 วินาทีที่ cron รัน owner_id อาจถูกเขียนทับด้วยค่าเก่าจนถึงรอบถัดไป (เติม `pg_advisory_xact_lock(hashtext('dsales_refresh_customer_base'))`) และ `set_member_tags` ยังไม่ถือ `dsales_admin_guard` lock
- **RFM segment แบบระบบเก่า (ทำหลังจบงาน worker ทักแชต):** นิยามกลุ่ม + แคมเปญแนะนำ อยู่ใน `docs/superpowers/specs/2026-11-20-rfm-segments-backlog.md`
- `getMyLeads(1000, 0)` โหลดลีดสูงสุด 1,000 แถว Dashboard และ /leads จะตัดเงียบเมื่อเกิน
