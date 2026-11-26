# Direct Sale คืนลีดอัตโนมัติเมื่อครบ 30 วัน — Design + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** ไม่ให้เซลล์ "ดอง" ลูกค้าใน Direct Sale — ลีดที่อยู่ใน Direct Sale ครบ 30 วันแล้วยังไม่ปิดการขาย ถูกคืนอัตโนมัติ (ลูกค้ากลับไป "ลูกค้าของฉัน" ของเจ้าของตาม tag JST หรือถังกลางถ้าไม่มี tag) · ยอดที่นำไปคิดค่าคอมนับเฉพาะลูกค้าที่อยู่ใน Direct Sale (spec 2026-11-23 การตัดสินใจข้อ 2)

**การตัดสินใจ (ผู้ใช้ยืนยัน 2026-11-23):**
1. นับ 30 วันจากวันที่ลีดเข้า Direct Sale ของเจ้าของคนปัจจุบัน (จอง / ส่งเข้า Direct Sale / หัวหน้ามอบหมาย) — เข้าใหม่แต่ละครั้งเริ่มนับใหม่
2. ลีดที่ "ปิดการขายแล้ว" (won) ไม่ถูกคืน · สถานะอื่นทั้งหมด (รวม ไม่สนใจ/ติดต่อไม่ได้/รอติดต่อ) ถูกคืน
3. หลังถูกคืน เซลล์คนเดิมจองลีดนั้นเองไม่ได้ 30 วัน (คนอื่นจองได้, หัวหน้ามอบหมายได้)
4. หน้า Direct Sale แสดง "เหลือ N วัน" เมื่อเหลือ ≤ 7 วัน · การคืนอัตโนมัติบันทึกในประวัติของลีด
5. ไม่เพิ่ม cron ใหม่ — ต่อขั้นตอนคืนลีดเข้ากับ job เดิม `dsales-refresh-customer-base` (07:05, 12:05, 16:05)

**Architecture:**
- `dsales_leads.ds_since timestamptz` = เวลาที่เข้า Direct Sale ของเจ้าของปัจจุบัน — ตั้งโดย trigger `BEFORE INSERT OR UPDATE OF owner_id` (owner เปลี่ยนเป็นคนใหม่ = `now()`, owner เป็น null = null) จึงครอบทุกทางที่ตั้งเจ้าของ (`dsales_claim_customer`, `dsales_claim_lead`, `dsales_assign_lead`, `dsales_unclaim_lead`, `dsales_set_nocall`, enqueue) · backfill ลีดที่มีเจ้าของ = `coalesce(claimed_at, created_at)` (ตรวจ 2026-11-23: 76 ลีดมีเจ้าของ, ไม่มีลีดเกิน 30 วัน — ไม่มีลีดถูกคืนทันที)
- ตาราง `dsales_lead_auto_releases (lead_id, user_id, released_at)` · trigger เดียวกันปฏิเสธ (`raise exception 'release_cooldown'`) เมื่อ `NEW.owner_id = auth.uid()` (จองเอง) และคนนั้นถูกคืนลีดนี้อัตโนมัติภายใน 30 วัน — หัวหน้ามอบหมาย (`auth.uid()` ≠ เจ้าของใหม่) ผ่านได้ · cron/postgres (`auth.uid()` null) ผ่านได้
- `dsales_interactions.type` เพิ่มค่า `system` (บันทึก "ครบ 30 วันยังไม่ปิดการขาย — คืนอัตโนมัติ")
- `dsales_release_stale_leads()` (security definer, ไม่ให้ client เรียก): ลีดที่ `owner_id is not null and status <> 'won' and ds_since < now() - make_interval(days => ds_max_days)` → เขียน auto_releases + interaction (`type 'system'`, `rep_id` = เจ้าของเดิม) + `owner_id = null, status = 'new', callback_date = null` · คืนจำนวนลีด · setting `ds_max_days` (ค่าเริ่ม 30)
- cron job เดิม: `cron.alter_job` ให้ command เป็น `select dsales.dsales_release_stale_leads(); select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();` (คืนก่อน refresh เพื่อให้ owner ตาม tag ถูกคำนวณรอบเดียวกัน)
- `dsales_lead_json` เพิ่ม `dsSince` · หน้าเว็บ: ฟังก์ชันล้วน `releaseDaysLeft(dsSince, today, maxDays)` → แท็ก "เหลือ N วัน" ในคอลัมน์สถานะของ Direct Sale เมื่อเหลือ ≤ 7 วัน (ไม่แสดงกับ won) · `toThaiError('release_cooldown')` = "ลูกค้ารายนี้เพิ่งถูกคืนจาก Direct Sale ของคุณ จองซ้ำได้เมื่อครบ 30 วัน" · ประวัติลีดแสดงรายการ type `system`

---

### Task 1 (DB): migration + test + dry run — ไม่ลง production
- [ ] test `supabase/tests/16_ds_auto_release.sql` (`begin … rollback`): สร้างเซลล์ทดสอบ 2 คน + ลีดทดสอบ (เบอร์ปลอม `0899999981`…) · ตรวจ: (a) จองลีด → `ds_since` ≈ now · (b) ตั้ง `ds_since = now() - 31 days` แล้วเรียก `dsales_release_stale_leads()` → owner null, status new, มี auto_release + interaction `system` · ลีด won อายุ 31 วันไม่ถูกคืน · ลีดอายุ 20 วันไม่ถูกคืน · (c) เซลล์เดิม (`set local role authenticated` + jwt sub) เรียก `dsales_claim_lead`/`dsales_claim_customer` → `release_cooldown` · เซลล์คนอื่นจองได้ · หัวหน้า `dsales_assign_lead` ให้เซลล์เดิมได้ · (d) `dsales_lead_json` มี `dsSince` · (e) authenticated เรียก `dsales_release_stale_leads` ไม่ได้ · อ่าน `dsales_lead_auto_releases` ไม่ได้
- [ ] รัน test ให้ล้มก่อน → เขียน `supabase/migrations/20261123130000_dsales_ds_auto_release.sql` (คอลัมน์ + backfill, ตาราง + RLS/revoke, trigger function, constraint interactions เพิ่ม `system`, `dsales_release_stale_leads`, `dsales_lead_json` เพิ่ม `dsSince` จากนิยามปัจจุบันใน production, setting `ds_max_days`) — **ไม่ใส่ `cron.alter_job` ในไฟล์นี้** (ทำแยกหลังผู้ใช้อนุมัติ)
- [ ] dry run (begin + migration + test + rollback) ผ่าน · regression ใน dry run: `08d_outreach_enqueue.sql`, `05_base_rpcs.sql` (ถ้าหนัก ให้รันเฉพาะส่วนที่เกี่ยว claim) · commit

### Task 2 (web): หลัง Task 1 ลง production
- [ ] `lib/api/types.ts` `LeadJson.dsSince`, `Lead.dsSince` + `mapLead` · `lib/domain/leads.ts` `releaseDaysLeft` (+test: 23 วันผ่านไป = เหลือ 7, เกิน = 0, null/won = null) · `LeadTable.tsx` แท็ก "เหลือ N วัน" (class เดิมของ DueTag/แท็กเตือน) · `errors.ts` `release_cooldown` (+test) · ประวัติลีด (`CustomerModal`/log list) แสดง type `system` เป็น "ระบบ" · fixture: ไม่มี `dsSince` = ไม่แสดงแท็ก
- [ ] typecheck/lint/vitest · e2e ภาพไม่ควรเปลี่ยน (fixture ไม่มี dsSince) · commit

### Task 3: ลง production + ต่อ cron เดิม (ต้องได้อนุมัติ)
- [ ] `apply_migration` → รัน test 16, 08d · `cron.alter_job` ของ `dsales-refresh-customer-base` (command ใหม่ตามข้างบน) · ตรวจ `select command from cron.job where jobname = 'dsales-refresh-customer-base'`
- [ ] เอกสาร CLAUDE.md / DATABASE.md
