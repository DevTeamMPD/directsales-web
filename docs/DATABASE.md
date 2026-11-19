# MPD Direct Sale · โครงสร้างฐานข้อมูล

> สำรวจจาก Supabase project `nroyacasuchqniaiuirk` เมื่อ 2026-11-17 (อ่านอย่างเดียว)
> project นี้ใช้ร่วมกับหลายระบบ (MRP, HR, CDP, bot ฯลฯ) มี migration ราว 1,568 ตัว
> เอกสารนี้สรุปเฉพาะส่วนที่ Direct Sale ใช้หรือจะใช้ ไฟล์ migration ไม่ได้อยู่ใน repo นี้

## 1. ภาพรวมการเชื่อมข้อมูล

```mermaid
erDiagram
  cdp_members      ||..o{ order_tracking    : "phone"
  order_tracking   ||..o{ order_contacts    : "tracking_number (canonical)"
  order_contacts   ||..o{ sales_transaction : "order_no (btrim)"
  order_tracking   ||..o{ iim_sessions      : "buyer_name = customer (ชื่อแชต)"
  iim_sessions     ||--o{ iim_messages      : "ms_id (FK)"
  customers_bbps   ||--o{ iim_sessions      : "customer_id (FK)"
  dsales_campaigns ||--o{ dsales_leads      : "campaign_id"
  dsales_leads     ||--o{ dsales_interactions : "lead_id"
  dsales_leads     }o..|| order_tracking    : "phone_normalized"
```

- **คีย์หลักของลูกค้าคือเบอร์โทร** (ใช้ `public.normalize_phone_th()` และ `dsales_valid_phone()`)
- Customer 360 กลางอยู่ที่ `customer_identities` / `customer_identity_links` (`identity_id` ใน `dsales_leads`)
- เส้นทึบ = foreign key จริง, เส้นประ = จับคู่ด้วยค่า (ไม่มี constraint)

## 2. ตารางแหล่งข้อมูล (มีอยู่แล้ว)

### `public.order_tracking` · ~43.6k แถว · ใช้หาตัวลูกค้า / ร้าน / ชื่อแชต
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | uuid | PK |
| online_order | text | เลขออเดอร์บนแพลตฟอร์ม |
| tracking_number | text | ใช้เชื่อมกับ `order_contacts` (ตัดอักขระพิเศษ + upper) |
| phone | text | **คีย์ลูกค้า** |
| platform, shop | text | ช่องทาง/ร้าน (แปลงผ่าน `cdp.shops`, `dsales_norm_platform`) |
| logistics, order_status | text | |
| buyer_account_no | text | บัญชีผู้ซื้อ (มีค่า ~40k แถว) — ตอนนี้จับคู่กับ iim ไม่ได้ |
| buyer_name | text | ชื่อผู้ซื้อ / ชื่อแชต — ใช้จับคู่ `iim_sessions.customer` |
| source_file, created_at, updated_at | | |

> ⚠️ **ไม่มีคอลัมน์ `Customer_ID`** ตัวระบุลูกค้าคือ `phone` (+ `buyer_name`, `buyer_account_no`)

### `public.sales_transaction` · ~271.8k แถว · รายการขายรายบรรทัด (บิล/SKU)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | uuid | PK |
| bill_no, order_no, invoice_no | text | `order_no` ใช้เชื่อม `order_contacts` |
| order_status, txn_date, transfer_date | | |
| customer_code, customer_group1, customer_group2 | text | |
| sku, product_name, product_group | text | |
| unit_price, quantity, amount, sell_price, shipping_cost | numeric | |
| salesperson | text | ชื่อพนักงานขาย (text ไม่ใช่ FK) |
| channel_id | uuid | |
| project, keyword, source_type, source_file, line_seq, numeric_order_sku_key | | `numeric_order_sku_key` unique |

> ไม่มีเบอร์โทร ต้องเดินเส้น `order_no → order_contacts → tracking_number → order_tracking.phone`
> (ทำไว้แล้วใน `crm_internal.refresh_sales_transaction_tracking_links_v1` → `customer_identity_links`)

### `cdp.members` · ~3.3k แถว · สมาชิก CRM
`id uuid, phone, phone_verified_at, first_name, last_name, gender, birth_date, email, source, status, merged_into, is_test, address jsonb, email_bounced_at, deleted_at, deleted_by, delete_reason, created_at, updated_at`

> ชื่อจริงคือ **`cdp.members`** (มี s) คีย์เชื่อมคือ `phone` · ควรกรอง `is_test`, `deleted_at`, `merged_into`

### `public.iim_sessions` · ~29.8k แถว · ห้องแชตจาก JST
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| ms_id | bigint | PK (session id ของ JST) |
| customer | text | **ชื่อแชตของลูกค้า** (มี index `lower(btrim(customer))`) |
| channel | text | Facebook 19.4k, Shopee 4.3k, Instagram 3.7k, Line 1.8k, TikTok 349, Lazada 330, WebChat 2 |
| page | text | เพจ/ร้าน |
| msg_type, account_type, session_tag, tags jsonb, remark | | |
| mop_id, mop_status, order_status | text | |
| no_read_count, msg_count | int | |
| last_time, fetched_at | timestamptz | |
| customer_id | text | FK → `customers_bbps(id)` มีค่าแค่ ~894 แถว (3%) |
| from_ads | boolean | |

### `public.iim_messages` · ~711.5k แถว · ข้อความแชต (2024-08 → ปัจจุบัน)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | bigint | PK |
| ms_id | bigint | FK → `iim_sessions` (ON DELETE CASCADE) |
| time | timestamptz | ⚠️ ดูข้อ 5.2 |
| dir | text | `admin` / `customer` |
| fmt | text | txt, image, video, audio, file, expression, product, order, share, template, bundlemessage, storymention, shopssfeedback, **autoreply, system, systemnotice, error** |
| text, sender | text | `sender` = ชื่อแอดมินใน JST (34 ชื่อ) |
| media_urls | text[] | |

ตารางประกอบ: `iim_run_logs` (log การดึงแชต ~ทุก 39 นาที), `iim_updater_checkpoint`

## 3. ตาราง Direct Sale (`dsales_*`) — สร้างแล้วใน DB แต่ frontend ยังไม่ใช้

| ตาราง | คอลัมน์หลัก |
|---|---|
| `dsales_members` | user_id, role, display_name, active, created_at |
| `dsales_campaigns` | id, brand, name, description, start_date, end_date, claim_mode, criteria jsonb, max_per_rep, active, created_by |
| `dsales_leads` | id, campaign_id, source, brand, name, phone, phone_normalized, identity_id, address, shop, chat_name, channels jsonb, owner_id, last_seller_id, claimed_by, claimed_at, status, callback_date, interest, closed_bills[], closed_amount, closed_at, no_call, no_call_by, no_call_at, released_by[], auto_skip, created_by |
| `dsales_interactions` | id, lead_id, type, result, note, bills[], due, rep_id, created_at |

ณ วันที่สำรวจ: leads 0 · interactions 0 · campaigns 0 · members 1

## 4. ฟังก์ชัน (RPC) ฝั่ง Direct Sale

ทั้งหมดอยู่ใน `public`, ส่วนใหญ่เป็น `SECURITY DEFINER`

| ฟังก์ชัน | หน้าที่ | frontend ใช้แล้ว |
|---|---|---|
| `dsales_me()` | ชื่อ (profiles) + is_admin (dsales_members) | ✅ |
| `dsales_customer_pool_v3(p_search, p_limit, p_offset, p_from, p_to, p_brand)` | ถังลูกค้าทั้งหมด สูงสุด 100 แถว/หน้า | ✅ |
| `dsales_customer_pool_v4(...)` | รุ่นใหม่ (อาร์กิวเมนต์เดียวกัน) | ❌ |
| `dsales_customer_purchases(p_phone)` | ประวัติซื้อรายรายการ สูงสุด 200 แถว | ✅ |
| `dsales_customer_channels(p_phone)` | ช่องทาง/ร้านที่ลูกค้าเคยสั่ง (order_tracking + cdp.shops) | ❌ |
| `dsales_customer_chats(p_phone, p_since)` | แชต JST ของลูกค้า + จำนวนข้อความที่แอดมินส่งจริงหลัง `p_since` (ไม่นับ autoreply/system/error) | ❌ |
| `dsales_claim_customer(p_phone, p_brand)` / `dsales_claim_lead(p_lead)` / `dsales_unclaim_lead(p_lead)` | จอง / ยกเลิกจอง | ❌ |
| `dsales_assign_lead(p_lead, p_user)` | หัวหน้ามอบหมายลีด | ❌ |
| `dsales_log(p_lead, p_type, p_result, p_note, p_status, p_callback, p_interest, p_bills, p_amount)` | บันทึกการโทร/แชต + อัปเดตสถานะ | ❌ |
| `dsales_set_nocall(p_lead, p_on)` | ห้ามโทร | ❌ |
| `dsales_my_leads(p_limit, p_offset)` | ลีดของฉัน | ❌ |
| `dsales_team()`, `dsales_register()`, `dsales_is_admin()`, `dsales_uid()` | ทีม / ลงทะเบียน / สิทธิ์ | ❌ |
| `dsales_lead_json`, `dsales_norm_platform`, `dsales_valid_phone`, `dsales_touch_updated_at` | helper / trigger | — |

Migration ที่เกี่ยวข้อง: `dsales_initial_schema` (2026-11-04) → … → `dsales_live_part1a_columns`, `part1b_functions`, `part1c_policies`, `part2_actions`, `dsales_my_leads_hide_orphans` (2026-11-10)

## 5. ข้อสังเกต / สิ่งที่ต้องแก้

### 5.1 การจับคู่แชต JST กับลูกค้ายังไม่แม่น
`dsales_customer_chats` จับคู่ด้วย **ชื่อแชต** (`iim_sessions.customer` = `buyer_name` / `customer_identities.display_name` / `lds_customers.jst_chat_name`)
- จับคู่ได้ ~4,616 / 29,800 sessions (~15%)
- ชื่อแชตซ้ำกัน 1,175 ชื่อ → เสี่ยงจับผิดคน
- `buyer_account_no` จับคู่กับ `iim_sessions.customer` / `mop_id` ได้ 0 แถว
- `iim_sessions.customer_id` มีค่าแค่ ~3% และชี้ไป `customers_bbps`

**แนะนำ:** ให้ตัวดึงแชตเก็บ ID ผู้ซื้อของแต่ละแพลตฟอร์ม (Shopee buyer id, FB PSID, LINE userId ฯลฯ) ลง `iim_sessions` เพื่อผูกกับ `order_tracking.buyer_account_no` ได้แน่นอน

### 5.2 เวลาใน `iim_messages.time` น่าจะเพี้ยน timezone
ข้อความล่าสุดมีเวลาล้ำปัจจุบันราว 413 นาที (~7 ชม.) → น่าจะบันทึกเวลาไทยเป็น UTC
ต้องแก้ก่อนใช้ `p_since` ตรวจ "เซลล์ทักหลังจองหรือไม่"

### 5.3 ยังผูกผู้ส่งใน JST กับเซลล์ไม่ได้
`iim_messages.sender` เป็นชื่อ text ไม่มีตาราง map ไป `dsales_members.user_id`
**แนะนำ:** เพิ่มคอลัมน์ เช่น `dsales_members.jst_sender_names text[]` หรือตาราง mapping

### 5.4 ความถี่และความเสถียรของตัวดึงแชต
ดึงประมาณทุก 39 นาที · มีสถานะ `partial` 4 ครั้งใน 24 ชม. → การยืนยันว่าทักแล้วจะล่าช้าได้ ~40 นาที

### 5.5 อื่น ๆ
- frontend ยังเก็บลีด/การจอง/บันทึกใน `localStorage` ต้องย้ายไปเรียก RPC `dsales_*` ในข้อ 4
- `dsales_me` fallback ให้ `dev@mpdgroup.co` เป็น admin ในโค้ด (`app.js`) ควรใช้สิทธิ์จาก DB อย่างเดียว
- ควร export migration `dsales_*` มาเก็บใน repo (เช่น `supabase/migrations/`) เพื่อ review และ deploy ซ้ำได้

### 5.6 งานตั้งเวลา: ฐานลูกค้า `dsales.dsales_customer_base` (แก้ 2026-11-19)
pg_cron job `dsales-refresh-customer-base` เรียก `dsales.dsales_seed_chat_links_by_name()` แล้ว `dsales.dsales_refresh_customer_base()`
- **รันวันละ 3 รอบ 07:05, 12:05, 16:05 น.** (`5 0,5,9 * * *` UTC) เดิมรันทุกชั่วโมง ข้อมูลต้นทาง (ออเดอร์/ยอดขาย) เข้าวันละไม่กี่ครั้ง จึงไม่ต้องรันถี่
- **เขียนเฉพาะแถวที่เปลี่ยน** (ใช้กับฐานข้อมูลจริงแล้ว 2026-11-19, Supabase migration `dsales_diff_refresh`) เดิมลบทั้งตารางแล้วเขียนใหม่ทุกรอบ (~18,800 + 2,300 แถว) ตอนนี้ลบแถวที่หลุด เพิ่มแถวใหม่ แก้แถวที่ค่าเปลี่ยน แถวที่เหมือนเดิมไม่แตะ ผลลัพธ์เท่าเดิม
- รอบแรกของแต่ละวันยังแก้ทุกแถวที่มีวันสั่งซื้อล่าสุด (~9,100 แถว) เพราะ `dormant_days` เพิ่มวันละ 1 รอบที่เหลือของวันเขียนเฉพาะแถวที่ข้อมูลต้นทางเปลี่ยน
- `refreshed_at` / `linked_at` จึงหมายถึง "เวลาที่แถวนี้ถูกเขียนล่าสุด" ไม่ใช่เวลาของรอบล่าสุด (ไม่มีโค้ดไหนอ่านสองคอลัมน์นี้)
- ฐานข้อมูลใช้ร่วมหลายแอปและเครื่องเล็ก งานนี้อ่านตารางออเดอร์/ยอดขายทั้งก้อน อย่าเพิ่มรอบโดยไม่จำเป็น
- โค้ด: `supabase/migrations/20261119120000_dsales_diff_refresh.sql`

## 6. แนวทางระบบ "ขุด → เปิดแชต JST → ตรวจว่าทักจริง" (ร่าง)

1. เซลล์กดจอง → `dsales_claim_customer` บันทึก `claimed_at`
2. หน้าเว็บเรียก `dsales_customer_chats(phone)` ได้ `ms_id` / `channel` / `page` → เปิดแชตใน JST
   (deep link หรือ script บนเครื่องเซลล์ — **ต้องยืนยันรูปแบบ URL ของ JST ก่อน**)
3. ตรวจซ้ำด้วย `dsales_customer_chats(phone, claimed_at)` → `admin_msgs > 0` และ `last_admin_sender` ตรงกับเซลล์ (ต้องทำข้อ 5.3)
4. บันทึกผลลง `dsales_interactions` (type = `chat`) อัตโนมัติ
