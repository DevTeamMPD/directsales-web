# CLAUDE.md — MPD Direct Sale

บริบทสำหรับ Claude Code อ่านก่อนทำงานในโปรเจกต์นี้ทุกครั้ง

## โปรเจกต์นี้คืออะไร

เว็บแอป Direct Sale ของ MPD Group (แบรนด์ Bebeplay / Hosttail) ให้ทีมเซลล์โทร/แชตหาลูกค้าเก่า จองลูกค้าจากถัง ติดตามแคมเปญ และให้หัวหน้าดูภาพรวมทีม
- กำลังย้ายจาก prototype (HTML/JS ล้วน) เป็น Next.js ตามแผน A (ฐานราก) → B (หน้าลีด `/leads` + popup ลีด) → C (แคมเปญ + ถังลูกค้า, ลูกค้าของฉัน/ถังกลาง, Dashboard, ตั้งค่า, deploy)
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
  ui/                           # ChIcon, CloseButton, StatusBadge/DueTag
  leads/                        # PeriodCard, LeadToolbar, ContactBar, LeadTable, LeadsPage, useJst, useLeadActions, useVerifyMine
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal
lib/
  supabase/client.ts            # supabase() ใช้กับ auth, db() = schema('dsales')
  supabase/server.ts
  api/                          # types, map (mapLead/mapCampaign/mapPoolRow), errors (toThaiError), rpc (wrapper ทุก RPC)
  state/                        # reducer + AppProvider (context แยก state / actions / toast / modal) + session.ts, toast.ts
  domain/                       # period, leads, log (ฟังก์ชันล้วน มี test)
  jst.ts                        # ช่องทางแชต, jstOpen, ตรวจทักแชท (chatCheckFor / verifyMine)
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

ดึงข้อมูลฝั่ง client เป็นหลักเหมือน prototype: ทุก RPC เรียกผ่าน `lib/api/rpc.ts` (โยน `Error` ข้อความไทยจาก `toThaiError`) และหลังแก้ข้อมูลให้ `upsertLead(lead)` แทนการโหลดใหม่ทั้งหน้า แล้ว `dispatch({ type: 'invalidatePool' })` (ถังลูกค้าโหลดใหม่ = `ui.pool.loaded = false` ของ prototype)
- component ที่ไม่ต้องอ่าน state ใช้ `useActions()` (คงที่ ไม่ re-render) อ่าน state ด้วย `useAppState()`; toast/modal อยู่คนละ context
- error ระหว่างใช้งานหน้าแสดงด้วย `toastError(e)` เท่านั้น (reducer ไม่รับ `failed` หลัง phase `ready`)
- ตรวจแชตอัตโนมัติ (`useVerifyMine`) ตั้งใจให้รันเฉพาะตอนเข้าหน้า / เมื่อชุดลีดที่ต้องตรวจเปลี่ยน และไม่ถี่กว่าทุก 30 วินาที ห้ามแก้กลับเป็นตรวจทุกครั้งที่ render (ฐานข้อมูล production ใช้ร่วมกัน)

## Supabase (ใช้ร่วมกับระบบอื่น — ระวัง)

- Project `nroyacasuchqniaiuirk` เป็น **production ที่ใช้ร่วมกับระบบอื่นของบริษัท** (บัญชีพนักงาน ~150 คน, ตาราง JST / order / CDP ของระบบอื่น)
- **ของ Direct Sale อยู่ใน schema `dsales` เท่านั้น** (ชื่อขึ้นต้น `dsales_`) **ห้ามแก้ตาราง/function/view ของ schema อื่น** (`public`, `cdp`, `auth` …) อ่านได้อย่างเดียวผ่าน function `security definer` ใน `dsales`
- เข้าใช้ได้เฉพาะสมาชิกใน `dsales.dsales_members` ที่ `active = true` (`dsales_uid()` โยน `not_member`) และต้องมีหัวหน้า active อย่างน้อย 1 คนเสมอ (`last_admin`)
- RPC ใหม่ทุกตัว: `security definer`, `set search_path = dsales, public`, เรียก `dsales.dsales_uid()`, `revoke … from public, anon` แล้ว `grant execute … to authenticated`
- **กฎความปลอดภัยสำหรับงานต่อไป:** RPC ใหม่ทุกตัวที่คืนข้อมูลลูกค้าต้องเรียก `dsales.dsales_uid()` (ประตูสมาชิกเท่านั้น) และ **ห้าม grant สิทธิ์ตารางภายใน** (`dsales_customer_base`, `dsales_chat_links`, `dsales_settings`) ให้ `authenticated`/`anon` เด็ดขาด
- Migration เพิ่มเติมที่มีอยู่แล้ว (นอกเหนือจาก `dsales_members_only`):
  - `20261117100100_dsales_access_hardening.sql` — RLS ต้องเป็นสมาชิก active ผ่าน `dsales.dsales_is_member()`, ห้ามเขียน `dsales_members` ตรง ๆ (ต้องผ่าน RPC), RPC จัดการสมาชิกใช้ advisory lock
  - `20261117100200_dsales_revoke_truncate.sql` — ถอน TRUNCATE/TRIGGER/REFERENCES จาก `authenticated`/`anon`
  - test คู่กัน: `supabase/tests/06_members_only.sql`, `supabase/tests/06b_access_hardening.sql`
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

- e2e เทียบภาพกับ prototype ครอบคลุม `/leads` และ popup ลีดทั้งหมด (15 tests); ค่า limit วัดจริงด้วย `PARITY_MEASURE=1` (รัน 3 ครั้ง ×1.25) — ถ้าเกินให้วัดใหม่ ห้ามเพิ่ม limit เอง; สีตรวจด้วย computed-style
- **หลัง `npm run test:e2e` ให้รัน `npm run build` ใหม่ก่อน `npm run check:fixtures` เสมอ** (e2e เขียนทับ `.next` ด้วยผลลัพธ์ของ dev)

## โหมด fixture

- `NEXT_PUBLIC_FIXTURES=1 npm run dev` → ข้ามการล็อกอิน (middleware) และใช้ข้อมูลตัวอย่างจาก `legacy/data.js` (ผู้ใช้ "Dev MPD" หัวหน้า, วันนี้ = 2026-11-04) ใช้พัฒนาหน้าตาและรัน Playwright
- มีผลเฉพาะ `next dev`: เงื่อนไขต้องเขียนตรงตัว `process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'` และโหลด fixture ด้วย dynamic import ในเงื่อนไขนั้นเท่านั้น (`lib/fixtures/guard.test.ts` ตรวจ) ห้าม import `lib/fixtures` แบบปกติจากโค้ดหน้าเว็บ
- `lib/fixtures/data.ts` และ `lib/icons.ts` สร้างด้วยสคริปต์ ห้ามแก้มือ
- `state.live = false` ในโหมด fixture: ฝั่งอ่านทำแบบโหมดตัวอย่างของ prototype (ไม่โหลดประวัติซื้อ, ไม่รัน verifyMine, ตรวจแชตจากบันทึกในแอป) ปุ่มที่เขียนข้อมูลแสดง toast "โหมด fixture: ไม่ได้บันทึกลง Supabase"
- `/leads?claim=<leadId>` (เฉพาะโหมด fixture) ทำเหมือน Dev MPD จองลีดนั้น — e2e ใช้เปิด popup ยกเลิกจอง

## เอกสาร

- Spec ระบบรวม: `docs/superpowers/specs/2026-11-17-direct-sale-design.md`
- Spec หน้าเว็บ Next.js: `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md`
- รายการ feature ของ prototype (อ้างเลขบรรทัด `legacy/app.js`): `docs/superpowers/specs/2026-11-17-prototype-inventory.md`
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A), `docs/superpowers/plans/2026-11-18-nextjs-plan-b-leads.md` (แผน B)
- ฐานข้อมูล: `docs/DATABASE.md`
- ตัวช่วยเปิดแชต JST บนเครื่องเซลล์: `tools/jst-helper/README.md`

## Coding Conventions

1. **ข้อความบนหน้าจอเป็นภาษาไทย** ตรงตัวอักษรกับ prototype (ดู inventory) error จาก RPC แปลงผ่าน `toThaiError` เท่านั้น
2. **เวลา Asia/Bangkok:** "วันนี้"/เวลาทุกจุดใช้ `lib/format.ts` (`todayBangkok`, `nowStamp`, `localStamp`) ห้ามพึ่งเขตเวลาของเครื่อง วันที่เทียบเป็นข้อความ `YYYY-MM-DD`
3. **หน้าตา = prototype:** ใช้ class เดิมจาก `styles/prototype.css` ไม่แก้ไฟล์นั้น (ยกเว้นตัวแปรฟอนต์) ไม่ใช้ shadcn/ui และใช้ Tailwind utility ให้น้อยที่สุด (ไม่มี preflight/base)
4. **TypeScript strict** ห้าม `any`; logic ที่ทดสอบได้อยู่ใน `lib/` เป็นฟังก์ชันล้วนพร้อม `*.test.ts` (เขียน test ก่อน)
5. **Client Component** เฉพาะส่วนที่มี state/effect; state กลางอยู่ใน `AppProvider` (`useApp()`)
6. **Commit:** ข้อความอังกฤษแบบ conventional (`feat(web): …`, `feat(db): …`) จบด้วยบรรทัดว่าง + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ผู้เขียน git = DevTeamMPD ห้าม push/merge หรือเปลี่ยนการตั้งค่า Vercel โดยไม่ถามผู้ใช้
7. **ห้าม push branch หลัก (`claude/serene-meitner-cprt82`) จนกว่าจะถึงขั้น deploy ของแผน C:** Vercel deploy จาก branch นี้ และโค้ดในเครื่องย้าย `index.html` ไป `legacy/` แล้ว push ก่อนเวลา = เว็บบน Vercel พังจนกว่าจะเปลี่ยน Framework Preset เป็น Next.js
8. **Tailwind:** ห้ามใช้ utility ที่ชื่อชนกับ class ของ prototype (มีใน `blocklist` ของ `tailwind.config.ts` เช่น `outline`) เจอชื่อชนเพิ่มให้เพิ่มใน blocklist
9. อย่ารัน `npm run test:e2e` ขณะเปิด `npm start` อยู่ (ใช้ `.next` ร่วมกัน)

## งานค้างสำหรับแผน C

- ประสิทธิภาพต่อแถว: `ChatButton` แต่ละปุ่มเรียก `useJst()` (subscribe context ต่อปุ่ม) ถ้าพิมพ์ค้นหาแล้วหน่วงเมื่อลีดเยอะ ให้ยก `openJst` ไปไว้ที่ `LeadTable` และ `memo(LeadRow)`
- session หมดอายุระหว่างใช้งาน: ตอนนี้ error จาก RPC แสดงแค่ toast ควรพิจารณา redirect/ขึ้นข้อความให้ล็อกอินใหม่เมื่อเจอ error แนว 401 / JWT expired / `not_member`
- StrictMode (dev เท่านั้น): `loadLive` ที่ถูกยกเลิกอาจยัง redirect ได้
- คลิกแท็บที่ active อยู่แล้วใน popup ลูกค้า ยังไม่รีเซ็ต scroll/โฟกัสเหมือน prototype (เล็กน้อย)
- `docs/DATABASE.md` และ `README.md` ยังอธิบายโครงสร้างเดิม (public/`index.html`/ลงทะเบียนอัตโนมัติ) ต้องอัปเดต
- หน้าแคมเปญใช้ `LeadTable` กับ `opts.mode` / `opts.perCamp` (ปุ่มจอง + `maxPerRep` + เปิด JST อัตโนมัติ, select มอบหมาย มีแล้ว) และโหลดถังใหม่เมื่อ `state.poolVersion` เปลี่ยน; ถ้า `ui.focusSearch` เป็นจริงให้ล้างคำค้นถัง โฟกัสช่อง `#pool-q` จนโหลดเสร็จแล้วตั้งกลับเป็น false
- รายการแผน C ที่เหลือ (แคมเปญ/ถังลูกค้า/popup E,F/Dashboard/ตั้งค่า/`/mine`/`/pool`/รอบมือถือ/deploy) ดู "สิ่งที่แผนนี้ยังไม่ทำ" ใน `docs/superpowers/plans/2026-11-18-nextjs-plan-b-leads.md`
