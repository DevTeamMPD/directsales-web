# JST Outreach Worker

ดึงงานส่งข้อความจาก Supabase (`dsales_worker_claim`) แล้วส่งแชตผ่าน endpoint ภายในของเว็บ JST (`/iim/SendMsg`) ด้วย HTTP ล้วน **ไม่ใช้ Playwright ในการส่ง** · รันบนเครื่องที่เปิด 24 ชม.

- สเปก: `docs/superpowers/specs/2026-11-20-jst-outreach-worker-design.md` §5, §7
- สัญญา RPC / endpoint JST: `docs/superpowers/plans/2026-11-20-outreach-contract.md`

| ไฟล์ | หน้าที่ |
|---|---|
| `worker.mjs` | ลูปหลัก (CLI) |
| `worker-core.mjs` | ตรรกะลูป (ไม่มี I/O ของตัวเอง มี test) |
| `jst-client.mjs` | คุยกับ JST ผ่าน fetch + cookie jar (`.session.json`) |
| `queue-client.mjs` | คุยกับ Supabase schema `dsales` ด้วยบัญชี worker |
| `import-session.mjs` | ดึง cookie JST จากโปรไฟล์ Chrome (Playwright ใช้เฉพาะไฟล์นี้) |

## ติดตั้ง (Windows, Node 20+)
```powershell
cd tools\jst-worker
npm install
copy config.example.json config.json
```
ต้องมี Google Chrome ในเครื่อง (ใช้กับ `import-session.mjs` เท่านั้น)

## ตั้งค่า `config.json` (อยู่นอก git — ห้าม commit/แชร์)
ค่าที่เว้นว่างใน `config.json` worker จะเติมจาก environment หรือ `.env.local` ที่รากโปรเจกต์ (นอก git): `JST_USER`, `JST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DSALES_WORKER_EMAIL`, `DSALES_WORKER_PASSWORD`

| ค่า | ความหมาย |
|---|---|
| `workerId` | ชื่อเครื่อง worker (แสดงในการ์ด Worker หน้าตั้งค่า) |
| `pollSeconds` | ตรวจคิวทุกกี่วินาทีเมื่อไม่มีงาน (ค่าเริ่ม 5) |
| `linkSync` | ผูกห้องแชตด้วยรหัสผู้ซื้อตอนไม่มีงานส่ง (ค่าเริ่ม `true`) — เครื่องสำรองที่รันพร้อมกันให้ตั้ง `false` |
| `jst.baseUrl` | `https://asia-web.jsterp.com` (รับเฉพาะ `https://*.jsterp.com`) |
| `jst.accountId` / `jst.password` | บัญชี JST กลาง (User Dev) — **เว้นว่างได้** ถ้าจะใช้ session จาก `import-session.mjs` อย่างเดียว (worker จะล็อกอินเองไม่ได้ เมื่อ session หลุดจะเข้า `needs_login`) |
| `supabase.url` / `supabase.anonKey` | โปรเจกต์ Supabase + publishable key (ค่าเดียวกับ `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `supabase.email` / `supabase.password` | บัญชี worker (ต้องอยู่ใน `worker_user_ids` ของ `dsales_settings`) |

## เริ่มใช้งาน
1. **นำ session JST เข้า** (ครั้งแรก หรือเมื่อ JST ขอ captcha)
   ```powershell
   node import-session.mjs            # ใช้โปรไฟล์ ..\jst-worker-spike\.profile ที่ล็อกอินไว้แล้ว
   node import-session.mjs --login    # เปิดหน้าต่าง Chrome ให้ล็อกอิน JST เอง แล้วบันทึก
   node import-session.mjs --profile C:\path\to\profile
   ```
   ได้ไฟล์ `.session.json` (cookie ของ JST = มีค่าเท่ารหัสผ่าน) · ปิดสคริปต์อื่นที่ใช้โปรไฟล์เดียวกันก่อน (เช่น `probe.mjs` ของ spike)
2. **ทดลองหนึ่งงาน**: `node worker.mjs --once` (ทำงานไม่เกิน 1 รายการแล้วออก)
3. **รันจริง**: `node worker.mjs` (กด Ctrl+C = ทำงานที่ค้างให้จบ ส่ง heartbeat `stopped` แล้วออก · กดซ้ำ = ออกทันที)

ให้เปิดโหมดทดสอบในหน้าตั้งค่าไว้ก่อนเสมอ (ค่าเริ่ม): ทุกงานจะถูกส่งไป "ห้องทดสอบ" (`target_ms_id`) พร้อมคำนำหน้า `[ทดสอบ → ชื่อลูกค้า]` แทนห้องลูกค้าจริง

## การทำงานต่องาน
1. `claim` → ไม่มีงาน = รอ `pollSeconds`
2. หาห้องด้วย `getSessions` (precise ตาม `target_ms_id`) → ไม่พบ = `failed: room_not_found`
3. โหมดปกติ: ชื่อห้องไม่ตรง `chat_name` = `failed: room_mismatch` (โหมดทดสอบข้ามข้อนี้)
4. ห้องหมดช่วงส่ง (`is_expired`) = `failed: window_closed`
5. ถ้าเป็นการลองซ้ำ (`attempts > 1`): `getMsgs` มีข้อความเดียวกันจากฝั่งเราหลังเวลาเข้าคิว = รายงาน `sent` โดยไม่ส่งซ้ำ
6. `SendMsg` → `sent` · JST ตอบ error = `requeue` (`jst_error: …`, ครบ 3 ครั้งฐานข้อมูลตั้ง `failed` เอง)

## สถานะ (`state` ใน heartbeat ทุก 60 วินาที)
| state | เกิดเมื่อ | ทำอย่างไร |
|---|---|---|
| `running` | ปกติ | — |
| `paused` | ล้มเหลวติดกัน 5 รายการ | พัก 15 นาทีแล้วลองใหม่เอง |
| `needs_login` | session หลุดแล้วล็อกอินใหม่ไม่ได้ (JST ขอ captcha / รหัสผิด / ไม่ได้ใส่รหัส / ล็อกอินเกิน 3 ครั้งใน 1 ชม.) | รัน `node import-session.mjs --login` — worker เห็นไฟล์ `.session.json` เปลี่ยนแล้วทำงานต่อเอง (หรือรีสตาร์ท worker) · งานในคิวไม่หาย |
| `stopped` | รูปแบบ response ของ JST/คิวเปลี่ยน (`ShapeError`) หรือกด Ctrl+C | หยุดส่งทันที (ยังส่ง heartbeat) — ให้ dev ตรวจ log แล้วรีสตาร์ทเอง **อย่าตั้งให้รีสตาร์ทอัตโนมัติ** |

## ผูกห้องแชตด้วยรหัสผู้ซื้อ (link sync)
ตอนไม่มีงานส่ง worker ค้นห้องใน JST ด้วย "รหัสผู้ซื้อออนไลน์" (`getSessions` + `query_type: 'outer_user_id'`) ทีละ 1 รหัส ทุก 1.5 วินาที
- รหัสมาจาก `dsales_worker_link_targets` (= `order_tracking.buyer_account_no` ของลูกค้าในฐาน: LINE userId / FB PSID / Shopee, Lazada buyer id) ที่ยังไม่เคยค้นก่อน (มูลค่าสูงก่อน) แล้วค่อยค้นซ้ำทุก 14 วัน · รหัสที่สั่งซื้อด้วยเบอร์มากกว่า 3 เบอร์ (ตัวแทน/พนักงาน) ไม่ถูกผูก
- ผล → `dsales_worker_link_save`: เก็บห้องใน `dsales_jst_rooms` และผูก `dsales_chat_links` (`method = 'buyer_id'`) เฉพาะห้องที่ `outer_user_id` ตรงทุกตัวอักษร
- งานส่งมาก่อนเสมอ (ตรวจคิวทุกรอบก่อนค้น) · ไม่มีรหัสเหลือ = ถามใหม่ทุก 30 นาที · JST หรือ RPC ผูกห้องตอบ error = พักการค้น 5 นาที (ไม่กระทบการส่ง — อัปเดตโค้ดก่อนลง migration ก็ยังส่งได้) · response รูปแบบไม่คาด = ปิดการค้นจนกว่าจะรีสตาร์ท (การส่งทำต่อ)
- log: บรรทัด `link` เมื่อผูกได้ และสรุปทุก 25 รหัส (ไม่มีรหัส/ชื่อลูกค้าใน log)

Supabase ใช้ไม่ได้ → รอแล้วลองใหม่ (5 → 10 → … → 60 วินาที) และ **ไม่ส่ง JST** ระหว่างนั้น · ถ้าส่งแล้วแต่รายงานผลไม่ได้ worker จะเก็บผลไว้และรายงานให้ได้ก่อนรับงานใหม่

## ความปลอดภัย
- `config.json`, `.session.json`, `logs/` อยู่ใน `.gitignore` — ห้าม commit/แชร์
- รหัสผ่าน/cookie ส่งไปที่ `asia-web.jsterp.com` เท่านั้น · log (`logs/worker-YYYY-MM-DD.jsonl`) ไม่เก็บรหัสผ่าน cookie header หรือเนื้อความข้อความ (เก็บแค่ id รายการ, `target_ms_id`, ผล)
- worker ไม่ใช้ service_role และเรียกเฉพาะ RPC `dsales_worker_*`
- ไม่พยายามผ่าน captcha — ให้คนล็อกอินเองด้วย `import-session.mjs --login`
- ข้อความทั้งหมดส่งในนาม User Dev ของ JST

## ทดสอบ (ไม่มี network)
```powershell
node --test
```
