# Outreach — สัญญาระหว่าง DB / worker / เว็บ (ใช้ร่วมกันใน D1, D2, D3)

> อ้างอิง: spec `docs/superpowers/specs/2026-11-20-jst-outreach-worker-design.md`, แผน DB `2026-11-20-outreach-d1-capture-db.md`
> ไฟล์นี้คือข้อตกลงกลาง ถ้าส่วนไหนต้องเปลี่ยน signature ให้แก้ไฟล์นี้ก่อน

## 1. การเปลี่ยนจากแผน D1 (ตัดสิน 2026-11-20 เพื่อให้ผู้ใช้ทดลองเองได้ปลอดภัย)

**โหมดทดสอบ = ส่งไปห้องทดสอบแทน (redirect)** แทน "พักงานที่ไม่อยู่ในรายการ":
- `outreach_test_mode = true` และ `outreach_test_ms_ids` มีอย่างน้อย 1 ห้อง → `dsales_worker_claim` คืนงานตามปกติ แต่ `target_ms_id` = ห้องทดสอบห้องแรก และ `message` = `"[ทดสอบ → " + coalesce(chat_name, phone) + "] " + message_text`
- โหมดทดสอบแต่ไม่มีห้องทดสอบ → claim คืน `null` (ไม่ส่งอะไร)
- คิวเก็บ `test_redirect boolean` และ `target_ms_id bigint` ตอน claim
- `dsales_worker_report(… 'sent' …)` ของรายการ `test_redirect` → ตั้ง `sent` แต่**ไม่**เขียน `dsales_interactions` และไม่เปลี่ยนสถานะลีด
- โหมดปกติ: `target_ms_id = ms_id`, ข้อความไม่มีคำนำหน้า

**RPC เพิ่ม: `dsales_worker_find_rooms(p_query text) → jsonb`** (หัวหน้าเท่านั้น) ค้นห้องใน `public.iim_sessions` ด้วยชื่อลูกค้า (ไม่สนตัวพิมพ์, ขึ้นต้น/มีคำนั้น) สูงสุด 20 ห้อง เรียงข้อความล่าสุด → `[{ms_id, customer, channel, page, last_time}]` ใช้ในการ์ด Worker เลือก "ห้องทดสอบ" · คำค้นสั้นกว่า 2 ตัวอักษร → `[]`

## 2. RPC (schema `dsales`, เรียกผ่าน `db().rpc(name, args)` ของ supabase-js ที่ตั้ง `db: { schema: 'dsales' }`)

error เป็นข้อความ token (เช่น `forbidden`) ให้เว็บแปลไทยใน `lib/api/errors.ts` (`ERROR_TEXT`)

### เว็บ (สมาชิก active)
| RPC | args | คืนค่า |
|---|---|---|
| `dsales_templates_list` | `{ p_brand: 'bebeplay'\|'hosttail'\|null }` | `Template[]` — `{id, brand, name, body, active, updated_at}` (sales เห็นเฉพาะ active) |
| `dsales_template_save` | `{ p_id: uuid\|null, p_brand, p_name, p_body, p_active }` | `Template` · errors `forbidden`, `invalid_template`, `not_found` |
| `dsales_outreach_preview` | `{ p_phones: string[], p_template: uuid }` | `PreviewRow[]` — `{phone, name, ms_id, page, provider, chat_name, message, skip}` · `skip` ∈ `customer_not_found`, `taken`, `already_queued`, `no_chat_room`, `window_closed` หรือ `null` · errors `template_not_found`, `batch_too_large` |
| `dsales_enqueue_outreach` | `{ p_phones, p_template }` | `{batch_id, queued, skipped: [{phone, reason}]}` · reason เพิ่ม `no_call`, `claim_failed` |
| `dsales_outreach_batches_mine` | `{ p_limit, p_offset }` | `BatchRow[]` — `{id, created_at, brand, requested_by, template_name, total, skipped (จำนวน), counts: {queued, sending, sent, failed, cancelled}}` (หัวหน้าเห็นทุกชุด) |
| `dsales_outreach_batch` | `{ p_batch }` | `{batch: {id, created_at, brand, template_name, total, skipped: [{phone, reason}], requested_by}, items: [{id, phone, lead_id, ms_id, page, provider, chat_name, message, status, attempts, error, enqueued_at, sent_at}]}` · errors `not_found`, `forbidden` |
| `dsales_outreach_cancel` | `{ p_ids: uuid[] }` | `number` (จำนวนที่ยกเลิก — เฉพาะ `queued`) |
| `dsales_worker_status_get` | `{}` | `{workers: [{worker_id, state, jst_session_ok, heartbeat_at, online, sent_last_hour, queue_waiting, last_error}], queue: {queued, sending, sent_last_hour, line_sent_this_month}, settings: {interval_seconds, line_monthly_cap, test_mode, test_ms_ids: number[], max_batch}}` |
| `dsales_worker_settings_set` | `{ p_interval, p_line_cap, p_test_mode, p_test_ms_ids: number[] }` | เหมือน `dsales_worker_status_get` · errors `forbidden`, `invalid_setting` (interval 5–3600, cap ≥ 0) |
| `dsales_worker_find_rooms` | `{ p_query }` | `[{ms_id, customer, channel, page, last_time}]` · error `forbidden` |

`state` ∈ `running`, `paused`, `needs_login`, `stopped` · `online` = heartbeat ไม่เกิน 3 นาที · `status` ของรายการ ∈ `queued`, `sending`, `sent`, `failed`, `cancelled` · `error` ที่ worker ใช้: `room_mismatch`, `window_closed`, `jst_error: <ข้อความ JST>`, `stale_sending`

### worker (`auth.uid()` อยู่ใน `worker_user_ids` = `dev@mpdgroup.co`)
| RPC | args | คืนค่า |
|---|---|---|
| `dsales_worker_claim` | `{ p_worker: string }` | `null` หรือ `{id, ms_id, target_ms_id, test_redirect, page, provider, chat_name, message, attempts, enqueued_at, requested_by}` — **ส่ง `message` ไปที่ `target_ms_id`** |
| `dsales_worker_report` | `{ p_id, p_status: 'sent'\|'failed'\|'requeue', p_error, p_jst_msg_id }` | `void` · errors `not_found`, `invalid_state`, `invalid_status` |
| `dsales_worker_heartbeat` | `{ p_worker, p_state, p_session_ok, p_last_error }` | `void` |
| ทุกตัว | — | error `not_worker` ถ้าไม่ใช่บัญชี worker |

## 3. JST web endpoints (อ่านจากโค้ดหน้าเว็บ JST 2026-11-20 — ยังไม่ได้ยิงจริง ยกเว้น getSessions/getMsgs)

ฐาน `https://asia-web.jsterp.com` · ทุกคำขอ `POST` JSON (`Content-Type: application/json;charset=UTF-8`) พร้อม cookie ของ session · คำตอบ `{success: boolean, data: any, message?: string}` (บางตัว `Success`/`Message`) · session หลุด → HTTP 401 หรือ redirect ไป `/Org/Account/Login/…`

| ทำอะไร | path | body | หมายเหตุ |
|---|---|---|---|
| ขอ public key | `GET /Org/Account/Login/index` | — | HTML มี `publicKey: '<base64 SPKI>'` |
| ต้อง captcha ไหม | `POST /Org/Account/Login/IsNeedCaptcha` | `{accountId, password: '', captchaCode: '', cacheKey, clientIp: '', address: '', policyChecked: true}` | `data == '1'` = ต้อง captcha → หยุด |
| ล็อกอิน | `POST /Org/Account/Login/Login` | `{accountId, password, captchaCode: '', cacheKey, clientIp: '', address: '', clientTimeZone: '', isNeedCaptcha: false, redirectUrl: ''}` | `password` = base64(RSA PKCS#1 v1.5 ด้วย publicKey, ผลลัพธ์ 256 ไบต์) · `cacheKey` = uuid v4 · สำเร็จ = `success: true` + Set-Cookie |
| ห้องตาม ms_id | `POST /iim/getSessions` | `{type: 'Private', query_type: 'name', name: '', order_id: '', chat_account_ids: [], label_codes: [], order_statuses: [], session_statuses: [], is_first_query: false, pull_model: 'old', page_size: 1, max_ts: '<ms now>', min_ts: 0, msg_id: '', ms_id: 0, last_message_time: '', created: [], is_precise_query: true, precise_query_ms_ids: [<ms_id>]}` | `data.data[]` → `{co_id, ms_id, chat_account_id, session_provider, outer_account_name, name, is_expired, outer_user_id}` (ถ้า `is_precise_query: true` ไม่ได้ผล ให้ลอง `false` + `precise_query_ms_ids`) |
| ข้อความล่าสุด | `POST /iim/getMsgs` | `{co_id, ms_id, msg_id: 0, ts: '0', page_size: 20, pull_model: 'old', is_first: true}` | `data[]` → `{msg_id, io_type ('In'/'Out'), msg_content, status, send_time}` |
| ส่งข้อความ | `POST /iim/SendMsg` | `{ms_id, chat_account_id, content, translate_content: '', send_message_to_buyer_type: 'ChatAccount', template_type: 'txt'}` | ยังไม่ได้ยิงจริง — ทดสอบครั้งแรกกับห้องทดสอบของผู้ใช้ |

ห้ามส่งรหัสผ่าน/cookie ไปที่อื่นนอกจาก `asia-web.jsterp.com` · ห้าม log รหัสผ่าน cookie หรือ header
