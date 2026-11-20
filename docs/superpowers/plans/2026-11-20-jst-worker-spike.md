# JST Worker — ต้นแบบ (spike) บนเครื่อง worker

> ทำในวันที่ผู้ใช้เข้าออฟฟิศ บนเครื่อง worker ที่เปิด 24 ชม. · โค้ดอยู่ที่ `tools/jst-worker-spike/` (เตรียมไว้แล้ว 2026-11-20)
> เป้าหมาย: พิสูจน์ก่อนลงทุนทำ worker เต็มระบบ (เฟส 3 ใน `docs/superpowers/specs/2026-11-17-direct-sale-design.md` §10) ว่า Playwright + บัญชี JST กลาง (User Dev) ส่งข้อความหาลูกค้าได้จริงช่องทางไหนบ้าง และ session อยู่ได้นานแค่ไหน
> **ห้ามส่งหาลูกค้าจริงใน spike นี้** ส่งได้เฉพาะห้องแชตทดสอบของพนักงานที่อยู่ใน allowlist (`testChats` ใน `config.json`)

## คำถามที่ spike ต้องตอบ

| # | คำถาม | วัดอย่างไร |
|---|---|---|
| Q1 | Playwright ล็อกอิน JST ด้วย User Dev แล้วเก็บ session ไว้ใช้ซ้ำได้ไหม (มี OTP/captcha ไหม) | `login.mjs` แล้ว `check.mjs` แบบ headless |
| Q2 | session อยู่ได้นานแค่ไหนโดยไม่ต้องล็อกอินใหม่ | `probe.mjs` ทุก 30 นาที อย่างน้อย 24–72 ชม. |
| Q3 | เปิดห้องแชตตามชื่อ/ms_id ได้แม่นไหม | `open-chat.mjs` กับห้องทดสอบ |
| Q4 | ส่งข้อความจริงได้ช่องทางไหน (LINE / Shopee / Lazada / Facebook / IG) และถ้าไม่ได้ JST แสดงอะไร | `send-test.mjs --confirm` ห้องทดสอบละ 1 ข้อความ |
| Q5 | payload จริงของ `/iim/SendMsg` เป็นอย่างไร (เผื่อเฟส 3 ส่งผ่าน API แทนการคลิก) | `send-test.mjs` บันทึก request/response ลง `logs/` (ไม่เก็บ header/cookie) |
| Q6 | ใช้บัญชีเดียวกันล็อกอินพร้อมกันหลายที่ (worker + แอดมินในออฟฟิศ) แล้วมีอะไรหลุดไหม | ระหว่าง Q2 ให้แอดมินใช้ User Dev ตามปกติ แล้วดู log |

## สิ่งที่รู้แล้ว (ตรวจจากหน้า JST จริง 2026-11-19/20 แบบอ่านอย่างเดียว)
- หน้าแชต `https://asia-web.jsterp.com/iim/index` (Vue 2) — URL รับแค่ `pageType`, `chatAccountId` ไม่มีลิงก์ตรงเข้าห้อง
- ค้นหา: ช่องค้นหาใน `.panel_contacts-filter` (`div.j-input > input`) + Enter (keyup) · ประเภทการค้นหาตัวแรก = Buyer Name · ค้นหาแล้ว JST เปิดห้องแรกให้เอง
- รายการห้อง: `#session li[data-ms-id]`, ห้องที่เปิดอยู่มี class `active`, ห้องที่หมดช่วงส่งได้ (เช่น FB/IG เกิน 24 ชม.) มี class `isExpired`
- ช่องพิมพ์ `.chat-input textarea.j-textarea` (สูงสุด 4000 ตัวอักษร) · ปุ่มส่ง `.chat-input button.j-primary`
- ส่งข้อความ: `POST /iim/SendMsg` (`ms_id`, `chat_account_id`, `content`, `send_message_to_buyer_type: "ChatAccount"`, …) และมี `POST /iim/BatchSendMsg` (`{ requestModel }`) ในตัว · ก่อนส่ง JST ตรวจ `isChatAccountAuthorized` (บัญชีแชตต้องเชื่อมสิทธิ์อยู่)
- เปิดห้อง = JST เรียก `setSupportStaff` (บันทึกบัญชีที่ล็อกอินเป็นผู้ดูแลห้อง) — worker ที่ใช้ User Dev จะทำให้ห้องที่ส่งขึ้นผู้ดูแลเป็น User Dev

## เตรียมก่อนวันเข้าออฟฟิศ
- [ ] เครื่อง worker: Windows, เปิดค้างได้, เน็ตเสถียร, ติดตั้ง [Node.js 24](https://nodejs.org)
- [ ] บัญชี JST "User Dev" (ผู้ใช้ล็อกอินเอง — Claude ไม่พิมพ์รหัสผ่าน)
- [ ] ห้องแชตทดสอบของพนักงาน อย่างน้อย LINE 1 ห้อง (เช่น LINE ส่วนตัวที่แอด OA Bebeplayofficial แล้วทักมา 1 ครั้ง) ถ้าได้ Shopee / Facebook อย่างละ 1 ยิ่งดี — จด `ms_id` ของแต่ละห้อง (เปิดห้องใน JST แล้วดู `data-ms-id` หรือรัน `open-chat.mjs` ซึ่งพิมพ์ ms_id ให้)

## ทดสอบบนเครื่อง dev แล้ว (2026-11-20)
- `login.mjs` (Chrome ที่ติดตั้งในเครื่อง, `channel: "chrome"`): ผู้ใช้ล็อกอิน User Dev เอง ไม่มี OTP/captcha → `logged_in: true`, 31 ห้อง
- `check.mjs` แบบ headless ใช้ session ซ้ำได้ (2.3 วินาที)
- Chromium ของ Playwright แบบมีหน้าต่างเปิดไม่ได้บนเครื่องนี้ (`spawn UNKNOWN`) จึงตั้ง `channel: "chrome"` เป็นค่าเริ่ม

## ขั้นตอนวันเข้าออฟฟิศ (ประมาณ 1–2 ชม. + ปล่อย probe ทิ้งไว้)

- [ ] **Step 1: ติดตั้ง** — คัดลอกโฟลเดอร์ `tools/jst-worker-spike` ไปไว้ที่เครื่อง worker เช่น `C:\jst-worker-spike`
  ```powershell
  cd C:\jst-worker-spike
  npm install
  npx playwright install chromium
  copy config.example.json config.json
  ```
- [ ] **Step 2: ล็อกอิน (Q1)** — `node login.mjs` เปิด Chromium แบบเห็นหน้าจอ ผู้ใช้ล็อกอิน JST ด้วย User Dev เอง สคริปต์รอจนเห็นรายการแชตแล้วบันทึก session ไว้ใน `.profile/` (ห้าม commit / ห้ามแชร์โฟลเดอร์นี้ = เท่ากับรหัสผ่าน)
- [ ] **Step 3: ตรวจ session แบบ headless** — `node check.mjs` ต้องได้ `logged_in: true` และจำนวนห้อง > 0
- [ ] **Step 4: เปิดห้องทดสอบ (Q3)** — `node open-chat.mjs --chat "<ชื่อห้องทดสอบ>"` พิมพ์ `ms_id`, ชื่อ, ช่องทาง, `expired` → ใส่ `ms_id` ลง `testChats` ใน `config.json`
- [ ] **Step 5: dry-run** — `node send-test.mjs --ms <ms_id> --text "ทดสอบระบบ Direct Sale"` (ไม่ใส่ `--confirm`) ต้องเปิดห้องถูก พิมพ์ข้อความลงช่อง แล้วลบออก ไม่กดส่ง
- [ ] **Step 6: ส่งจริงไปห้องทดสอบ (Q4, Q5)** — ถามผู้ใช้ก่อนทุกครั้ง แล้ว `node send-test.mjs --ms <ms_id> --text "ทดสอบระบบ Direct Sale" --confirm` ช่องทางละ 1 ข้อความ ผลที่ต้องจด: ส่งสำเร็จไหม (ข้อความถึงมือถือผู้ทดสอบไหม), สถานะใน `getMsgs`, ข้อความ error ของ JST, ไฟล์ `logs/send-*.json`
- [ ] **Step 7: ปล่อย probe (Q2, Q6)** — `node probe.mjs` ทิ้งไว้ (ทุก 30 นาที เขียน `logs/session-probe.jsonl`) อย่างน้อย 24 ชม. ระหว่างนั้นแอดมินใช้ User Dev ตามปกติ
- [ ] **Step 8: สรุปผล** — กรอกตารางด้านล่าง แล้วตัดสินใจรูปแบบ worker เฟส 3

## ผลลัพธ์ (กรอกวันทดสอบ)

| ช่องทาง | ms_id ทดสอบ | ส่งสำเร็จ? | ถึงมือถือ? | error / หมายเหตุ |
|---|---|---|---|---|
| LINE | | | | |
| Shopee | | | | |
| Facebook | | | | |
| Lazada / IG / TikTok | | | | |

- Q1 ล็อกอิน: OTP/captcha? ______
- Q2 session อยู่ได้: ______ ชม. (ดู `logs/session-probe.jsonl` ครั้งแรกที่ `logged_in: false`)
- Q5 payload `SendMsg`: แนบ `logs/send-*.json` (ตรวจว่าไม่มี cookie ก่อนแชร์)
- Q6 ล็อกอินซ้อน: ______

## เกณฑ์ตัดสิน
- **ไปต่อเฟส 3 แบบคลิกผ่านหน้าจอ** ถ้า LINE ส่งสำเร็จ และ session อยู่ได้ ≥ 24 ชม. (หรือล็อกอินใหม่ได้โดยไม่มี OTP)
- **พิจารณาส่งผ่าน `/iim/SendMsg` ตรง** (เร็วกว่า ไม่ต้องเปิดห้อง ไม่เปลี่ยนผู้ดูแลห้อง) ถ้า payload จาก Q5 ชัดและเสถียร — ต้องให้ผู้ใช้ยืนยันความเสี่ยงอีกครั้ง
- **หยุด/ทบทวน** ถ้าต้องล็อกอินใหม่ทุกไม่กี่ชั่วโมงด้วย OTP หรือ LINE ส่งไม่ได้

## ความปลอดภัยของ spike
- ส่งได้เฉพาะ `ms_id` ใน `testChats` และต้องมี `--confirm` — ไม่มีโหมดส่งหลายห้อง
- `.profile/` (session JST) และ `logs/` อยู่ใน `.gitignore` · log ไม่เก็บ header/cookie
- ไม่แตะ Supabase เลยใน spike นี้
