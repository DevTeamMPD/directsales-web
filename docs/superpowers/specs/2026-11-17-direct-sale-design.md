# MPD Direct Sale · Design Spec (เฟส 1)

> วันที่: 2026-11-17 · สถานะ: รอตรวจ
> ขอบเขต: Feature List, Workflow, โครงสร้าง DB, กติกานับยอด Direct Sale และ KPI
> นอกขอบเขต: รายละเอียด Playwright ของ JST Worker (spec แยก หลังดูหน้า JST จริง), การคำนวณเงินค่าคอม (ทำใน Project Commission)

## 1. เป้าหมาย

ให้ Sale Online ที่ตอบแชตใน JST อยู่แล้ว ใช้เวลาว่างขุด/ติดตามลูกค้าเก่าด้วยการ **ทักแชตกลับ** และ **โทร** แล้วบันทึกผล
ระบบต้องบอกได้อย่างอัตโนมัติว่า **order ไหนนับเป็น Direct Sale ของเซลล์คนไหน** เพื่อส่งต่อให้ Project Commission คำนวณค่าคอม และเก็บ KPI ของเซลล์

## 2. นิยาม

| คำ | ความหมาย |
|---|---|
| ลูกค้า | 1 เบอร์โทร (normalize ด้วย `public.normalize_phone_th()`) = 1 ลูกค้า |
| ลูกค้าเก่า | มีบิลอย่างน้อย 1 บิลใน `order_tracking` หรือ `sales_transaction` (ผูกด้วยเบอร์) ส่วน `cdp.members` ใช้เป็นแหล่งชื่อ/ข้อมูลประกอบ สมาชิกที่ไม่มีบิลเลยไม่นับเป็นลูกค้าเก่า |
| ลูกค้าที่เข้าเกณฑ์ (dormant) | ลูกค้าเก่าที่บิลล่าสุดห่างจากวันนี้ (หรือวันที่ติดต่อ) **≥ 30 วัน** |
| เจ้าของลูกค้า | ลำดับความสำคัญ: (1) หัวหน้ามอบหมาย → (2) tag `Admin_<ชื่อ>` ใน JST ที่ผูกกับเซลล์ → (3) เซลล์ที่จองจากถังกลาง/แคมเปญ ลูกค้าที่ไม่มีข้อใดเลยอยู่ใน **ถังกลาง** |
| tag ของลูกค้า | tag `Admin_*` ตัวแรกของ **ห้องล่าสุดที่มี tag Admin_\*** ในบรรดาห้องแชตที่ผูกกับเบอร์นั้นใน `dsales.chat_links` (ห้องล่าสุด = `last_time` ใหม่สุด ถ้าเท่ากันใช้ `ms_id` มากสุด; ห้องที่ไม่มี tag `Admin_*` ข้ามไป ไม่ทำให้ลูกค้าหลุด tag; ห้องที่ยังไม่ผูกเบอร์ ระบบไม่รู้ว่าเป็นลูกค้าคนไหน) |
| tag ขัดกัน | ลูกค้ามีหลายห้องแชตที่ติด `Admin_*` ต่างกัน → ใช้ tag ของห้องล่าสุดที่มี tag `Admin_*` (เรียง `last_time` ล่าสุด แล้ว `ms_id` มากสุด) |
| การติดต่อผ่านเกณฑ์ | ดูข้อ 6.1 |
| ช่วงนับยอด | (เวลาติดต่อผ่านเกณฑ์, เวลาติดต่อ + 30 วัน] |

## 3. ผู้ใช้และ Feature List

ผู้ใช้ 2 บทบาท: **เซลล์** และ **หัวหน้า** · ใช้งานได้ทั้ง **มือถือ** และ **คอม** (responsive, UX/UI ตาม prototype ปัจจุบัน)

### เซลล์
1. **ลูกค้าของฉัน** — ลูกค้าที่เป็นของฉัน (ตาม tag/จอง/มอบหมาย) และเข้าเกณฑ์ ≥30 วัน เรียงตาม LTV/RFM ค้นหา/กรองแบรนด์ได้
2. **ถังกลาง** — ลูกค้าเข้าเกณฑ์ที่ไม่มีเจ้าของ ใครจองก่อนได้ก่อน
3. **แคมเปญ** — ลีดที่หัวหน้าสร้าง/แจก (มีใน prototype แล้ว)
4. **ทักแชตแบบกลุ่ม** — ติ๊กเลือกลูกค้าหลายคน → เลือก template → ดูตัวอย่างข้อความ → กด "ส่ง N รายการ" เข้าคิว → ดูความคืบหน้า batch (รอส่ง/ส่งแล้ว/ยืนยันแล้ว/ไม่สำเร็จ) และยกเลิกรายการที่ยังไม่ส่งได้
5. **โทร** — ปุ่ม `tel:` แล้วบันทึกผล: ติดต่อได้ / ไม่รับสาย / เบอร์ผิด / ห้ามโทร
6. **บันทึกผลและนัดติดตาม** — สถานะลีด, วันนัดโทรกลับ, ระดับความสนใจ, หมายเหตุ
7. **ผลงานของฉัน** — order ที่นับเป็น Direct Sale, KPI เทียบเป้าของเดือน

### หัวหน้า
8. **ผูก tag กับเซลล์** — เช่น `Admin_Sao` → บัญชีเซลล์คนหนึ่ง (1 เซลล์มีได้หลาย tag)
9. **แคมเปญและ template ข้อความ** — template ต่อแบรนด์ มีตัวแปร `{ชื่อ}`, `{สินค้าล่าสุด}`, `{ร้าน}`
10. **ตั้งเป้ารายเดือน** — จำนวนการติดต่อและยอดขาย ต่อเซลล์
11. **Dashboard ทีม** — KPI ทุกคน แยกแบรนด์และช่องทาง
12. **รายการ order Direct Sale** — ตาราง + export, และ view ให้ Project Commission อ่าน
13. **สถานะ Worker** — online/offline, session JST หลุดไหม, ส่งไปกี่ข้อความในชั่วโมงนี้, คิวค้างกี่รายการ

### ไม่ทำในเฟสนี้
- คำนวณเงินค่าคอม
- ระบบโทรผ่านเว็บ/บันทึกเสียง (ใช้ `tel:`)
- นับแชตที่เซลล์พิมพ์เองใน JST (ยืนยันตัวผู้พิมพ์ไม่ได้ ดูข้อ 6.1)
- RLS ระดับแถว (ดูข้อ 9)

## 4. Workflow

```
ลูกค้าเก่าที่หายไป ≥30 วัน  (dsales.customer_base, refresh ทุกชั่วโมง)
   │
   ├─ มีเจ้าของตาม tag/มอบหมาย → อยู่ใน "ลูกค้าของฉัน" ของเซลล์คนนั้น
   └─ ไม่มีเจ้าของ → "ถังกลาง" / แคมเปญ → เซลล์กดจอง
   │
   ▼  เซลล์ติดต่อ (มือถือหรือคอม)
   ├─ ทักแชต: เลือกหลายคน → batch → dsales.outreach_queue
   │      → JST Worker (24 ชม., บัญชี Dev) ตรวจห้องแชตถูกคน → ส่ง → status = sent
   │      → job ตรวจกับ iim_messages → status = verified
   └─ โทร: กดโทร → บันทึกผล "ติดต่อได้"
   │
   ▼  ระบบตรวจเกณฑ์ (ข้อ 6.1) → ผ่าน = เปิดช่วงนับยอด 30 วัน
   │
   ▼  ลูกค้าซื้อ: sales_transaction.bill_no = order_tracking.online_order → เบอร์ตรงกับลูกค้า
   │
   ▼  job นับยอด (ทุกชั่วโมง) → dsales.attributions (1 แถว/บิล) → view ให้ Project Commission
```

## 5. สถาปัตยกรรม

| ส่วน | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Web App | HTML/CSS/JS เดิม (static, ไม่มี build) + supabase-js | หน้าจอเซลล์/หัวหน้า ทั้งมือถือและคอม เรียกเฉพาะ RPC ใน schema `dsales` |
| Supabase (Postgres) | schema `dsales` + pg_cron | ข้อมูล Direct Sale ทั้งหมด, กติกานับยอด, KPI, คิวส่งข้อความ |
| JST Worker | Node.js + Playwright บนเครื่องที่เปิด 24 ชม. | ล็อกอิน JST ด้วยบัญชีกลาง (User Dev) ดึงคิวจาก Supabase ส่งข้อความ เก็บเลข order/ID ผู้ซื้อ (spec แยก) |
| jst-helper (เดิม) | Node.js บนคอมเซลล์ (ไม่บังคับ) | ปุ่ม "เปิดห้องแชต" ให้เซลล์คุยต่อเอง |

**หลักการ:** กติกานับยอดคำนวณใน DB เท่านั้น (ไม่คำนวณในเบราว์เซอร์) เพื่อให้ตัวเลขค่าคอมเชื่อถือได้และระบบอื่นอ่านผลเดียวกัน

### 5.1 Schema `dsales` แยกจาก `public`

project Supabase นี้ใช้ร่วมกับหลายระบบ (MRP, HR, CDP, bot, ~1,568 migrations) จึงแยกของ Direct Sale ไว้ใน schema `dsales`:
- ย้ายตาราง/ฟังก์ชัน `public.dsales_*` เดิมเข้า `dsales` โดย**คงชื่อเดิม** (เช่น `public.dsales_leads` → `dsales.dsales_leads`) เพื่อให้แปลง function เดิมได้ปลอดภัย ชื่อตารางใหม่ในเอกสารนี้ (เช่น `customer_base`) จึงมี prefix `dsales_` ในของจริง
- ตารางต้นทาง (`order_tracking`, `sales_transaction`, `iim_*`, `cdp.members`, `customer_identities`) **อ่านอย่างเดียว ไม่แก้**
- ต้องเพิ่ม `dsales` ใน Supabase Dashboard → Data API → Exposed schemas และหน้าเว็บเรียกด้วย `sb.schema('dsales').rpc(...)`
- Project Commission ได้สิทธิ์อ่านเฉพาะ `dsales.directsale_orders_v`

## 6. กติกานับยอด

### 6.1 การติดต่อผ่านเกณฑ์ (เปิดช่วงนับยอด)

ต้องครบทุกข้อ:
1. **ช่องทาง**
   - แชต: รายการใน `dsales.outreach_queue` ที่ `status = verified` (เวลาติดต่อ = เวลาข้อความใน `iim_messages`)
   - โทร: `dsales.interactions` ที่ `type = call` และ `result = connected` (เวลาติดต่อ = เวลาบันทึก)
2. **เซลล์ทักก่อน** (เฉพาะแชต): ไม่มีข้อความ `dir = customer` ในห้องแชตใด ๆ ที่ผูกกับเบอร์นี้ ภายใน 30 วันก่อนเวลาติดต่อ
3. **ลูกค้าหายไป ≥30 วัน**: บิลล่าสุดก่อนเวลาติดต่อ เก่ากว่า 30 วัน
4. **ผู้ติดต่อเป็นเจ้าของ** ณ เวลาติดต่อ (ข้อ 2 นิยาม "เจ้าของลูกค้า")

### 6.2 การยืนยันแชตจาก Worker

`iim_messages.sender` เป็นชื่อเพจ/`[admin]` ไม่ใช่ชื่อคน จึงยืนยันด้วย:
- `ms_id` ตรงกับรายการคิว, `dir = admin`
- `text` ขึ้นต้นตรงกับข้อความที่ส่ง (เทียบ 30 ตัวอักษรแรกหลังตัดช่องว่าง)
- เวลาอยู่ในช่วง `[sent_at − 5 นาที, sent_at + 3 ชม.]` (ใช้เวลาที่แก้ timezone แล้ว ข้อ 6.5)
- ไม่พบภายใน 3 ชม. → `status = sent_unverified` (ไม่นับ หัวหน้าตรวจเองได้)

ผู้ที่ได้ผลงาน = `requested_by` ของรายการคิว

### 6.3 การจับคู่บิล

- บิล = แถวใน `sales_transaction` จัดกลุ่มด้วย `bill_no`
- เบอร์ของบิล = `order_tracking.phone` ที่ `btrim(online_order) = btrim(bill_no)` (ตรวจแล้ว: บิล ต.ค.–พ.ย. 2026 ผูกได้ 5,342 / 6,001 = 89%)
- บิลนับยอดเมื่อ `txn_date` อยู่ในช่วงนับยอดของการติดต่อผ่านเกณฑ์ของเบอร์นั้น
- **นับทุกบิล** ในช่วง 30 วัน
- มีการติดต่อผ่านเกณฑ์หลายครั้ง → ผูกกับครั้งล่าสุดก่อน `txn_date`
- ยอดเงิน = `sum(amount)` ของบิล (ไม่รวม `shipping_cost`)
- 1 บิลนับได้ครั้งเดียว (`bill_no` unique)

### 6.4 สถานะบิลใน `dsales.attributions`

| `sales_transaction.order_status` | `attributions.status` | Project Commission ควร |
|---|---|---|
| Shipped | `active` | นับ |
| Pending, To Ship | `pending` | รอ |
| Abnormal Order | `review` | รอหัวหน้าตรวจ |
| Cancelled | `void` | ไม่นับ |

job ประเมินบิลย้อนหลัง 60 วันทุกรอบ จึงอัปเดตสถานะเมื่อบิลเปลี่ยน ไม่ลบแถว

### 6.5 เวลาใน `iim_messages` (ต้องทำก่อน)

`iim_messages.time` ล้ำเวลาจริงราว 7 ชม. (บันทึกเวลาไทยเป็น UTC) Direct Sale จะไม่แก้ตารางต้นทาง แต่สร้าง view `dsales.chat_messages_v` ที่ลบ 7 ชม. ออก หลังยืนยันว่า offset คงที่ทั้งชุดข้อมูล ทุกกติกาที่ใช้เวลาแชตอ่านจาก view นี้

## 7. KPI (ต่อเซลล์ รายวัน/รายเดือน)

| KPI | สูตร |
|---|---|
| จำนวนการติดต่อ | จำนวนลูกค้าไม่ซ้ำที่มีการติดต่อผ่านเกณฑ์ แยกโทร/แชต |
| อัตราปิดการขาย | ลูกค้าที่ติดต่อผ่านเกณฑ์ในเดือน M และมีบิล `active` ในช่วงนับยอด ÷ ลูกค้าที่ติดต่อผ่านเกณฑ์ในเดือน M |
| ยอดขาย Direct Sale | `sum(amount)` และจำนวนบิล `active` ใน `dsales.attributions` ตาม `txn_date` แยกแบรนด์/ช่องทาง |
| เทียบเป้า | จำนวนการติดต่อ และยอดขาย เทียบ `dsales.targets` ของเดือน |

## 8. โครงสร้าง DB (schema `dsales`)

### 8.1 ตารางต้นทาง (อ่านอย่างเดียว)

`public.order_tracking`, `public.sales_transaction`, `public.iim_sessions`, `public.iim_messages`, `cdp.members`, `public.customer_identities`

### 8.2 ตาราง

| ตาราง | ที่มา | คอลัมน์หลัก |
|---|---|---|
| `members` | ย้ายจาก `public.dsales_members` + เพิ่ม | user_id, role (sales/admin), display_name, active, email, **jst_tags text[]** |
| `campaigns` | ย้าย | (เดิม) |
| `leads` | ย้าย + เพิ่ม | (เดิม) + **source** (tag/pool/campaign/assigned) · สร้างเมื่อเซลล์เริ่มทำงานกับลูกค้า ไม่สร้างล่วงหน้า |
| `interactions` | ย้าย + เพิ่ม | (เดิม) + **verified_at**, **verify_method** (iim/self), **outreach_id** |
| `customer_base` | ใหม่ (refresh ทุกชั่วโมง) | phone_normalized PK, identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv, rfm_segment, brands[], owner_tag, owner_id, eligible bool |
| `chat_links` | ใหม่ | ms_id, phone_normalized, method (order_no/buyer_id/chat_name/manual), evidence (เลข order/ID ที่เจอ), confidence (high/medium/low), linked_at · unique (ms_id, phone_normalized) |
| `templates` | ใหม่ | id, brand, name, body, active, created_by |
| `outreach_batches` | ใหม่ | id, requested_by, template_id, total, created_at |
| `outreach_queue` | ใหม่ | id, batch_id, lead_id, phone_normalized, ms_id, message_text, requested_by, status (queued/sending/sent/sent_unverified/verified/failed/cancelled), attempts, error, locked_at, sent_at, verified_at, verified_message_id |
| `attributions` | ใหม่ | bill_no PK, txn_date, amount, brand, phone_normalized, member_id, lead_id, contact_kind (call/chat), contact_ref (interaction/queue id), contact_at, status (active/pending/review/void), attributed_at, updated_at |
| `targets` | ใหม่ | member_id, month (date วันแรกของเดือน), target_contacts, target_amount · PK (member_id, month) |
| `worker_status` | ใหม่ | worker_id PK, heartbeat_at, jst_session_ok, sent_last_hour, last_error |
| `settings` | ใหม่ | key, value jsonb — dormant_days (30), window_days (30), worker_rate_per_hour (60), chat_tz_offset ('7 hours') |

### 8.3 View / ฟังก์ชัน / งานตั้งเวลา

| ชื่อ | ประเภท | หน้าที่ |
|---|---|---|
| `chat_messages_v` | view | `iim_messages` ที่แก้เวลาแล้ว (ข้อ 6.5) |
| `qualified_contacts_v` | view | การติดต่อผ่านเกณฑ์ทั้งหมด (ข้อ 6.1) |
| `kpi_daily_v`, `kpi_monthly_v` | view | KPI ข้อ 7 |
| `directsale_orders_v` | view | `attributions` + ชื่อเซลล์/อีเมล สำหรับ Project Commission |
| `refresh_customer_base()` | function + pg_cron ทุกชั่วโมง | สร้าง `customer_base` ใหม่ |
| `verify_outreach()` | function + pg_cron ทุก 15 นาที | ตรวจคิว `sent` กับ `chat_messages_v` (ข้อ 6.2) |
| `attribute_orders()` | function + pg_cron ทุกชั่วโมง | upsert `attributions` ย้อนหลัง 60 วัน (ข้อ 6.3–6.4) idempotent |
| `enqueue_outreach(p_leads, p_template)` | RPC | สร้าง batch + รายการคิว (แทนตัวแปรในข้อความ) |
| `claim_next_outreach(p_worker)` | RPC (worker) | lock รายการถัดไปแบบสลับคิวระหว่างเซลล์ (`for update skip locked`) |
| `report_outreach(p_id, p_status, p_error, p_evidence)` | RPC (worker) | อัปเดตผลส่ง + เขียน `chat_links` |
| RPC เดิม (`claim_*`, `log`, `set_nocall`, `my_leads`, `customer_*` ฯลฯ) | ย้าย | ย้ายเข้า `dsales` ปรับให้อ่าน `customer_base` |

## 9. สิทธิ์

- **เฟสนี้:** ยังไม่ทำ RLS ระดับแถว หน้าเว็บกรองข้อมูลตามเซลล์ (tag/เจ้าของ) และแยกหน้า "ของฉัน" กับหน้าทีม
  - ความเสี่ยงที่ยอมรับ: ผู้ใช้ที่ล็อกอินได้เรียก API ดูข้อมูลลูกค้าทั้งหมดได้
- **ก่อนเปิดใช้ทั้งทีม (เฟส 5):** เปิด RLS ใน `dsales` — เซลล์เห็นเฉพาะลูกค้าของตัวเอง + ถังกลาง, หัวหน้าเห็นทั้งหมด
- worker ใช้ key แยกที่ทำได้แค่ `claim_next_outreach` / `report_outreach` / อัปเดต `worker_status`
- Project Commission อ่านได้แค่ `directsale_orders_v`

## 10. JST Worker (สัญญาที่ worker ต้องทำตาม)

รายละเอียดอยู่ใน spec แยก ส่วนนี้กำหนดพฤติกรรมที่ต้องมี:
- **วิธีคุยกับ JST (ตัดสินใจ 2026-11-17):** เรียก endpoint ภายในของเว็บ JST (`asia-web.jsterp.com/iim/...` เช่น `getSessions`, `getMsgs`) ด้วย cookie ของ session ที่ล็อกอินไว้ ไม่ใช้ JST Open API (มีค่าใช้จ่าย) ทีมรับทราบว่าเป็น endpoint ที่ไม่ได้เปิดให้ใช้อย่างเป็นทางการ จึง:
  - ตรวจรูปแบบ response ทุกครั้ง field ที่ต้องใช้หายหรือเปลี่ยนชนิด → หยุด worker และแจ้งในหน้าสถานะ ไม่เดาต่อ
  - ใช้ Playwright เฉพาะการล็อกอินและรักษา session (ดึง cookie) ส่วน endpoint ส่งข้อความต้องดูจาก network ตอนแอดมินส่งจริง 1 ครั้งระหว่างทำ spec worker
- ข้อมูลที่ได้จาก `getSessions` (ดู 2026-11-17): `ms_id` (ตรงกับ `iim_sessions.ms_id`), `outer_user_id` (LINE userId / Facebook PSID), `order_id`, `is_match_order`, `tags`, `msgs[].io_type` (In/Out), `send_time` เป็นเวลาไทยไม่มี timezone · ช่องค้นหาในหน้าแชตค้นได้ด้วย Online order number และ Online buyer number
- รันบนเครื่องที่เปิด 24 ชม. แบบ headless ล็อกอิน JST ด้วยบัญชีกลาง (User Dev) เครื่องนี้ใช้งานอย่างเดียว ไม่เปิด port รับคำสั่งจากภายนอก (ดึงงานจาก Supabase เอง)
- ดึงงานด้วย `claim_next_outreach` ทีละรายการ สลับระหว่างเซลล์
- **ตรวจห้องแชตก่อนส่ง:** เลข order หรือ ID ผู้ซื้อที่เห็นในห้องต้องตรงกับข้อมูลลูกค้า ถ้าไม่ตรง → ไม่ส่ง, `failed: mismatch`
- ระหว่างเปิดห้อง เก็บเลข order / ID ผู้ซื้อ (`outer_user_id`) ส่งกลับผ่าน `report_outreach` เพื่อเพิ่ม `chat_links` (method `order_no` / `buyer_id`) — `outer_user_id` ของ LINE ตัวเดียวกันใช้ข้ามหลาย OA ได้ และ Facebook PSID เทียบกับ `customer_identities.primary_psid` ได้
- **ทุกช่องทาง (LINE, Facebook, Instagram, marketplace) ส่งผ่าน JST เป็นค่าเริ่มต้น** ไม่กรองช่องทางล่วงหน้า ให้ผลส่งจริงเป็นตัวตัดสิน
- **ส่งไม่ได้เพราะแพลตฟอร์มปิดหน้าต่างแชต** (เช่นลูกค้า FB/IG ไม่ได้แชตนาน — JST แสดงแถบสีแดงในห้อง) → อ่านสถานะจาก response ของ JST (field ที่แน่ชัดต้องดูตอนทดสอบส่งจริงหาลูกค้าที่ไม่ได้แชตนาน) แล้วบันทึก `failed: window_closed` ไม่ลองซ้ำ เซลล์ตัดสินใจเองว่าจะโทรหรือไปขุดต่อใน Meta Inbox
- **ยืนยันการส่งทันที** ด้วย `getMsgs` ของห้องนั้น (ข้อความ `io_type = Out` ของเราปรากฏ และไม่มีข้อความ `In` ของลูกค้าในช่วงก่อนหน้าตามกติกาข้อ 6.1) แล้วตั้ง `verified` ได้เลย การเทียบกับ `iim_messages` (ข้อ 6.2) ใช้เป็นการตรวจย้อนหลัง/สำรองเมื่อยืนยันทันทีไม่ได้
- **โควตา LINE OA:** ข้อความที่ส่งหาลูกค้า LINE นับโควตารายเดือนของ OA แสดงจำนวนที่ใช้ไปในหน้าสถานะ worker และมีเพดานต่อเดือนใน `settings` (ส่งครบเพดาน → หยุดเฉพาะงาน LINE)
- **ปุ่ม "เปิดใน Meta Inbox"** สำหรับลูกค้า FB/IG ทุกราย (เซลล์เลือกกดเอง): `https://business.facebook.com/latest/inbox/all/?asset_id={page_id}&mailbox_id={page_id}&selected_item_id={psid}&thread_type=FB_MESSAGE` ต้องมีตารางจับคู่เพจใน JST → `page_id` ของ Meta และต้องทดสอบว่า `selected_item_id` รับ PSID จาก JST ได้ (ต้องล็อกอิน Meta Business ใน browser ครั้งหนึ่ง)
- จำกัดอัตรา `settings.worker_rate_per_hour` (เริ่ม 60) และหยุดเองเมื่อล้มเหลวติดกัน 5 ครั้ง
- อัปเดต `worker_status` ทุก 1 นาที
- มีโหมด dry-run (ทำทุกขั้นยกเว้นกดส่ง)
- ประมาณการ: ~10–15 วินาที/ข้อความ → 100 ข้อความ ~20–25 นาที (ไม่รวมเพดานอัตรา)

## 11. การจัดการ error

| กรณี | การทำงาน |
|---|---|
| ส่งไม่สำเร็จ (หน้าค้าง/หาห้องไม่เจอ) | ลองใหม่สูงสุด 3 ครั้ง → `failed` + เหตุผล เซลล์เห็นในหน้า batch |
| ห้องแชตไม่ตรงลูกค้า | ไม่ส่งเด็ดขาด → `failed: mismatch` |
| แพลตฟอร์มไม่ให้ส่ง (หน้าต่างแชตปิด, JST ขึ้นแถบแดง) | `failed: window_closed` ไม่ลองซ้ำ หน้า batch แสดงปุ่ม "โทร" และ "เปิดใน Meta Inbox" (FB/IG) |
| โควตา LINE ครบเพดานเดือน | หยุดงาน LINE ที่เหลือเป็น `queued` จนเดือนใหม่ แจ้งในหน้าสถานะ worker |
| ส่งแล้วยืนยันไม่ได้ใน 3 ชม. | `sent_unverified` ไม่นับเป็นการติดต่อ |
| ไม่รู้ `ms_id` ของลูกค้า | ไม่ให้เลือกส่งแชตในหน้าเว็บ (แสดง "ยังไม่พบห้องแชต") ยังโทรได้ |
| worker หยุด / session JST หลุด | คิวค้างใน DB ไม่หาย หน้าเว็บแสดง worker offline หัวหน้าเห็นในหน้าสถานะ |
| รายการค้างที่ `sending` เกิน 10 นาที | ปลด lock กลับเป็น `queued` (นับ attempts) |
| บิลถูกยกเลิกหลังนับยอด | `attributions.status = void` |
| lead ถูกตั้งห้ามโทร | ยกเลิกรายการคิวที่ยังไม่ส่งของลูกค้านั้นอัตโนมัติ |

## 12. การทดสอบ

- **SQL test กติกานับยอด** ด้วยข้อมูลจำลองใน schema ทดสอบ ครอบคลุม: หายไป 29/30 วัน, ลูกค้าทักมาก่อน, บิลวันที่ 30 และ 31 หลังติดต่อ, หลายบิลในช่วงเดียว, ติดต่อหลายครั้ง (ผูกครั้งล่าสุด), บิล Cancelled/Abnormal, คนที่ไม่ใช่เจ้าของติดต่อ, `sent_unverified`
- **Dry-run กับข้อมูลจริง:** รัน `attribute_orders()` ย้อนหลังเดือนก่อนลงตารางทดสอบ ให้หัวหน้าสุ่มตรวจ ≥20 บิล
- **Worker:** dry-run กับห้องแชตทดสอบก่อนส่งจริง (spec แยก)
- **Web:** ทดสอบหน้าจอ 375px (มือถือ) และ desktop ทุกหน้าของเซลล์

## 13. ลำดับงาน

| เฟส | งาน |
|---|---|
| 0 | ยืนยัน timezone ของ `iim_messages` + สร้าง schema `dsales` + ย้ายของเดิม + expose schema + ปรับหน้าเว็บให้เรียก `dsales` |
| 1 | `customer_base`, ผูก tag กับเซลล์, หน้า "ลูกค้าของฉัน"/ถังกลาง, responsive มือถือ |
| 2 | บันทึกโทร, `qualified_contacts_v`, `attribute_orders()`, `attributions`, KPI, เป้า, Dashboard, view ให้ Project Commission |
| 3 | templates, batch, `outreach_queue` + RPC ของ worker, หน้า batch/สถานะ worker |
| 4 | JST Worker (spec แยก หลังดูหน้า JST จริง) |
| 5 | RLS ก่อนเปิดใช้ทั้งทีม |

## 14. ความเสี่ยงและเรื่องที่ต้องเช็ก

- **บัญชีกลางบัญชีเดียวส่งทุกข้อความ** → ความเสี่ยงโดนจำกัด/แบนรวมอยู่ที่บัญชีเดียว ใช้เพดานอัตราและเริ่มที่จำนวนน้อย
- **อัตราจับคู่ห้องแชตกับเบอร์ต่ำ (~15%)** ช่วงแรก → (1) เซลล์ส่งแชตได้เฉพาะลูกค้าที่รู้ `ms_id` (2) ลูกค้าที่มี tag ใน JST แต่ห้องยังไม่ผูกเบอร์ จะไปอยู่ในถังกลางแทนที่จะเป็นของเจ้าของ tag ทั้งสองข้อจะดีขึ้นเมื่อ worker เก็บเลข order/ID ผู้ซื้อ ควรให้ worker ไล่เก็บข้อมูลห้องที่มี tag `Admin_*` ก่อนเปิดใช้จริง
- **ตัวดึงแชตรันทุก ~39 นาที และบางรอบได้ข้อมูลไม่ครบ** → สถานะ verified ช้าได้ ~40 นาที
- **บิล ~11% ผูกเบอร์ไม่ได้** (ไม่มี `online_order` ที่ตรง) → ไม่ถูกนับยอด ควรติดตามสัดส่วนนี้ใน Dashboard
- **ไม่มี RLS ในเฟสแรก** (ข้อ 9)
- **ลูกค้า FB/IG ที่ไม่ได้แชตนานน่าจะส่งไม่ได้** (กติกาหน้าต่างแชตของ Meta) — ห้องแชตส่วนใหญ่ใน JST เป็น Facebook จึงคาดว่า "โทร" และการขุดใน Meta Inbox จะเป็นช่องทางหลักของลูกค้ากลุ่มนี้ ยืนยันด้วยการทดสอบส่งจริง
- **โควตา LINE OA มีค่าใช้จ่ายเมื่อเกินแพ็กเกจ** → เพดานต่อเดือน
- ตรวจแล้ว (2026-11-17): เปิดห้องด้วยลิงก์ `ms_id` ไม่ได้ (URL ไม่เปลี่ยน) แต่ค้นห้องผ่าน API `getSessions` ได้ · ยังต้องเช็ก: `query_type` ของการค้นด้วยเลข order/ID ผู้ซื้อ, endpoint ส่งข้อความ และ response ตอนส่งไม่ได้ (ทดสอบส่งจริง 1 ครั้งต่อช่องทาง: LINE, Facebook ที่ไม่ได้แชตนาน, Shopee), session อยู่ได้นานแค่ไหน, มี OTP/captcha ไหม

## 15. บันทึกการตัดสินใจ

| เรื่อง | ตัดสินใจ |
|---|---|
| เจ้าของลูกค้า | ตาม tag `Admin_*` ไม่มี tag = ถังกลาง |
| นับยอด | อัตโนมัติล้วน ไม่ต้องยืนยัน |
| ช่วงนับยอด | 30 วันหลังติดต่อผ่านเกณฑ์ นับทุกบิล |
| การติดต่อที่นับ | แชตที่ยืนยันแล้ว หรือโทรที่บันทึก "ติดต่อได้" |
| ลูกค้าเข้าเกณฑ์ | หายไป ≥30 วัน และเซลล์ทักก่อน |
| ค่าคอม | ระบบส่งออกรายการ order เท่านั้น Project Commission คำนวณเอง |
| KPI | การติดต่อ, อัตราปิดการขาย, ยอดขาย, เทียบเป้า |
| Script | ส่งข้อความอัตโนมัติ, worker 24 ชม. ตัวเดียว, บัญชีกลาง User Dev, ส่งแบบ batch |
| วิธีคุยกับ JST | endpoint ภายในของเว็บ JST ด้วย session ที่ล็อกอินไว้ (ไม่ซื้อ Open API) พร้อมตรวจรูปแบบ response และหยุดเองเมื่อผิดรูป |
| ช่องทางส่งแชต | ส่งผ่าน JST ทุกช่องทางรวม FB/IG เป็นค่าเริ่มต้น ส่งไม่ได้ → `window_closed` แล้วเซลล์โทรหรือไปขุดใน Meta Inbox เอง |
| Meta Inbox | ปุ่มลิงก์ให้เซลล์กดเองสำหรับลูกค้า FB/IG ไม่ส่งข้อความผ่าน Meta โดยอัตโนมัติ |
| อุปกรณ์ | มือถือและคอม |
| Schema | แยก `dsales` |
| สิทธิ์ | ยังไม่ทำ RLS ในเฟสแรก |
