# ส่งข้อความหาลูกค้าเป็นชุดผ่าน JST Worker (API หน้าเว็บ JST) — Design

> วันที่ 2026-11-20 · ต่อยอด spec หลัก `2026-11-17-direct-sale-design.md` ข้อ 4, 9, 13 และข้อ 10 (สัญญาของ worker)
> แทนแนวทาง "ปุ่มแชตเปิดหน้า JST + สคริปต์ Tampermonkey" ที่ใช้ไม่ได้บนเครื่องผู้ใช้ (ปุ่มแชตเดิมยังเปิดหน้า JST + คัดลอกชื่อแชตได้เหมือนเดิม)
> นอกขอบเขต: การนับยอด Direct Sale อัตโนมัติ (attribution) และ KPI จากแชต — เฟสถัดไป แต่รายการที่ `sent` ต้องพร้อมให้เฟสนั้นใช้

## 1. เป้าหมายและการตัดสินใจ

เซลล์ติ๊กเลือกลูกค้าหลายคน → เลือก template → กดส่งทีเดียว → worker บนเครื่องที่เปิด 24 ชม. ส่งข้อความผ่าน endpoint ภายในของหน้าเว็บ JST ด้วย session ของบัญชีกลาง แล้วรายงานผลรายคนกลับมาที่เว็บ

| เรื่อง | ตัดสินใจ (ผู้ใช้ 2026-11-20) |
|---|---|
| วิธีสั่งทัก | **ส่งเป็นชุดเท่านั้น** (ติ๊กเลือกแล้วส่ง) ไม่มีปุ่มทักทีละคน |
| ข้อความ | **template ที่หัวหน้าตั้งไว้เท่านั้น** มีตัวแปร แก้ข้อความก่อนส่งไม่ได้ |
| เลือกจากไหน | **ลูกค้าของฉัน + ถังกลาง** — ลูกค้าจากถังกลางถูกจองให้อัตโนมัติตอนส่ง · สูงสุด 50 คนต่อชุด |
| ล็อกอิน JST | **worker ล็อกอินเองอัตโนมัติ** ด้วยรหัสผ่านบัญชีกลางที่เก็บบนเครื่อง worker · ไม่ผ่าน captcha เด็ดขาด |
| ความเร็ว | **ตั้งค่าได้** เริ่ม 1 ข้อความ/นาที (`worker_interval_seconds` = 60) |
| วิธีส่ง | **คิวใน Supabase + worker ยิง `/iim/SendMsg` ทีละข้อความ** (ไม่ใช้ Playwright ในการส่ง) — `BatchSendMsg` เก็บไว้ทดลองภายหลัง |
| บัญชี Supabase ของ worker | **`dev@mpdgroup.co`** (แนวปฏิบัติของทีม) — RPC ของ worker อนุญาตเฉพาะ user_id ใน `worker_user_ids` |
| เครื่อง worker | ทดสอบบน**เครื่อง dev ของผู้ใช้**ก่อน ผ่านแล้วย้ายไปเครื่อง worker ที่ออฟฟิศ (โค้ดเดียวกัน ย้ายไฟล์ตั้งค่า) |

## 2. สิ่งที่รู้จากหน้า JST (ตรวจแบบอ่านอย่างเดียว 2026-11-19/20)

- ล็อกอิน: หน้า `/Org/Account/Login/index` เข้ารหัสรหัสผ่านด้วย RSA public key ที่ฝังในหน้า (JSEncrypt, PKCS#1 v1.5) แล้วแปลง `btoa(atob(cipher).padStart(256, "\0"))` · ก่อนล็อกอินเรียก `POST /Org/Account/Login/IsNeedCaptcha` (`data == '1'` = ต้องกรอก captcha) · ชื่อ endpoint และ field ของคำขอล็อกอินจริงยังไม่ได้เก็บ → ขั้น 0
- ห้องแชต: `POST /iim/getSessions` (ค้นด้วย `precise_query_ms_ids`) ได้ `ms_id`, `chat_account_id`, `session_provider`, `outer_account_name`, `name`, `is_expired`, `outer_user_id`
- ข้อความ: `POST /iim/getMsgs` (`ms_id`, `pull_model`, …) ได้ `msg_id`, `io_type`, `msg_content`, `status`, `send_time`
- ส่ง: `POST /iim/SendMsg` — พารามิเตอร์ที่เห็นจากโค้ด: `ms_id`, `chat_account_id`, `content`, `send_message_to_buyer_type: "ChatAccount"` (+ `template_type` สำหรับการ์ด) · payload ของข้อความตัวอักษรธรรมดายังไม่ได้เก็บ → ขั้น 0 · หน้าเว็บตรวจ `isChatAccountAuthorized` ก่อนส่ง
- ทดสอบแล้วบนเครื่อง dev: ล็อกอิน User Dev ไม่มี OTP/captcha, session ใช้ซ้ำแบบ headless ได้

## 3. ขั้น 0 — เก็บข้อมูลจริงก่อนเขียน worker (บนเครื่อง dev)

ใช้ `tools/jst-worker-spike` ที่มีอยู่ (Playwright ใช้เฉพาะขั้นนี้)
1. จับคำขอล็อกอินจริง 1 ครั้ง (ผู้ใช้ล็อกอินเอง) — เก็บ path + ชื่อ field + รูปแบบ response โดยตัดรหัสผ่าน/cookie ออก
2. ส่งข้อความทดสอบ 1 ข้อความไป**ห้องแชตของผู้ใช้เอง** (`send-test.mjs --confirm` หลังผู้ใช้ยืนยัน) — เก็บ payload/response ของ `/iim/SendMsg`
3. วัดความหน่วง: กดส่ง → JST ตอบ → ข้อความถึงมือถือ
4. บันทึก fixture (ลบข้อมูลลับแล้ว) ไว้ใช้เป็นข้อมูลทดสอบของ `jst-client`

ถ้าขั้นนี้พบว่า SendMsg ใช้ไม่ได้ (เช่น ต้องมี token ที่สร้างในหน้าเว็บเท่านั้น) → หยุดและกลับมาทบทวน design ก่อนทำต่อ

## 4. ฐานข้อมูล (schema `dsales`)

### 4.1 ตารางใหม่
| ตาราง | คอลัมน์ |
|---|---|
| `dsales_templates` | id uuid PK, brand (bebeplay/hosttail), name, body, active bool, created_by, created_at, updated_at |
| `dsales_outreach_batches` | id uuid PK, requested_by, template_id, brand, total int, skipped jsonb (`[{phone, reason}]`), created_at |
| `dsales_outreach_queue` | id uuid PK, batch_id, lead_id, phone_normalized, ms_id bigint, page text, provider text, message_text, requested_by, status (`queued`/`sending`/`sent`/`failed`/`cancelled`), attempts int, error text, enqueued_at, locked_at, locked_by, sent_at, jst_msg_id text |
| `dsales_worker_status` | worker_id text PK, user_id, heartbeat_at, jst_session_ok bool, state (`running`/`paused`/`needs_login`/`stopped`), sent_last_hour int, queue_waiting int, last_error text, updated_at |

ดัชนี: `outreach_queue (status, enqueued_at)`, `outreach_queue (batch_id)`, `outreach_queue (requested_by, status)`

### 4.2 ค่าใน `dsales_settings`
| key | ค่าเริ่ม | ใช้ทำอะไร |
|---|---|---|
| `worker_user_ids` | `["<user_id ของ dev@mpdgroup.co>"]` | บัญชีที่เรียก RPC ของ worker ได้ |
| `worker_interval_seconds` | `60` | ระยะห่างขั้นต่ำระหว่างการส่ง 2 ครั้ง (ทั้ง worker) |
| `outreach_max_batch` | `50` | จำนวนสูงสุดต่อชุด |
| `outreach_test_mode` | `true` | ส่งได้เฉพาะ `ms_id` ใน `outreach_test_ms_ids` รายการอื่นค้าง `queued` |
| `outreach_test_ms_ids` | `[]` | ห้องทดสอบ (ห้องของผู้ใช้) |
| `line_monthly_cap` | `0` (= ไม่จำกัด) | เพดานข้อความ LINE ต่อเดือน ครบแล้วพักงาน LINE |

### 4.3 RPC (security definer, `search_path = dsales, public`, revoke จาก public/anon)
**เว็บ (สมาชิก active ผ่าน `dsales_uid()`)**
- `dsales_templates_list(p_brand)` — template ที่ active ของแบรนด์
- `dsales_template_save(p_id, p_brand, p_name, p_body, p_active)` — หัวหน้าเท่านั้น
- `dsales_outreach_preview(p_phones text[], p_template uuid)` — คืนรายคน: ข้อความที่แทนตัวแปรแล้ว, ห้องที่จะส่ง (page/provider), หรือเหตุผลที่ถูกข้าม (`customer_not_found`, `taken`, `already_queued`, `no_chat_room`, `window_closed`) — ไม่เขียนอะไร · ลูกค้า "ห้ามโทร" ยังส่งแชตได้ (ห้ามแค่โทร)
- `dsales_enqueue_outreach(p_phones text[], p_template uuid)` — ทำแบบเดียวกับ preview ใน transaction เดียว: ตรวจ ≤ `outreach_max_batch`, จองลูกค้าจากถังกลาง (ใช้กติกาเดียวกับ `dsales_claim_customer`), สร้าง batch + คิว, คืน `{batch_id, queued, skipped}`
- `dsales_outreach_batches_mine(p_limit, p_offset)` / `dsales_outreach_batch(p_batch)` — ความคืบหน้า (หัวหน้าเห็นทุกชุด)
- `dsales_outreach_cancel(p_ids uuid[])` — ยกเลิกรายการ `queued` ของตัวเอง (หัวหน้ายกเลิกได้ทุกรายการ)
- `dsales_worker_status_get()` และ `dsales_worker_settings_set(p_interval, p_line_cap, p_test_mode, p_test_ms_ids)` (หัวหน้า)

**worker (user_id ต้องอยู่ใน `worker_user_ids`)**
- `dsales_worker_claim(p_worker text)` — คืนรายการถัดไปหรือว่าง: ข้ามถ้ายังไม่ครบ `worker_interval_seconds` นับจาก `sent_at` ล่าสุด · เลือกแบบสลับระหว่างเซลล์ (เซลล์ที่ได้ส่งล่าสุดนานที่สุดก่อน) · `for update skip locked` · เคารพ `outreach_test_mode` และ `line_monthly_cap` · ตั้ง `sending`, `locked_at`, `attempts + 1`
- `dsales_worker_report(p_id, p_status, p_error, p_jst_msg_id)` — `sent` → ตั้ง `sent_at` และเขียน `dsales_interactions` (type `chat`, result `ส่งข้อความผ่าน worker`, `outreach_id`) · `failed` → เก็บเหตุผล · `requeue` → กลับเป็น `queued` (ลองใหม่ ≤ 3 ครั้ง)
- `dsales_worker_heartbeat(p_worker, p_state, p_session_ok, p_last_error)`
- รายการ `sending` เกิน 10 นาที ถูกคืนเป็น `queued` ตอน `dsales_worker_claim` ครั้งถัดไป (ไม่ใช้ pg_cron เพิ่ม) · worker ตรวจข้อความในห้องก่อนส่งซ้ำ · ส่งได้ทีละรายการทั้งระบบ (ไม่มี 2 รายการ `sending` พร้อมกัน)

`dsales_interactions` เพิ่มคอลัมน์ `outreach_id uuid null` (มีใน spec หลักอยู่แล้ว)

### 4.4 การเลือกห้องแชต (ใน preview/enqueue)
จาก `dsales_chat_links` ของเบอร์นั้น → ห้องใน `iim_sessions` ที่เพจตรงแบรนด์ของ template → เรียง LINE ก่อน แล้ว Shopee/Lazada แล้ว Facebook/Instagram → ภายในช่องทางเดียวกันเอาห้องที่มีข้อความล่าสุดใหม่สุด · ไม่มีห้อง = ข้าม (`no_chat_room`)

เพจ → แบรนด์ (`dsales_settings.page_brand_map`, จากห้องที่ผูกเบอร์แล้วจริง 2026-11-20):
- **bebeplay**: `Bebeplay` (Facebook, Instagram), `Bebeplayofficial`, `bebeplayspace` (LINE), `SH_bebeplay`, `LA_bebeplay`
- **hosttail**: `HostTail คอกหมา บ้านแมว ของใช้สัตว์เลี้ยง` (Facebook), `Hosttail แหล่งรวมเฟอร์นิเจอร์สัตว์เลี้ยง🧡` (Instagram), `Host Tail` (LINE), `SH_hosttail`, `LA_hosttail`, `TT_hosttail`
- เพจอื่น (Bebekim, Bebeshop, Mothery, Playtimes, …) ไม่อยู่ในแบรนด์ของระบบนี้ → ไม่ใช้ส่ง

**ช่วงส่งได้ของ Facebook/Instagram (และ Lazada):** แพลตฟอร์มให้ร้านส่งได้เฉพาะภายในช่วงเวลาหลังลูกค้าทักมาล่าสุด (FB/IG 24 ชม.) ห้องที่ผูกเบอร์แล้วส่วนใหญ่เป็น Facebook (Bebeplay 839, HostTail 428 จาก ~2,300 ห้อง) และลูกค้าเก่าส่วนมากเงียบเกิน 24 ชม. → preview ข้ามห้อง FB/IG ที่ข้อความฝั่งลูกค้าล่าสุด (`dsales_chat_messages_v`) เกิน 24 ชม. ล่วงหน้า (`window_closed`) และเลือกช่องทางอื่นของลูกค้าคนเดียวกันแทนถ้ามี · worker ตรวจ `is_expired` ซ้ำก่อนส่งทุกครั้ง · ผลที่คาด: ช่วงแรกส่งได้จริงส่วนใหญ่ทาง LINE / Shopee / Lazada

## 5. Worker (`tools/jst-worker/`, Node.js 24, ไม่มี Playwright)

```
tools/jst-worker/
  worker.mjs        ลูปหลัก
  jst-client.mjs    คุยกับ JST ผ่าน HTTP (fetch + cookie jar)
  queue-client.mjs  คุยกับ Supabase ด้วย supabase-js (ล็อกอิน dev@mpdgroup.co)
  import-session.mjs ล็อกอินด้วยมือเมื่อ JST ขอ captcha (Playwright เฉพาะไฟล์นี้)
  config.example.json  (config.json อยู่นอก git: รหัสผ่าน JST/Supabase, worker_id)
  *.test.mjs        node --test
```

**`jst-client`** (แต่ละฟังก์ชันตรวจรูปแบบ response — field หาย/ผิดชนิด → โยน `ShapeError`)
- `login()` — GET หน้าล็อกอิน → อ่าน public key → `IsNeedCaptcha` (= `1` → โยน `CaptchaRequired`) → เข้ารหัสรหัสผ่านด้วย `crypto.publicEncrypt` (RSA_PKCS1_PADDING) + pad 256 ไบต์ → POST ล็อกอิน → เก็บ cookie ลง `.session.json` บนเครื่อง
- `room(msId)` — `getSessions` แบบ precise → `{msId, chatAccountId, provider, page, name, expired}`
- `recentMessages(msId)` — `getMsgs` ล่าสุด
- `send(room, text)` — `SendMsg` → `{jstMsgId?}` · session หลุด (redirect ไปหน้าล็อกอิน/401) → โยน `SessionExpired`

**ลูปหลัก**
1. heartbeat ทุก 60 วินาที (state, session_ok, sent_last_hour, last_error)
2. ทุก 5 วินาที: `claim` → ไม่มีงาน = รอ
3. ได้งาน: `room(ms_id)` → ชื่อห้อง/เพจไม่ตรงกับที่คิวบันทึกไว้ = `failed: room_mismatch` · `expired` = `failed: window_closed`
4. ถ้า `attempts > 1`: `recentMessages` มีข้อความเดียวกันจากฝั่งเราหลัง `enqueued_at` แล้ว = รายงาน `sent` โดยไม่ส่งซ้ำ
5. `send` → `report sent` · error ของ JST → `requeue` (ครบ 3 ครั้ง = `failed` + ข้อความ JST)

**กรณีผิดพลาด**
| เหตุการณ์ | การทำงาน |
|---|---|
| `SessionExpired` | `login()` ใหม่ ≤ 3 ครั้ง/ชม. แล้วทำงานต่อ |
| `CaptchaRequired` หรือล็อกอินไม่ผ่าน 3 ครั้ง | state `needs_login` หยุดส่ง (คิวไม่หาย) · ผู้ใช้ล็อกอินเองในหน้าต่าง Chrome ด้วย `node import-session.mjs` (Playwright ใช้เฉพาะคำสั่งนี้: เปิดหน้าล็อกอิน รอผู้ใช้ล็อกอิน แล้วบันทึก cookie ลง `.session.json`) แล้ว worker ทำงานต่อเอง · ไม่พยายามผ่าน captcha |
| `ShapeError` | state `stopped` + รายละเอียด — ต้องให้ dev ตรวจก่อนเปิดใหม่ |
| ล้มเหลวติดกัน 5 รายการ | state `paused` 15 นาที แล้วลองใหม่ |
| Supabase ใช้ไม่ได้ | รอแล้วลองใหม่ (backoff) ไม่ส่ง JST ถ้ารายงานผลไม่ได้ |

ความลับ: รหัสผ่าน JST และ Supabase อยู่ใน `config.json` บนเครื่อง worker เท่านั้น (gitignore) · log ไม่เก็บรหัสผ่าน cookie หรือ header

## 6. หน้าเว็บ (หน้าตาใช้คลาสของ prototype: `panel`, `list-row`, `btn`, `chip`, popup เดิม)

1. **ลูกค้าของฉัน / ถังกลาง** (`BasePage`): คอลัมน์ติ๊กหน้าแถว (ไม่มีห้องแชต = ติ๊กไม่ได้ + tooltip "ยังไม่รู้ห้องแชต") · แถบลอยด้านล่าง "เลือก N คน · ส่งข้อความ" · ข้ามหน้าแล้วยังจำที่เลือกไว้ · สูงสุด 50
2. **popup ส่งข้อความ**: เลือก template ของแบรนด์ → เรียก `dsales_outreach_preview` → ตัวอย่างข้อความรายคน + รายการที่จะถูกข้ามพร้อมเหตุผล → "ส่ง N รายการ" → toast + ลิงก์ไปหน้าความคืบหน้า
3. **หน้า `/outreach` "ส่งข้อความ"** (เมนูใหม่ใต้ "ฐานลูกค้าเก่า"): รายการชุด (เวลา, template, ส่งแล้ว/รอ/ไม่สำเร็จ) → รายละเอียดรายคน (สถานะ, เวลาส่ง, เหตุผล, ปุ่มยกเลิกรายการที่รอ, ปุ่ม "โทร" / "Meta Inbox" สำหรับ `window_closed`) · โหลดใหม่ทุก 10 วินาทีเฉพาะตอนหน้าเปิดและมีรายการรอ
4. **ตั้งค่า (หัวหน้า)**: การ์ด **Template** (สร้าง/แก้/ปิด ต่อแบรนด์ พร้อมตัวอย่างการแทนตัวแปร) · การ์ด **Worker** (ออนไลน์ = heartbeat < 3 นาที, session JST, state, ส่งชั่วโมงนี้, คิวรอ, error ล่าสุด, ตั้ง interval / เพดาน LINE / โหมดทดสอบ + ห้องทดสอบ)
5. ตัวแปร template: `{ชื่อ}` (ชื่อลูกค้า), `{สินค้าล่าสุด}` (ชื่อสินค้าบิลล่าสุดของแบรนด์นั้น), `{ร้าน}` (ชื่อเพจของห้องที่ส่ง) · ค่าว่าง = แทนด้วยข้อความว่าง และ preview เตือน

## 7. ความปลอดภัย

- RPC ของ worker ตรวจ `auth.uid()` อยู่ใน `worker_user_ids` · RPC ของเว็บตรวจ `dsales_uid()` (สมาชิก active) และสิทธิ์หัวหน้าตามเดิม · ตารางใหม่ไม่ grant ให้ `authenticated`/`anon` (เข้าผ่าน RPC เท่านั้น)
- **โหมดทดสอบเปิดเป็นค่าเริ่ม** — ส่งได้เฉพาะห้องใน `outreach_test_ms_ids` จนผู้ใช้ปิดเองในหน้าตั้งค่า
- worker ไม่แตะตารางอื่นของบริษัท ไม่ใช้ service_role
- ความเสี่ยงที่ทีมยอมรับ: endpoint ภายในของ JST อาจเปลี่ยน (worker หยุดเองเมื่อรูปแบบเปลี่ยน) · ข้อความทั้งหมดส่งในนาม User Dev และ JST อาจบันทึก User Dev เป็นผู้ดูแลห้อง · รหัสผ่าน `dev@mpdgroup.co` และ User Dev อยู่บนเครื่อง worker

## 8. การทดสอบ

- **DB (TDD ทุก migration: test ล้มก่อน → dry-run ใน transaction → apply → regression ทีละไฟล์)**: preview/enqueue (เพดาน 50, จองจากถังกลาง, ข้าม taken/no_call/no_chat_room, ไม่มี template = error), claim (interval, สลับเซลล์, skip locked, test mode, เพดาน LINE), report (sent เขียน interactions, requeue ≤ 3), cancel (เฉพาะ queued, ของตัวเอง), สิทธิ์ (เซลล์เรียก RPC worker ไม่ได้, ผู้ที่ไม่อยู่ใน worker_user_ids เรียกไม่ได้)
- **worker**: `jst-client` กับ fixture จากขั้น 0 (เข้ารหัสรหัสผ่าน, captcha, session หลุด, ShapeError) · ลูปหลักด้วยตัวปลอม (room mismatch, expired, กันส่งซ้ำ, ล้มเหลวติดกัน 5 ครั้ง, Supabase ล่ม)
- **เว็บ**: unit test (การเลือก, preview, สถานะ) + e2e โหมด fixture (ติ๊กเลือก, popup, หน้า /outreach, การ์ดตั้งค่า) — หน้าใหม่ไม่มีใน prototype จึงใช้ baseline ของแอปเอง
- **ทดสอบจริงบนเครื่อง dev**: โหมดทดสอบ + ห้องของผู้ใช้ → ส่งชุด 1–2 รายการ → วัด `sent_at - enqueued_at` และเวลาที่ถึงมือถือ → ผู้ใช้ยืนยัน → ปิดโหมดทดสอบ (ผู้ใช้ทำเอง)

## 9. ลำดับงาน (แผนแยกตอนเขียน plan)

0. เก็บข้อมูลจริง (ข้อ 3) · 1. migration + test DB · 2. `jst-client` + fixture · 3. worker loop · 4. หน้าเว็บ (template, ติ๊กเลือก + popup, /outreach, การ์ด worker) · 5. ทดสอบจริงบนเครื่อง dev · 6. deploy (ถามผู้ใช้) · 7. ย้ายไปเครื่อง worker ที่ออฟฟิศ

**สิ่งที่ผู้ใช้ต้องทำเอง**: ล็อกอิน JST ในขั้น 0 · ใส่รหัสผ่าน User Dev และ `dev@mpdgroup.co` ใน `config.json` ของ worker · บอกชื่อห้องแชตของตัวเองใน JST · อนุมัติก่อน apply migration และก่อน push/deploy ทุกครั้ง
