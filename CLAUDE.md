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
- **กฎความปลอดภัยสำหรับงานต่อไป:** RPC ใหม่ทุกตัวที่คืนข้อมูลลูกค้าต้องเรียก `dsales.dsales_uid()` (ประตูสมาชิกเท่านั้น; RPC ของ worker ใช้ `dsales.dsales_worker_uid()`) และ **ห้าม grant สิทธิ์ตารางภายใน** (`dsales_customer_base`, `dsales_chat_links`, `dsales_settings`, `dsales_templates`, `dsales_outreach_batches`, `dsales_outreach_queue`, `dsales_worker_status`, `dsales_worker_state`) ให้ `authenticated`/`anon` เด็ดขาด
- Migration เพิ่มเติมที่มีอยู่แล้ว (นอกเหนือจาก `dsales_members_only`):
  - `20261117100100_dsales_access_hardening.sql` — RLS ต้องเป็นสมาชิก active ผ่าน `dsales.dsales_is_member()`, ห้ามเขียน `dsales_members` ตรง ๆ (ต้องผ่าน RPC), RPC จัดการสมาชิกใช้ advisory lock
  - `20261117100200_dsales_revoke_truncate.sql` — ถอน TRUNCATE/TRIGGER/REFERENCES จาก `authenticated`/`anon`
  - test คู่กัน: `supabase/tests/06_members_only.sql`, `supabase/tests/06b_access_hardening.sql`
  - `20261119120000_dsales_diff_refresh.sql` (มาจาก PR #3 บน `main`) — refresh เขียนเฉพาะแถวที่เปลี่ยน + cron เปลี่ยนเป็นวันละ 3 รอบ
  - `20261119130000_dsales_set_member_tags_fast.sql` — `dsales_set_member_tags` / `dsales_set_member_active` ไม่เรียก `dsales_refresh_customer_base()` แล้ว (หนัก เกิน `statement_timeout` 8 วินาทีของ `authenticated`) แต่อัปเดต `dsales_customer_base.owner_id` ในที่เดิมจาก `owner_tag` (~0.04 วินาที) บันทึก tag/ปิด-เปิดสมาชิกมีผลกับความเป็นเจ้าของทันที ส่วนการเปลี่ยน tag ฝั่ง JST ของลูกค้ายังรอ cron รอบถัดไป; test คู่กัน: `supabase/tests/07_member_tags_fast.sql`
  - `20261120100000`–`20261120100600` (`dsales_outreach_tables`, `dsales_templates`, `dsales_outreach_room`, `dsales_outreach_enqueue`, `dsales_outreach_batches`, `dsales_worker_rpcs`, `dsales_worker_settings`) — คิวส่งข้อความเป็นชุดผ่าน JST worker: ตาราง `dsales_templates` / `dsales_outreach_batches` / `dsales_outreach_queue` / `dsales_worker_status` (ภายใน ไม่มี grant), RPC ของเว็บ (template, preview/enqueue, ความคืบหน้า/ยกเลิก, สถานะ/ตั้งค่า worker, `dsales_worker_find_rooms` ค้นห้องทดสอบ — หัวหน้าเท่านั้น) และของ worker (`dsales_worker_claim` / `_report` / `_heartbeat` ตรวจ `worker_user_ids` ผ่าน `dsales_worker_uid()`); **โหมดทดสอบเปิดเป็นค่าเริ่ม และ = ส่งไปห้องทดสอบแทน** (claim คืน `target_ms_id` = ห้องแรกใน `outreach_test_ms_ids` + ข้อความขึ้นต้น `[ทดสอบ → …]`, รายงาน sent ไม่เขียน interaction/ไม่เปลี่ยนสถานะลีด, ไม่มีห้องทดสอบ = claim คืน null) worker ต้องส่งไปที่ `target_ms_id` เสมอ; test คู่กัน `supabase/tests/08_*`–`08g_*`; สัญญา DB/worker/เว็บ `docs/superpowers/plans/2026-11-20-outreach-contract.md`
  - `20261120150000_dsales_buyer_id_room_links.sql` — ผูกห้องแชตด้วยรหัสผู้ซื้อ (`order_tracking.buyer_account_no` = `outer_user_id` ของห้อง JST): worker ค้น JST ตอนไม่มีงานส่ง (`dsales_worker_link_targets` / `_link_save`), ตาราง `dsales_jst_rooms` / `dsales_buyer_lookups` (ภายใน ไม่มี grant), view `dsales_rooms_v` (= `iim_sessions` + ห้องที่มีเฉพาะใน JST) ที่ฟังก์ชันเลือกห้องทุกตัวอ่าน; test `supabase/tests/10_buyer_id_room_links.sql` (รายละเอียด `docs/DATABASE.md`); ตามด้วย `20261123060000_dsales_sendable_rooms_fast.sql` / `20261123063000_dsales_room_lookup_fast.sql` (ฟังก์ชันรายเบอร์อ่านห้องผ่าน `dsales_room_of(ms_id)` ที่ inline ได้ — **ห้าม join `dsales_rooms_v` รายเบอร์ตรง ๆ** planner จะ hash ทั้ง view ช้าเป็นสิบวินาที)
  - `20261123080000_dsales_customer_rooms_name.sql` / `20261123090000_dsales_rooms_for_phones.sql` — `dsales_customer_rooms` คืนชื่อของแต่ละห้อง (`name`) และ RPC `dsales_rooms_for_phones(p_phones)` ห้องของหลายเบอร์สำหรับหน้า Direct Sale (เซลล์ = ลีดของตัวเอง, หัวหน้า = ทุกเบอร์, ≤ 100 เบอร์/ครั้ง); test `11_customer_rooms_name.sql`, `12_rooms_for_phones.sql`
  - `20261123130000_dsales_ds_auto_release.sql` — ลีดใน Direct Sale ครบ `ds_max_days` (30) วันยังไม่ won → คืนอัตโนมัติ (`dsales_release_stale_leads()` รันต้น job `dsales-refresh-customer-base`, แก้ command ใน production 2026-11-24) · `ds_since`/`ds_owner` ตั้งโดย trigger `dsales_leads_ds_since` (ครอบทุก RPC ที่ตั้งเจ้าของ) · เซลล์ที่ถูกคืนจองลีดนั้นเองไม่ได้ 30 วัน (`release_cooldown`), ยกเลิกจองแล้วจองใหม่ไม่เริ่มนับใหม่, หัวหน้าไม่ติด · บันทึกประวัติเป็น interaction `type = 'system'` · `dsales_lead_json.dsSince` (เฉพาะลีดที่มีเจ้าของ); test `16_ds_auto_release.sql`
  - `20261124090000_dsales_admin_send_on_behalf.sql` — หัวหน้าส่งข้อความแทนเจ้าของลีดได้ (`dsales_outreach_plan`: หัวหน้า + ลีดมีเจ้าของ → ไม่ taken, enqueue ไม่จองแทน ลีดคงเป็นของเจ้าของเดิม) · ลูกค้าที่เป็นของเซลล์อื่นตาม tag แต่ไม่มีลีด ยัง taken · หน้า Direct Sale หัวหน้าติ๊กลีดที่มีเจ้าของได้ทุกแถว; test `18_admin_send_on_behalf.sql`
  - `20261125090000_dsales_campaign_segments.sql` — แคมเปญใช้ได้จริง: `dsales_product_search(p_q)` ค้น SKU + ชื่อ + จำนวนผู้ซื้อจาก `public.lendi_purchase_lines` (ครอบคลุมเฉพาะลูกค้าที่มีประวัติซื้อในตารางนี้ ~7.5k จาก ~18.9k) · `dsales_base_customers` รับตัวกรองเพิ่ม `products` (กลุ่ม `{skus|kw}` ทุกกลุ่มต้องเจอ), `bought_from/to`, `bill_min`, `ltv_to` (เว็บแปลง criteria → ตัวกรองเองใน `criteriaFilters` — DB ไม่อ่าน criteria) · `dsales_claim_customer(p_phone, p_brand, p_campaign default null)` จองจากการ์ดแคมเปญ = ลีดผูกแคมเปญ (`campaign_closed`, `campaign_quota` ตาม `max_per_rep`) · เลือกสินค้าแล้วไม่กรองแบรนด์ซ้ำ (`audienceBrand`); test `19_campaign_segments.sql`
  - `20261125120000_dsales_exclude_cs_b2b.sql` — **ไม่ดึงลูกค้าเคสบริการ/เคลม และ B2B เป็นลีด:** `dsales_excluded_customers(p_phone default null)` (ภายใน) = เบอร์ที่ห้องแชตผูกไว้มี tag ใน setting `excluded_room_tags` (มาจากเซ็นทรัล, มาจาก OFFLINE, แจ้งปัญหา, Customer Service) หรือขึ้นต้นด้วย `excluded_room_tag_prefixes` (`CS_`) + `customer_base.segment = 'b2b'` · ตัดออกจาก `dsales_base_customers` / `dsales_customer_pool_v3/v4`, จองไม่ได้ (`dsales_claim_customer` / `dsales_claim_lead` → `cs_customer`), ส่งข้อความเป็นชุดข้าม (`cs_customer`) · `dsales_release_excluded_leads()` (ภายใน) คืนลีดที่ไม่ใช่ won + ตั้ง no_call + บันทึก system + ยกเลิกคิวที่รอส่ง — รันตอน migration (คืน 16 ลีด 2026-11-25) และทุกรอบ cron ผ่าน `dsales_release_stale_leads()` · test ที่หยิบเบอร์จากถัง (08d, 09, 18, 19) ต้องข้ามเบอร์เหล่านี้ด้วย; test `20_exclude_cs_b2b.sql`
  - `20261125130000_dsales_ai_status.sql` — **ปุ่ม "วิเคราะห์สถานะ (AI)"** (หัวหน้า, ล็อกอินจริงเท่านั้น): `POST /api/ai/lead-status` (`app/api/ai/lead-status/route.ts`, NDJSON) อ่าน `dsales_ai_status_context(p_leads)` (≤ 50 ลีดที่มีเจ้าของและยังไม่ won: แชต 40 ข้อความล่าสุด, บันทึก 10 รายการ, ประวัติซื้อ, บิลใหม่หลังจอง) → ข้ามลีดที่ไม่มีข้อมูล/ไม่มีอะไรใหม่ (`planAnalysis`) → Claude Haiku 5.5 (`claude-haiku-5-5`, effort low, structured output, ปิดเลขยาวด้วย `maskDigits`) พร้อมกัน 5 → `dsales_ai_status_apply` เปลี่ยนสถานะเฉพาะความมั่นใจ ≥ `ai_min_confidence` (0.7), ห้าม won/new, ข้ามลีดที่มีคนบันทึกระหว่างวิเคราะห์ · บันทึก interaction `type = 'ai'` + `dsales_leads.ai` (ป้าย `AiTag` ในตาราง, ประวัติในป๊อปอัปลูกค้า) · `dsales_ai_status_undo` ย้อนกลับ · `dsales_ai_runs` + `ai_daily_limit` (300 ลีด/วัน) · prompt/กฎอยู่ใน `lib/domain/aiStatus.ts` · ต้องมี `ANTHROPIC_API_KEY` ฝั่ง server (`.env.local` / Vercel env — ห้าม `NEXT_PUBLIC_`); test `21_ai_status.sql`
  - `20261125140000_dsales_rfm_segments.sql` — **กลุ่มลูกค้า RFM แบบระบบเก่า** (หน้าลูกค้าของฉัน/ถังกลาง): `dsales_rfm(orders, days)` + คอลัมน์ generated `dsales_customer_base.rfm` (อัปเดตเองเมื่อ refresh เขียน order_count/dormant_days) · ลำดับกติกา: Champion (≥6 ครั้ง ≤30 วัน) → Shouldn't Lose (≥6, >90) → Loyal (≥4, ≤90) → Sleepers (≥3, >90) → Promising (2–3, ≤60) → Need Attention (2–3, 61–90) → Warm (1 ครั้ง ≤60 — รวม Hot เดิม) → Cold (1 ครั้ง 61–90) → Lost · `dsales_base_customers` กรอง/คืน `rfm_segment` จาก `b.rfm` · `dsales_base_segment_counts(p_scope, p_brand)` จำนวนบนชิป · กติกาฝั่งเว็บ `lib/domain/rfm.ts` (ต้องตรงกับ SQL); test `22_rfm_segments.sql`
  - `20261125150000_dsales_admin_view_as.sql` — **หัวหน้า "ดูในมุมมองเซลล์" + ทำแทน** (เลือกในเมนูซ้าย `ViewAsSwitch`, state `viewAs` จำใน localStorage `dsales.viewAs`, แถบ `ViewAsBar` ทุกหน้า, `useActor()` = actorId/forUser): `dsales_actor(p_for)` ตรวจสิทธิ์ · `dsales_base_customers` p_filters.as · `dsales_base_segment_counts(..., p_as)` · `dsales_claim_customer(..., p_for)` · `dsales_outreach_preview` / `dsales_enqueue_outreach` (..., p_for) = ส่งในนามเซลล์ (requested_by = หัวหน้า) · `dsales_log` บันทึกบนลีดของเซลล์อื่น → `rep_id` = เจ้าของลีด, `interactions.logged_by` = หัวหน้า, ปิดการขาย `last_seller_id` = เจ้าของลีด (ผู้ใช้เลือกให้นับผลงานให้เซลล์) · หัวหน้ายกเลิกจองลีดที่มีเจ้าของได้ทุกแถว (`canUnclaimAs`); test `23_admin_view_as.sql`
  - `20261125160000_dsales_auto_close_orders.sql` — **ปิดการขายอัตโนมัติเมื่อพบบิล/ออเดอร์หลังวันที่จอง** (เคส Nantaporn Chaiphet: บิลอยู่ใน `sales_transaction` แต่ `lendi_purchase_lines` ยังไม่ซิงก์): `dsales_close_won_from_orders(p_leads default null)` (ภายใน) บิล = `sales_transaction` ที่ bill_no ตรงกับ `order_tracking.online_order` ของเบอร์ลีด + `lendi_purchase_lines` ที่ไม่ซ้ำ · ยอดแถว = amount หรือ unit_price × quantity (amount ว่าง ~26%) · วันที่บิล ≥ วันที่จอง (เวลาไทย), ไม่ Cancelled ทั้งบิล, ยอด > 0 → won + closed_bills/amount/at + `last_seller_id` = เจ้าของ + interaction system · `dsales_ai_close_orders(p_leads)` หัวหน้า ≤ 50 เรียกจาก `/api/ai/lead-status` ก่อนส่ง AI (บรรทัด start มี `closed`, แสดงบนสุดใน `AiStatusModal`) · cron job 51 เรียกก่อน `dsales_release_stale_leads` (3 ครั้ง/วัน); test `24_auto_close_orders.sql`
  - `20261126100000_dsales_chat_page_brands.sql` — **แบรนด์ของลูกค้ามาจากเพจของห้องแชตด้วย:** `dsales_customer_base.brands` = `identity_brands` (CDP, หยุดอัปเดต 2026-06-21) รวมกับแบรนด์ของเพจ (`page_brand_map`) ของทุกห้องที่ผูกกับเบอร์ (นับห้องหมดอายุด้วย) คำนวณใน `dsales_refresh_customer_base()` แบบ join ทั้งชุดครั้งเดียว · มีผลกับคอลัมน์แบรนด์ ตัวกรองแบรนด์ และแบรนด์ตอนจองใน `/mine` `/pool` · ถังหน้าแคมเปญ (`dsales_customer_pool_v3/v4`) ยังอ่าน `identity_brands` ตรง ๆ; test `25_chat_page_brands.sql` (เรียก refresh 1 ครั้ง — หนักเหมือน 04/04b)
  - `20261126120000_dsales_worker_tick.sql` — **worker ตัวสำรองบน Vercel (`office-1` เป็นตัวหลักตามที่ผู้ใช้เลือก 2026-11-26)** (spec `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`): cron `dsales-outreach-tick` ทุกนาที → `dsales_tick_kick()` → `POST /api/cron/outreach-tick` (`app/api/cron/outreach-tick/route.ts` เป็น wrapper บาง ๆ → `lib/cron/tick-handler.ts` → `tools/jst-worker/tick.mjs`) · ทำงานเมื่อ `worker_tick_enabled = true` และ Vault มี `dsales_app_url` + `dsales_cron_secret` · สถานะข้ามรอบ: ตาราง `dsales_worker_state` (ภายใน ไม่มี grant) + cookie JST ใน Vault `dsales_jst_session_<worker>` ผ่าน `dsales_worker_state_begin` / `_state_end` / `_session_put` (worker เท่านั้น; lease เริ่มต้น 90 วินาที ขั้นต่ำ 70 ต้องยาวกว่า `maxDuration` 60 วินาทีของ route) · `_session_put` และ `dsales_worker_state_reset` ตอบ `worker_busy` ขณะรอบหนึ่งถือ lease, `_session_put` จาก `needs_login` ล้าง `failures` / `loginTimes` ด้วย, `_session_write` ปฏิเสธ cookie ว่าง/เกิน 64 KB (`invalid_cookies`), `_state_end` ปฏิเสธ runtime เกิน 64 KB (`invalid_runtime`) · `worker_primary`: ตัวที่ไม่ใช่ตัวหลักได้ `claim` = null และ `link_targets` ว่าง ตราบที่ตัวหลัก `running` + heartbeat < 3 นาที (`dsales_worker_is_standby`) · หัวหน้า: `dsales_worker_primary_set` / `dsales_worker_state_reset` (ปุ่มบนการ์ด Worker); test `28_worker_primary_standby.sql`, `29_worker_state.sql`, `30_tick_kick.sql`
  - **หมายเหตุสำหรับ dev:** ตราบที่ `worker_primary` ชี้ worker ที่ยังมีชีวิต (ค่าเริ่ม `office-1`) worker id อื่น เช่น laptop ที่รัน `node worker.mjs` จะ **ไม่ได้งานและไม่ได้รหัสให้ค้นโดยไม่มี error** — จะทดสอบในเครื่องให้ตั้ง `worker_primary` เป็น `""` หรือ id ของตัวเอง แล้วคืนค่าเดิมหลังทดสอบ · SQL test ที่ใช้ worker id อื่น (08f, 10, 28) ล้าง `worker_primary` ในขั้นตอนเตรียมเอง
  - `20261126140000_dsales_lead_json_rfm.sql` — **หน้า Direct Sale แสดงกลุ่มลูกค้า RFM + "ไม่ซื้อมา N วัน" เหมือนหน้าลูกค้าของฉัน:** `dsales_lead_json` คืนเพิ่ม `rfm` / `dormantDays` จาก `dsales_customer_base` ของเบอร์เดียวกับลีด (ค่าเดียวกับ `dsales_base_customers`; เบอร์ไม่อยู่ในฐาน = null) — ไม่คำนวณจาก `lastBuy`/`orders` ของลีดเพราะนับจาก `lendi_purchase_lines` ซึ่งไม่ตรงกับฐานลูกค้า (ตรวจ 2026-11-26: กลุ่มต่างกัน 27 จาก 120 ลีด) · เว็บ: คอลัมน์ "กลุ่มลูกค้า" ใน `LeadTable` (`opts.rfm`, เฉพาะ `/leads`; class `.rfm-col` ไม่เทียบกับ prototype ใน e2e) ผ่าน `leadRfm` ใน `lib/domain/leads.ts` (โหมด fixture คำนวณจากประวัติซื้อ) · แสดงผลอย่างเดียว ไม่มีตัวกรอง/เรียงตามกลุ่ม; test `31_lead_json_rfm.sql`
  - `20261123140000_dsales_reset_trial_data.sql` — **ช่วงทดลองใช้เท่านั้น:** `select dsales.dsales_reset_trial_data('RESET DSALES TRIAL');` ลบถาวร ลีด/ประวัติ/แคมเปญ/ชุดส่ง+คิว/ประวัติคืนลีด เก็บสมาชิก ตั้งค่า template ฐานลูกค้า ห้องแชต · เรียกจาก SQL เท่านั้น (ไม่ grant ให้เว็บ) · รันจริงต้องถามผู้ใช้ก่อนทุกครั้ง · เริ่มใช้จริงแล้วให้ drop function นี้; test `17_reset_trial_data.sql`
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
ANTHROPIC_API_KEY=                                 # ฝั่ง server เท่านั้น: ปุ่มวิเคราะห์สถานะ (AI)
# ฝั่ง server เท่านั้น (Vercel Production) — worker บน Vercel: route /api/cron/outreach-tick
JST_USER=
JST_PASSWORD=
DSALES_WORKER_EMAIL=
DSALES_WORKER_PASSWORD=
CRON_SECRET=                                       # ต้องตรงกับ Vault secret dsales_cron_secret · ค่าสุ่มยาว ≥ 32 ตัวอักษร
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
- Worker บน Vercel + ตัวสำรอง: spec `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`, แผน `docs/superpowers/plans/2026-11-26-cloud-tick-worker.md`
- JST worker บนเครื่อง office: `tools/jst-worker/README.md` — รันถาวรด้วย `install-task.ps1` (task เปิด `run-worker.cmd` ตอนล็อกอิน + ตรวจทุก 15 นาที, สคริปต์เปิดใหม่เมื่อ worker ออก, watchdog 10 นาที)

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

- แคมเปญ: funnel/แผง "ลูกค้าตามเงื่อนไข" ใช้ฐานลูกค้าจริงแล้ว (20261125090000) แต่การส่งข้อความเป็นชุด (enqueue) ยังจองแบบ self ไม่ผูกแคมเปญ และโหมด fixture ยังแสดงตารางลีดแบบ prototype (ไม่มีแผงลูกค้าตามเงื่อนไข)
- test `05_base_rpcs.sql` ล้มกับข้อมูลปัจจุบัน (`tag_taken: Admin_Sao` — tag ถูกผูกกับสมาชิกอื่นแล้ว) ไม่เกี่ยวกับ migration ล่าสุด ต้องแก้ test ให้เลือก tag ที่ยังว่าง
- โหมด `auto` ยังอ่านเป็น `self` และปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" ขึ้น "ไม่มีลีดที่ต้องจัดสรร" เสมอ (ยังไม่มีการผูกผู้ขายล่าสุดกับเซลล์)
- ผลตรวจทักแชตไม่ถูกบันทึกลง DB (ดู `docs/DATABASE.md` ข้อ 5.5)
- `dsales_set_member_tags` / `dsales_set_member_active` ยังไม่ถือ advisory lock ของ refresh: ถ้าหัวหน้าบันทึกตรงกับช่วง ~3 วินาทีที่ cron รัน owner_id อาจถูกเขียนทับด้วยค่าเก่าจนถึงรอบถัดไป (เติม `pg_advisory_xact_lock(hashtext('dsales_refresh_customer_base'))`) และ `set_member_tags` ยังไม่ถือ `dsales_admin_guard` lock
- RFM: แบ่งกลุ่มแล้ว (20261125140000) — ยังไม่ได้ทำแคมเปญแนะนำต่อกลุ่ม / template ต่อกลุ่ม / Dashboard ตาราง R × F (ดู `docs/superpowers/specs/2026-11-20-rfm-segments-backlog.md`)
- ภาพ e2e `send-outreach-*` / `outreach-*` ไม่ตรง baseline: baseline ยังเป็นข้อความ "24 ชม." ก่อนเปลี่ยนเป็น 7 วัน และเครื่องที่รันโหลดฟอนต์ Google ไม่ได้ (fallback font) — อัปเดต baseline บนเครื่องที่โหลดฟอนต์ได้
- `getMyLeads(1000, 0)` โหลดลีดสูงสุด 1,000 แถว Dashboard และ /leads จะตัดเงียบเมื่อเกิน
