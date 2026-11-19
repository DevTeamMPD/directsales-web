# Direct Sale Next.js · แผน C: แคมเปญ, ถังลูกค้า, Dashboard, ตั้งค่า, deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **แผน C แบ่งเป็น 2 ไฟล์** (ยาวเกินกว่าจะอยู่ไฟล์เดียว): **C1 (ไฟล์นี้)** = งานค้างจากแผน B + หน้าแคมเปญ/ถังลูกค้า/popup E, F + `/mine` `/pool` + e2e ของหน้าเหล่านี้ · **C2** (`2026-11-19-nextjs-plan-c2-dashboard-setup-deploy.md`) = Dashboard, ตั้งค่า, รอบมือถือ, เอกสาร, deploy และย้าย `legacy/` — ทำ C1 ให้จบก่อน C2 เสมอ

**Goal:** ย้ายหน้าแคมเปญ Bebeplay/Hosttail (`/campaigns/[brand]`) ของ prototype มาเป็น Next.js ให้หน้าตาและการทำงานเหมือนเดิมทุกจุด — การ์ดถัง "ลูกค้าทั้งหมด", "ลูกค้าทุกแคมเปญ", การ์ดแต่ละแคมเปญ, ถังลูกค้า (`dsales_customer_pool_v4` + จำนวนรวมจาก v3, ค้นหา debounce 300 ms, แบ่งหน้า 50, จอง/ยกเลิกจอง), ตารางลีดของแคมเปญ (จอง + `maxPerRep` + เปิด JST อัตโนมัติ, มอบหมาย), popup E (รายละเอียดลูกค้าในถัง) และ popup F (ตัวสร้างแคมเปญ) — เพิ่มหน้าใหม่เฟส 1 `/mine` และ `/pool` (`dsales_base_customers`) และเก็บงานค้างของแผน B (กันกดซ้ำ, บันทึกซ้ำเมื่อสำเร็จบางขั้น, session หมดอายุระหว่างใช้งาน, error เครือข่ายเป็นภาษาไทย, วันนี้ข้ามเที่ยงคืน, ประสิทธิภาพต่อแถว, StrictMode redirect, คลิกแท็บเดิมใน popup ลูกค้า)

**Architecture:** กติกาทั้งหมดเป็นฟังก์ชันล้วนใน `lib/domain/{campaigns,pool}.ts` (Vitest เทียบค่ากับโค้ด `legacy/app.js` ตรงตัวบนข้อมูลตัวอย่าง) ส่วน React ใช้ class/markup/ข้อความเดิมของ prototype ตรงตัว state ที่คงค่าข้ามหน้าของถัง (แบรนด์ คำค้น หน้า จำนวนรวม) อยู่ใน reducer (`state.pool`) ส่วนแถวที่โหลดมาอยู่ใน component (โหลดใหม่ทุกครั้งที่เข้าหน้า = prototype `ui.pool.loaded = false`) โหมด fixture มี `state.customers` (ลูกค้าตัวอย่างของ `legacy/data.js`) เพื่อให้ถัง/การ์ด/funnel ทำแบบโหมดตัวอย่างของ prototype ทุกอย่าง (ล็อกอินจริง `customers = []` เหมือน prototype) — Playwright จึงเทียบหน้าแคมเปญ/ถัง/popup E, F กับ prototype ได้ทั้ง DOM และภาพ ทุก RPC ผ่าน `lib/api/rpc.ts` ซึ่งตอนนี้โยน `RpcError` (ข้อความไทย + ประเภท auth/member/network) ให้ `toastError` / `handleAuthError` ตัดสินว่าต้องแสดงการ์ด "หมดเวลาการเข้าสู่ระบบ" หรือไม่

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, `@supabase/ssr` 0.10, `styles/prototype.css` (Tailwind 3 ปิด preflight ใช้น้อยที่สุด), Vitest 3 (environment `node`, เฉพาะ `lib/**/*.test.ts`), Playwright 1.65 (Chromium, `Asia/Bangkok`)

**Spec:** `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md` (ข้อ 2 แถวหน้า/Popup/กติกาลีด/JST/พฤติกรรมย่อย, ข้อ 3 หน้าใหม่เฟส 1 + การจัดการตามผู้ตรวจ RPC, ข้อ 6) + `docs/superpowers/specs/2026-11-17-prototype-inventory.md` (ข้อ 2 `#campaign-*` + pool panel, ข้อ 3 E/F, ข้อ 4 campaign model/claim modes/`maxPerRep`/`applyAuto`, ข้อ 5 pool v3/v4/claim/campaigns insert, ข้อ 6, ข้อ 10) + `CLAUDE.md` หัวข้อ "งานค้างสำหรับแผน C"

---

## วิธีรัน

- ติดตั้ง/ตั้งค่าเหมือนแผน A/B (`npm install`, `.env.local` จาก `.env.example`) ทุกคำสั่งเขียนแบบ bash (Git Bash บน Windows ใช้ได้; PowerShell ใช้ `$env:VAR='x'; คำสั่ง` แทน `VAR=x คำสั่ง`)
- ตรวจ: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run check:fixtures` (หลัง build) · `npm run test:e2e` (เปิด prototype ที่พอร์ต 4100 และ `next dev` โหมด fixture ที่พอร์ต 3100 ให้เอง ต้องต่ออินเทอร์เน็ต — ถ้ามี static server ของ `legacy/` เปิดอยู่ที่ 4100 แล้ว Playwright ใช้ตัวนั้นต่อ)
- ดูหน้าด้วยตาโหมด fixture: `NEXT_PUBLIC_FIXTURES=1 npx next dev -p 3200 -H 127.0.0.1` แล้วเปิด http://127.0.0.1:3200/campaigns/bebeplay เทียบกับ prototype http://127.0.0.1:4100/index.html → "ดูตัวอย่างโดยไม่ล็อกอิน" → เมนูแคมเปญ Bebeplay
- **`next dev`, `npm run build`, `npm run test:e2e` และ `npm start` ใช้ `.next` ร่วมกัน:** ปิด `npm start` ก่อน และหลัง `test:e2e` ต้อง `npm run build` ใหม่ก่อน `check:fixtures` / `npm start` (CLAUDE.md ข้อ 9)
- แผนนี้ **ไม่แก้ DB** (ไม่มี migration ไม่มี grant ใหม่) — RPC/ตารางที่ใช้มีอยู่แล้วและตรวจ signature กับ catalog แล้ว (ดูหัวข้อ "ข้อมูลที่ตรวจแล้ว") ห้ามรัน SQL ที่เขียนข้อมูล
- จำนวน test ที่ต้องได้หลังแต่ละ Task (เริ่มที่ Vitest 114 test / 19 ไฟล์ และ e2e 15 test):

| หลัง Task | Vitest files | Vitest tests | e2e |
|---|---|---|---|
| เริ่มต้น | 19 | 114 | 15 |
| 1 | 20 | 126 | 15 |
| 2 | 20 | 127 | 15 |
| 3 | 22 | 150 | 15 |
| 4 | 22 | 150 | 15 |
| 5 | 22 | 150 | 15 |
| 6 | 22 | 150 | 15 |
| 7 | 22 | 150 | 15 |
| 8 | 22 | 150 | 25 |
| 9 | 22 | 150 | 25 |

## Branch

ทำงานบน branch ใหม่จาก `claude/serene-meitner-cprt82` (แผน A และ B merge แล้ว) — C2 ทำต่อบน branch เดียวกัน:

```bash
git switch -c feat/nextjs-plan-c claude/serene-meitner-cprt82
```

## Deploy (สำคัญ)

- **C1 ไม่ deploy:** ห้าม push / merge และห้ามเปลี่ยนการตั้งค่า Vercel (CLAUDE.md ข้อ 6–7) — Vercel ยัง deploy prototype แบบ static จาก `claude/serene-meitner-cprt82`; ขั้น deploy ทั้งหมดอยู่ใน C2 Task 7 และต้องให้ผู้ใช้ยืนยันทีละขั้น
- งาน C1 จบที่ commit บน `feat/nextjs-plan-c` ในเครื่อง
- checklist ด้วยบัญชีจริง (Task 9 Step 3) **เขียนข้อมูลจริงลง production** ใช้เฉพาะลูกค้าทดสอบที่ตกลงกับหัวหน้าไว้แล้ว

## ข้อมูลที่ตรวจแล้วก่อนเขียนแผน (2026-11-19, อ่านอย่างเดียวผ่าน MCP `execute_sql`)

- signature ใน schema `dsales` ตรงกับ `lib/api/rpc.ts`: `dsales_customer_pool_v3/_v4(p_search, p_limit, p_offset, p_from date, p_to date, p_brand)` (v4 คืน 16 คอลัมน์รวม `lead_id, taken, mine, no_call, reserved_by`), `dsales_base_customers(p_scope, p_search, p_limit, p_offset, p_brand)` (+ `dormant_days`, `owner_tag`; scope `mine` = เจ้าของ (ลีดหรือ tag) เป็นฉัน, `pool` = ไม่มีเจ้าของ, `team` = หัวหน้าเห็นทั้งหมด; limit สูงสุด 100), `dsales_claim_customer(p_phone, p_brand)` (ห้ามจองลูกค้าที่เป็นของเซลล์อื่นตาม tag → `taken`), `dsales_claim_lead/unclaim_lead(p_lead)`, `dsales_assign_lead(p_lead, p_user)`, `dsales_customer_purchases(p_phone)`, `dsales_customer_channels(p_phone)` — ทุกตัว `security definer`, `authenticated` execute ได้, `anon` ไม่ได้
- `dsales_campaigns` RLS: `select` = สมาชิก active, `ALL` (insert/update) = หัวหน้า (`dsales_is_admin()`); คอลัมน์ `criteria jsonb not null default '[]'`, `claim_mode not null default 'self'`, `active not null default true`
- `dsales.dsales_customer_base` / `dsales_chat_links` / `dsales_settings` ไม่มี grant ให้ `authenticated`/`anon` (แผนนี้ไม่แตะ)

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/api/errors.ts` (+ test) | `toThaiError` แปลง error เครือข่าย/JWT เป็นไทย, `errorKind`, `RpcError`, `kindOf`; `errorMessage` แปลง error เครือข่ายดิบ |
| `lib/api/rpc.ts` | `unwrap` โยน `RpcError` |
| `lib/api/types.ts` | `DemoCustomer`, `PoolRow.releasedByMe/mineReserved` (โหมด fixture) |
| `lib/state/busy.ts` (+ test) | กันกดซ้ำต่อ key (`actions.once`) |
| `lib/state/reducer.ts` (+ test) | `customers`, `pool` (ส่วนที่คงค่าของถัง), phase `expired`, action `sessionLost` / `setToday` / `setPool` |
| `lib/state/AppProvider.tsx` | `handleAuthError`, `toastError` ตรวจ session, `once`, `setPool`, เลื่อน `today` ข้ามเที่ยงคืน, `loadLive` ไม่ redirect เมื่อ effect ถูกยกเลิก |
| `lib/fixtures/{types,load}.ts` (+ test) | ส่ง `customers` ของ `legacy/data.js` ในโหมด fixture |
| `components/auth/NoAccess.tsx`, `components/shell/Shell.tsx` | การ์ด "หมดเวลาการเข้าสู่ระบบ" + ปุ่ม "เข้าสู่ระบบใหม่" |
| `lib/domain/log.ts` (+ test), `components/modals/LogModal.tsx` | `logSteps` — กดบันทึกซ้ำหลังสำเร็จบางขั้นไม่บันทึกประวัติซ้ำ |
| `components/leads/{useLeadActions.tsx,ContactBar.tsx,LeadTable.tsx}`, `components/modals/CustomerModal.tsx` | กันกดซ้ำ, actions คงที่, ยก `useJst` ขึ้นระดับตาราง/popup + `memo(LeadRow)`, คลิกแท็บเดิมรีเซ็ต scroll/โฟกัส |
| `lib/domain/campaigns.ts` (+ test) | การ์ดแคมเปญ, badge, สถิติ, base ของตาราง, quota, `inCampLine`, ตัวสร้างแคมเปญ (`matchOne`, `funnel`, `newCampaignRow`) |
| `lib/domain/pool.ts` (+ test) | ปุ่มของแถวถัง (`poolAction`), popup E (`takenBadge`, `poolDetailFooter`), ถังโหมดตัวอย่าง (`demoPool`, `demoGrand`), ตัวแบ่งหน้า, `/mine` `/pool` (`baseAction`, `claimBrand`, `demoBase`, `keepTotal`) |
| `components/campaigns/{useCustomerClaim.ts,RowButton.tsx,BrandTags.tsx,PoolPanel.tsx}` | จองลูกค้าจากถัง + เปิด JST, ปุ่มท้ายแถว, tag แบรนด์, ถังลูกค้าทั้งหมด |
| `components/modals/PoolDetailModal.tsx` | popup E |
| `components/modals/CampaignFormModal.tsx` | popup F |
| `components/campaigns/{CampaignCards.tsx,CampaignPage.tsx}`, `app/(app)/campaigns/[brand]/page.tsx` | หน้าแคมเปญ |
| `components/campaigns/BasePage.tsx`, `app/(app)/{mine,pool}/page.tsx` | ลูกค้าของฉัน / ถังกลาง |
| `components/leads/PeriodCard.tsx`, `components/modals/PickFromBucketModal.tsx` | เปลี่ยนช่วงวันที่ = ถังกลับหน้าแรก; "เลือกจากถัง" ล้างคำค้นถัง |
| `e2e/visual-parity.spec.ts`, `.gitignore`, `e2e/.legacy-shots/app/*.png` | เทียบหน้าแคมเปญ/ถัง/popup E, F กับ prototype + ภาพของตัวเองของ `/mine` `/pool` |
| `CLAUDE.md` | โครงไฟล์ใหม่, งานค้างที่ปิดแล้ว |

## การตัดสินใจในแผนนี้ (ต่างจาก/เพิ่มจาก brief และ spec)

- **แบ่งแผน C เป็น C1/C2** เพราะโค้ดครบทุกไฟล์ยาวเกิน ~3,800 บรรทัด C2 พึ่ง C1 (reducer, `once`, `handleAuthError`, `state.customers`)
- **`state.customers` (โหมด fixture เท่านั้น):** prototype มี `state.customers` (ลูกค้าตัวอย่าง) ที่ใช้กับถัง, การ์ดถัง ("เข้าแคมเปญแล้ว X · ยังไม่เข้า Y") และ funnel ของตัวสร้างแคมเปญ ส่วนล็อกอินจริงเป็น `[]` — แผนนี้ทำแบบเดียวกัน (`fixturePayload` ส่ง `customers`, `loadLive` ส่ง `[]`) e2e จึงเทียบถังโหมดตัวอย่างกับ Next ได้ตรงตัว ข้อมูลยังมาทาง dynamic import ของ fixture เท่านั้น (`check:fixtures` ยังผ่าน)
- **state ของถัง:** ส่วนที่ prototype คงค่าข้ามหน้า (`ui.pool.brand/q/page/grand/grandFor`) อยู่ใน `state.pool`; แถว/total/loading/err อยู่ใน `PoolPanel` ซึ่ง mount ใหม่ทุกครั้งที่เข้าหน้า (= `ui.pool.loaded = false` ใน `renderCampaign`) และโหลดใหม่เมื่อ `poolVersion` / คำค้น (debounce 300 ms) / หน้า / ช่วงวันที่เปลี่ยน — **ต่างจาก prototype เล็กน้อย:** prototype เรียก `dsales_customer_pool_v4` ทุกครั้งที่เข้าหน้าแม้เลือกการ์ดแคมเปญอยู่ (ถังไม่แสดง) แผนนี้โหลด v4 เฉพาะตอนถังแสดง (ลด RPC บนฐานข้อมูลที่ใช้ร่วมกัน) ส่วน v3 (จำนวนรวมทั้งแบรนด์) ยังโหลดครั้งเดียวต่อแบรนด์เหมือนเดิม
- **badge การ์ดถัง "ข้อมูลจริง/ตัวอย่าง":** ใช้ `state.live` แทน `P.live` ของ prototype (prototype ล็อกอินจริงขึ้น "ตัวอย่าง" แวบหนึ่งก่อนโหลดเสร็จ — ไม่ทำตาม)
- **ปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" (หัวหน้า):** คงไว้ (หน้าตา topbar เหมือน prototype) และทำแบบ prototype ตอนล็อกอินจริง: `applyAuto` คืน 0 เสมอ → toast "ไม่มีลีดที่ต้องจัดสรร" (โหมด fixture ก็ได้ผลเดียวกันเพราะข้อมูล fixture ผ่าน `applyAuto` ครั้งแรกมาแล้ว) — โหมด `auto` ยัง map เป็น `self` ตอนโหลด (spec ข้อ 2) ดูคำถามข้อ 1
- **funnel ของตัวสร้างแคมเปญตอนล็อกอินจริง = 0 ทุกขั้น (คง parity):** prototype คิดจาก `state.customers` ซึ่งว่างตอนล็อกอินจริง การคำนวณจริงต้องมี RPC ใหม่ที่กรองตามประวัติซื้อ (งาน DB) จึงไม่ทำในแผนนี้ ดูคำถามข้อ 2 — `criteria` ยังบันทึกลง `dsales_campaigns` ตามเดิม (ไม่สร้างลีด)
- **`/mine` `/pool` (ไม่มีใน prototype):** ใช้ markup ของถังลูกค้า คอลัมน์ที่สอง "ไม่ซื้อมา / tag" (`ไม่ซื้อมา N วัน` + `.tag` owner_tag) ช่องเลือกแบรนด์ "ทุกแบรนด์/Bebeplay/Hosttail" ค้นหา `#base-q` (ชื่อ/ชื่อแชต/เบอร์ — RPC นี้ไม่ค้นเลขบิล) **ไม่มีการ์ดช่วงวันที่** (RPC ไม่กรองตามวันที่ การ์ดจะหลอกผู้ใช้) ปุ่ม: ห้ามโทร → "ไม่สะดวกให้โทร" (disabled), ของฉันที่มีลีดแล้ว → "ยกเลิกจอง"/"จองแล้ว", ของฉันตาม tag ที่ยังไม่มีลีด → "เริ่มติดตาม" (`dsales_claim_customer`), ของเซลล์อื่น → "เป็นลูกค้าของ <ชื่อ/tag>" (disabled), ว่าง → "จอง"; แบรนด์ที่จอง = แบรนด์ในตัวกรอง หรือแบรนด์แรกของลูกค้าที่เป็น bebeplay/hosttail ไม่มี → toast "เลือกแบรนด์ที่ช่องด้านบนก่อนจอง"; `total_count` ใช้จากหน้าที่มีแถว (หน้าเกินท้ายคงค่าเดิม); โหมด fixture แบ่งลูกค้าตัวอย่างเป็นของฉัน/ถังกลาง (`demoBase`) ให้ e2e มีข้อมูล
- **session หมดอายุระหว่างใช้งาน:** `rpc.ts` โยน `RpcError` ที่จำประเภทของข้อความดิบ: `JWT …`/`not_authenticated`/`PGRST30x` = `auth` → การ์ด "หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่" + ปุ่ม "เข้าสู่ระบบใหม่" (= ออกจากระบบแล้วไป `/login`); `not_member` = `member` → การ์ด "บัญชีนี้ถูกปิดใช้งาน ติดต่อหัวหน้า" — ทั้งสองกรณีล้างข้อมูลลูกค้าออกจาก state (`sessionLost`) และปิด popup; error เครือข่าย (`Failed to fetch` ฯลฯ) → toast "เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" (หน้าไม่เปลี่ยน) — test เดิม `toThaiError('JWT expired') === 'JWT expired'` เปลี่ยนเป็นข้อความไทย
- **`today` ข้ามเที่ยงคืน:** ล็อกอินจริงตรวจทุก 60 วินาทีและตอนกลับมาที่แท็บ (`visibilitychange`) แล้ว `setToday(todayBangkok())` (reducer ไม่เปลี่ยน state ถ้าวันเดิม) โหมด fixture ตรึง 2026-11-04
- **กันกดซ้ำ:** `actions.once(key, fn)` (ตัวเดียวทั้งแอป) ใช้กับ จอง/มอบหมาย/ยกเลิกห้ามโทร/จองจากถัง/สร้างแคมเปญ (+ C2: เพิ่มเซลล์, ปิด/เปิดใช้งาน, บันทึก tag) — ไม่มีผลกับหน้าตา
- **LogModal สำเร็จบางขั้น:** จำขั้นที่สำเร็จของฟอร์มชุดเดิม (`logSteps`) กดบันทึกซ้ำทำเฉพาะขั้นที่เหลือ; แก้ฟอร์มแล้ว = บันทึกชุดใหม่
- **ประสิทธิภาพต่อแถว:** `useLeadActions` คืน object คงที่ (อ่าน state ล่าสุดผ่าน ref), `useJst` เรียกครั้งเดียวที่ `LeadTable`/popup แล้วส่ง `openJst` ลง `ContactBar`, `LeadRow` เป็น `memo` — พิมพ์ค้นหาแล้วแถวที่ลีดไม่เปลี่ยนไม่ต้องวาดใหม่
- **จองจากถังแล้วดึงช่องทางไม่ได้:** prototype เขียน `channels = []` ทับ แผนนี้คงช่องทางที่ server ส่งมากับลีด (เปลี่ยนเฉพาะเมื่อดึงสำเร็จ) หน้าตาไม่ต่าง
- **"เลือกจากถัง":** ล้างคำค้นและกลับหน้าแรกของถัง (prototype ล้างแค่คำค้น หน้าเดิมค้าง — ถือเป็น bug)
- **e2e:** ค่า `maxDiffPixels` ตั้งต้นวัดตอนเขียนแผน (1 รอบ) — Task 8 ให้วัดใหม่ 3 รอบ; `/mine` `/pool` ไม่มี prototype ให้เทียบ จึงตรวจ DOM + ภาพของตัวเองที่ commit ไว้ใน `e2e/.legacy-shots/app/` (สร้างครั้งแรกด้วย `--update-snapshots=missing`)

---
### Task 1: error ภาษาไทย, session หมดอายุระหว่างใช้งาน, `today` ข้ามเที่ยงคืน, state ของถัง

**Files:**
- Create: `lib/state/busy.ts`
- Modify: `lib/api/errors.ts`, `lib/api/rpc.ts`, `lib/api/types.ts`, `lib/state/reducer.ts`, `lib/state/AppProvider.tsx`, `lib/fixtures/types.ts`, `lib/fixtures/load.ts`, `components/auth/NoAccess.tsx`, `components/shell/Shell.tsx`
- Test: `lib/api/errors.test.ts`, `lib/state/busy.test.ts`, `lib/state/reducer.test.ts`, `lib/fixtures/load.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/api/errors.test.ts` (แทนทั้งไฟล์ — test เดิมครบ + JWT/เครือข่าย/`errorKind`/`RpcError`; ข้อ "falls back" เปลี่ยนตัวอย่างจาก `'JWT expired'` เป็น `'duplicate key value'` เพราะ JWT แปลเป็นไทยแล้ว):

```ts
import { describe, expect, it } from 'vitest';
import { errorKind, errorMessage, kindOf, NETWORK_TEXT, RpcError, toThaiError } from './errors';

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
  it('names the tag even when the message is prefixed', () => {
    expect(toThaiError('ERROR: tag_taken: Admin_X')).toBe('tag Admin_X เป็นของเซลล์คนอื่นแล้ว');
  });
  it('finds the key inside a longer message', () => {
    expect(toThaiError('ERROR: not_member (SQLSTATE 42501)')).toBe('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า');
  });
  it('maps an expired or invalid JWT to the re-login text', () => {
    expect(toThaiError('JWT expired')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
    expect(toThaiError('invalid JWT: unable to parse or verify signature')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  });
  it('maps network failures of every browser to Thai', () => {
    for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed']) {
      expect(toThaiError(m), m).toBe(NETWORK_TEXT);
    }
  });
  it('falls back to the raw message, or a generic text', () => {
    expect(toThaiError('duplicate key value')).toBe('duplicate key value');
    expect(toThaiError('constructor')).toBe('constructor');
    expect(toThaiError('')).toBe('ทำรายการไม่สำเร็จ');
    expect(toThaiError(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
});

describe('errorKind / RpcError / kindOf', () => {
  it('classifies raw server messages', () => {
    expect(errorKind('JWT expired')).toBe('auth');
    expect(errorKind('ERROR: not_authenticated')).toBe('auth');
    expect(errorKind('ERROR: not_member (SQLSTATE 42501)')).toBe('member');
    expect(errorKind('TypeError: Failed to fetch')).toBe('network');
    expect(errorKind('taken')).toBe('other');
    expect(errorKind(undefined)).toBe('other');
  });
  it('RpcError keeps the Thai text and the kind of the raw message', () => {
    const e = new RpcError('JWT expired');
    expect([e.message, e.kind, e instanceof Error]).toEqual(['หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', 'auth', true]);
    expect(kindOf(e)).toBe('auth');
    expect(kindOf(new RpcError('not_member'))).toBe('member');
    expect(kindOf(new TypeError('Failed to fetch'))).toBe('network');
    expect(kindOf('boom')).toBe('other');
  });
});

describe('errorMessage', () => {
  it('reads Error.message or a string, and falls back to the generic text', () => {
    expect(errorMessage(new Error('ลูกค้ารายนี้มีคนจองไปแล้ว'))).toBe('ลูกค้ารายนี้มีคนจองไปแล้ว');
    expect(errorMessage('boom')).toBe('boom');
    expect(errorMessage(new Error(''))).toBe('ทำรายการไม่สำเร็จ');
    expect(errorMessage(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
  it('translates a raw network TypeError (fetch outside rpc.ts)', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_TEXT);
  });
});
```

`lib/state/busy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBusyGuard } from './busy';

const deferred = () => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createBusyGuard', () => {
  it('runs one call per key at a time; a second click while waiting does nothing', async () => {
    const g = createBusyGuard();
    const d = deferred();
    let calls = 0;
    const first = g.run('claim:L1', () => {
      calls += 1;
      return d.promise;
    });
    const second = g.run('claim:L1', async () => {
      calls += 1;
      return 'x';
    });
    expect(g.has('claim:L1')).toBe(true);
    await expect(second).resolves.toBeUndefined();
    d.resolve('ok');
    await expect(first).resolves.toBe('ok');
    expect(calls).toBe(1);
    expect(g.has('claim:L1')).toBe(false);
  });
  it('different keys run in parallel', async () => {
    const g = createBusyGuard();
    const a = deferred();
    const p1 = g.run('claim:L1', () => a.promise);
    await expect(g.run('claim:L2', async () => 'b')).resolves.toBe('b');
    a.resolve('a');
    await expect(p1).resolves.toBe('a');
  });
  it('releases the key when the call fails, and rethrows', async () => {
    const g = createBusyGuard();
    await expect(g.run('assign:L1', async () => { throw new Error('taken'); })).rejects.toThrow('taken');
    await expect(g.run('assign:L1', async () => 'again')).resolves.toBe('again');
  });
});
```

`lib/state/reducer.test.ts` — ใน `const payload` แก้

```ts
  campaigns: [], leads: [], today: '2026-11-04',
```

เป็น

```ts
  campaigns: [], leads: [], customers: [], today: '2026-11-04',
```

แล้วเพิ่มก่อน `it('invalidatePool bumps poolVersion; live and focusSearch start false', () => {`:

```ts
  it('sessionLost clears every lead and customer, keeps the email, and only applies once ready', () => {
    const withLead = reducer(ready, { type: 'upsertLead', lead: leadJson({ id: 'L1' }) });
    expect(reducer(withLead, { type: 'sessionLost', reason: 'expired' }))
      .toMatchObject({ phase: 'expired', email: 'a@example.com', leads: [], reps: [], customers: [], isAdmin: false });
    expect(reducer(withLead, { type: 'sessionLost', reason: 'inactive' }).phase).toBe('inactive');
    expect(reducer(initialState, { type: 'sessionLost', reason: 'expired' })).toBe(initialState);
  });
  it('setToday moves to the new Bangkok day and ignores the same day', () => {
    expect(reducer(ready, { type: 'setToday', today: '2026-11-04' })).toBe(ready);
    expect(reducer(ready, { type: 'setToday', today: '2026-11-05' }).today).toBe('2026-11-05');
  });
  it('setPool merges the persistent pool filters', () => {
    expect(initialState.pool).toEqual({ brand: null, q: '', page: 0, grand: null, grandFor: null });
    expect(reducer(ready, { type: 'setPool', patch: { brand: 'hosttail', q: '081', page: 2 } }).pool)
      .toEqual({ brand: 'hosttail', q: '081', page: 2, grand: null, grandFor: null });
  });
```

`lib/fixtures/load.test.ts` — เพิ่มหลัง test แรก (`it('starts as the prototype demo user …')`):

```ts
  it('carries the demo customers of the pool and the campaign builder (prototype state.customers)', () => {
    const p = fixturePayload();
    expect(p.customers).toHaveLength(90);
    expect(p.customers.filter((c) => c.brand === 'bebeplay')).toHaveLength(60);
    expect(p.customers[0]).toMatchObject({ id: 'C5000', name: 'ธนากร รุ่งเรือง', phone: '0864355692', brand: 'bebeplay' });
  });
```

Run: `npm test`
Expected: FAIL — `lib/state/busy.test.ts` ตก (`Failed to resolve import "./busy"`), `errors.test.ts` ตก (`errorKind`/`RpcError` ยังไม่มี, `'JWT expired'` และ `'Failed to fetch'` ยังไม่เป็นข้อความไทย), `reducer.test.ts` 3 test ตก (`sessionLost`/`setToday`/`setPool` ยังไม่มี), `load.test.ts` 1 test ตก (`p.customers` เป็น `undefined`)

- [ ] **Step 2: `lib/api/errors.ts`** (แทนทั้งไฟล์)

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

/** fetch ล้ม / offline: Chrome "Failed to fetch", Firefox "NetworkError when attempting…", Safari "Load failed", Node "fetch failed" */
export const NETWORK_TEXT = 'เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
const NETWORK = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i;
// PostgREST: "JWT expired" / "invalid JWT" (PGRST301–303, HTTP 401) และ dsales_uid(): not_authenticated
const AUTH = /\bjwt\b|not_authenticated|PGRST30[0-3]/i;

export function toThaiError(message: string | null | undefined): string {
  const msg = (message ?? '').trim();
  if (NETWORK.test(msg)) return NETWORK_TEXT;
  if (AUTH.test(msg)) return ERROR_TEXT.not_authenticated;
  const tag = /tag_taken:\s*(.+)$/.exec(msg);
  if (tag) return `tag ${tag[1]} เป็นของเซลล์คนอื่นแล้ว`;
  for (const token of msg.match(/[a-z_]+/g) ?? []) {
    if (Object.prototype.hasOwnProperty.call(ERROR_TEXT, token)) return ERROR_TEXT[token];
  }
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ประเภทของ error ดิบ: auth = session หมดอายุ (ต้องล็อกอินใหม่), member = ไม่ใช่สมาชิก active แล้ว, network = เน็ตล้ม */
export type ErrorKind = 'auth' | 'member' | 'network' | 'other';
export function errorKind(message: string | null | undefined): ErrorKind {
  const msg = message ?? '';
  if (/\bnot_member\b/.test(msg)) return 'member';
  if (AUTH.test(msg)) return 'auth';
  if (NETWORK.test(msg)) return 'network';
  return 'other';
}

/** error ที่ rpc.ts โยน: message = ข้อความไทย, kind = ประเภทจากข้อความดิบของ server */
export class RpcError extends Error {
  readonly kind: ErrorKind;
  constructor(raw: string | null | undefined) {
    super(toThaiError(raw));
    this.name = 'RpcError';
    this.kind = errorKind(raw);
  }
}

/** ข้อความของ error ที่ catch ได้ (rpc.ts โยนข้อความไทยแล้ว) สำหรับ toast — error เครือข่ายดิบ (fetch ตรง) แปลงเป็นไทย */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : e == null ? '' : String(e);
  if (NETWORK.test(msg)) return NETWORK_TEXT;
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ประเภทของ error ที่ catch ได้: RpcError ใช้ kind จากข้อความดิบ, error อื่นคำนวณจาก message */
export const kindOf = (e: unknown): ErrorKind =>
  e instanceof RpcError ? e.kind : errorKind(e instanceof Error ? e.message : e == null ? '' : String(e));
```

- [ ] **Step 3: `lib/api/rpc.ts` โยน `RpcError`**

แก้

```ts
import { toThaiError } from './errors';
```

เป็น

```ts
import { RpcError } from './errors';
```

และใน `unwrap` แก้

```ts
  if (error) throw new Error(toThaiError(error.message));
```

เป็น

```ts
  if (error) throw new RpcError(error.message);
```

(`RpcError extends Error` — โค้ดเดิมที่อ่าน `e.message` / `errorMessage(e)` ทำงานเหมือนเดิม และ test `rpc.test.ts` ข้อ "throws the Thai message" ยังผ่าน)

- [ ] **Step 4: `lib/state/busy.ts`**

```ts
/**
 * กันกดซ้ำ (double-click) ระหว่างรอ RPC: key เดียวกันทำได้ทีละครั้ง ครั้งที่ซ้อนเข้ามาคืน undefined ทันที (ไม่เรียก fn)
 * AppProvider สร้าง 1 ตัวต่อแอป (`actions.once`) ใช้กับปุ่ม จอง / มอบหมาย / ยกเลิกห้ามโทร / จองจากถัง / สร้างแคมเปญ ฯลฯ
 */
export interface BusyGuard {
  run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined>;
  has(key: string): boolean;
}

export function createBusyGuard(): BusyGuard {
  const keys = new Set<string>();
  return {
    async run(key, fn) {
      if (keys.has(key)) return undefined;
      keys.add(key);
      try {
        return await fn();
      } finally {
        keys.delete(key);
      }
    },
    has: (key) => keys.has(key),
  };
}
```

- [ ] **Step 5: `lib/api/types.ts` — ลูกค้าตัวอย่าง + ฟิลด์โหมด fixture ของแถวถัง**

ใน `export interface PoolRow { … }` แก้บรรทัดสุดท้าย

```ts
  dormantDays: number | null; ownerTag: string | null;
}
```

เป็น

```ts
  dormantDays: number | null; ownerTag: string | null;
  /** โหมด fixture (prototype โหมดตัวอย่าง L640): เซลล์คนนี้เคยคัดออก / ลีดที่จองไว้ยกเลิกได้ */
  releasedByMe?: boolean; mineReserved?: boolean;
}

/** ลูกค้าในถังของโหมดตัวอย่าง (window.DS_DATA.customers) — ล็อกอินจริงเป็น [] เสมอ (prototype loadLive L980) */
export interface DemoCustomer {
  id: string; name: string; phone: string; address: string; brand: Brand; shop: string; chatName: string; channels: Channel[]; purchases: Purchase[];
}
```

- [ ] **Step 6: `lib/fixtures/types.ts`** (แทนทั้งไฟล์ — `FixtureCustomer` กลายเป็นชื่อเดิมของ `DemoCustomer` เพื่อให้ `lib/fixtures/data.ts` ที่สร้างด้วยสคริปต์ไม่ต้องแก้)

```ts
import type { Campaign, DemoCustomer, Lead, Rep } from '@/lib/api/types';

/** รูปของ window.DS_DATA ใน legacy/data.js */
export type FixtureCustomer = DemoCustomer;
export interface FixtureData {
  reps: Rep[];
  campaigns: Pick<Campaign, 'id' | 'brand' | 'claimMode' | 'name' | 'start' | 'end' | 'note'>[];
  leads: Lead[];
  customers: FixtureCustomer[];
  today: string;
}
```

`lib/fixtures/load.ts` — ใน object ที่ `fixturePayload` คืน แก้

```ts
    leads: d.leads,
    today: d.today,
```

เป็น

```ts
    leads: d.leads,
    customers: d.customers,
    today: d.today,
```

- [ ] **Step 7: `lib/state/reducer.ts`** (แทนทั้งไฟล์)

```ts
import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, DemoCustomer, Lead, LeadJson, Rep } from '@/lib/api/types';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) + focusSearch (L616: โฟกัสช่องค้นหาถังหลัง "เลือกจากถัง") */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all',
  period: { from: '', to: '', key: 'all' }, focusSearch: false,
};

/**
 * ส่วนของ ui.pool (prototype L616) ที่คงค่าข้ามหน้า: แบรนด์ของถัง, คำค้น, หน้า, จำนวนลูกค้าทั้งแบรนด์ (นับครั้งเดียวต่อแบรนด์ = grandFor)
 * แถว/total/loading/err อยู่ใน state ของ PoolPanel ซึ่งโหลดใหม่ทุกครั้งที่ mount (= prototype ตั้ง ui.pool.loaded = false ใน renderCampaign)
 */
export interface PoolUi { brand: Brand | null; q: string; page: number; grand: number | null; grandFor: Brand | null }
export const initialPool: PoolUi = { brand: null, q: '', page: 0, grand: null, grandFor: null };

/** live = ข้อมูลจาก Supabase; false = โหมด fixture (อ่านแบบโหมดตัวอย่างของ prototype และไม่เรียก RPC ที่เขียนข้อมูล) */
export interface LoadedPayload {
  email: string; meId: string; isAdmin: boolean; live: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[];
  /** ลูกค้าของถัง/ตัวสร้างแคมเปญในโหมดตัวอย่าง — ล็อกอินจริง = [] (prototype loadLive L980) */
  customers: DemoCustomer[];
  today: string;
}
/** expired = session หมดอายุระหว่างใช้งาน (ต้องล็อกอินใหม่) */
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'expired' | 'error';
/** poolVersion เพิ่มทุกครั้งที่ถังลูกค้าต้องโหลดใหม่ (prototype ui.pool.loaded = false) */
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters; poolVersion: number; pool: PoolUi }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, live: false, reps: [], campaigns: [], leads: [], customers: [], today: '',
  ui: initialUi, poolVersion: 0, pool: initialPool,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'sessionLost'; reason: 'expired' | 'inactive' }
  | { type: 'setToday'; today: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'setUi'; patch: Partial<UiFilters> }
  | { type: 'setPool'; patch: Partial<PoolUi> }
  | { type: 'invalidatePool' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      // หลังโหลดเสร็จ error ระหว่างใช้งานแสดงด้วย toast เท่านั้น (ห้ามแทนทั้ง Shell ด้วยการ์ด error)
      return state.phase === 'ready' ? state : { ...state, phase: 'error', error: action.error };
    case 'sessionLost':
      // ระหว่างใช้งาน: session หมดอายุ / ถูกปิดใช้งาน → ล้างข้อมูลลูกค้าทั้งหมดออกจากหน้า เหลือแค่การ์ด (คงอีเมลไว้แสดง)
      return state.phase === 'ready' ? { ...initialState, phase: action.reason, email: state.email } : state;
    case 'setToday':
      return action.today && action.today !== state.today ? { ...state, today: action.today } : state;
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
    case 'setPool':
      return { ...state, pool: { ...state.pool, ...action.patch } };
    case 'invalidatePool':
      return { ...state, poolVersion: state.poolVersion + 1 };
  }
}
```

- [ ] **Step 8: `lib/state/AppProvider.tsx`** (แทนทั้งไฟล์ — เพิ่ม `handleAuthError`, `toastError` ตรวจ session, `once`, `setPool`, ตัวเลื่อน `today`, `customers: []` ใน `loadLive`, และ `loadLive` คืน `'login'` ให้ effect redirect เองเฉพาะเมื่อยังไม่ถูกยกเลิก = งานค้าง "StrictMode: loadLive ที่ถูกยกเลิกอาจยัง redirect ได้")

```tsx
'use client';

import {
  createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode,
} from 'react';
import { errorMessage, kindOf } from '@/lib/api/errors';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import type { Lead, LeadJson } from '@/lib/api/types';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { createBusyGuard } from './busy';
import { initialState, reducer, type Action, type AppState, type PoolUi, type UiFilters } from './reducer';
import { classifySession } from './session';
import { createToaster } from './toast';

import { closeModalState, type ModalState } from './modal';

export type { ModalState };

/** ตรวจว่าข้ามเที่ยงคืน (เวลาไทย) หรือยังทุก 1 นาที — เปิดหน้าค้างข้ามวัน "วันนี้" / เลยนัด / นัดวันนี้ ต้องเปลี่ยนตาม */
export const TODAY_CHECK_MS = 60_000;

/** ฟังก์ชันที่คงที่ตลอดอายุ provider — component ที่ใช้แค่ส่วนนี้ไม่ re-render ตาม state / toast / modal */
export interface AppActions {
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** error ระหว่างใช้งานหน้า (RPC ล้ม) → toast เสมอ + session หมดอายุ/ถูกปิดใช้งาน → การ์ด (handleAuthError) */
  toastError: (e: unknown) => void;
  /** session หมดอายุ (JWT / not_authenticated) หรือไม่ใช่สมาชิก active แล้ว (not_member) → ล้างข้อมูลแล้วแสดงการ์ด; คืน true ถ้าจัดการแล้ว */
  handleAuthError: (e: unknown) => boolean;
  /** กันกดซ้ำ: key เดียวกันทำได้ทีละครั้ง (ครั้งที่ซ้อนเข้ามาไม่ทำอะไร) */
  once: <T>(key: string, fn: () => Promise<T>) => Promise<T | undefined>;
  openModal: (node: ReactNode, cls?: string) => void;
  /** ไม่ระบุ seq = ปิดเสมอ; ระบุ seq (จาก useModalSeq) = ปิดเฉพาะเมื่อ popup นั้นยังเปิดอยู่ */
  closeModal: (seq?: number) => void;
  logout: () => Promise<void>;
  upsertLead: (lead: LeadJson) => void;
  patchLead: (id: string, patch: Partial<Lead>) => void;
  setUi: (patch: Partial<UiFilters>) => void;
  setPool: (patch: Partial<PoolUi>) => void;
}

const StateContext = createContext<AppState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);
// undefined = ไม่มี provider (null = ไม่มี toast / popup)
const ToastContext = createContext<string | null | undefined>(undefined);
const ModalContext = createContext<ModalState | null | undefined>(undefined);

/**
 * โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ)
 * 'login' = ต้องไป /login (ผู้เรียก redirect เองเฉพาะเมื่อ effect ยังไม่ถูกยกเลิก — StrictMode ของ dev mount สองรอบ)
 */
async function loadLive(): Promise<Action | 'login'> {
  const auth = supabase().auth;
  const { data: sessionData, error: sessionError } = await auth.getSession();
  const hasSession = !!sessionData.session;
  const { data: userData, error: userError } = hasSession ? await auth.getUser() : { data: { user: null }, error: null };
  const check = classifySession({ hasSession, sessionError, user: userData.user, userError });
  if (check.kind === 'login') return 'login';
  if (check.kind === 'error') throw new Error(check.message);
  const email = check.email;
  const me = await getMe();
  if (!me || !me.is_member) return { type: 'noAccess', email, inactive: false };
  if (!me.active) return { type: 'noAccess', email, inactive: true };
  const [team, campaigns, leads] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, live: true, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), customers: [], today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const toaster = useMemo(() => createToaster(setToastMsg), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let action: Action | 'login';
      try {
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') {
          const { fixturePayload } = await import('@/lib/fixtures/load');
          action = { type: 'loaded', payload: fixturePayload(window.location.search) };
        } else {
          action = await loadLive();
        }
      } catch (e) {
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${errorMessage(e)}` };
      }
      if (cancelled) return;
      if (action === 'login') window.location.replace('/login');
      else dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // เปิดค้างข้ามเที่ยงคืน: เลื่อน today ตามเวลาไทย (ล็อกอินจริงเท่านั้น โหมด fixture ตรึงวันที่ 2026-11-04 ตาม prototype)
  useEffect(() => {
    if (!state.live || state.phase !== 'ready') return;
    const tick = () => dispatch({ type: 'setToday', today: todayBangkok() });
    const timer = setInterval(tick, TODAY_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.live, state.phase]);

  // เคลียร์ timer ของ toast ตอน unmount
  useEffect(() => () => toaster.dispose(), [toaster]);

  const actions = useMemo<AppActions>(() => {
    let seq = 0;
    const busy = createBusyGuard();
    const handleAuthError = (e: unknown): boolean => {
      const kind = kindOf(e);
      if (kind !== 'auth' && kind !== 'member') return false;
      setModal(null);
      dispatch({ type: 'sessionLost', reason: kind === 'auth' ? 'expired' : 'inactive' });
      return true;
    };
    return {
      dispatch,
      toast: toaster.toast,
      toastError: (e) => {
        handleAuthError(e);
        toaster.toast(errorMessage(e));
      },
      handleAuthError,
      once: (key, fn) => busy.run(key, fn),
      openModal: (node, cls = '') => {
        seq += 1;
        setModal({ node, cls, seq });
      },
      closeModal: (seq) => setModal((m) => closeModalState(m, seq)),
      // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
      logout: async () => {
        if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
        window.location.href = '/login';
      },
      upsertLead: (lead) => dispatch({ type: 'upsertLead', lead }),
      patchLead: (id, patch) => dispatch({ type: 'patchLead', id, patch }),
      setUi: (patch) => dispatch({ type: 'setUi', patch }),
      setPool: (patch) => dispatch({ type: 'setPool', patch }),
    };
  }, [toaster]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <ToastContext.Provider value={toastMsg}>
          <ModalContext.Provider value={modal}>{children}</ModalContext.Provider>
        </ToastContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useAppState(): AppState {
  const v = useContext(StateContext);
  if (!v) throw new Error('useAppState ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useActions(): AppActions {
  const v = useContext(ActionsContext);
  if (!v) throw new Error('useActions ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useToastMsg(): string | null {
  const v = useContext(ToastContext);
  if (v === undefined) throw new Error('useToastMsg ต้องอยู่ใน <AppProvider>');
  return v;
}

/** ลำดับของ popup ที่ครอบ component นี้อยู่ (ModalRoot ใส่ให้) ใช้กับ closeModal(seq) หลัง await */
export const ModalSeqContext = createContext<number | undefined>(undefined);
export function useModalSeq(): number | undefined {
  return useContext(ModalSeqContext);
}

export function useModalState(): ModalState | null {
  const v = useContext(ModalContext);
  if (v === undefined) throw new Error('useModalState ต้องอยู่ใน <AppProvider>');
  return v;
}

/** state + actions (re-render เมื่อ state เปลี่ยน แต่ไม่ตาม toast / modal) — ใช้กับ shell เดิม */
export function useApp(): AppActions & { state: AppState } {
  const state = useAppState();
  const actions = useActions();
  return useMemo(() => ({ ...actions, state }), [actions, state]);
}
```

> เงื่อนไขโหมด fixture 2 จุดยังเป็นข้อความ `process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'` ตรงตัว (`lib/fixtures/guard.test.ts` ตรวจ)

- [ ] **Step 9: การ์ด "หมดเวลาการเข้าสู่ระบบ"**

`components/auth/NoAccess.tsx` (แทนทั้งไฟล์):

```tsx
'use client';

export const LOADING_TEXT = 'กำลังโหลดข้อมูล…';
export const NO_ACCESS_TEXT = 'ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า';
export const INACTIVE_TEXT = 'บัญชีนี้ถูกปิดใช้งาน ติดต่อหัวหน้า';
export const EXPIRED_TEXT = 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่';

interface Props {
  message: string;
  email?: string;
  isError?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
  /** ข้อความปุ่ม onLogout (session หมดอายุ = "เข้าสู่ระบบใหม่") */
  logoutText?: string;
}

export function NoAccess({ message, email, isError = false, onRetry, onLogout, logoutText = 'ออกจากระบบ' }: Props) {
  return (
    <div className="login" id="no-access">
      <div className="login-card">
        <div className="brand-name">MPD Direct Sale</div>
        {isError ? <div className="login-err" role="alert">{message}</div> : <p className="help">{message}</p>}
        {email ? <p className="help">บัญชีที่ใช้อยู่: {email}</p> : null}
        {onRetry ? <button className="btn primary" type="button" onClick={onRetry}>ลองใหม่</button> : null}
        {onLogout ? (
          <button className={onRetry ? 'btn' : 'btn primary'} type="button" id="logout" onClick={onLogout}>{logoutText}</button>
        ) : null}
      </div>
    </div>
  );
}
```

`components/shell/Shell.tsx` — แก้ import

```tsx
import { INACTIVE_TEXT, LOADING_TEXT, NO_ACCESS_TEXT, NoAccess } from '@/components/auth/NoAccess';
```

เป็น

```tsx
import { EXPIRED_TEXT, INACTIVE_TEXT, LOADING_TEXT, NO_ACCESS_TEXT, NoAccess } from '@/components/auth/NoAccess';
```

และแก้

```tsx
  if (state.phase === 'loading') return <NoAccess message={LOADING_TEXT} />;
```

เป็น

```tsx
  if (state.phase === 'loading') return <NoAccess message={LOADING_TEXT} />;
  if (state.phase === 'expired') return <NoAccess message={EXPIRED_TEXT} email={state.email} onLogout={logout} logoutText="เข้าสู่ระบบใหม่" />;
```

(`logout` = `signOut` แล้วไป `/login`; refresh token ที่ตายแล้ว `signOut` ได้ 401 ซึ่ง supabase-js ยังลบ session ในเครื่อง → middleware ไม่เด้งกลับ `/leads`)

- [ ] **Step 10: รัน test + typecheck + lint**

Run: `npm test`
Expected: `Test Files  20 passed (20)` · `Tests  126 passed (126)`

Run: `npm run typecheck && npm run lint`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`

- [ ] **Step 11: Commit**

```bash
git add lib/api/errors.ts lib/api/errors.test.ts lib/api/rpc.ts lib/api/types.ts lib/state/busy.ts lib/state/busy.test.ts lib/state/reducer.ts lib/state/reducer.test.ts lib/state/AppProvider.tsx lib/fixtures/types.ts lib/fixtures/load.ts lib/fixtures/load.test.ts components/auth/NoAccess.tsx components/shell/Shell.tsx
git commit -m "feat(web): translate network and expired-session errors, show a re-login card, roll today over at midnight and keep pool filters in state" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: กันกดซ้ำ, บันทึกซ้ำเมื่อสำเร็จบางขั้น, ประสิทธิภาพต่อแถว, คลิกแท็บเดิมใน popup ลูกค้า

**Files:**
- Modify: `lib/domain/log.ts`, `components/modals/LogModal.tsx`, `components/leads/useLeadActions.tsx`, `components/leads/ContactBar.tsx`, `components/leads/LeadTable.tsx`, `components/modals/CustomerModal.tsx`
- Test: `lib/domain/log.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน** — `lib/domain/log.test.ts`: แก้ import

```ts
import { buildLogSave, initialLogForm, LOG_WARN, logSections, logStatusOptions, splitBills, validateLog } from './log';
```

เป็น

```ts
import { buildLogSave, initialLogForm, LOG_WARN, logSections, logStatusOptions, logSteps, splitBills, validateLog } from './log';
```

แล้วเพิ่มก่อน `});` บรรทัดสุดท้าย:

```ts
  it('logSteps skips the steps that already succeeded for the same form (no double history after a partial failure)', () => {
    const plan = buildLogSave({ ...base, status: 'dnc', note: 'ลูกค้าขอ' }, { id: 'L1', status: 'new' });
    const first = logSteps(plan, null);
    expect(first.steps).toEqual(['log', 'dnc']);
    // dsales_log ผ่านแต่ dsales_set_nocall ล้ม → กดบันทึกอีกครั้งทำเฉพาะ dnc
    expect(logSteps(plan, { key: first.key, done: ['log'] }).steps).toEqual(['dnc']);
    // แก้ฟอร์ม (หมายเหตุใหม่) = บันทึกชุดใหม่ทั้งหมด
    const edited = buildLogSave({ ...base, status: 'dnc', note: 'ลูกค้าขอ (แก้)' }, { id: 'L1', status: 'new' });
    expect(logSteps(edited, { key: first.key, done: ['log'] }).steps).toEqual(['log', 'dnc']);
    expect(logSteps(buildLogSave(base, { id: 'L1', status: 'new' }), null).steps).toEqual(['log']);
  });
```

Run: `npm test -- lib/domain/log.test.ts`
Expected: FAIL 1 test — `TypeError: (0 , logSteps) is not a function` (`Tests  1 failed | 7 passed (8)`)

- [ ] **Step 2: `logSteps` ใน `lib/domain/log.ts`** — ต่อท้ายไฟล์:

```ts

/** ขั้นของการบันทึก: dsales_log แล้ว (ถ้ามี) dsales_set_nocall / dsales_unclaim_lead */
export type LogStep = 'log' | 'dnc' | 'release';
/** ขั้นที่สำเร็จแล้วของฟอร์มชุดเดิม (key = อาร์กิวเมนต์ทั้งหมด) — กดบันทึกซ้ำหลังสำเร็จบางขั้นไม่บันทึกประวัติซ้ำ */
export interface LogProgress { key: string; done: LogStep[] }

/** ขั้นที่ยังต้องทำ: ฟอร์มเดิม (key เท่ากัน) ข้ามขั้นที่สำเร็จแล้ว; แก้ฟอร์มแล้ว = ชุดใหม่ เริ่มตั้งแต่ dsales_log */
export function logSteps(plan: LogSave, progress: LogProgress | null): { key: string; steps: LogStep[] } {
  const key = JSON.stringify([plan.input, plan.then]);
  const all: LogStep[] = plan.then ? ['log', plan.then] : ['log'];
  const done = progress?.key === key ? progress.done : [];
  return { key, steps: all.filter((s) => !done.includes(s)) };
}
```

Run: `npm test`
Expected: `Test Files  20 passed (20)` · `Tests  127 passed (127)`

- [ ] **Step 3: `components/modals/LogModal.tsx` ใช้ `logSteps`**

แก้ import

```tsx
import {
  buildLogSave, initialLogForm, LOG_RESULTS, logSections, logStatusOptions, validateLog, type LogField, type LogForm, type LogStatus,
} from '@/lib/domain/log';
```

เป็น

```tsx
import {
  buildLogSave, initialLogForm, LOG_RESULTS, logSections, logStatusOptions, logSteps, validateLog,
  type LogField, type LogForm, type LogProgress, type LogStatus,
} from '@/lib/domain/log';
```

แก้

```tsx
  const busy = useRef(false);
  const seq = useModalSeq();
```

เป็น

```tsx
  const busy = useRef(false);
  const progress = useRef<LogProgress | null>(null);
  const seq = useModalSeq();
```

และใน `onSubmit` แก้

```tsx
    const plan = buildLogSave(f, { id: l.id, status: prevStatus });
    try {
      upsertLead(await logContact(plan.input));
      if (plan.then === 'dnc') upsertLead(await setNoCall(l.id, true));
      if (plan.then === 'release') upsertLead(await unclaimLead(l.id));
      closeModal(seq);
```

เป็น

```tsx
    const plan = buildLogSave(f, { id: l.id, status: prevStatus });
    const { key, steps } = logSteps(plan, progress.current);
    if (progress.current?.key !== key) progress.current = { key, done: [] };
    const run = progress.current;
    try {
      // ทีละขั้น จำขั้นที่สำเร็จ: ถ้า setNoCall/unclaim ล้มแล้วกดบันทึกซ้ำ จะไม่เรียก dsales_log ซ้ำ (ประวัติไม่ซ้ำ 2 รอบ)
      for (const step of steps) {
        if (step === 'log') upsertLead(await logContact(plan.input));
        else if (step === 'dnc') upsertLead(await setNoCall(l.id, true));
        else upsertLead(await unclaimLead(l.id));
        run.done.push(step);
      }
      closeModal(seq);
```

- [ ] **Step 4: `components/leads/useLeadActions.tsx`** (แทนทั้งไฟล์ — object คงที่ + `once` กันกดซ้ำ + จองไม่สำเร็จแล้วโหลดถังใหม่เหมือน `route()` ของ prototype L888)

```tsx
'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { ConfirmUnclaimModal } from '@/components/modals/ConfirmUnclaimModal';
import { CustomerModal } from '@/components/modals/CustomerModal';
import { LogModal } from '@/components/modals/LogModal';
import { assignLead, claimLead, setNoCall } from '@/lib/api/rpc';
import type { ContactType } from '@/lib/api/types';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import { canUnclaimAny, claimBlock } from '@/lib/domain/leads';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { useJst } from './useJst';

export interface LeadActions {
  openCustomer: (id: string) => void;
  openLog: (id: string, type: ContactType) => void;
  confirmUnclaim: (id: string) => void;
  restoreNoCall: (id: string) => Promise<void>;
  claim: (id: string) => Promise<void>;
  assign: (id: string, userId: string) => Promise<void>;
}

/**
 * ปุ่มดำเนินการของแถวลีด — เขียนข้อมูลแล้ว upsertLead + invalidatePool (= route() ของ prototype) + toast; error → toast
 * object คงที่ตลอดอายุ component (อ่าน state ล่าสุดผ่าน ref) ให้ memo(LeadRow) ไม่ต้องวาดทุกแถวใหม่
 * ปุ่มที่เรียก RPC กันกดซ้ำด้วย once(key) — คลิกซ้ำระหว่างรอไม่ส่งซ้ำ
 */
export function useLeadActions(): LeadActions {
  const state = useAppState();
  const actions = useActions();
  const openJst = useJst();
  const latest = useRef({ state, openJst });
  useLayoutEffect(() => {
    latest.current = { state, openJst };
  });

  return useMemo<LeadActions>(() => {
    const { openModal, toast, toastError, upsertLead, dispatch, once } = actions;
    const done = (msg: string) => {
      dispatch({ type: 'invalidatePool' });
      toast(msg);
    };
    const leads = () => latest.current.state.leads;
    return {
      // legacy customerModal/logModal: ไม่พบลีดใน state → ไม่เปิด popup
      openCustomer: (id) => {
        if (leads().some((x) => x.id === id)) openModal(<CustomerModal id={id} />);
      },
      openLog: (id, type) => {
        if (leads().some((x) => x.id === id)) openModal(<LogModal id={id} type={type} />, 'sm');
      },
      confirmUnclaim: (id) => {
        const l = leads().find((x) => x.id === id);
        if (!l || !canUnclaimAny(l, latest.current.state.meId)) {
          toast('ยกเลิกจองรายการนี้ไม่ได้');
          return;
        }
        openModal(<ConfirmUnclaimModal id={id} />, 'sm');
      },
      restoreNoCall: async (id) => {
        if (!latest.current.state.live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`dnc-restore:${id}`, async () => {
          try {
            upsertLead(await setNoCall(id, false));
            done('ยกเลิกห้ามโทรแล้ว');
          } catch (e) {
            toastError(e);
          }
        });
      },
      claim: async (id) => {
        const { leads: all, campaigns, meId, live } = latest.current.state;
        const l = all.find((x) => x.id === id);
        if (!l) return;
        const block = claimBlock(l, campaigns.find((c) => c.id === l.campaignId), all, meId);
        if (block) {
          toast(block);
          return;
        }
        if (!live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`claim:${id}`, async () => {
          try {
            const nl = await claimLead(id);
            upsertLead(nl);
            done('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
            // จองแล้วเด้งไปแชตของลูกค้าใน JST (L888)
            const c0 = channelsOf(nl)[0];
            if (c0) latest.current.openJst(jstTarget(nl, c0), { auto: true });
          } catch (e) {
            toastError(e);
            dispatch({ type: 'invalidatePool' }); // prototype: toast แล้ว route() (L888)
          }
        });
      },
      assign: async (id, userId) => {
        if (!latest.current.state.live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`assign:${id}`, async () => {
          try {
            upsertLead(await assignLead(id, userId));
            done('มอบหมายแล้ว: ' + (latest.current.state.reps.find((r) => r.id === userId)?.name || ''));
          } catch (e) {
            toastError(e);
          }
        });
      },
    };
  }, [actions]);
}
```

- [ ] **Step 5: `components/leads/ContactBar.tsx`** (แทนทั้งไฟล์ — รับ `openJst` จาก component แม่ แทนการเรียก `useJst()` ในทุกปุ่ม)

```tsx
'use client';

import { ChIcon } from '@/components/ui/ChIcon';
import { PATHS } from '@/lib/constants';
import { chatAria, chatTitle, jstTarget, platLabel, type JstSource, type JstTarget, type NormChannel } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';

/** ฟังก์ชันเปิดแชตใน JST (จาก useJst ของ component แม่ — เรียก hook ครั้งเดียวต่อตาราง/popup ไม่ใช่ต่อปุ่ม) */
export type OpenJst = (t: JstTarget, opts?: { auto?: boolean }) => void;

/** ปุ่มโทร: เปิดแอปโทร (tel:) พร้อมคัดลอกเบอร์ เผื่อเครื่องคอมไม่มีแอปโทร */
export function CallButton({ phone }: { phone: string }) {
  const { toast } = useActions();
  return (
    <a
      className="ch-btn call"
      href={`tel:${phone}`}
      data-call={phone}
      title={`โทร ${phone}`}
      aria-label={`โทร ${phone}`}
      onClick={() => {
        navigator.clipboard?.writeText(phone).catch(() => {});
        toast(`โทร ${phone} · คัดลอกเบอร์แล้ว`);
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={PATHS.phone} /></svg>
    </a>
  );
}

function ChatButton({ x, c, size, openJst }: { x: JstSource; c: NormChannel; size: number; openJst: OpenJst }) {
  return (
    <button type="button" className="ch-btn" data-act="jst" data-t={JSON.stringify(jstTarget(x, c))} title={chatTitle(c)} aria-label={chatAria(c)} onClick={() => openJst(jstTarget(x, c))}>
      <ChIcon p={c.platform} size={size} />
    </button>
  );
}

/** ปุ่มโทร + ปุ่มแชต: ในตาราง (mini) 4 ช่องทาง 16px, ใน popup 8 ช่องทาง 22px */
export function ContactBar({ x, chans, mini = false, openJst }: { x: JstSource; chans: NormChannel[]; mini?: boolean; openJst: OpenJst }) {
  return (
    <span className={`ch-bar ${mini ? 'mini' : ''}`}>
      <CallButton phone={x.phone} />
      {chans.slice(0, mini ? 4 : 8).map((c, i) => (
        <ChatButton key={`${c.shop}-${i}`} x={x} c={c} size={mini ? 16 : 22} openJst={openJst} />
      ))}
    </span>
  );
}

/** ช่องทางแชต (แยกตามร้าน) ใน popup รายละเอียดลูกค้า */
export function ChannelRow({ x, chans, openJst }: { x: JstSource; chans: NormChannel[]; openJst: OpenJst }) {
  if (!chans.length) return <span className="sub">ไม่พบช่องทางแชต</span>;
  return (
    <div className="ch-chips">
      {chans.map((c, i) => (
        <button key={`${c.shop}-${i}`} type="button" className="ch-chip" data-act="jst" data-t={JSON.stringify(jstTarget(x, c))} title="เปิดแชตใน JST" onClick={() => openJst(jstTarget(x, c))}>
          <ChIcon p={c.platform} size={18} />
          <span>{c.shop || platLabel(c.platform)}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `components/leads/LeadTable.tsx`** (แทนทั้งไฟล์ — `useJst` ครั้งเดียว, `ctx` ผ่าน `useMemo`, `memo(LeadRow)`; markup เหมือนเดิมทุกตัวอักษร)

```tsx
'use client';

import { Fragment, memo, useMemo } from 'react';
import { ContactBar, type OpenJst } from '@/components/leads/ContactBar';
import { DueTag, StatusBadge } from '@/components/ui/StatusBadge';
import type { Campaign, ClaimMode, Lead, Rep } from '@/lib/api/types';
import { bills, canUnclaim, lastSeller, repName, total } from '@/lib/domain/leads';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useAppState } from '@/lib/state/AppProvider';
import { useJst } from './useJst';
import { useLeadActions, type LeadActions } from './useLeadActions';

/** mode = วิธีจองของแคมเปญที่เลือก (หน้าแคมเปญ); perCamp = มุม "ลูกค้าทุกแคมเปญ" ใช้วิธีจองของแคมเปญของแต่ละลีด */
export interface TableOpts { mode?: ClaimMode; perCamp?: boolean }

interface RowCtx { reps: Rep[]; campaigns: Campaign[]; meId: string; isAdmin: boolean; today: string; act: LeadActions; openJst: OpenJst }

export function LeadTable({ list, opts = {} }: { list: Lead[]; opts?: TableOpts }) {
  const { reps, campaigns, meId, isAdmin, today } = useAppState();
  const act = useLeadActions();
  const openJst = useJst();
  // ctx คงที่จนกว่าทีม/แคมเปญ/วันนี้เปลี่ยน → พิมพ์ค้นหาแล้วแถวที่ลีดไม่เปลี่ยนไม่ต้องวาดใหม่ (memo)
  const ctx = useMemo<RowCtx>(() => ({ reps, campaigns, meId, isAdmin, today, act, openJst }), [reps, campaigns, meId, isAdmin, today, act, openJst]);
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>ชื่อ / เบอร์</th><th>เลขบิลที่เคยซื้อ</th><th>ร้านค้า</th><th>แคมเปญ</th><th>พนักงานขาย</th>
            <th className="r">ยอดซื้อรวม</th><th>สถานะ</th><th>บันทึกล่าสุด</th><th>ปุ่มดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {list.length ? (
            list.map((l) => {
              const mode = opts.perCamp ? campaigns.find((c) => c.id === l.campaignId)?.claimMode || 'self' : opts.mode;
              return <LeadRow key={l.id} l={l} mode={mode} ctx={ctx} />;
            })
          ) : (
            <tr><td colSpan={9} className="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const LeadRow = memo(function LeadRow({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  const { reps, campaigns, meId, isAdmin, today, act, openJst } = ctx;
  const owner = repName(reps, l.owner);
  const seller = lastSeller(l, reps);
  const lastNote = l.interactions[l.interactions.length - 1]?.note;
  const logType = l.noCall ? 'chat' : 'call';
  return (
    <tr>
      <td>
        <button className="cust-name" data-act="open" data-id={l.id} onClick={() => act.openCustomer(l.id)}>{l.name}</button>
        <div className="sub mono">{l.phone}</div>
        <ContactBar x={l} chans={channelsOf(l)} mini openJst={openJst} />
      </td>
      <td>
        <div className="bills">{bills(l).map((b, i) => <span key={`${b}-${i}`} className="bill">{b}</span>)}</div>
      </td>
      <td>{l.shop}</td>
      <td>
        {l.source === 'self'
          ? <span className="tag self">เซลล์ขุดเอง</span>
          : <span className="camp-cell">{campaigns.find((c) => c.id === l.campaignId)?.name || '—'}</span>}
      </td>
      <td>
        {owner ? <span className="rep-name">{owner}</span> : <span className="sub">ยังไม่มีผู้ดูแล</span>}
        {seller ? <div className="sub">ขายล่าสุด: {repName(reps, seller) || ''}</div> : null}
      </td>
      <td className="r num">{baht(total(l))}</td>
      <td>
        <StatusBadge status={l.status} />
        <DueTag callback={l.callback} today={today} />
        {l.chatCheck?.sent ? <div><span className="tag chat-ok">ทักแชทแล้ว ✓</span></div> : null}
        {l.noCall ? (
          <>
            <div><span className="tag nocall">ห้ามโทร · แชตเท่านั้น</span></div>
            {isAdmin ? <div className="sub">แจ้งโดย {repName(reps, l.noCallBy) || '—'}{l.noCallAt ? ' · ' + fmtDate(l.noCallAt) : ''}</div> : null}
          </>
        ) : null}
        {isAdmin && l.releasedBy?.length && !l.owner ? (
          <div className="sub">คัดออกโดย {l.releasedBy.map((id) => repName(reps, id) || '').join(', ')}</div>
        ) : null}
      </td>
      <td className="note-cell">
        {l.interest ? <div><span className="sub">สนใจ:</span> {l.interest}</div> : null}
        {l.status === 'won' && l.closedBills.length ? (
          <div>
            <span className="sub">บิลที่ปิด:</span>{' '}
            {l.closedBills.map((b, i) => (
              <Fragment key={`${b}-${i}`}>{i ? ' ' : ''}<span className="bill">{b}</span></Fragment>
            ))}
          </div>
        ) : null}
        <div>{lastNote || '—'}</div>
      </td>
      <td>
        <div className="actions">
          <button className="btn sm primary" data-act="log" data-type={logType} data-id={l.id} onClick={() => act.openLog(l.id, logType)}>
            {l.noCall ? 'บันทึกแชต' : 'บันทึก'}
          </button>
          <ClaimCell l={l} mode={mode} ctx={ctx} />
          {canUnclaim(l, meId) ? (
            <button className="btn sm danger" data-act="unclaim" data-id={l.id} onClick={() => act.confirmUnclaim(l.id)}>ยกเลิกจอง</button>
          ) : null}
          {isAdmin && l.noCall ? (
            <button className="btn sm" data-act="dnc-restore" data-id={l.id} onClick={() => void act.restoreNoCall(l.id)}>ยกเลิกห้ามโทร</button>
          ) : null}
        </div>
      </td>
    </tr>
  );
});

/** L106-113: ไม่มีวิธีจองหรือมีเจ้าของแล้ว → ว่าง; หัวหน้าได้ select มอบหมาย */
function ClaimCell({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  if (!mode || l.owner) return null;
  const assign = ctx.isAdmin ? (
    <select
      className="select"
      data-assign={l.id}
      aria-label="มอบหมายให้"
      defaultValue=""
      onChange={(e) => {
        const sel = e.currentTarget;
        // มอบหมายไม่สำเร็จ/โหมด fixture: คืนช่องเลือกเป็นค่าว่างเหมือน prototype ที่วาดตารางใหม่ (route())
        if (sel.value) void ctx.act.assign(l.id, sel.value).finally(() => { if (sel.isConnected) sel.value = ''; });
      }}
    >
      <option value="">มอบหมายให้…</option>
      {ctx.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  ) : null;
  if (mode === 'self') {
    return (
      <>
        <button className="btn sm outline" data-act="claim" data-id={l.id} onClick={() => void ctx.act.claim(l.id)}>จอง</button>
        {assign}
      </>
    );
  }
  return assign ?? <span className="sub">{mode === 'assign' ? 'รอหัวหน้ามอบหมาย' : 'ไม่มียอดขายเดิมให้อ้างอิง'}</span>;
}
```

- [ ] **Step 7: `components/modals/CustomerModal.tsx`** — `openJst` + คลิกแท็บเดิมรีเซ็ต scroll/โฟกัส/ตรวจแชตใหม่ (prototype เปิด popup ใหม่ทุกครั้งที่คลิกแท็บ L515)

แก้

```tsx
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
```

เป็น

```tsx
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
import { useJst } from '@/components/leads/useJst';
```

แก้

```tsx
  const { openModal, patchLead, toast } = useActions();
  const [tab, setTab] = useState<Tab>('buy');
```

เป็น

```tsx
  const { openModal, patchLead, toast } = useActions();
  const openJst = useJst();
  const [tab, setTab] = useState<Tab>('buy');
  // นับทุกครั้งที่คลิกแท็บ (รวมแท็บที่ active อยู่แล้ว) = prototype เปิด popup ใหม่ทุกครั้ง (L515)
  const [tabSeq, setTabSeq] = useState(0);
```

แก้

```tsx
  }, [tab, plDone]);
  const switchTab = (t: Tab) => setTab(t);
```

เป็น

```tsx
  }, [tabSeq, plDone]);
  const switchTab = (t: Tab) => {
    setTab(t);
    setTabSeq((n) => n + 1);
  };
```

แก้ `<ContactBar x={l} chans={chans} />` เป็น `<ContactBar x={l} chans={chans} openJst={openJst} />`, แก้ `<ChannelRow x={l} chans={chans} />` เป็น `<ChannelRow x={l} chans={chans} openJst={openJst} />` และแก้

```tsx
          <ChatCheckBody lead={l} blankKey={`${tab}|${plDone}`} runKey={`${tab}|${plDone}|${checks}`} />
```

เป็น

```tsx
          <ChatCheckBody lead={l} blankKey={`${tabSeq}|${plDone}`} runKey={`${tabSeq}|${plDone}|${checks}`} />
```

- [ ] **Step 8: ตรวจ**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`; `Tests  127 passed (127)`

Run: `npx playwright test -g "leads"` (ปิด dev server ที่เปิดค้างก่อน)
Expected: `10 passed` (หน้า `/leads` และ popup A–D ยังเหมือน prototype หลังแยก `openJst` และ `memo`)

- [ ] **Step 9: Commit**

```bash
git add lib/domain/log.ts lib/domain/log.test.ts components/modals/LogModal.tsx components/leads/useLeadActions.tsx components/leads/ContactBar.tsx components/leads/LeadTable.tsx components/modals/CustomerModal.tsx
git commit -m "fix(web): guard claim/assign/restore against double clicks, resume a partly saved log, memoize lead rows and reset the customer popup on every tab click" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: กติกาหน้าแคมเปญ + ถังลูกค้า + `/mine` `/pool` (ฟังก์ชันล้วน)

ค่าคาดหวังทุกตัวใน test คำนวณด้วยโค้ดของ `legacy/app.js` ตรงตัว (renderCampaign, campsCard, inCampLine, poolLoad โหมดตัวอย่าง, poolAction, matchOne, funnel) บนข้อมูลตัวอย่างเดียวกัน — ถ้า test ตก ให้แก้ฟังก์ชันให้ตรง prototype ห้ามแก้ตัวเลขใน test

**Files:**
- Create: `lib/domain/campaigns.ts`, `lib/domain/pool.ts`
- Test: `lib/domain/campaigns.test.ts`, `lib/domain/pool.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/domain/campaigns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Campaign } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import {
  campaignBadge, campaignBase, campStats, emptyCampaignsText, funnel, inCampLine, initialCampaignForm, leadsInCampaigns, matchOne, modeOf,
  namePlaceholder, newCampaignRow, nextTab, normalizeSelCamp, quota,
} from './campaigns';

// ค่าคาดหวังคำนวณด้วยโค้ด legacy/app.js ตรงตัวบนข้อมูลตัวอย่างเดียวกัน (Dev MPD หัวหน้า, วันนี้ 2026-11-04)
const F = fixturePayload();
const admin = { meId: 'r4', isAdmin: true };
const bebe = F.campaigns.filter((c) => c.brand === 'bebeplay');
const camp = (over: Partial<Campaign>): Campaign => ({ ...F.campaigns[0], ...over });

describe('campaign page (prototype renderCampaign L259-298)', () => {
  it('normalizeSelCamp keeps ALL/CAMPS or a campaign of this brand, else ALL (L261)', () => {
    expect(normalizeSelCamp(null, F.campaigns, 'bebeplay')).toBe('ALL');
    expect(normalizeSelCamp('CAMPS', F.campaigns, 'hosttail')).toBe('CAMPS');
    expect(normalizeSelCamp('c-bebe-nov', F.campaigns, 'bebeplay')).toBe('c-bebe-nov');
    expect(normalizeSelCamp('c-bebe-nov', F.campaigns, 'hosttail')).toBe('ALL');
    expect(normalizeSelCamp('gone', F.campaigns, 'bebeplay')).toBe('ALL');
  });
  it('campaignBadge: running / closed / ended (L278-281)', () => {
    expect(campaignBadge(camp({ end: '2026-11-30' }), F.today)).toEqual({ cls: 's-won', text: 'กำลังดำเนินการ' });
    expect(campaignBadge(camp({ end: '' }), F.today)).toEqual({ cls: 's-won', text: 'กำลังดำเนินการ' });
    expect(campaignBadge(camp({ end: '2026-10-20' }), F.today)).toEqual({ cls: 's-new', text: 'จบแล้ว' });
    expect(campaignBadge(camp({ active: false }), F.today)).toEqual({ cls: 's-new', text: 'ปิดอยู่' });
  });
  it('card stats count visible leads: contacted = not new, bar % rounded (L275-285)', () => {
    const card = (id: string, v = admin) => campStats(leadsInCampaigns(F.leads, new Set([id]), v));
    expect(card('c-bebe-nov')).toEqual({ n: 12, done: 6, won: 2, pct: 50 });
    expect(card('c-bebe-oct')).toEqual({ n: 2, done: 1, won: 1, pct: 50 });
    expect(card('c-host-nov')).toEqual({ n: 6, done: 4, won: 1, pct: 67 });
    // เซลล์ r1 เห็นเฉพาะลีดว่าง + ของตัวเอง
    expect(card('c-bebe-nov', { meId: 'r1', isAdmin: false })).toEqual({ n: 4, done: 0, won: 0, pct: 0 });
    expect(campStats([])).toEqual({ n: 0, done: 0, won: 0, pct: 0 });
  });
  it('"ลูกค้าทุกแคมเปญ" and the campaign table base (L272, L654-656)', () => {
    expect(campStats(campaignBase(F.leads, 'CAMPS', bebe, admin))).toEqual({ n: 14, done: 7, won: 3, pct: 50 });
    expect(campaignBase(F.leads, 'c-bebe-nov', bebe, admin)).toHaveLength(12);
  });
  it('quota line (L290)', () => {
    const base = campaignBase(F.leads, 'c-bebe-nov', bebe, admin);
    expect(quota(base, 'r4', 'c-bebe-nov', F.campaigns)).toEqual({ n: 12, mine: 3, free: 4, mode: 'เซลล์จองเอง' });
    expect(quota(base, 'r4', 'CAMPS', F.campaigns).mode).toBe('ตามที่ตั้งไว้ในแต่ละแคมเปญ');
    expect(modeOf('c-bebe-oct', F.campaigns)).toBe('assign');
    expect(modeOf('c-host-nov', F.campaigns)).toBe('auto');
    expect(modeOf('ALL', F.campaigns)).toBe('self');
  });
  it('demo pool card line and empty text (L286, L648-653)', () => {
    expect(inCampLine(F.customers, F.leads, F.campaigns, 'bebeplay')).toBe('เข้าแคมเปญแล้ว 14 · ยังไม่เข้า 45');
    expect(inCampLine(F.customers, F.leads, F.campaigns, 'hosttail')).toBe('เข้าแคมเปญแล้ว 6 · ยังไม่เข้า 23');
    expect(emptyCampaignsText(true)).toBe('ยังไม่มีแคมเปญ — กด "+ สร้างแคมเปญ" ด้านบน');
    expect(emptyCampaignsText(false)).toBe('ยังไม่มีแคมเปญ');
  });
});

describe('campaign builder (prototype campaignForm L782-871)', () => {
  it('starts on the base tab with self mode; tabs advance base → set → aud', () => {
    expect(initialCampaignForm('hosttail')).toEqual({
      tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand: 'hosttail', mode: 'self', max: '', crits: [], prev: false,
    });
    expect([nextTab('base'), nextTab('set')]).toEqual(['set', 'aud']);
    expect([namePlaceholder('bebeplay'), namePlaceholder('hosttail')]).toEqual(['เช่น Bebeplay Q4 2026', 'เช่น Hosttail Q4 2026']);
  });
  it('matchOne: empty fields pass; times is strictly more than (L771-779)', () => {
    const c = { purchases: [{ date: '2026-03-01', bill: '1', sku: 'BBP-BED-01', product: 'เตียงนอนเด็ก', amount: 4990, seller: null }] };
    expect(matchOne(c, { type: 'product', kw: 'bbp-bed' })).toBe(true);
    expect(matchOne(c, { type: 'product', kw: '  ' })).toBe(true);
    expect(matchOne(c, { type: 'total', min: '5000' })).toBe(false);
    expect(matchOne(c, { type: 'total', min: '', max: '4990' })).toBe(true);
    expect(matchOne(c, { type: 'dates', from: '2026-03-02' })).toBe(false);
    expect(matchOne(c, { type: 'order', min: '4990' })).toBe(true);
    expect(matchOne(c, { type: 'times', min: '1' })).toBe(false);
    expect(matchOne(c, { type: 'times', min: '0' })).toBe(true);
  });
  it('funnel narrows step by step from all brand customers without no-call (L785-793)', () => {
    const bed = funnel(F.customers, F.leads, 'bebeplay', [{ type: 'product', kw: 'เตียง' }]);
    expect(bed.steps).toEqual([
      { label: 'ลูกค้าทั้งหมด · Bebeplay', n: 59, pct: 100 },
      { label: 'เงื่อนไข 1 · เคยซื้อสินค้า (ชื่อ / SKU)', n: 26, pct: 44 },
    ]);
    expect(bed.result.slice(0, 3).map((c) => c.name)).toEqual(['พิมพ์ชนก มั่นคง', 'สมศักดิ์ พงษ์ไทย', 'ชลธิชา ใจดี']);
    expect(funnel(F.customers, F.leads, 'bebeplay', [{ type: 'total', min: '3000' }, { type: 'times', min: '1' }]).steps.map((s) => s.n)).toEqual([59, 40, 37]);
    expect(funnel(F.customers, F.leads, 'hosttail', [{ type: 'dates', from: '2026-01-01', to: '' }, { type: 'order', min: '1000' }]).steps.map((s) => s.n))
      .toEqual([29, 25, 18]);
  });
  it('live mode has no customers in state → every step is 0 (prototype quirk kept)', () => {
    expect(funnel([], F.leads, 'bebeplay', [{ type: 'product', kw: 'x' }]).steps).toEqual([
      { label: 'ลูกค้าทั้งหมด · Bebeplay', n: 0, pct: 0 },
      { label: 'เงื่อนไข 1 · เคยซื้อสินค้า (ชื่อ / SKU)', n: 0, pct: 0 },
    ]);
  });
  it('newCampaignRow builds the dsales_campaigns insert (L852)', () => {
    const f = { ...initialCampaignForm('bebeplay'), name: '  Bebeplay Q4  ', desc: ' ', max: '20', mode: 'assign' as const, crits: [{ type: 'product' as const, kw: 'เตียง' }] };
    expect(newCampaignRow(f)).toEqual({
      brand: 'bebeplay', name: 'Bebeplay Q4', description: null, start_date: null, end_date: null, claim_mode: 'assign', max_per_rep: 20,
      active: true, criteria: [{ type: 'product', kw: 'เตียง' }],
    });
    expect(newCampaignRow({ ...f, desc: 'โปร', start: '2026-12-01', end: '2026-12-31', max: '', active: false }))
      .toMatchObject({ description: 'โปร', start_date: '2026-12-01', end_date: '2026-12-31', max_per_rep: null, active: false });
  });
});
```

`lib/domain/pool.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Lead, PoolRow } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import type { Period } from '@/lib/state/reducer';
import {
  baseAction, canNext, claimBrand, demoBase, demoGrand, demoPool, dormantText, keepTotal, pageRange, poolAction, poolCampNames,
  poolDetailFooter, takenBadge,
} from './pool';

// ค่าคาดหวังคำนวณด้วยโค้ด legacy/app.js ตรงตัว (poolLoad โหมดตัวอย่าง L636-640, poolAction L694-704)
const F = fixturePayload();
const NONE: Period = { from: '', to: '', key: 'all' };
const admin = { meId: 'r4', isAdmin: true };
const ctx = { live: false, isAdmin: true, meId: 'r4', leads: F.leads, reps: F.reps };
const pool = (over: Partial<Parameters<typeof demoPool>[2]> = {}) =>
  demoPool(F.customers, F.leads, { brand: 'bebeplay', q: '', page: 0, period: NONE, viewer: admin, ...over });
const row = (over: Partial<PoolRow>): PoolRow => ({
  id: 'i1', name: 'ก', phone: '0812345678', segment: '', ltv: 0, orders: 0, last: null, brands: ['bebeplay'], chat: '', leadId: null,
  mine: false, noCall: false, takenName: '', taken: null, dormantDays: null, ownerTag: null, ...over,
});
const lead = (over: Partial<Lead>): Lead => ({ ...F.leads[0], ...over });

describe('demo pool (fixture mode = prototype demo)', () => {
  it('brand total without no-call customers, 50 per page, sorted by spend', () => {
    expect(demoGrand(F.customers, F.leads, 'bebeplay')).toBe(59);
    expect(demoGrand(F.customers, F.leads, 'hosttail')).toBe(29);
    const p0 = pool();
    expect([p0.total, p0.rows.length, pool({ page: 1 }).rows.length]).toEqual([59, 50, 9]);
    expect(p0.rows.slice(0, 3).map((r) => [r.id, r.name, r.ltv])).toEqual([
      ['C5063', 'พิมพ์ชนก มั่นคง', 14850], ['C5087', 'ศิริพร เจริญผล', 11560], ['C5048', 'ธีรเดช บุญมา', 10650],
    ]);
  });
  it('searches name / chat name / phone digits / bill, and filters the period by the latest purchase', () => {
    expect(pool({ q: 'mom' }).rows.map((r) => r.id)).toEqual([
      'C5061', 'C5057', 'C5039', 'C5018', 'C5054', 'C5058', 'C5034', 'C5052', 'C5088', 'C5007', 'C5003', 'C5028', 'C5019', 'C5045', 'C5040', 'C5006',
    ]);
    expect(pool({ q: '086-435' }).rows.map((r) => r.id)).toEqual(['C5000']);
    expect(pool({ q: '895016' }).rows.map((r) => r.id)).toEqual(['C5000']);
    expect(pool({ period: { from: '2026-10-01', to: '2026-10-31', key: 'm1' } }).total).toBe(8);
  });
  it('row buttons: reserved by others / mine / free (admin Dev MPD)', () => {
    const taken = pool().rows.filter((r) => r.taken).map((r) => [r.id, poolAction(r, ctx)]);
    expect(taken).toEqual([
      ['C5018', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5010', { kind: 'disabled', text: 'จองโดย อาทิตยา คชสร' }],
      ['C5016', { kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1016' }],
      ['C5012', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5015', { kind: 'disabled', text: 'จองแล้ว' }],
      ['C5027', { kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1027' }],
      ['C5019', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5025', { kind: 'disabled', text: 'จองโดย ปรีชา วงศ์ทอง' }],
    ]);
    expect(poolAction(pool().rows[0], ctx)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('a sales rep sees "จองแล้ว" for others and can unclaim own', () => {
    const r1 = { ...ctx, isAdmin: false, meId: 'r1' };
    const rows = pool({ viewer: { meId: 'r1', isAdmin: false } }).rows;
    expect(poolAction(rows.find((r) => r.id === 'C5010') as PoolRow, r1)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1010' });
    expect(poolAction(rows.find((r) => r.id === 'C5018') as PoolRow, r1)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({ releasedByMe: true }), r1)).toEqual({ kind: 'disabled', text: 'คัดออกแล้ว' });
  });
  it('campaign names of a pool row (demo only)', () => {
    expect(poolCampNames({ phone: F.leads[1].phone }, F.leads, F.campaigns)).toEqual(['Bebeplay · ลูกค้าเก่า 6 เดือน']);
    expect(poolCampNames({ phone: '0000000000' }, F.leads, F.campaigns)).toEqual([]);
  });
});

describe('live pool rows (dsales_customer_pool_v4)', () => {
  const live = { ...ctx, live: true, leads: [lead({ id: 'L9', owner: 'r4', claimedBy: 'r4', status: 'following', noCall: false })] };
  it('poolAction: no-call, mine (unclaimable or not), taken (admin sees the name), free', () => {
    expect(poolAction(row({ noCall: true, taken: 'other' }), live)).toEqual({ kind: 'disabled', text: 'ไม่สะดวกให้โทร' });
    expect(poolAction(row({ mine: true, taken: 'r4', leadId: 'L9' }), live)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(poolAction(row({ mine: true, taken: 'r4', leadId: 'L404' }), live)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({ taken: 'other', takenName: 'กมลชนก' }), live)).toEqual({ kind: 'disabled', text: 'จองโดย กมลชนก' });
    expect(poolAction(row({ taken: 'other', takenName: 'กมลชนก' }), { ...live, isAdmin: false })).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({}), live)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('popup E: taken badge and footer (L729, L740)', () => {
    expect(takenBadge(row({}), live)).toBeNull();
    expect(takenBadge(row({ taken: 'other' }), live)).toBe('จองแล้ว');
    expect(takenBadge(row({ taken: 'other', takenName: 'กมลชนก' }), live)).toBe('จองโดย กมลชนก');
    expect(takenBadge(row({ taken: 'other', takenName: 'กมลชนก' }), { ...live, isAdmin: false })).toBe('จองแล้ว');
    expect(takenBadge(row({ taken: 'r4', mine: true }), live)).toBe('จองโดย Dev MPD');
    expect(poolDetailFooter(row({}), live)).toEqual({ kind: 'claim', text: 'จอง' });
    expect(poolDetailFooter(row({ noCall: true }), live)).toBeNull();
    expect(poolDetailFooter(row({ taken: 'r4', mine: true, leadId: 'L9' }), live)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(poolDetailFooter(row({ taken: 'other' }), live)).toBeNull();
  });
  it('page range text and next button (L686-687)', () => {
    expect(pageRange(0, 50, 1234)).toBe('1–50 จาก 1,234');
    expect(pageRange(1, 9, 59)).toBe('51–59 จาก 59');
    expect(pageRange(0, 0, 0)).toBe('');
    expect(pageRange(0, 0, null)).toBe('');
    expect([canNext(0, 50, 59), canNext(1, 9, 59), canNext(0, 0, null)]).toEqual([true, false, false]);
  });
});

describe('/mine and /pool (dsales_base_customers, spec ข้อ 3)', () => {
  const mineCtx = { meId: 'r4', leads: [lead({ id: 'L9', owner: 'r4', claimedBy: 'r4', status: 'following', noCall: false }), lead({ id: 'L8', owner: 'r4', status: 'won' })] };
  it('claimBrand: the brand filter, or the first sellable brand of the customer', () => {
    expect(claimBrand('hosttail', ['bebeplay'])).toBe('hosttail');
    expect(claimBrand('all', ['other', 'hosttail', 'bebeplay'])).toBe('hosttail');
    expect(claimBrand('', ['other'])).toBeNull();
    expect(claimBrand(null, [])).toBeNull();
  });
  it('baseAction covers no-call, my lead, my tag customer without a lead, another rep, free', () => {
    expect(baseAction(row({ noCall: true, mine: true }), mineCtx)).toEqual({ kind: 'disabled', text: 'ไม่สะดวกให้โทร' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L9' }), mineCtx)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L8' }), mineCtx)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: null, ownerTag: 'Admin_Dev' }), mineCtx)).toEqual({ kind: 'claim', text: 'เริ่มติดตาม' });
    expect(baseAction(row({ taken: 'other', takenName: 'กมลชนก' }), mineCtx)).toEqual({ kind: 'disabled', text: 'เป็นลูกค้าของ กมลชนก' });
    expect(baseAction(row({ taken: 'other', ownerTag: 'Admin_Ploy' }), mineCtx)).toEqual({ kind: 'disabled', text: 'เป็นลูกค้าของ Admin_Ploy' });
    expect(baseAction(row({ taken: 'other' }), mineCtx)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(baseAction(row({}), mineCtx)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('dormant text and total from the first page', () => {
    expect([dormantText(null), dormantText(1234)]).toEqual(['—', 'ไม่ซื้อมา 1,234 วัน']);
    expect([keepTotal(120, 50, 0, null), keepTotal(0, 0, 3, 120), keepTotal(0, 0, 0, 120)]).toEqual([120, 120, 0]);
  });
  it('demoBase splits fixture customers into mine / pool', () => {
    const o = { brand: null, q: '', page: 0, today: F.today, meId: 'r4' };
    const mine = demoBase(F.customers, F.leads, 'mine', o);
    const free = demoBase(F.customers, F.leads, 'pool', o);
    expect(mine.rows.every((r) => r.mine && r.taken === 'r4')).toBe(true);
    expect(free.rows.every((r) => !r.taken)).toBe(true);
    expect(mine.total + free.total).toBeLessThanOrEqual(F.customers.length);
    expect(mine.total).toBeGreaterThan(0);
    expect(free.rows[0].dormantDays).toBeGreaterThan(0);
    expect(demoBase(F.customers, F.leads, 'pool', { ...o, brand: 'hosttail' }).rows.every((r) => r.brands[0] === 'hosttail')).toBe(true);
  });
});
```

Run: `npm test`
Expected: FAIL 2 ไฟล์ — `Failed to resolve import "./campaigns"` และ `Failed to resolve import "./pool"` (`Test Files  2 failed | 20 passed (22)` · `Tests  127 passed (127)`)

- [ ] **Step 2: `lib/domain/campaigns.ts`**

```ts
import type { Campaign, CampaignCriterion, DemoCustomer, Lead, NewCampaign } from '@/lib/api/types';
import { BRAND, CRIT, MODES, type Brand, type ClaimMode } from '@/lib/constants';
import { isDnc, visible, type Viewer } from './leads';

// หน้าแคมเปญ + ตัวสร้างแคมเปญของ prototype (legacy/app.js L259-298, L647-663, L763-871) เป็นฟังก์ชันล้วน

/** การ์ดที่เลือกบนหน้าแคมเปญ: 'ALL' = ถังลูกค้าทั้งหมด, 'CAMPS' = ลูกค้าทุกแคมเปญ, อื่น ๆ = id แคมเปญ */
export const SEL_ALL = 'ALL';
export const SEL_CAMPS = 'CAMPS';

/** L261: การ์ดที่เลือกไว้ต้องเป็น ALL / CAMPS หรือแคมเปญของแบรนด์นี้ ไม่งั้นกลับไป ALL */
export function normalizeSelCamp(sel: string | null, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'brand'>>, brand: Brand): string {
  if (sel === SEL_ALL || sel === SEL_CAMPS) return sel;
  return sel && campaigns.find((c) => c.id === sel)?.brand === brand ? sel : SEL_ALL;
}

/** L278: เปิดอยู่และยังไม่เลยวันสิ้นสุด */
export const campaignActive = (c: Pick<Campaign, 'active' | 'end'>, today: string): boolean => c.active !== false && (!c.end || c.end >= today);

/** badge ของการ์ดแคมเปญ (L281) */
export function campaignBadge(c: Pick<Campaign, 'active' | 'end'>, today: string): { cls: 's-won' | 's-new'; text: string } {
  if (campaignActive(c, today)) return { cls: 's-won', text: 'กำลังดำเนินการ' };
  return { cls: 's-new', text: c.active === false ? 'ปิดอยู่' : 'จบแล้ว' };
}

export interface CampStats { n: number; done: number; won: number; pct: number }
/** สถิติการ์ด (L275-277, L655-656): ติดต่อแล้ว = สถานะไม่ใช่ใหม่, bar = done/n ปัดเป็น % */
export function campStats(ls: ReadonlyArray<Pick<Lead, 'status'>>): CampStats {
  const done = ls.filter((l) => l.status !== 'new').length;
  return { n: ls.length, done, won: ls.filter((l) => l.status === 'won').length, pct: ls.length ? Math.round((done / ls.length) * 100) : 0 };
}

/** ลีดในแคมเปญชุดนี้ที่ผู้ใช้เห็น (visible L37) */
export function leadsInCampaigns(leads: ReadonlyArray<Lead>, ids: ReadonlySet<string>, v: Viewer): Lead[] {
  return leads.filter((l) => !!l.campaignId && ids.has(l.campaignId) && visible(l, v));
}

/** base ของตาราง (L272): CAMPS = ทุกแคมเปญของแบรนด์, อื่น ๆ = แคมเปญที่เลือก — ผ่าน visible() */
export function campaignBase(leads: ReadonlyArray<Lead>, sel: string, brandCampaigns: ReadonlyArray<Pick<Campaign, 'id'>>, v: Viewer): Lead[] {
  const ids = sel === SEL_CAMPS ? new Set(brandCampaigns.map((c) => c.id)) : new Set([sel]);
  return leadsInCampaigns(leads, ids, v);
}

/** วิธีจองของการ์ดที่เลือก (L269): ไม่ใช่แคมเปญ (ALL/CAMPS) = self */
export const modeOf = (sel: string, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'claimMode'>>): ClaimMode =>
  campaigns.find((c) => c.id === sel)?.claimMode || 'self';

export interface Quota { n: number; mine: number; free: number; mode: string }
/** แถบ .quota (L290) */
export function quota(base: ReadonlyArray<Pick<Lead, 'owner'>>, meId: string, sel: string, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'claimMode'>>): Quota {
  return {
    n: base.length,
    mine: base.filter((l) => l.owner === meId).length,
    free: base.filter((l) => !l.owner).length,
    mode: sel === SEL_CAMPS ? 'ตามที่ตั้งไว้ในแต่ละแคมเปญ' : MODES[modeOf(sel, campaigns)],
  };
}

export const emptyCampaignsText = (isAdmin: boolean): string => `ยังไม่มีแคมเปญ${isAdmin ? ' — กด "+ สร้างแคมเปญ" ด้านบน' : ''}`;

/** โหมดตัวอย่าง (L648-653): ลูกค้าในถังของแบรนด์ (ไม่นับห้ามโทร) ที่มีลีดในแคมเปญของแบรนด์แล้ว (จับคู่ด้วยเบอร์) */
export function inCampLine(
  customers: ReadonlyArray<Pick<DemoCustomer, 'brand' | 'phone'>>, leads: ReadonlyArray<Lead>, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'brand'>>, brand: Brand,
): string {
  const ids = new Set(campaigns.filter((c) => c.brand === brand).map((c) => c.id));
  const phones = new Set(leads.filter((l) => !!l.campaignId && ids.has(l.campaignId)).map((l) => l.phone));
  const mine = customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone));
  const inC = mine.filter((c) => phones.has(c.phone)).length;
  return `เข้าแคมเปญแล้ว ${inC} · ยังไม่เข้า ${mine.length - inC}`;
}

/* ---------- ตัวสร้างแคมเปญ (popup F) ---------- */
export type CampaignTab = 'base' | 'set' | 'aud';
export interface CampaignForm {
  tab: CampaignTab; name: string; desc: string; active: boolean; start: string; end: string; brand: Brand;
  mode: ClaimMode; max: string; crits: CampaignCriterion[]; prev: boolean;
}
export const initialCampaignForm = (brand: Brand): CampaignForm => ({
  tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand, mode: 'self', max: '', crits: [], prev: false,
});

/** คำอธิบายใต้ตัวเลือกวิธีจอง (L814) */
export const MODE_HELP: Record<ClaimMode, string> = {
  self: 'เซลล์กดจองลีดที่ยังว่างเอง ลีดที่จองแล้วคนอื่นจะไม่เห็น',
  assign: 'หัวหน้าเลือกมอบหมายลีดให้เซลล์แต่ละคน',
  auto: 'ลีดเข้าถังของเซลล์ที่เคยขายให้ลูกค้ารายนั้นล่าสุดทันที ที่เหลือให้จองเอง',
};

export const namePlaceholder = (brand: Brand): string => `เช่น ${brand === 'hosttail' ? 'Hosttail Q4 2026' : 'Bebeplay Q4 2026'}`;

/** ปุ่ม "ถัดไป →" (L843): base → set → aud */
export const nextTab = (tab: CampaignTab): CampaignTab => (tab === 'base' ? 'set' : 'aud');

const has = (v: unknown): boolean => v !== undefined && v !== null && String(v) !== '';

/** เงื่อนไขหนึ่งข้อ (L771-779) ช่องว่าง = ผ่าน */
export function matchOne(c: Pick<DemoCustomer, 'purchases'>, cr: CampaignCriterion): boolean {
  const P = c.purchases;
  if (cr.type === 'product') {
    const k = (cr.kw || '').trim().toLowerCase();
    return !k || P.some((p) => (p.product + ' ' + p.sku).toLowerCase().includes(k));
  }
  if (cr.type === 'total') {
    const t = P.reduce((s, p) => s + p.amount, 0);
    return (!has(cr.min) || t >= Number(cr.min)) && (!has(cr.max) || t <= Number(cr.max));
  }
  if (cr.type === 'dates') return P.some((p) => (!cr.from || p.date >= cr.from) && (!cr.to || p.date <= cr.to));
  if (cr.type === 'order') return !has(cr.min) || P.some((p) => p.amount >= Number(cr.min));
  if (cr.type === 'times') return !has(cr.min) || P.length > Number(cr.min);
  return true;
}

export interface FunnelStep { label: string; n: number; pct: number }
/**
 * funnel (L785-793): ลูกค้าทั้งแบรนด์ (ไม่นับห้ามโทร) แล้วกรองทีละเงื่อนไข (AND); pct = n / ขั้นแรก ปัดเป็น %
 * ล็อกอินจริง customers = [] เสมอ จึงเป็น 0 ทุกขั้น (พฤติกรรมเดิมของ prototype)
 */
export function funnel(customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, brand: Brand, crits: ReadonlyArray<CampaignCriterion>): { steps: FunnelStep[]; result: DemoCustomer[] } {
  let cur = customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone));
  const raw: Array<{ label: string; n: number }> = [{ label: `ลูกค้าทั้งหมด · ${BRAND[brand]}`, n: cur.length }];
  crits.forEach((cr, i) => {
    cur = cur.filter((c) => matchOne(c, cr));
    raw.push({ label: `เงื่อนไข ${i + 1} · ${CRIT[cr.type].label}`, n: cur.length });
  });
  const top = raw[0].n || 1;
  return { steps: raw.map((s) => ({ ...s, pct: Math.round((s.n / top) * 100) })), result: cur };
}

/** แถว insert ของ dsales_campaigns (L852) — ไม่สร้างลีด */
export function newCampaignRow(f: CampaignForm): NewCampaign {
  return {
    brand: f.brand, name: f.name.trim(), description: f.desc.trim() || null, start_date: f.start || null, end_date: f.end || null,
    claim_mode: f.mode, max_per_rep: f.max ? Number(f.max) : null, active: !!f.active, criteria: f.crits,
  };
}
```

- [ ] **Step 3: `lib/domain/pool.ts`**

```ts
import type { Campaign, DemoCustomer, Lead, PoolRow, Rep } from '@/lib/api/types';
import { PAGE, type Brand } from '@/lib/constants';
import { canUnclaimAny, isDnc, releasedByMe, repName, type Viewer } from './leads';
import { hasPeriod, inPeriod } from './period';
import type { Period } from '@/lib/state/reducer';

// ถังลูกค้า "ลูกค้าทั้งหมด" (legacy/app.js L614-760) และหน้า /mine, /pool (spec ข้อ 3) เป็นฟังก์ชันล้วน

/** ปุ่มท้ายแถว: จอง (outline) / ยกเลิกจอง (danger) / ปุ่มกดไม่ได้ */
export type RowAction =
  | { kind: 'claim'; text: string }
  | { kind: 'unclaim'; text: 'ยกเลิกจอง'; leadId: string }
  | { kind: 'disabled'; text: string };

export interface PoolCtx { live: boolean; isAdmin: boolean; meId: string; leads: ReadonlyArray<Lead>; reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>> }

const unclaim = (leadId: string): RowAction => ({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId });
const disabled = (text: string): RowAction => ({ kind: 'disabled', text });

/** poolAction (L694-704) */
export function poolAction(r: PoolRow, ctx: PoolCtx): RowAction {
  if (ctx.live) {
    if (r.noCall) return disabled('ไม่สะดวกให้โทร');
    if (r.mine) {
      const l = r.leadId ? ctx.leads.find((x) => x.id === r.leadId) : undefined;
      return l && r.leadId && canUnclaimAny(l, ctx.meId) ? unclaim(r.leadId) : disabled('จองแล้ว');
    }
    if (r.taken) return disabled(ctx.isAdmin && r.takenName ? 'จองโดย ' + r.takenName : 'จองแล้ว');
    return { kind: 'claim', text: 'จอง' };
  }
  if (r.releasedByMe) return disabled('คัดออกแล้ว');
  if (r.taken) {
    if (r.taken === ctx.meId) return r.mineReserved && r.leadId ? unclaim(r.leadId) : disabled('จองแล้ว');
    return disabled(ctx.isAdmin ? 'จองโดย ' + (repName(ctx.reps, r.taken) || '') : 'จองแล้ว');
  }
  return { kind: 'claim', text: 'จอง' };
}

/** badge "จองแล้ว / จองโดย …" ที่หัว popup E (L729) */
export function takenBadge(r: PoolRow, ctx: Pick<PoolCtx, 'isAdmin' | 'reps'>): string | null {
  if (!r.taken) return null;
  if (r.taken === 'other' && !(ctx.isAdmin && r.takenName)) return 'จองแล้ว';
  return 'จองโดย ' + (repName(ctx.reps, r.taken) || r.takenName || '');
}

/** ปุ่มท้าย popup E (L740): จอง = ยังไม่มีคนจองและไม่ใช่ห้ามโทร; ยกเลิกจอง = ของฉันและยกเลิกได้ */
export function poolDetailFooter(r: PoolRow, ctx: PoolCtx): RowAction | null {
  if (!r.taken && !r.noCall) return { kind: 'claim', text: 'จอง' };
  if (r.taken === ctx.meId && r.leadId) {
    const l = ctx.leads.find((x) => x.id === r.leadId);
    if (ctx.live ? !!l && canUnclaimAny(l, ctx.meId) : !!r.mineReserved) return unclaim(r.leadId);
  }
  return null;
}

/** ช่อง "แคมเปญ" ของโหมดตัวอย่าง (L689-693) — ล็อกอินจริงแสดง "—" */
export function poolCampNames(r: Pick<PoolRow, 'phone'>, leads: ReadonlyArray<Lead>, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'name'>>): string[] {
  return leads
    .filter((l) => l.phone === r.phone && l.campaignId)
    .map((l) => campaigns.find((c) => c.id === l.campaignId)?.name)
    .filter((n): n is string => !!n);
}

/** "1–50 จาก 60" (L686) — total ว่าง/0 = ไม่แสดง */
export function pageRange(page: number, rowCount: number, total: number | null): string {
  if (!total) return '';
  const from = page * PAGE;
  return `${(from + 1).toLocaleString('th-TH')}–${(from + rowCount).toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')}`;
}
/** ปุ่ม "ถัดไป →" (L687) */
export const canNext = (page: number, rowCount: number, total: number | null): boolean => !(total === null || page * PAGE + rowCount >= total);

const sumAmount = (c: Pick<DemoCustomer, 'purchases'>): number => c.purchases.reduce((s, p) => s + p.amount, 0);
const ownedLead = (leads: ReadonlyArray<Lead>, phone: string): Lead | undefined => leads.find((l) => l.phone === phone && l.owner);

/** โหมดตัวอย่าง: จำนวนลูกค้าทั้งแบรนด์ (L642) */
export const demoGrand = (customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, brand: Brand): number =>
  customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone)).length;

/** โหมดตัวอย่าง (L636-640): ค้นหา ชื่อ/ชื่อแชต/เบอร์ (ตัวเลข)/เลขบิล, ไม่รวมห้ามโทร, ช่วงวันที่ตามวันซื้อล่าสุด, เรียงยอดซื้อมากสุด */
export function demoPool(
  customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>,
  o: { brand: Brand | null; q: string; page: number; period: Period; viewer: Viewer },
): { rows: PoolRow[]; total: number } {
  const q = o.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const all = customers
    .filter((c) => (!o.brand || c.brand === o.brand) && !isDnc(leads, c.phone) && (
      !q || c.name.toLowerCase().includes(q) || (c.chatName || '').toLowerCase().includes(q) || (!!qd && c.phone.includes(qd))
      || c.purchases.some((p) => p.bill.includes(q))
    ))
    .filter((c) => !hasPeriod(o.period) || inPeriod(c.purchases[0]?.date, o.period))
    .sort((a, b) => sumAmount(b) - sumAmount(a));
  const rows = all.slice(o.page * PAGE, o.page * PAGE + PAGE).map((c): PoolRow => {
    const tl = ownedLead(leads, c.phone);
    return {
      id: c.id, name: c.name, phone: c.phone, segment: '', ltv: sumAmount(c), orders: c.purchases.length, last: c.purchases[0]?.date ?? null,
      brands: [c.brand], chat: c.chatName, leadId: tl?.id ?? null, mine: false, noCall: false, takenName: '', taken: tl?.owner ?? null,
      dormantDays: null, ownerTag: null,
      releasedByMe: leads.some((l) => l.phone === c.phone && releasedByMe(l, o.viewer)),
      mineReserved: tl?.owner === o.viewer.meId && !tl?.noCall && tl?.status !== 'won',
    };
  });
  return { rows, total: all.length };
}

/* ---------- /mine และ /pool (dsales_base_customers) ---------- */
export type BaseScopeKey = 'mine' | 'pool';

/** แบรนด์ที่ใช้จอง (spec ข้อ 3): แบรนด์ที่เลือกในตัวกรอง หรือแบรนด์แรกของลูกค้าที่เป็น bebeplay/hosttail; ไม่มี = null */
export function claimBrand(selected: string | null | undefined, brands: ReadonlyArray<string>): Brand | null {
  if (selected === 'bebeplay' || selected === 'hosttail') return selected;
  const b = brands.find((x) => x === 'bebeplay' || x === 'hosttail');
  return (b as Brand | undefined) ?? null;
}
export const NO_BRAND_TEXT = 'เลือกแบรนด์ที่ช่องด้านบนก่อนจอง';

/**
 * ปุ่มของ /mine, /pool (spec ข้อ 3): ห้ามโทร → disabled; ของฉันที่มีลีดแล้ว → ยกเลิกจอง/จองแล้ว; ของฉันตาม tag ที่ยังไม่มีลีด → เริ่มติดตาม;
 * เป็นของเซลล์คนอื่น (ลีดหรือ tag) → disabled "เป็นลูกค้าของ <ชื่อ/tag>"; ว่าง → จอง
 */
export function baseAction(r: PoolRow, ctx: Pick<PoolCtx, 'meId' | 'leads'>): RowAction {
  if (r.noCall) return disabled('ไม่สะดวกให้โทร');
  if (r.mine) {
    const l = r.leadId ? ctx.leads.find((x) => x.id === r.leadId) : undefined;
    if (l && r.leadId && l.owner === ctx.meId) return canUnclaimAny(l, ctx.meId) ? unclaim(r.leadId) : disabled('จองแล้ว');
    return { kind: 'claim', text: 'เริ่มติดตาม' };
  }
  if (r.taken) {
    const who = r.takenName || r.ownerTag;
    return disabled(who ? `เป็นลูกค้าของ ${who}` : 'จองแล้ว');
  }
  return { kind: 'claim', text: 'จอง' };
}

export const dormantText = (days: number | null): string => (days == null ? '—' : `ไม่ซื้อมา ${days.toLocaleString('th-TH')} วัน`);

/** total ของ /mine, /pool: ใช้จากหน้าที่มีแถว (dsales_base_customers คืน total_count เฉพาะเมื่อมีแถว) หน้าเกินท้ายคงค่าเดิม */
export const keepTotal = (rowsTotal: number, rowCount: number, page: number, prev: number | null): number | null =>
  rowCount ? rowsTotal : page === 0 ? 0 : prev;

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / 864e5);

/** โหมด fixture ของ /mine, /pool: ของฉัน = มีลีดเบอร์นี้ที่ฉันดูแล, ถังกลาง = ไม่มีใครดูแล — เรียงยอดซื้อมากสุด */
export function demoBase(
  customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, scope: BaseScopeKey,
  o: { brand: Brand | null; q: string; page: number; today: string; meId: string },
): { rows: PoolRow[]; total: number } {
  const q = o.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const all = customers
    .filter((c) => {
      const owner = ownedLead(leads, c.phone)?.owner ?? null;
      return (scope === 'mine' ? owner === o.meId : owner === null) && (!o.brand || c.brand === o.brand)
        && (!q || c.name.toLowerCase().includes(q) || (c.chatName || '').toLowerCase().includes(q) || (!!qd && c.phone.includes(qd)));
    })
    .sort((a, b) => sumAmount(b) - sumAmount(a));
  const rows = all.slice(o.page * PAGE, o.page * PAGE + PAGE).map((c): PoolRow => {
    const l = leads.find((x) => x.phone === c.phone);
    const owner = l?.owner ?? null;
    const last = c.purchases[0]?.date ?? null;
    return {
      id: c.id, name: c.name, phone: c.phone, segment: '', ltv: sumAmount(c), orders: c.purchases.length, last, brands: [c.brand],
      chat: c.chatName, leadId: l?.id ?? null, mine: owner === o.meId, noCall: !!l?.noCall, takenName: '',
      taken: owner ? (owner === o.meId ? o.meId : 'other') : null, dormantDays: last ? daysBetween(last, o.today) : null, ownerTag: null,
    };
  });
  return { rows, total: all.length };
}
```

- [ ] **Step 4: รัน test + typecheck + lint**

Run: `npm test`
Expected: `Test Files  22 passed (22)` · `Tests  150 passed (150)` (campaigns 11, pool 12)

Run: `npm run typecheck && npm run lint`
Expected: ไม่มี error; lint `✔ No ESLint warnings or errors`

- [ ] **Step 5: Commit**

```bash
git add lib/domain/campaigns.ts lib/domain/campaigns.test.ts lib/domain/pool.ts lib/domain/pool.test.ts
git commit -m "feat(web): port campaign card, quota, builder funnel and customer pool rules from the prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ถังลูกค้าทั้งหมด (pool panel) + popup E + จองจากถัง

**Files:**
- Create: `components/campaigns/useCustomerClaim.ts`, `components/campaigns/RowButton.tsx`, `components/campaigns/BrandTags.tsx`, `components/campaigns/PoolPanel.tsx`, `components/modals/PoolDetailModal.tsx`
- Modify: `components/leads/PeriodCard.tsx`, `components/modals/PickFromBucketModal.tsx`

- [ ] **Step 1: จองลูกค้าจากถัง** — `components/campaigns/useCustomerClaim.ts`

```ts
'use client';

import { useCallback } from 'react';
import { useJst } from '@/components/leads/useJst';
import { mapChannel } from '@/lib/api/map';
import { claimCustomer, getCustomerChannels } from '@/lib/api/rpc';
import type { Channel, PoolRow } from '@/lib/api/types';
import { FIXTURE_NO_WRITE, type Brand } from '@/lib/constants';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * จองลูกค้าจากถัง (poolClaimLive L961-970): dsales_claim_customer → ลีดใหม่เข้า state, ปิด popup, ถังโหลดใหม่, toast
 * แล้วดึงช่องทางแชต (dsales_customer_channels) เก็บลงลีด และเปิดแชตแรกใน JST อัตโนมัติ; error → toast + ถังโหลดใหม่
 * seq = popup E ที่กดจอง (ปิดเฉพาะ popup นั้น); กันกดซ้ำต่อเบอร์
 */
export function useCustomerClaim(): (r: PoolRow, brand: Brand, seq?: number, msg?: string) => Promise<void> {
  const { live } = useAppState();
  const { once, upsertLead, patchLead, dispatch, toast, toastError, closeModal } = useActions();
  const openJst = useJst();
  return useCallback(
    async (r, brand, seq, msg = 'จองแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ') => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      await once(`claim-customer:${r.phone}`, async () => {
        try {
          const lj = await claimCustomer(r.phone, brand);
          upsertLead(lj);
          closeModal(seq);
          dispatch({ type: 'invalidatePool' });
          toast(msg);
          let chans: Channel[] | null = null;
          try {
            chans = ((await getCustomerChannels(r.phone)) || []).map(mapChannel);
          } catch {
            // ดึงช่องทางไม่ได้: ใช้ช่องทางที่ server ส่งมากับลีด
          }
          const chatName = r.chat || '';
          if (chans) patchLead(lj.id, { channels: chans, chatName });
          const c1 = channelsOf(chans ? { channels: chans, shop: lj.shop, chatName } : lj)[0];
          if (c1) openJst(jstTarget({ phone: lj.phone, name: lj.name, brand: lj.brand, chatName: chans ? chatName : lj.chatName }, c1), { auto: true });
        } catch (e) {
          toastError(e);
          dispatch({ type: 'invalidatePool' });
        }
      });
    },
    [live, once, upsertLead, patchLead, dispatch, toast, toastError, closeModal, openJst],
  );
}
```

- [ ] **Step 2: ปุ่มท้ายแถวและ tag แบรนด์**

`components/campaigns/RowButton.tsx`:

```tsx
'use client';

import type { RowAction } from '@/lib/domain/pool';

/** ปุ่มท้ายแถวของถังลูกค้า / ลูกค้าของฉัน / ถังกลาง (poolAction L694-704) */
export function RowButton({ a, rowId, onClaim, onUnclaim }: { a: RowAction; rowId: string; onClaim: () => void; onUnclaim: (leadId: string) => void }) {
  if (a.kind === 'claim') return <button className="btn sm outline" data-pool-claim={rowId} onClick={onClaim}>{a.text}</button>;
  if (a.kind === 'unclaim') {
    const leadId = a.leadId;
    return <button className="btn sm danger" data-act="unclaim" data-id={leadId} onClick={() => onUnclaim(leadId)}>{a.text}</button>;
  }
  return <button className="btn sm" disabled>{a.text}</button>;
}
```

`components/campaigns/BrandTags.tsx`:

```tsx
import { Fragment } from 'react';
import { BRAND } from '@/lib/constants';

const label = (b: string): string => (BRAND as Readonly<Record<string, string>>)[b] || b;

/** tag แบรนด์ของลูกค้าในถัง (L679, L729) คั่นด้วยช่องว่าง; ไม่มีแบรนด์ = "—" เมื่อ dash */
export function BrandTags({ brands, dash = false }: { brands: ReadonlyArray<string>; dash?: boolean }) {
  if (!brands.length) return dash ? <span className="sub">—</span> : null;
  return (
    <>
      {brands.map((b, i) => (
        <Fragment key={`${b}-${i}`}>
          {i ? ' ' : ''}
          <span className={`tag ${b === 'bebeplay' ? 'bebe' : b === 'hosttail' ? 'host' : ''}`}>{label(b)}</span>
        </Fragment>
      ))}
    </>
  );
}
```

- [ ] **Step 3: popup E** — `components/modals/PoolDetailModal.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BrandTags } from '@/components/campaigns/BrandTags';
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
import { useJst } from '@/components/leads/useJst';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { CloseButton } from '@/components/ui/CloseButton';
import { mapChannel } from '@/lib/api/map';
import { getCustomerChannels, getCustomerPurchases } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { repName } from '@/lib/domain/leads';
import { takenBadge, type RowAction } from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf, type NormChannel } from '@/lib/jst';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

interface Line { date: string | null; bill: string; sku: string; product: string; amount: number | null; seller: string }

/**
 * popup E รายละเอียดลูกค้าในถัง (poolDetail L719-753)
 * ล็อกอินจริง: แสดงทันที ("กำลังโหลดประวัติการซื้อ…") แล้วดึง dsales_customer_purchases + dsales_customer_channels (LINE ก่อน) แล้ววาดใหม่ครั้งเดียว
 * โหมด fixture: ประวัติซื้อ/ช่องทาง/ที่อยู่จากลูกค้าตัวอย่าง (ขายโดย = ชื่อเซลล์)
 * footer คำนวณโดยผู้เปิด (ถังลูกค้า: poolDetailFooter, /mine /pool: baseAction)
 */
export function PoolDetailModal({ row: r, footer, onClaim }: { row: PoolRow; footer: RowAction | null; onClaim: (seq: number | undefined) => void }) {
  const { live, customers, reps, isAdmin } = useAppState();
  const { toast, handleAuthError } = useActions();
  const openJst = useJst();
  const act = useLeadActions();
  const seq = useModalSeq();
  const cu = live ? undefined : customers.find((c) => c.id === r.id);
  const [detail, setDetail] = useState<{ lines: Line[] | null; err: string; chans: NormChannel[] }>(() => ({
    lines: cu ? cu.purchases.map((p) => ({ ...p, seller: repName(reps, p.seller) || '' })) : null,
    err: '',
    chans: cu ? channelsOf(cu) : channelsOf({ channels: r.chat ? [{ shop: '', platform: 'other', chat: r.chat }] : [] }),
  }));

  useEffect(() => {
    if (!live) return;
    let alive = true;
    (async () => {
      let lines: Line[] = [];
      let err = '';
      try {
        lines = ((await getCustomerPurchases(r.phone)) || []).map((x) => ({
          date: x.txn_date, bill: x.bill_no || x.order_no || '', sku: x.sku || '', product: x.product_name || '',
          amount: x.amount == null ? null : Number(x.amount), seller: '',
        }));
      } catch (e) {
        if (handleAuthError(e)) return;
        err = 'โหลดประวัติการซื้อไม่สำเร็จ';
      }
      let chans: NormChannel[] | null = null;
      try {
        const rows = await getCustomerChannels(r.phone);
        if (rows?.length) chans = channelsOf({ channels: rows.map(mapChannel) });
      } catch {
        // ใช้ช่องทางจากชื่อแชตเหมือนเดิม
      }
      if (alive) setDetail((d) => ({ lines, err, chans: chans ?? d.chans }));
    })();
    return () => {
      alive = false;
    };
  }, [live, r.phone, handleAuthError]);

  const tx = { phone: r.phone, name: r.name, brand: (r.brands[0] || '') as Brand, chatName: r.chat };
  const badge = takenBadge(r, { isAdmin, reps });
  const { lines, err, chans } = detail;
  const copyPhone = () => {
    navigator.clipboard?.writeText(r.phone).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(r.phone));
  };

  return (
    <>
      <div className="modal-h">
        <h3>{r.name}</h3>
        <BrandTags brands={r.brands} />
        {badge ? <span className="badge s-new plain">{badge}</span> : null}
        <ContactBar x={tx} chans={chans} openJst={openJst} />
        <CloseButton />
      </div>
      <div className="modal-b">
        <dl className="info-grid" style={{ margin: 0 }}>
          <div><dt>เบอร์</dt><dd className="mono">{r.phone}{' '}<button className="copy" data-copy={r.phone} onClick={copyPhone}>คัดลอก</button></dd></div>
          <div><dt>กลุ่มลูกค้า</dt><dd>{r.segment || '—'}</dd></div>
          <div><dt>ยอดซื้อสะสม</dt><dd className="num">{baht(Math.round(r.ltv))}</dd></div>
          <div><dt>จำนวนออเดอร์</dt><dd className="num">{r.orders}</dd></div>
          <div><dt>ซื้อล่าสุด</dt><dd>{r.last ? fmtDate(r.last) : '—'}</dd></div>
          <div><dt>ชื่อแชต</dt><dd>{r.chat || '—'}</dd></div>
          <div><dt>ที่อยู่</dt><dd>{cu?.address || '—'}</dd></div>
          <div className="wide"><dt>ช่องทางแชต (แยกตามร้าน)</dt><dd><ChannelRow x={tx} chans={chans} openJst={openJst} /></dd></div>
        </dl>
        <div className="sub"><b>ประวัติการซื้อ</b></div>
        {lines === null ? (
          <div className="empty">กำลังโหลดประวัติการซื้อ…</div>
        ) : err ? (
          <div className="login-err">{err}</div>
        ) : lines.length ? (
          <div className="mini-table table-wrap">
            <table>
              <thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th className="r">ยอดซื้อ</th></tr></thead>
              <tbody>
                {lines.map((p, i) => (
                  <tr key={`${p.bill}-${i}`}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="mono">{p.sku || '—'}</td>
                    <td>{p.product || '—'}<div className="sub">บิล {p.bill || '—'}{p.seller ? ' · ขายโดย ' + p.seller : ''}</div></td>
                    <td className="r num">{p.amount == null ? '—' : baht(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ไม่พบประวัติการซื้อรายรายการ</div>
        )}
      </div>
      {footer?.kind === 'claim' ? (
        <div className="modal-f"><button className="btn primary" data-pool-claim={r.id} onClick={() => onClaim(seq)}>{footer.text}</button></div>
      ) : null}
      {footer?.kind === 'unclaim' ? (
        <div className="modal-f"><button className="btn danger" data-act="unclaim" data-id={footer.leadId} onClick={() => act.confirmUnclaim(footer.leadId)}>ยกเลิกจอง</button></div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: ถังลูกค้า** — `components/campaigns/PoolPanel.tsx`

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PoolDetailModal } from '@/components/modals/PoolDetailModal';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getCustomerPool } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import { PAGE, PATHS, type Brand } from '@/lib/constants';
import { canNext, demoPool, pageRange, poolAction, poolCampNames, poolDetailFooter, type PoolCtx } from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { BrandTags } from './BrandTags';
import { RowButton } from './RowButton';
import { useCustomerClaim } from './useCustomerClaim';

/** ค้นหาถังหลังหยุดพิมพ์ 300 ms (prototype P.t L758) */
export const POOL_DEBOUNCE_MS = 300;

/**
 * ถังลูกค้าทั้งหมดของแบรนด์ (poolPanel L672-688, bindPool L754-760, poolLoad L622-646)
 * - ล็อกอินจริง: dsales_customer_pool_v4 (50 แถว/หน้า, p_from/p_to เมื่อมีช่วงวันที่) โหลดใหม่เมื่อ mount / คำค้น / หน้า / ช่วงวันที่ / poolVersion
 * - โหมด fixture: ลูกค้าตัวอย่าง (demoPool) แบบโหมดตัวอย่างของ prototype
 * - ui.focusSearch (มาจาก "เลือกจากถัง"): โฟกัส #pool-q จนโหลดเสร็จแล้วตั้งกลับเป็น false
 */
export function PoolPanel({ brand }: { brand: Brand }) {
  const { live, pool, poolVersion, ui, customers, leads, meId, isAdmin, reps, campaigns } = useAppState();
  const { setPool, setUi, openModal, handleAuthError } = useActions();
  const act = useLeadActions();
  const claimRow = useCustomerClaim();
  const inputRef = useRef<HTMLInputElement>(null);
  const [qKey, setQKey] = useState(pool.q);
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(live);
  const { from, to } = ui.period;

  // debounce: เปลี่ยนคำค้นที่ใช้โหลด + กลับหน้าแรกพร้อมกัน (โหลดครั้งเดียว)
  useEffect(() => {
    if (pool.q === qKey) return;
    const t = setTimeout(() => {
      setPool({ page: 0 });
      setQKey(pool.q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [pool.q, qKey, setPool]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoading(true);
    setData((d) => ({ ...d, err: '' }));
    getCustomerPool({ search: qKey, offset: pool.page * PAGE, brand, from, to })
      .then((rows) => {
        if (alive) setData({ rows: rows.map((r) => mapPoolRow(r, meId)), total: rowsTotal(rows), err: '' });
      })
      .catch((e: unknown) => {
        if (alive && !handleAuthError(e)) setData((d) => ({ ...d, err: 'โหลดลูกค้าไม่สำเร็จ: ' + errorMessage(e) }));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [live, brand, qKey, pool.page, from, to, poolVersion, meId, handleAuthError]);

  const demo = useMemo(
    () => (live ? null : demoPool(customers, leads, { brand, q: qKey, page: pool.page, period: ui.period, viewer: { meId, isAdmin } })),
    [live, customers, leads, brand, qKey, pool.page, ui.period, meId, isAdmin],
  );
  const rows = demo ? demo.rows : data.rows;
  const total = demo ? demo.total : data.total;
  const busy = !demo && loading;

  // focusSearch: โฟกัสทุกครั้งที่วาดจนกว่าถังจะโหลดเสร็จ (L294)
  useEffect(() => {
    if (ui.focusSearch) inputRef.current?.focus();
  });
  useEffect(() => {
    if (ui.focusSearch && !busy) setUi({ focusSearch: false });
  }, [ui.focusSearch, busy, setUi]);

  const ctx: PoolCtx = { live, isAdmin, meId, leads, reps };
  const claim = (r: PoolRow, seq?: number) => void claimRow(r, brand, seq);
  const openDetail = (r: PoolRow) =>
    openModal(<PoolDetailModal row={r} footer={poolDetailFooter(r, ctx)} onClaim={(seq) => claim(r, seq)} />);

  return (
    <>
      <div className="toolbar">
        <label className="search" htmlFor="pool-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="pool-q" ref={inputRef} type="search" placeholder="ค้นหา เบอร์ / เลขบิล / ชื่อแชต / ชื่อลูกค้า" value={pool.q} onChange={(e) => setPool({ q: e.target.value })} />
        </label>
        {busy ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ / เบอร์</th><th>แคมเปญ</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const names = live ? [] : poolCampNames(r, leads, campaigns);
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="cust-name" data-pool-open={r.id} onClick={() => openDetail(r)}>{r.name}</button>
                      <div className="sub mono">{r.phone}</div>
                      {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                    </td>
                    <td>
                      {live ? <span className="sub">—</span>
                        : names.length ? names.map((n, i) => <div key={`${n}-${i}`} className="camp-cell">{n}</div>)
                          : <span className="sub">ยังไม่เข้าแคมเปญ</span>}
                    </td>
                    <td>{r.segment ? <span className="tag">{r.segment}</span> : <span className="sub">—</span>}</td>
                    <td className="r num">{baht(Math.round(r.ltv))}</td>
                    <td className="r num">{r.orders}</td>
                    <td>{r.last ? fmtDate(r.last) : '—'}</td>
                    <td><BrandTags brands={r.brands} dash /></td>
                    <td><RowButton a={poolAction(r, ctx)} rowId={r.id} onClaim={() => claim(r)} onUnclaim={act.confirmUnclaim} /></td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} className="empty">{busy ? 'กำลังโหลด…' : 'ไม่พบลูกค้าที่ตรงกับคำค้น'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn sm" data-pool="prev" disabled={pool.page === 0} onClick={() => setPool({ page: pool.page - 1 })}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(pool.page, rows.length, total)}</span>
        <button className="btn sm" data-pool="next" disabled={!canNext(pool.page, rows.length, total)} onClick={() => setPool({ page: pool.page + 1 })}>ถัดไป →</button>
      </div>
    </>
  );
}
```

- [ ] **Step 5: เปลี่ยนช่วงวันที่ = ถังกลับหน้าแรก; "เลือกจากถัง" ล้างคำค้น**

`components/leads/PeriodCard.tsx` — แก้

```tsx
  const { setUi, dispatch } = useActions();
```

เป็น

```tsx
  const { setUi, setPool, dispatch } = useActions();
```

และแก้

```tsx
  const apply = (p: Period) => {
    setUi({ period: p });
    dispatch({ type: 'invalidatePool' });
  };
```

เป็น

```tsx
  const apply = (p: Period) => {
    setUi({ period: p });
    setPool({ page: 0 });
    dispatch({ type: 'invalidatePool' });
  };
```

`components/modals/PickFromBucketModal.tsx` — แก้คอมเมนต์หัว component เป็น

```tsx
/** ไม่ให้พิมพ์ข้อมูลเอง: เลือกลูกค้าจากถัง "ลูกค้าทั้งหมด" ของแบรนด์แล้วกด จอง (prototype L602-610: ล้างคำค้นถัง + โฟกัสช่องค้นหา) */
```

แก้

```tsx
  const { setUi, dispatch, closeModal } = useActions();
```

เป็น

```tsx
  const { setUi, setPool, dispatch, closeModal } = useActions();
```

และแก้

```tsx
    setUi({ selCamp: 'ALL', focusSearch: true });
```

เป็น

```tsx
    setUi({ selCamp: 'ALL', focusSearch: true });
    setPool({ q: '', page: 0 });
```

- [ ] **Step 6: ตรวจ**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ไม่มี error; `Tests  150 passed (150)` (ถังยังไม่ถูกใช้ในหน้าใด — แสดงผลใน Task 6)

- [ ] **Step 7: Commit**

```bash
git add components/campaigns/useCustomerClaim.ts components/campaigns/RowButton.tsx components/campaigns/BrandTags.tsx components/campaigns/PoolPanel.tsx components/modals/PoolDetailModal.tsx components/leads/PeriodCard.tsx components/modals/PickFromBucketModal.tsx
git commit -m "feat(web): add the customer pool panel, pool customer popup and claim from the pool with automatic JST chat" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: popup F ตัวสร้างแคมเปญ

**Files:**
- Create: `components/modals/CampaignFormModal.tsx`

พฤติกรรมที่ต้องตรง prototype (inventory ข้อ 10.9): พิมพ์/เลือกในช่องไม่วาดใหม่ (โฟกัสอยู่ที่เดิม, "ถัดไป →" เปิดทันทีที่พิมพ์ชื่อ, ช่องของเงื่อนไขอัปเดตแค่ funnel) ส่วนสลับแท็บ/ถัดไป/ย้อนกลับ/เพิ่ม-ลบ-เปลี่ยนชนิดเงื่อนไข/ดูตัวอย่าง = วาด popup ใหม่ → เลื่อนกลับบนสุดและโฟกัสช่องแรก (`input,select,textarea,button.btn` เหมือน `openModal`) — e2e Task 8 ตรวจ element ที่ถูกโฟกัสทุกขั้น

- [ ] **Step 1: `components/modals/CampaignFormModal.tsx`**

```tsx
'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseButton } from '@/components/ui/CloseButton';
import { errorMessage } from '@/lib/api/errors';
import { mapCampaign } from '@/lib/api/map';
import { createCampaign } from '@/lib/api/rpc';
import type { CampaignCriterion } from '@/lib/api/types';
import { BRAND, CRIT, FIXTURE_NO_WRITE, MODES, PATHS, type Brand, type ClaimMode, type CritType } from '@/lib/constants';
import {
  funnel, initialCampaignForm, MODE_HELP, namePlaceholder, newCampaignRow, nextTab, type CampaignForm, type CampaignTab,
} from '@/lib/domain/campaigns';
import { baht } from '@/lib/format';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

const TABS: ReadonlyArray<readonly [CampaignTab, string]> = [['base', 'ข้อมูลพื้นฐาน'], ['set', 'การตั้งค่า'], ['aud', 'กลุ่มลูกค้า']];
type CritKey = 'kw' | 'min' | 'max' | 'from' | 'to';

/**
 * popup F ตัวสร้างแคมเปญ (campaignForm L782-871) หัวหน้าเท่านั้น
 * - พิมพ์/เลือกในช่องอัปเดตค่าโดยไม่ "วาดใหม่" (โฟกัสอยู่ที่เดิม); สลับแท็บ / ถัดไป / ย้อนกลับ / เพิ่ม-ลบ-เปลี่ยนชนิดเงื่อนไข / ดูตัวอย่าง
 *   = prototype วาด popup ใหม่ → เลื่อนกลับบนสุดแล้วโฟกัสช่องแรก (input/select/textarea/button.btn) เหมือน openModal
 * - funnel นับจาก state.customers (ล็อกอินจริง = [] จึงเป็น 0 เหมือน prototype)
 * - สร้าง: insert dsales_campaigns (ไม่สร้างลีด) → เลือกแคมเปญใหม่ → ไปหน้าแบรนด์ของแคมเปญ
 */
export function CampaignFormModal({ brand }: { brand: Brand }) {
  const { customers, leads, live } = useAppState();
  const { toast, closeModal, once, setUi, dispatch, handleAuthError } = useActions();
  const router = useRouter();
  const seq = useModalSeq();
  const [f, setF] = useState<CampaignForm>(() => initialCampaignForm(brand));
  const [draws, setDraws] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<CampaignForm>) => setF((x) => ({ ...x, ...patch }));
  const redraw = (patch: Partial<CampaignForm>) => {
    set(patch);
    setDraws((n) => n + 1);
  };
  const setCrits = (fn: (crits: CampaignCriterion[]) => CampaignCriterion[], again: boolean) =>
    (again ? redraw : set)({ crits: fn(f.crits) });

  useLayoutEffect(() => {
    if (!draws) return; // เปิดครั้งแรก: ModalRoot โฟกัส #cf-name ให้แล้ว
    const m = tabsRef.current?.closest('.modal');
    m?.scrollTo(0, 0);
    m?.querySelector<HTMLElement>('input,select,textarea,button.btn')?.focus();
  }, [draws]);

  const { steps, result } = useMemo(() => funnel(customers, leads, f.brand, f.crits), [customers, leads, f.brand, f.crits]);

  async function create() {
    if (!f.name.trim()) {
      redraw({ tab: 'base' });
      toast('ใส่ชื่อแคมเปญก่อน');
      return;
    }
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('create-campaign', async () => {
      try {
        const c = mapCampaign(await createCampaign(newCampaignRow(f)));
        dispatch({ type: 'upsertCampaign', campaign: c });
        setUi({ selCamp: c.id, status: 'all' });
        closeModal(seq);
        router.push(`/campaigns/${c.brand}`);
        toast('สร้างแคมเปญแล้ว · เลือกลูกค้าเข้าแคมเปญจากถัง "ลูกค้าทั้งหมด" ด้วยปุ่ม จอง');
      } catch (e) {
        handleAuthError(e);
        toast('สร้างแคมเปญไม่สำเร็จ: ' + errorMessage(e));
      }
    });
  }

  return (
    <>
      <div className="modal-h"><h3>สร้างแคมเปญใหม่</h3><CloseButton /></div>
      <div className="utabs" ref={tabsRef}>
        {TABS.map(([k, t]) => (
          <button key={k} type="button" className={`utab ${f.tab === k ? 'active' : ''}`} data-ca="tab" data-tab={k} onClick={() => redraw({ tab: k })}>
            {t}
            {k === 'aud' && f.crits.length ? <span className="count">{f.crits.length}</span> : null}
          </button>
        ))}
      </div>
      <div className="modal-b" style={{ paddingTop: 16 }}>
        {f.tab === 'base' ? (
          <>
            <div className="field">
              <label htmlFor="cf-name">ชื่อแคมเปญ <span className="req">*</span></label>
              <input className="input" id="cf-name" data-k="name" value={f.name} placeholder={namePlaceholder(f.brand)} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cf-desc">คำอธิบาย <span className="opt">(ไม่บังคับ)</span></label>
              <textarea className="textarea" id="cf-desc" data-k="desc" placeholder="สรุปวัตถุประสงค์ของแคมเปญนี้…" value={f.desc} onChange={(e) => set({ desc: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cf-brand">แบรนด์</label>
                <select className="select" id="cf-brand" data-k="brand" value={f.brand} onChange={(e) => set({ brand: e.target.value as Brand })}>
                  <option value="bebeplay">Bebeplay</option>
                  <option value="hosttail">Hosttail</option>
                </select>
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label className="switch">
                  <input type="checkbox" data-k="active" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
                  <span></span>เปิดใช้งานทันที
                </label>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cf-start">วันเริ่มต้น <span className="opt">(ไม่บังคับ)</span></label>
                <input className="input" type="date" id="cf-start" data-k="start" value={f.start} onChange={(e) => set({ start: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="cf-end">วันสิ้นสุด <span className="opt">(ไม่บังคับ)</span></label>
                <input className="input" type="date" id="cf-end" data-k="end" value={f.end} onChange={(e) => set({ end: e.target.value })} />
              </div>
            </div>
          </>
        ) : f.tab === 'set' ? (
          <>
            <div className="field">
              <label>วิธีจองลีดของแคมเปญนี้</label>
              {(Object.keys(MODES) as ClaimMode[]).map((k) => (
                <label key={k} className="radio-card">
                  <input type="radio" name="cf-mode" data-k="mode" value={k} checked={f.mode === k} onChange={() => set({ mode: k })} />
                  <span><b>{MODES[k]}</b><span className="sub">{MODE_HELP[k]}</span></span>
                </label>
              ))}
            </div>
            <div className="field">
              <label htmlFor="cf-max">จำนวนลีดสูงสุดที่เซลล์แต่ละคนจองได้ <span className="opt">(ไม่บังคับ)</span></label>
              <input className="input" id="cf-max" type="number" min="1" data-k="max" value={f.max} placeholder="ไม่จำกัด" onChange={(e) => set({ max: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <p className="help">กำหนดเงื่อนไขกรองลูกค้าที่จะเข้าแคมเปญนี้ ถ้าไม่กำหนดจะใช้ลูกค้าทั้งหมดของ {BRAND[f.brand]}</p>
            <div id="funnel">
              <div className="funnel">
                {steps.map((s, i) => (
                  <div key={i} className={`funnel-row ${i === 0 ? 'first' : ''}`}>
                    <span>{s.label}</span>
                    <b className="num">{s.n.toLocaleString('th-TH')} คน</b>
                    <div className="bar"><i style={{ width: `${s.pct}%` }} /></div>
                  </div>
                ))}
              </div>
              {f.prev ? (
                result.length ? (
                  <>
                    <div className="mini-table table-wrap">
                      <table>
                        <thead><tr><th>ชื่อ</th><th>เบอร์</th><th className="r">ยอดซื้อรวม</th><th className="r">ซื้อ (ครั้ง)</th></tr></thead>
                        <tbody>
                          {result.slice(0, 8).map((c) => (
                            <tr key={c.id}>
                              <td>{c.name}</td>
                              <td className="mono">{c.phone}</td>
                              <td className="r num">{baht(c.purchases.reduce((s, p) => s + p.amount, 0))}</td>
                              <td className="r num">{c.purchases.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sub">แสดง {Math.min(8, result.length)} จาก {result.length} คน</div>
                  </>
                ) : (
                  <div className="empty">ไม่มีลูกค้าที่ตรงเงื่อนไขทั้งหมด</div>
                )
              ) : null}
            </div>
            {f.crits.map((cr, i) => (
              <div key={i} className="crit-row">
                <select className="select" data-ct={i} aria-label="ประเภทเงื่อนไข" value={cr.type}
                  onChange={(e) => setCrits((cs) => cs.map((x, j) => (j === i ? { type: e.target.value as CritType } : x)), true)}>
                  {(Object.keys(CRIT) as CritType[]).map((k) => <option key={k} value={k}>{CRIT[k].label}</option>)}
                </select>
                {CRIT[cr.type].fields.map(([t, n, ph]) => (
                  <input key={n} className="input" type={t} min={t === 'number' ? '0' : undefined} data-cf={`${i}:${n}`} placeholder={ph} aria-label={ph}
                    value={cr[n as CritKey] ?? ''}
                    onChange={(e) => setCrits((cs) => cs.map((x, j) => (j === i ? { ...x, [n]: e.target.value } : x)), false)} />
                ))}
                <button type="button" className="icon-btn" data-ca="del" data-i={i} aria-label="ลบเงื่อนไข" onClick={() => setCrits((cs) => cs.filter((_, j) => j !== i), true)}>
                  <svg viewBox="0 0 24 24"><path d={PATHS.trash} /></svg>
                </button>
              </div>
            ))}
            <div className="crit-actions">
              <button type="button" className="btn sm" data-ca="add" onClick={() => setCrits((cs) => [...cs, { type: 'product' }], true)}>+ เพิ่มเงื่อนไข</button>
              <button type="button" className="btn sm" data-ca="prev" onClick={() => redraw({ prev: !f.prev })}>{f.prev ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}</button>
            </div>
          </>
        )}
      </div>
      <div className="modal-f">
        {f.tab === 'aud' ? (
          <>
            <button type="button" className="btn" data-ca="back" onClick={() => redraw({ tab: 'set' })}>← ย้อนกลับ</button>
            <button type="button" className="btn primary" data-ca="create" onClick={() => void create()}>สร้างแคมเปญ</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" data-close>ยกเลิก</button>
            <button type="button" className="btn primary" data-ca="next" disabled={!f.name.trim()} onClick={() => f.name.trim() && redraw({ tab: nextTab(f.tab) })}>ถัดไป →</button>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: ตรวจ**

Run: `npm run typecheck && npm run lint`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/modals/CampaignFormModal.tsx
git commit -m "feat(web): add the campaign builder popup with tabs, criteria funnel and preview" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: หน้าแคมเปญ `/campaigns/[brand]`

**Files:**
- Create: `components/campaigns/CampaignCards.tsx`, `components/campaigns/CampaignPage.tsx`
- Modify: `app/(app)/campaigns/[brand]/page.tsx`

- [ ] **Step 1: การ์ด** — `components/campaigns/CampaignCards.tsx`

```tsx
'use client';

import type { Campaign, Lead } from '@/lib/api/types';
import { BRAND, type Brand } from '@/lib/constants';
import { campaignBadge, campStats, emptyCampaignsText, SEL_ALL, SEL_CAMPS, type CampStats } from '@/lib/domain/campaigns';
import { fmtDate } from '@/lib/format';

const Bar = ({ pct }: { pct: number }) => (
  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
);
const Stats = ({ s }: { s: CampStats }) => (
  <div className="camp-stats"><span>ติดต่อแล้ว {s.done}/{s.n}</span><span>ปิดการขาย {s.won}</span></div>
);
const Count = ({ n }: { n: string | number }) => (
  <div className="kpi-value num" style={{ fontSize: 22 }}>{n} <span className="sub" style={{ fontSize: 13, fontWeight: 400 }}>ราย</span></div>
);

export interface CardsProps {
  brand: Brand; sel: string; live: boolean; isAdmin: boolean; today: string;
  /** จำนวนลูกค้าทั้งแบรนด์ (null = ยังไม่โหลด → "…") */
  grand: number | null;
  /** บรรทัดใต้ตัวเลขของการ์ดถัง: ล็อกอินจริง "ทั้งที่เข้าและยังไม่เข้าแคมเปญ", fixture = inCampLine */
  poolLine: string;
  campaigns: Campaign[];
  /** ลีดที่เห็นได้ (visible) ของทุกแคมเปญของแบรนด์ — แยกต่อแคมเปญในการ์ด */
  campLeads: Lead[];
  onSelect: (sel: string) => void;
}

/** .camp-grid ของหน้าแคมเปญ: การ์ดถัง (poolCard L664), ลูกค้าทุกแคมเปญ (campsCard L654), การ์ดแต่ละแคมเปญ (L274-286) */
export function CampaignCards({ brand, sel, live, isAdmin, today, grand, poolLine, campaigns, campLeads, onSelect }: CardsProps) {
  const all = campStats(campLeads);
  return (
    <div className="camp-grid">
      <button className={`camp all ${sel === SEL_ALL ? 'active' : ''}`} data-camp={SEL_ALL} onClick={() => onSelect(SEL_ALL)}>
        <div className="camp-top">
          <span className="camp-name">ลูกค้าทั้งหมด</span>
          <span className={`badge ${live ? 's-won' : 's-new'}`}>{live ? 'ข้อมูลจริง' : 'ตัวอย่าง'}</span>
        </div>
        <div className="camp-meta">ลูกค้าทั้งหมดของ {BRAND[brand]}</div>
        <Count n={grand == null ? '…' : grand.toLocaleString('th-TH')} />
        <div className="camp-stats"><span>{poolLine}</span></div>
      </button>
      <button className={`camp ${sel === SEL_CAMPS ? 'active' : ''}`} data-camp={SEL_CAMPS} onClick={() => onSelect(SEL_CAMPS)}>
        <div className="camp-top">
          <span className="camp-name">ลูกค้าทุกแคมเปญ</span>
          <span className="badge s-following plain">{campaigns.length} แคมเปญ</span>
        </div>
        <div className="camp-meta">ลูกค้าที่อยู่ในแคมเปญต่างๆ ของ {BRAND[brand]} รวมกัน</div>
        <Count n={all.n} />
        <Bar pct={all.pct} />
        <Stats s={all} />
      </button>
      {campaigns.length ? (
        campaigns.map((c) => {
          const s = campStats(campLeads.filter((l) => l.campaignId === c.id));
          const b = campaignBadge(c, today);
          return (
            <button key={c.id} className={`camp ${c.id === sel ? 'active' : ''}`} data-camp={c.id} onClick={() => onSelect(c.id)}>
              <div className="camp-top">
                <span className="camp-name">{c.name}</span>
                <span className={`badge ${b.cls}`}>{b.text}</span>
              </div>
              <div className="camp-meta">{fmtDate(c.start)} – {fmtDate(c.end)}</div>
              <div className="camp-meta">{c.note}</div>
              <Bar pct={s.pct} />
              <Stats s={s} />
            </button>
          );
        })
      ) : (
        <div className="empty">{emptyCampaignsText(isAdmin)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: หน้า** — `components/campaigns/CampaignPage.tsx`

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadToolbar } from '@/components/leads/LeadToolbar';
import { PeriodCard } from '@/components/leads/PeriodCard';
import { CampaignFormModal } from '@/components/modals/CampaignFormModal';
import { TopbarActions } from '@/components/shell/TopbarActions';
import { getPoolGrandTotal } from '@/lib/api/rpc';
import type { Brand } from '@/lib/constants';
import { campaignBase, inCampLine, leadsInCampaigns, modeOf, normalizeSelCamp, quota, SEL_ALL, SEL_CAMPS } from '@/lib/domain/campaigns';
import { filtered } from '@/lib/domain/leads';
import { demoGrand } from '@/lib/domain/pool';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { CampaignCards } from './CampaignCards';
import { PoolPanel } from './PoolPanel';

/**
 * หน้าแคมเปญของแบรนด์ (renderCampaign L259-298): การ์ด → การ์ดช่วงวันที่ → ถังลูกค้าทั้งหมด (ALL) หรือแถบ quota + toolbar + ตารางลีด
 * ปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" ทำแบบ prototype ตอนล็อกอินจริง (applyAuto คืน 0 เสมอ → toast "ไม่มีลีดที่ต้องจัดสรร")
 */
export function CampaignPage({ brand }: { brand: Brand }) {
  const { campaigns, leads, customers, meId, isAdmin, live, ui, today, pool } = useAppState();
  const { setUi, setPool, openModal, toast } = useActions();
  const viewer = useMemo(() => ({ meId, isAdmin }), [meId, isAdmin]);
  const cs = useMemo(() => campaigns.filter((c) => c.brand === brand), [campaigns, brand]);
  const sel = normalizeSelCamp(ui.selCamp, campaigns, brand);
  const isAll = sel === SEL_ALL;
  const isCamps = sel === SEL_CAMPS;

  useEffect(() => {
    if (sel !== ui.selCamp) setUi({ selCamp: sel });
  }, [sel, ui.selCamp, setUi]);

  // ถังเป็นของแบรนด์ที่เปิดอยู่เท่านั้น: เปลี่ยนแบรนด์ → ล้างคำค้น/หน้า/จำนวนรวม (L264)
  useEffect(() => {
    if (pool.brand !== brand) setPool({ brand, page: 0, q: '', grand: null, grandFor: null });
  }, [pool.brand, brand, setPool]);

  // จำนวนลูกค้าทั้งแบรนด์: dsales_customer_pool_v3 ครั้งเดียวต่อแบรนด์ (L626-629) ไม่ขึ้นกับคำค้น/ช่วงวันที่
  useEffect(() => {
    if (!live || pool.brand !== brand || pool.grandFor === brand) return;
    let alive = true;
    getPoolGrandTotal(brand).then(
      (grand) => {
        if (alive) setPool({ grand, grandFor: brand });
      },
      () => {
        // prototype ไม่แจ้ง error ของตัวเลขนี้ (การ์ดแสดง "…")
      },
    );
    return () => {
      alive = false;
    };
  }, [live, brand, pool.brand, pool.grandFor, setPool]);

  const campLeads = useMemo(() => leadsInCampaigns(leads, new Set(cs.map((c) => c.id)), viewer), [leads, cs, viewer]);
  const base = useMemo(() => (isAll ? [] : campaignBase(leads, sel, cs, viewer)), [isAll, leads, sel, cs, viewer]);
  const list = useMemo(() => filtered(base, { ...ui, today }), [base, ui, today]);
  const grand = live ? (pool.grandFor === brand ? pool.grand : null) : demoGrand(customers, leads, brand);
  const q = quota(base, meId, sel, campaigns);

  return (
    <>
      {isAdmin ? (
        <TopbarActions>
          <button className="btn" id="auto-run" onClick={() => toast('ไม่มีลีดที่ต้องจัดสรร')}>จัดสรรให้เซลล์ที่ขายล่าสุด</button>
          <button className="btn primary" id="new-camp" onClick={() => openModal(<CampaignFormModal brand={brand} />)}>+ สร้างแคมเปญ</button>
        </TopbarActions>
      ) : null}
      <CampaignCards
        brand={brand} sel={sel} live={live} isAdmin={isAdmin} today={today} grand={grand}
        poolLine={live ? 'ทั้งที่เข้าและยังไม่เข้าแคมเปญ' : inCampLine(customers, leads, campaigns, brand)}
        campaigns={cs} campLeads={campLeads}
        onSelect={(id) => setUi({ selCamp: id, status: 'all' })}
      />
      <PeriodCard />
      {isAll ? (
        pool.brand === brand ? <PoolPanel brand={brand} /> : null
      ) : (
        <>
          <div className="quota card" style={{ padding: '10px 14px' }}>
            ลีดในแคมเปญนี้ <b>{q.n}</b> รายการ · ที่ฉันดูแล <b>{q.mine}</b> · ยังไม่มีผู้ดูแล <b>{q.free}</b> · วิธีจอง: <b>{q.mode}</b>
          </div>
          <LeadToolbar base={base} withCampSelect={false} />
          <LeadTable list={list} opts={{ mode: modeOf(sel, campaigns), perCamp: isCamps }} />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 3: route** — `app/(app)/campaigns/[brand]/page.tsx` (แทนทั้งไฟล์)

```tsx
import { redirect } from 'next/navigation';
import { CampaignPage } from '@/components/campaigns/CampaignPage';

export default async function Page({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (brand !== 'bebeplay' && brand !== 'hosttail') redirect('/leads');
  // key: เปลี่ยนแบรนด์ = เข้าหน้าใหม่ (ถังโหลดใหม่ทุกครั้งที่เข้าหน้า เหมือน prototype)
  return <CampaignPage key={brand} brand={brand} />;
}
```

- [ ] **Step 4: ตรวจ + ดูด้วยตา**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ไม่มี error; `Tests  150 passed (150)`

เปิด `NEXT_PUBLIC_FIXTURES=1 npx next dev -p 3200 -H 127.0.0.1` → http://127.0.0.1:3200/campaigns/bebeplay เทียบกับ prototype (#campaign-bebeplay):
- การ์ด 4 ใบ: "ลูกค้าทั้งหมด" (badge "ตัวอย่าง", 59 ราย, "เข้าแคมเปญแล้ว 14 · ยังไม่เข้า 45"), "ลูกค้าทุกแคมเปญ" (2 แคมเปญ, 14 ราย, ติดต่อแล้ว 7/14, ปิดการขาย 3), "Bebeplay · ลูกค้าเก่า 6 เดือน" (กำลังดำเนินการ, 6/12), "Bebeplay · Double Date 10.10" (จบแล้ว, 1/2)
- ถัง: 50 แถว, "1–50 จาก 59", "ถัดไป →" ไปหน้า 2 (9 แถว), แถว "พิมพ์ชนก มั่นคง" ปุ่ม "จอง"; พิมพ์ `mom` ในช่องค้นหา → รอ ~0.3 วิ เหลือ 16 แถว; คลิกชื่อ → popup E
- คลิกการ์ดแคมเปญแรก → แถบ "ลีดในแคมเปญนี้ 12 รายการ · ที่ฉันดูแล 3 · ยังไม่มีผู้ดูแล 4 · วิธีจอง: เซลล์จองเอง" + ตารางลีดที่แถวว่างมีปุ่ม "จอง" + select "มอบหมายให้…"; ชิปสถานะกลับเป็น "ทั้งหมด"
- topbar: "จัดสรรให้เซลล์ที่ขายล่าสุด" → toast "ไม่มีลีดที่ต้องจัดสรร"; "+ สร้างแคมเปญ" → popup F
- หน้า `/leads` → "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" → "ถังลูกค้าทั้งหมด Bebeplay" → หน้านี้พร้อมโฟกัสที่ช่องค้นหาถัง

- [ ] **Step 5: Commit**

```bash
git add components/campaigns/CampaignCards.tsx components/campaigns/CampaignPage.tsx "app/(app)/campaigns/[brand]/page.tsx"
git commit -m "feat(web): add the campaign page with pool, all-campaign and campaign cards, quota line and campaign lead table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ลูกค้าของฉัน `/mine` และถังกลาง `/pool`

**Files:**
- Create: `components/campaigns/BasePage.tsx`
- Modify: `app/(app)/mine/page.tsx`, `app/(app)/pool/page.tsx`

- [ ] **Step 1: `components/campaigns/BasePage.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { PoolDetailModal } from '@/components/modals/PoolDetailModal';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getBaseCustomers } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import { PAGE, PATHS, type Brand } from '@/lib/constants';
import {
  baseAction, canNext, claimBrand, demoBase, dormantText, keepTotal, NO_BRAND_TEXT, pageRange, type BaseScopeKey, type RowAction,
} from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { BrandTags } from './BrandTags';
import { POOL_DEBOUNCE_MS } from './PoolPanel';
import { RowButton } from './RowButton';
import { useCustomerClaim } from './useCustomerClaim';

/** ตัวกรองของหน้า /mine, /pool (คงค่าระหว่างอยู่ในหน้าเดียวกัน) */
interface BaseFilter { brand: '' | Brand; q: string; page: number }

/**
 * ลูกค้าของฉัน (/mine) และถังกลาง (/pool) — หน้าใหม่ของเฟส 1 (spec ข้อ 3) ไม่มีใน prototype ใช้ markup ของถังลูกค้า (poolPanel L672-688)
 * - dsales_base_customers(scope) 50 แถว/หน้า, ค้นหา debounce 300 ms (เบอร์ +66/66/ขีด แปลงใน rpc.ts), เลือกแบรนด์
 * - คอลัมน์ที่สอง "ไม่ซื้อมา N วัน" + tag เจ้าของ (owner_tag)
 * - total ใช้จากหน้าที่มีแถว (หน้าเกินท้ายไม่มี total_count)
 * - ไม่มีการ์ดช่วงวันที่: RPC นี้ไม่กรองตามช่วงวันที่
 */
export function BasePage({ scope }: { scope: BaseScopeKey }) {
  const { live, customers, leads, meId, today, poolVersion } = useAppState();
  const { openModal, toast, handleAuthError } = useActions();
  const act = useLeadActions();
  const claimRow = useCustomerClaim();
  const [f, setF] = useState<BaseFilter>({ brand: '', q: '', page: 0 });
  const [qKey, setQKey] = useState('');
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(live);

  useEffect(() => {
    if (f.q === qKey) return;
    const t = setTimeout(() => {
      setF((x) => ({ ...x, page: 0 }));
      setQKey(f.q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [f.q, qKey]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoading(true);
    setData((d) => ({ ...d, err: '' }));
    getBaseCustomers(scope, { search: qKey, offset: f.page * PAGE, brand: f.brand || null })
      .then((rows) => {
        if (alive) setData((d) => ({ rows: rows.map((r) => mapPoolRow(r, meId)), total: keepTotal(rowsTotal(rows), rows.length, f.page, d.total), err: '' }));
      })
      .catch((e: unknown) => {
        if (alive && !handleAuthError(e)) setData((d) => ({ ...d, err: 'โหลดลูกค้าไม่สำเร็จ: ' + errorMessage(e) }));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [live, scope, qKey, f.page, f.brand, poolVersion, meId, handleAuthError]);

  const demo = useMemo(
    () => (live ? null : demoBase(customers, leads, scope, { brand: f.brand || null, q: qKey, page: f.page, today, meId })),
    [live, customers, leads, scope, f.brand, qKey, f.page, today, meId],
  );
  const rows = demo ? demo.rows : data.rows;
  const total = demo ? demo.total : data.total;
  const busy = !demo && loading;

  const claim = (r: PoolRow, a: RowAction, seq?: number) => {
    const brand = claimBrand(f.brand, r.brands);
    if (!brand) {
      toast(NO_BRAND_TEXT);
      return;
    }
    void claimRow(r, brand, seq, a.text === 'เริ่มติดตาม' ? 'เริ่มติดตามแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ' : undefined);
  };
  const openDetail = (r: PoolRow) => {
    const a = baseAction(r, { meId, leads });
    openModal(<PoolDetailModal row={r} footer={a.kind === 'disabled' ? null : a} onClaim={(seq) => claim(r, a, seq)} />);
  };

  return (
    <>
      <div className="toolbar">
        <label className="search" htmlFor="base-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="base-q" type="search" placeholder="ค้นหา เบอร์ / ชื่อแชต / ชื่อลูกค้า" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
        </label>
        <select id="base-brand" className="select" aria-label="แบรนด์" value={f.brand} onChange={(e) => setF((x) => ({ ...x, brand: e.target.value as BaseFilter['brand'], page: 0 }))}>
          <option value="">ทุกแบรนด์</option>
          <option value="bebeplay">Bebeplay</option>
          <option value="hosttail">Hosttail</option>
        </select>
        {busy ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ / เบอร์</th><th>ไม่ซื้อมา / tag</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const a = baseAction(r, { meId, leads });
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="cust-name" data-pool-open={r.id} onClick={() => openDetail(r)}>{r.name}</button>
                      <div className="sub mono">{r.phone}</div>
                      {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                    </td>
                    <td>
                      <div>{dormantText(r.dormantDays)}</div>
                      {r.ownerTag ? <span className="tag">{r.ownerTag}</span> : null}
                    </td>
                    <td>{r.segment ? <span className="tag">{r.segment}</span> : <span className="sub">—</span>}</td>
                    <td className="r num">{baht(Math.round(r.ltv))}</td>
                    <td className="r num">{r.orders}</td>
                    <td>{r.last ? fmtDate(r.last) : '—'}</td>
                    <td><BrandTags brands={r.brands} dash /></td>
                    <td><RowButton a={a} rowId={r.id} onClaim={() => claim(r, a)} onUnclaim={act.confirmUnclaim} /></td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} className="empty">{busy ? 'กำลังโหลด…' : 'ไม่พบลูกค้าที่ตรงกับคำค้น'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn sm" data-pool="prev" disabled={f.page === 0} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(f.page, rows.length, total)}</span>
        <button className="btn sm" data-pool="next" disabled={!canNext(f.page, rows.length, total)} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>ถัดไป →</button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: หน้า** — `app/(app)/mine/page.tsx` (แทนทั้งไฟล์)

```tsx
import { BasePage } from '@/components/campaigns/BasePage';

export default function MinePage() {
  return <BasePage scope="mine" />;
}
```

`app/(app)/pool/page.tsx` (แทนทั้งไฟล์)

```tsx
import { BasePage } from '@/components/campaigns/BasePage';

export default function PoolPage() {
  return <BasePage scope="pool" />;
}
```

(ชื่อหน้า "ลูกค้าของฉัน" / "ถังกลาง" มีใน `lib/routes.ts` จากแผน A แล้ว; `components/shell/Placeholder.tsx` ยังใช้กับ Dashboard/ตั้งค่า จนถึง C2)

- [ ] **Step 3: ตรวจ + ดูด้วยตา**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ไม่มี error; `Tests  150 passed (150)`

โหมด fixture (พอร์ต 3200): `/mine` 7 แถว (ลูกค้าที่ Dev MPD ดูแล ปุ่ม "ยกเลิกจอง"/"จองแล้ว"), `/pool` 50 แถว + "1–50 จาก 67" ปุ่ม "จอง" (โหมด fixture กด = toast "โหมด fixture: ไม่ได้บันทึกลง Supabase"), คอลัมน์ที่สอง "ไม่ซื้อมา N วัน", เลือกแบรนด์ Hosttail → เหลือเฉพาะ Hosttail

- [ ] **Step 4: Commit**

```bash
git add components/campaigns/BasePage.tsx "app/(app)/mine/page.tsx" "app/(app)/pool/page.tsx"
git commit -m "feat(web): add my customers and central pool pages on dsales_base_customers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: เทียบหน้าแคมเปญ/ถัง/popup E, F กับ prototype + ภาพของ `/mine` `/pool` (Playwright)

เทียบโหมด fixture (Next พอร์ต 3100) กับ prototype โหมดตัวอย่าง (พอร์ต 4100) ทั้งสองขนาดจอแบบเดียวกับแผน B: (1) ข้อความ/คลาส/สี/ความกว้าง bar/ปุ่ม/ตัวแบ่งหน้า ต้องเท่ากัน (`toEqual`) (2) element screenshot ของ `#view` (ปลดความสูงให้ยาวตามเนื้อหา), `.topbar`, `.modal` threshold 0.1 + `maxDiffPixels` ต่อภาพ — ไม่มีส่วนที่ตั้งใจต่างจาก prototype ในหน้าเหล่านี้ `/mine` `/pool` ไม่มีใน prototype จึงตรวจ DOM + ภาพของตัวเอง (baseline commit ใน `e2e/.legacy-shots/app/`)

**Files:**
- Modify: `e2e/visual-parity.spec.ts`, `.gitignore`
- Create: `e2e/.legacy-shots/app/mine-desktop.png`, `mine-mobile.png`, `pool-desktop.png`, `pool-mobile.png` (สร้างด้วย Playwright)

- [ ] **Step 1: ให้ git เก็บภาพของตัวเองได้** — `.gitignore` แก้

```
e2e/.legacy-shots/
```

เป็น

```
e2e/.legacy-shots/*
!e2e/.legacy-shots/app/
```

(ภาพของ prototype ยังไม่ถูก commit เหมือนเดิม — test ถ่ายใหม่ทุกครั้ง)

- [ ] **Step 2: ต่อท้าย `e2e/visual-parity.spec.ts`** (ใช้ helper เดิม `SIZES`, `LEGACY`, `APP`, `INJECT`, `MEASURE`, `settleWork`, `unclipView`, `shootLegacy`, `leadsText`, `modalState`, `press`, `Step`)

```ts

/* ---------- แผน C1: หน้าแคมเปญ, ถังลูกค้า, popup E (รายละเอียดลูกค้าในถัง), popup F (ตัวสร้างแคมเปญ), /mine, /pool ---------- */
// ความต่างที่ตั้งใจ: ไม่มี — โหมด fixture (live = false) ทำแบบโหมดตัวอย่างของ prototype ทั้งการ์ดถัง ("ตัวอย่าง" + เข้าแคมเปญแล้ว/ยังไม่เข้า),
// ช่องแคมเปญของแถวถัง, ปุ่มจอง/จองโดย/ยกเลิกจอง และ funnel ของตัวสร้างแคมเปญ (นับจากลูกค้าตัวอย่าง)
// maxDiffPixels ของภาพแผน C1 (วัดด้วย PARITY_MEASURE=1 ตาม Task 8 Step 5 แล้วแก้ค่าในตารางนี้)
// ค่าตั้งต้นจากการวัดตอนเขียนแผน (Chromium ของ Playwright 1.65, Windows) — Task 8 Step 5 วัดซ้ำ 3 รอบแล้วแก้เป็นค่าสูงสุด × 1.25 ปัดขึ้นหลัก 50
const MAX_DIFF_C1: Record<string, number> = {
  'campaign-view-desktop': 14400, 'campaign-view-mobile': 9400, 'campaign-topbar-desktop': 250, 'campaign-topbar-mobile': 150,
  'campaign-table-desktop': 8200, 'campaign-table-mobile': 4750,
  'pool-detail-desktop': 1650, 'pool-detail-mobile': 650, 'pool-detail-mine-desktop': 1800, 'pool-detail-mine-mobile': 750,
  'builder-base-desktop': 450, 'builder-base-mobile': 450, 'builder-set-desktop': 850, 'builder-set-mobile': 850,
  'builder-aud-desktop': 500, 'builder-aud-mobile': 500, 'builder-crit-desktop': 650, 'builder-crit-mobile': 650,
  'builder-preview-desktop': 1450, 'builder-preview-mobile': 850,
};
const shotC1 = (name: string) => ({ maxDiffPixels: MEASURE ? 0 : (MAX_DIFF_C1[name] ?? 0), threshold: 0.1 }) as const;

/** prototype โหมดตัวอย่างที่หน้าแคมเปญ (การ์ด "ลูกค้าทั้งหมด" ถูกเลือกเป็นค่าเริ่ม) รอถังแสดงครบหน้าแรก */
async function openLegacyCampaign(page: Page, brand: 'bebeplay' | 'hosttail', rows: number) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  await page.evaluate((b) => {
    location.hash = '#campaign-' + b;
  }, brand);
  await expect(page.locator('#pool-q')).toBeVisible();
  await expect(page.locator('#view tbody tr')).toHaveCount(rows);
  await settleWork(page);
}

async function openAppCampaign(page: Page, brand: 'bebeplay' | 'hosttail', rows: number) {
  await page.goto(`${APP}/campaigns/${brand}`);
  await expect(page.locator('#view tbody tr')).toHaveCount(rows, { timeout: 60_000 });
  if (INJECT) await page.addStyleTag({ content: INJECT });
  await settleWork(page);
}

/** ข้อความ/คลาส/สีของหน้าแคมเปญ: การ์ด (รวมความกว้าง bar), quota, ปุ่มท้ายแถวถัง, ตัวแบ่งหน้า + ส่วนเดียวกับหน้า /leads */
async function campaignText(page: Page) {
  const leads = await leadsText(page);
  const extra = await page.evaluate(() => {
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const view = document.querySelector('#view');
    const all = (sel: string) => Array.from(view?.querySelectorAll(sel) ?? []);
    return {
      cards: all('.camp-grid > *').map((c) => ({
        cls: cls(c), camp: c.getAttribute('data-camp'), text: t(c),
        bars: Array.from(c.querySelectorAll('.bar > i')).map((i) => (i as HTMLElement).style.width),
        badge: (() => {
          const b = c.querySelector('.badge');
          return b ? `${cls(b)}|${getComputedStyle(b).backgroundColor}` : null;
        })(),
      })),
      quota: t(view?.querySelector('.quota') ?? null),
      poolSearch: (view?.querySelector('#pool-q') as HTMLInputElement | null)?.placeholder ?? null,
      rowButtons: all('tbody tr > td:last-child > button').map((b) => `${cls(b)}|${t(b)}|${(b as HTMLButtonElement).disabled}`),
      pager: all('[data-pool]').map((b) => `${t(b)}|${(b as HTMLButtonElement).disabled}`).concat(all('.sub.num').map(t)),
      claimCells: all('tbody select[data-assign]').length,
    };
  });
  return { ...leads, ...extra };
}

/** เหมือน compareSteps แต่เปิดหน้าด้วยฟังก์ชันที่ส่งมา (หน้าแคมเปญ) */
async function compareStepsOn(page: Page, steps: Step[], openLegacy: (p: Page) => Promise<void>, openApp: (p: Page) => Promise<void>) {
  await openLegacy(page);
  const legacy: Awaited<ReturnType<typeof modalState>>[] = [];
  for (const st of steps) {
    await st.act(page);
    await settleWork(page);
    legacy.push(await modalState(page));
    await shootLegacy(page, st.name, '.modal');
  }
  await openApp(page);
  for (const [i, st] of steps.entries()) {
    await st.act(page);
    await settleWork(page);
    expect.soft(await modalState(page), st.name).toEqual(legacy[i]);
    await expect.soft(page.locator('.modal')).toHaveScreenshot(`${st.name}.png`, shotC1(st.name));
  }
}

const click = (selector: string, ready: string) => async (page: Page) => {
  await page.locator(selector).click();
  await expect(page.locator(ready).first()).toBeVisible();
};

for (const s of SIZES) {
  test.describe(`campaigns ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('campaign page with the customer pool matches the prototype (both pages)', async ({ page }) => {
      await openLegacyCampaign(page, 'bebeplay', 50);
      const legacy = await campaignText(page);
      expect(legacy.cards).toHaveLength(4);
      expect(legacy.rowButtons).toHaveLength(50);
      await shootLegacy(page, `campaign-topbar-${s.tag}`, '.topbar');
      await unclipView(page);
      await shootLegacy(page, `campaign-view-${s.tag}`, '#view');
      await page.locator('[data-pool=next]').click();
      await expect(page.locator('#view tbody tr')).toHaveCount(9);
      // หน้า 2: เทียบแถว/ปุ่ม/ตัวแบ่งหน้า (ความกว้างคอลัมน์ขึ้นกับความกว้างตัวอักษรของชื่อในหน้านั้น ต่างกันได้ ±0.1px ระหว่างฟอนต์ CDN กับ next/font)
      const page2 = async (p: Page) => {
        const x = await campaignText(p);
        return { rows: x.rows, rowButtons: x.rowButtons, pager: x.pager, cards: x.cards };
      };
      const legacyPage2 = await page2(page);
      await openAppCampaign(page, 'bebeplay', 50);
      expect(await campaignText(page)).toEqual(legacy);
      await expect.soft(page.locator('.topbar')).toHaveScreenshot(`campaign-topbar-${s.tag}.png`, shotC1(`campaign-topbar-${s.tag}`));
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`campaign-view-${s.tag}.png`, shotC1(`campaign-view-${s.tag}`));
      await page.locator('[data-pool=next]').click();
      await expect(page.locator('#view tbody tr')).toHaveCount(9);
      expect(await page2(page)).toEqual(legacyPage2);
    });

    test('campaign lead tables match the prototype (campaign, all campaigns, auto campaign)', async ({ page }) => {
      const views = async (p: Page) => {
        const out = [];
        await p.locator('[data-camp=c-bebe-nov]').click();
        await expect(p.locator('.quota')).toBeVisible();
        await settleWork(p);
        out.push(await campaignText(p));
        await p.locator('[data-camp=CAMPS]').click();
        await settleWork(p);
        out.push(await campaignText(p));
        return out;
      };
      await openLegacyCampaign(page, 'bebeplay', 50);
      const legacy = await views(page);
      await page.locator('[data-camp=c-bebe-nov]').click();
      await unclipView(page);
      await shootLegacy(page, `campaign-table-${s.tag}`, '#view');
      await openLegacyCampaign(page, 'hosttail', 29);
      await page.locator('[data-camp=c-host-nov]').click();
      await settleWork(page);
      const legacyAuto = await campaignText(page);
      expect(legacyAuto.quota).toContain('วิธีจอง: เด้งเข้าเซลล์ที่ขายล่าสุด');

      await openAppCampaign(page, 'bebeplay', 50);
      expect(await views(page)).toEqual(legacy);
      await page.locator('[data-camp=c-bebe-nov]').click();
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`campaign-table-${s.tag}.png`, shotC1(`campaign-table-${s.tag}`));
      await openAppCampaign(page, 'hosttail', 29);
      await page.locator('[data-camp=c-host-nov]').click();
      await settleWork(page);
      expect(await campaignText(page)).toEqual(legacyAuto);
    });

    test('pool customer popup matches the prototype (reserved by another rep, mine)', async ({ page }) => {
      await compareStepsOn(page, [
        { name: `pool-detail-${s.tag}`, act: press('[data-pool-open=C5018]', '.modal .info-grid') },
        { name: `pool-detail-mine-${s.tag}`, act: press('[data-pool-open=C5016]', '.modal [data-act=unclaim]') },
      ], (p) => openLegacyCampaign(p, 'bebeplay', 50), (p) => openAppCampaign(p, 'bebeplay', 50));
    });

    test('campaign builder matches the prototype (every tab, criterion, preview)', async ({ page }) => {
      await compareStepsOn(page, [
        { name: `builder-base-${s.tag}`, act: press('#new-camp', '#cf-name') },
        {
          name: `builder-set-${s.tag}`,
          act: async (p) => {
            await p.locator('#cf-name').fill('แคมเปญทดสอบ');
            await click('[data-ca=next]', '.radio-card')(p);
          },
        },
        { name: `builder-aud-${s.tag}`, act: click('[data-ca=next]', '#funnel') },
        {
          name: `builder-crit-${s.tag}`,
          act: async (p) => {
            await click('[data-ca=add]', '.crit-row')(p);
            await p.locator('[data-cf="0:kw"]').fill('เตียง');
          },
        },
        { name: `builder-preview-${s.tag}`, act: click('[data-ca=prev]', '#funnel .mini-table') },
      ], (p) => openLegacyCampaign(p, 'bebeplay', 50), (p) => openAppCampaign(p, 'bebeplay', 50));
    });

    // /mine และ /pool ไม่มีใน prototype: ตรวจ DOM + ภาพของตัวเอง (baseline commit ไว้ที่ e2e/.legacy-shots/app/ สร้างด้วย --update-snapshots=missing)
    test('my customers and the central pool render the base customer table', async ({ page }) => {
      for (const [path, rows, first] of [['mine', 7, 'ยกเลิกจอง'], ['pool', 50, 'จอง']] as const) {
        await page.goto(`${APP}/${path}`);
        await expect(page.locator('#view tbody tr')).toHaveCount(rows, { timeout: 60_000 });
        await expect(page.locator('#page-title')).toHaveText(path === 'mine' ? 'ลูกค้าของฉัน' : 'ถังกลาง');
        await expect(page.locator('#view thead th')).toHaveText(['ชื่อ / เบอร์', 'ไม่ซื้อมา / tag', 'กลุ่มลูกค้า', 'ยอดซื้อสะสม', 'ออเดอร์', 'ซื้อล่าสุด', 'แบรนด์', '']);
        await expect(page.locator('#view tbody tr').first().locator('td').nth(1)).toContainText(/^ไม่ซื้อมา [\d,]+ วัน/);
        await expect(page.locator('#view tbody tr').first().locator('td:last-child button')).toHaveText(first);
        await expect(page.locator('#base-brand option')).toHaveText(['ทุกแบรนด์', 'Bebeplay', 'Hosttail']);
        if (INJECT) await page.addStyleTag({ content: INJECT });
        await unclipView(page);
        await expect.soft(page.locator('#view')).toHaveScreenshot(['app', `${path}-${s.tag}.png`], { maxDiffPixels: 0, threshold: 0.1 });
      }
      await page.locator('#base-brand').selectOption('hosttail');
      await expect(page.locator('#view tbody tr td:nth-child(7)').first()).toHaveText('Hosttail');
      expect(new Set(await page.locator('#view tbody tr td:nth-child(7)').allInnerTexts())).toEqual(new Set(['Hosttail']));
    });
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: ไม่มี error; lint `✔ No ESLint warnings or errors`

- [ ] **Step 4: รันครั้งแรก + สร้างภาพของ `/mine` `/pool`** (ปิด `npm start` / dev server ที่เปิดค้างก่อน; ต่ออินเทอร์เน็ต; พอร์ต 3100 ว่าง)

Run: `npx playwright test -g "campaigns" --update-snapshots=missing`
Expected: `10 passed` และมีไฟล์ใหม่ 4 ไฟล์ใน `e2e/.legacy-shots/app/` (`mine-desktop.png`, `mine-mobile.png`, `pool-desktop.png`, `pool-mobile.png`) — เปิดดูทั้ง 4 ภาพด้วยตาว่าเป็นตารางลูกค้าที่ถูกต้องก่อน commit

ถ้าไม่ผ่าน:
- `toEqual` ของ `campaignText` / `modalState` ตก = markup/ข้อความ/สี/ปุ่ม/ค่าในช่อง/โฟกัสต่างจริง → แก้ component ให้ตรง `legacy/app.js` (ห้ามแก้ test ให้ยอมรับความต่าง)
- ภาพตก: `npx playwright show-report` ดู `-expected` / `-actual` / `-diff` — diff เป็นขอบตัวอักษรกระจายทั่วภาพ = anti-alias ของฟอนต์ ไป Step 5; เป็นก้อน/เส้น/ตำแหน่งเลื่อน = layout ต่าง → แก้ markup (ไม่แก้ `styles/prototype.css`)

- [ ] **Step 5: วัด `maxDiffPixels` จริง 3 รอบแล้วตั้งค่า**

Run 3 ครั้ง: `PARITY_MEASURE=1 npx playwright test -g "campaigns" 2>&1 | grep -E "pixels \(ratio|Snapshot:"`
Expected: ภาพที่เทียบกับ prototype ทุกภาพตก (ตั้ง 0) และพิมพ์ `N pixels (ratio …) are different.` ตามด้วย `Snapshot: <ชื่อ>.png` — ภาพของ `/mine` `/pool` (ตั้ง 0 อยู่แล้ว) ต้องผ่านทุกรอบ

แก้ `MAX_DIFF_C1` = ค่าสูงสุดจาก 3 รอบ × 1.25 ปัดขึ้นหลัก 50 และแก้คอมเมนต์เหนือตารางเป็นวันที่วัด ห้ามเกิน 2% ของพื้นที่ภาพ — ค่าที่วัดได้ตอนเขียนแผน (1 รอบ, desktop/mobile): campaign-view 11481/7512, campaign-topbar 161/105, campaign-table 6551/3776, pool-detail 1306/508, pool-detail-mine 1417/597, builder-base 353/353, builder-set 673/672, builder-aud 379/379, builder-crit 503/503, builder-preview 1140/680

Run: `npm run test:e2e`
Expected: `25 passed`

- [ ] **Step 6: Teeth check**

Run: `PARITY_INJECT_CSS='.camp-name { letter-spacing: .4px; }' npx playwright test -g "campaign page with"`
Expected: `2 failed` (ภาพ `campaign-view-…` ต่าง)

Run: `PARITY_INJECT_CSS='.modal-h h3 { letter-spacing: .4px; }' npx playwright test -g "pool customer popup|campaign builder"`
Expected: `4 failed`

Run: `PARITY_INJECT_CSS='.tag { letter-spacing: .4px; }' npx playwright test -g "my customers"`
Expected: `2 failed` (ภาพของตัวเองของ `/mine` `/pool` ก็จับความต่างได้)

Run: `npm run test:e2e`
Expected: `25 passed`

- [ ] **Step 7: Commit**

```bash
git add .gitignore e2e/visual-parity.spec.ts e2e/.legacy-shots/app/mine-desktop.png e2e/.legacy-shots/app/mine-mobile.png e2e/.legacy-shots/app/pool-desktop.png e2e/.legacy-shots/app/pool-mobile.png
git commit -m "test(web): compare campaign pages, the customer pool and popups E/F with the prototype and snapshot /mine and /pool" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: ตรวจรอบสุดท้ายของ C1 + อัปเดต `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (และไฟล์ที่ต้องแก้จากการตรวจ ถ้ามี)

- [ ] **Step 1: อัปเดต `CLAUDE.md`**

ในหัวข้อ `## Architecture` แก้

```md
  ui/                           # ChIcon, CloseButton, StatusBadge/DueTag
  leads/                        # PeriodCard, LeadToolbar, ContactBar, LeadTable, LeadsPage, useJst, useLeadActions, useVerifyMine
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal
```

เป็น

```md
  ui/                           # ChIcon, CloseButton, StatusBadge/DueTag
  leads/                        # PeriodCard, LeadToolbar, ContactBar, LeadTable, LeadsPage, useJst, useLeadActions, useVerifyMine
  campaigns/                    # CampaignPage, CampaignCards, PoolPanel, BasePage (/mine /pool), RowButton, BrandTags, useCustomerClaim
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal, PoolDetailModal (E), CampaignFormModal (F)
```

แก้

```md
  state/                        # reducer + AppProvider (context แยก state / actions / toast / modal) + session.ts, toast.ts
  domain/                       # period, leads, log (ฟังก์ชันล้วน มี test)
```

เป็น

```md
  state/                        # reducer + AppProvider (context แยก state / actions / toast / modal) + session.ts, toast.ts, busy.ts
  domain/                       # period, leads, log, campaigns, pool (ฟังก์ชันล้วน มี test)
```

ต่อท้ายย่อหน้า bullet ใต้ "ดึงข้อมูลฝั่ง client เป็นหลัก…" (หลังบรรทัด `useVerifyMine`):

```md
- ถังลูกค้า: ส่วนที่คงค่าข้ามหน้า (แบรนด์/คำค้น/หน้า/จำนวนรวม) อยู่ใน `state.pool` (`setPool`) แถวที่โหลดอยู่ใน `PoolPanel` / `BasePage` และโหลดใหม่เมื่อ mount / `poolVersion` / คำค้น (debounce 300 ms) / หน้า / ช่วงวันที่เปลี่ยน
- `rpc.ts` โยน `RpcError` (ข้อความไทย + `kind`): `toastError` / `handleAuthError` เปลี่ยนเป็นการ์ด "หมดเวลาการเข้าสู่ระบบ" (`auth`) หรือ "ถูกปิดใช้งาน" (`member`) เอง — โค้ดที่ catch error แล้วไม่ใช้ `toastError` ต้องเรียก `handleAuthError(e)` ก่อนแสดง error ในหน้า
- ปุ่มที่เรียก RPC เขียนข้อมูลกันกดซ้ำด้วย `once(key, fn)` ของ `useActions()`
```

ในหัวข้อ `## โหมด fixture` เพิ่มหลังบรรทัด `state.live = false …`:

```md
- `state.customers` = ลูกค้าตัวอย่างของ `legacy/data.js` (โหมด fixture เท่านั้น ล็อกอินจริงเป็น `[]` เหมือน prototype) ใช้กับถังลูกค้า (`demoPool`), การ์ดถัง, funnel ของตัวสร้างแคมเปญ และ `/mine` `/pool` (`demoBase`)
```

ในหัวข้อ `## Commands` แก้

```md
- e2e เทียบภาพกับ prototype ครอบคลุม `/leads` และ popup ลีดทั้งหมด (15 tests); ค่า limit วัดจริงด้วย `PARITY_MEASURE=1` (รัน 3 ครั้ง ×1.25) — ถ้าเกินให้วัดใหม่ ห้ามเพิ่ม limit เอง; สีตรวจด้วย computed-style
```

เป็น

```md
- e2e เทียบภาพกับ prototype ครอบคลุม `/leads`, หน้าแคมเปญ + ถังลูกค้า และ popup A–F (25 tests); ค่า limit วัดจริงด้วย `PARITY_MEASURE=1` (รัน 3 ครั้ง ×1.25) — ถ้าเกินให้วัดใหม่ ห้ามเพิ่ม limit เอง; สีตรวจด้วย computed-style
- `/mine` `/pool` ไม่มีใน prototype: เทียบกับภาพของตัวเองที่ commit ไว้ใน `e2e/.legacy-shots/app/` (ตั้งใจเปลี่ยนหน้าตา → `npx playwright test -g "<ชื่อ test>" --update-snapshots=changed` แล้วตรวจภาพด้วยตาก่อน commit)
```

ในหัวข้อ `## งานค้างสำหรับแผน C` ลบ bullet ที่เสร็จแล้วใน C1 (ประสิทธิภาพต่อแถว, session หมดอายุ, StrictMode, คลิกแท็บที่ active, หน้าแคมเปญใช้ `LeadTable`…, กันกดซ้ำ, LogModal สำเร็จบางขั้น, error จากเครือข่าย, `today`) ให้เหลือ

```md
## งานค้างสำหรับแผน C (ส่วน C2)

- `docs/DATABASE.md` และ `README.md` ยังอธิบายโครงสร้างเดิม (public/`index.html`/ลงทะเบียนอัตโนมัติ) ต้องอัปเดต
- Dashboard, ตั้งค่า (สมาชิก/tag JST/วิธีจอง), รอบมือถือ, deploy และย้าย `legacy/` — ดู `docs/superpowers/plans/2026-11-19-nextjs-plan-c2-dashboard-setup-deploy.md`
```

ในหัวข้อ `## เอกสาร` แก้บรรทัดแผนเป็น

```md
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A), `docs/superpowers/plans/2026-11-18-nextjs-plan-b-leads.md` (แผน B), `docs/superpowers/plans/2026-11-19-nextjs-plan-c1-campaigns-pool.md` / `2026-11-19-nextjs-plan-c2-dashboard-setup-deploy.md` (แผน C)
```

- [ ] **Step 2: ตรวจอัตโนมัติตามลำดับ** (ปิด `npm start` / dev server ก่อน)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:fixtures
npm run test:e2e
npm run build
npm run check:fixtures
```

Expected:
- `typecheck`: ไม่มี output · `lint`: `✔ No ESLint warnings or errors`
- `test`: `Test Files  22 passed (22)` · `Tests  150 passed (150)`
- `build`: สำเร็จ ตาราง Route มี `ƒ /campaigns/[brand]`, `○ /mine`, `○ /pool`, `○ /leads`, `ƒ Middleware`
- `check:fixtures`: `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server` (ยืนยันว่า `customers` ของ fixture ไม่ติดไปกับ production)
- `test:e2e`: `25 passed`
- `build` ครั้งที่สอง + `check:fixtures`: สำเร็จ / `ok: …`

- [ ] **Step 3: Checklist ให้ผู้ใช้ทดสอบด้วยบัญชีจริง** — `.env.local` ครบและ `NEXT_PUBLIC_FIXTURES=0`; `npm run build && npm start` แล้วเปิด http://localhost:3000

> **คำเตือน:** ข้อ 5–8 **เขียนข้อมูลจริงลง Supabase production** ใช้เฉพาะลูกค้าทดสอบที่ตกลงกับหัวหน้าไว้แล้ว จดชื่อ/เบอร์ที่ใช้ และยกเลิกจองคืนหลังทดสอบ — ข้อ 7 (สร้างแคมเปญ) สร้างแถวจริงใน `dsales_campaigns` ที่ทีมเห็น ตั้งชื่อ "ทดสอบระบบ — ลบได้" และปิดใช้งานหลังทดสอบ (ยังไม่มีปุ่มลบในเว็บ)

1. เมนูแคมเปญ Bebeplay → การ์ด "ลูกค้าทั้งหมด" badge "ข้อมูลจริง" ตัวเลขรวมขึ้นภายในไม่กี่วินาที (Network: `dsales_customer_pool_v3` ครั้งเดียว — ไป Hosttail แล้วกลับมาไม่เรียกซ้ำ) บรรทัด "ทั้งที่เข้าและยังไม่เข้าแคมเปญ"; ถัง 50 แถว "1–50 จาก N" (Network: `dsales_customer_pool_v4` `p_limit: 50`)
2. ค้นหาถังด้วยเบอร์/เลขบิล/ชื่อแชต → Network ยิง v4 ครั้งเดียวหลังหยุดพิมพ์ ~0.3 วิ แสดง "กำลังโหลด…" ระหว่างรอ; "ถัดไป →" / "← ก่อนหน้า" ใช้ได้; ตั้งช่วงวันที่ "เดือนนี้" → v4 มี `p_from`/`p_to` และกลับหน้าแรก
3. คลิกชื่อลูกค้าในถัง → popup E: "กำลังโหลดประวัติการซื้อ…" แล้วขึ้นตาราง (Network: `dsales_customer_purchases` + `dsales_customer_channels`), ช่องทางแชต LINE ก่อน, "คัดลอก" → toast "คัดลอกเบอร์แล้ว"
4. คลิกการ์ดแคมเปญ (ถ้ามี) → แถบ quota + ตารางลีด; หัวหน้าเห็น select "มอบหมายให้…" ในแถวที่ยังไม่มีผู้ดูแล; การ์ด "ลูกค้าทุกแคมเปญ" แถบ quota "วิธีจอง: ตามที่ตั้งไว้ในแต่ละแคมเปญ"
5. (เขียนข้อมูลจริง) ถัง → "จอง" ลูกค้าทดสอบ → toast "จองแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ", ถังโหลดใหม่ แถวนั้นเป็น "ยกเลิกจอง", ถ้ารันตัวช่วย JST อยู่ JST เปิดแชตเอง (ไม่มี toast); ดับเบิลคลิก "จอง" เร็ว ๆ → Network มี `dsales_claim_customer` ครั้งเดียว
6. (เขียนข้อมูลจริง) แถวเดิม → "ยกเลิกจอง" → popup "ยกเลิกจอง?" → ยืนยัน → toast "ยกเลิกจองแล้ว" แถวกลับเป็น "จอง"
7. (เขียนข้อมูลจริง หัวหน้า) "+ สร้างแคมเปญ" → แท็บ ข้อมูลพื้นฐาน ("ถัดไป →" ปิดจนพิมพ์ชื่อ) → การตั้งค่า → กลุ่มลูกค้า (funnel "ลูกค้าทั้งหมด · Bebeplay 0 คน" — พฤติกรรมเดิมของ prototype ดูคำถามข้อ 2) → "สร้างแคมเปญ" → toast "สร้างแคมเปญแล้ว · เลือกลูกค้าเข้าแคมเปญจากถัง "ลูกค้าทั้งหมด" ด้วยปุ่ม จอง" การ์ดใหม่ถูกเลือก topbar "N แคมเปญ" เพิ่ม 1 → หลังทดสอบ ปิดใช้งานแคมเปญนี้ (C2 หน้าตั้งค่ายังไม่มีปุ่มปิด — แจ้งผู้ดูแล DB หรือเก็บไว้)
8. (เขียนข้อมูลจริง) `/mine` เห็นลูกค้าของฉัน (ลีดที่ดูแล + ลูกค้าตาม tag) คอลัมน์ "ไม่ซื้อมา N วัน" + tag; ลูกค้าตาม tag ที่ยังไม่มีลีด → "เริ่มติดตาม" → toast "เริ่มติดตามแล้ว…" แถวกลายเป็น "ยกเลิกจอง"; `/pool` ค้นหา `+66 81-234-5678` → Network `p_search: "0812345678"`; เลือก "ทุกแบรนด์" แล้วจองลูกค้าที่ไม่มีแบรนด์ bebeplay/hosttail → toast "เลือกแบรนด์ที่ช่องด้านบนก่อนจอง"
9. session หมดอายุ: DevTools → Application → Cookies ลบ cookie `sb-…-auth-token` แล้วกดจองหรือค้นหาถัง → การ์ด "หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่" + ปุ่ม "เข้าสู่ระบบใหม่" → `/login`
10. เครือข่ายล้มระหว่างใช้งาน: Network → Offline แล้วค้นหาถัง → "โหลดลูกค้าไม่สำเร็จ: เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"; กดบันทึกใน popup → toast ข้อความเดียวกัน
11. เปิดค้างข้ามเที่ยงคืน (หรือเปลี่ยนเวลาเครื่องไปวันถัดไปแล้วกลับมาที่แท็บ) → ชิป "นัดวันนี้"/"เลยนัด" และป้ายวันนัดในตารางเปลี่ยนตามวันใหม่ภายใน 1 นาที

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record plan C1 structure, pool state, RpcError handling and remaining C2 work in CLAUDE.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

ถ้า Step 2–3 ต้องแก้โค้ด ให้ commit แยก:

```bash
git add -A
git commit -m "fix(web): address final verification findings for campaign and pool pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## คำถามที่ยังเปิด (ถามผู้ใช้ก่อน/ระหว่างทำ)

1. **ปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" และโหมด `auto`:** ตอนล็อกอินจริงไม่มีข้อมูลผู้ขายล่าสุดผูกกับเซลล์ ปุ่มจึงขึ้น "ไม่มีลีดที่ต้องจัดสรร" เสมอ และวิธีจอง `auto` ถูกอ่านเป็น `self` — แผนนี้คงไว้ตาม prototype/spec **ข้อเสนอ:** หลังผู้ใช้ตรวจ production แล้วซ่อนปุ่มนี้และตัดตัวเลือก "เด้งเข้าเซลล์ที่ขายล่าสุด" จนกว่าจะมีการผูกผู้ขายกับเซลล์ (ต้องอัปเดตภาพ e2e ของ topbar หน้าแคมเปญ)
2. **funnel ของตัวสร้างแคมเปญเป็น 0 ตอนล็อกอินจริง:** ทำให้นับจริงต้องมี RPC ใหม่ใน `dsales` (กรองลูกค้าตามเงื่อนไข `CRIT` จากประวัติซื้อ + เรียก `dsales_uid()`) **ข้อเสนอ:** เลื่อนไปเฟส 2 พร้อมการสร้างลีดจากเงื่อนไข (ตอนนี้แคมเปญได้ลูกค้าจากการกด "จอง" ในถังเท่านั้น ตามข้อความ toast)
3. **หน้า `/mine` `/pool` ไม่มีการ์ดช่วงวันที่:** ถ้าต้องการกรองตามวันซื้อล่าสุด ต้องเพิ่มพารามิเตอร์ให้ `dsales_base_customers` (งาน DB) — ตอนนี้ไม่ทำ
4. **หัวคอลัมน์ "ไม่ซื้อมา / tag" และข้อความ "เริ่มติดตามแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ"** เป็นข้อความใหม่ (ไม่มีใน prototype) — ยืนยันถ้อยคำกับผู้ใช้

## สิ่งที่ C1 ยังไม่ทำ (อยู่ใน C2)

- Dashboard `/dashboard` (KPI, เปรียบเทียบแยกแบรนด์, ตารางค่าคอม + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด)
- ตั้งค่า `/setup` (ทีมจาก DB + เพิ่มด้วยอีเมล + ปิด/เปิดใช้งาน, การ์ดผูก tag JST, วิธีจองของแคมเปญ) และคำถาม `.brand-sub`
- รอบมือถือของทุกหน้า, e2e ของ Dashboard/ตั้งค่า, `README.md` / `docs/DATABASE.md` / `CLAUDE.md`
- deploy (Framework Preset, push ด้วยการยืนยันของผู้ใช้, checklist production) และย้าย `legacy/` ไป `e2e/legacy-reference/`
