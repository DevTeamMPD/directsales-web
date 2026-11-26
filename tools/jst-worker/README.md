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
| `session-store.mjs` | ที่เก็บ cookie ของ JST: ไฟล์ `.session.json` (เครื่อง worker) หรือหน่วยความจำ (โหมดรอบ) |
| `tick.mjs` | หนึ่งรอบของ worker บน Vercel: ถือ lease → `worker.tick()` → บันทึกสถานะลง DB |
| `config.mjs` | อ่านค่าตั้งจาก `config.json` / environment / `.env.local` |
| `import-session.mjs` | ดึง cookie JST จากโปรไฟล์ Chrome (Playwright ใช้เฉพาะไฟล์นี้) |
| `run-worker.cmd` | รัน worker แล้วเปิดใหม่เองเมื่อออกด้วย error |
| `install-task.ps1` | ตั้ง task ของ Windows ให้เปิด `run-worker.cmd` ตอนล็อกอิน + ตรวจทุก 15 นาที |

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
| `watchdogMinutes` | ลูปค้างเกินกี่นาทีให้ออกเพื่อเปิดใหม่ (ค่าเริ่ม 10, 0 = ปิด) |
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

4. **รันค้างไว้ถาวร (เครื่อง worker จริง — แนะนำ)**: ติดตั้ง task ของ Windows ครั้งเดียว (ไม่ต้องใช้สิทธิ์ admin)
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-task.ps1 -KeepAwake
   ```
   - task **"JST Outreach Worker"** เปิด `run-worker.cmd` ตอนล็อกอินเครื่อง และตรวจทุก 15 นาที: ถ้า worker ไม่ได้รันอยู่ (ปิดหน้าต่าง/เครื่องหลับแล้วตื่น/แครช) จะเปิดใหม่เอง · ตั้ง WakeToRun ให้ปลุกเครื่องจากโหมดหลับได้
   - `run-worker.cmd` รัน `node worker.mjs` ซ้ำทุกครั้งที่ออกด้วย error (เน็ตหลุด, แครช, watchdog) หลังรอ 30 วินาที · ออกด้วย Ctrl+C = หยุด (task จะเปิดใหม่ภายใน 15 นาที) · ประวัติการเปิด/ปิดอยู่ที่ `logs/supervisor.log`
   - watchdog: ลูปไม่ขยับเกิน `watchdogMinutes` (ค่าเริ่ม 10, ตั้ง 0 = ปิด) worker ออกเอง (exit 3) ให้สคริปต์เปิดใหม่
   - `-KeepAwake` ตั้งเครื่องไม่ให้หลับ/hibernate ตอนเสียบไฟ (สาเหตุหลักที่ worker หายไปเงียบ ๆ)
   - เลิกใช้: `.\install-task.ps1 -Remove` · เมื่อติดตั้ง task แล้วอย่ารัน `node worker.mjs` ซ้อนอีกหน้าต่าง
   - task เริ่มเมื่อมีคนล็อกอินเครื่องเท่านั้น — หลัง Windows Update รีสตาร์ท ต้องล็อกอินเครื่องก่อน (หรือเปิด auto-logon ของ Windows)

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

## ตัวหลักบน Vercel + เครื่องนี้เป็นตัวสำรอง
สเปก: `docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md`

- worker ตัวหลักชื่อ `vercel` รันเป็น route `POST /api/cron/outreach-tick` (logic อยู่ใน `lib/cron/tick-handler.ts`) ที่ pg_cron (`dsales-outreach-tick`) ปลุกทุกนาที — หนึ่งรอบส่งได้ไม่เกิน 1 ข้อความ หรือผูกห้องไม่เกิน 10 รหัส ใช้โค้ดชุดเดียวกับลูปของเครื่องนี้ · request ไป JST หมดเวลา 8 วินาทีบน cloud (เครื่องนี้ 15 วินาที)
- ค่า `worker_primary` ใน `dsales_settings` (ตั้งจากการ์ด Worker หน้าตั้งค่า) บอกว่าใครเป็นตัวหลัก · ตัวที่ไม่ใช่ตัวหลักจะได้ `claim` เป็น `null` และไม่ได้รหัสให้ค้น ตราบที่ตัวหลักยัง `running` และ heartbeat ไม่เกิน 3 นาที — เกินนั้นเครื่องนี้รับงานเอง ไม่ต้องสั่ง
- เครื่องสำรองตั้ง `"pollSeconds": 30` ใน `config.json` (ไม่ต้องถามคิวถี่) ค่าอื่นเหมือนเดิม
- ปิดตัวปลุกชั่วคราว: ตั้ง `worker_tick_enabled` เป็น `false` (ตัวสำรองจะรับช่วงภายใน 3–4 นาที)
- สถานะข้ามรอบของ `vercel` อยู่ในตาราง `dsales_worker_state` และ cookie ของ JST อยู่ใน Supabase Vault (`dsales_jst_session_vercel`) · รอบหนึ่งถือ lease 90 วินาที (ขั้นต่ำ 70 วินาที ต้องยาวกว่า `maxDuration` 60 วินาทีของ route) รอบที่ชนกันจะข้าม (`skipped: busy`)
- route ตอบ 401 ถ้าไม่มี bearer ที่ถูก · 500 `not_configured` เฉพาะเมื่อขาด `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DSALES_WORKER_EMAIL` หรือ `DSALES_WORKER_PASSWORD` (ขาด `JST_USER` / `JST_PASSWORD` ไม่ทำให้ route ล้ม — มีผลเฉพาะตอนต้องล็อกอิน JST ซึ่งจะขึ้นเป็น `needs_login`) · 500 `tick_failed` (+ `kind`; ข้อความ error อยู่ใน log ของ Vercel เท่านั้น ไม่อยู่ใน body เพราะ pg_net เก็บ body ลง `net._http_response`) · 503 เมื่อ Supabase ใช้ไม่ได้ระหว่างรอบ (`result: queue_error`) · ปกติ 200 พร้อม `result`, `links`, `pinged`, `state`, `cookiesSaved`, `region`

### ทดสอบ `node worker.mjs` บนเครื่อง dev (ข้อควรระวัง)
ตราบที่ `worker_primary` ชี้ worker ที่ยังมีชีวิต (ค่าเริ่ม `office-1`) worker id อื่นใด เช่น laptop ของ dev ที่รัน `node worker.mjs` จะ **ไม่ได้งานและไม่ได้รหัสให้ค้นโดยไม่มี error** · ถ้าจะทดสอบในเครื่อง ให้ตั้ง `worker_primary` เป็น `""` (ไม่มีตัวหลัก) หรือเป็น id ของตัวเอง แล้ว **คืนค่าเดิมเมื่อทดสอบเสร็จ** · SQL test ที่ใช้ worker id อื่น (08f, 10, 28) ล้าง `worker_primary` ในขั้นตอนเตรียมเอง

### เมื่อ `vercel` ขึ้น `needs_login` (JST ขอ captcha)
รันจากเครื่องไหนก็ได้ที่มี repo นี้และ Chrome (คำสั่ง `import-session.mjs` ทั้งหมดรันในโฟลเดอร์ `tools/jst-worker`):
```powershell
node import-session.mjs --login --upload vercel
```
ล็อกอิน JST ในหน้าต่างที่เปิดขึ้น สคริปต์จะส่ง cookie ขึ้นฐานข้อมูล แล้ว `vercel` ทำงานต่อในรอบถัดไป (การอัปโหลดจากสถานะ `needs_login` ล้างตัวนับ `failures` / `loginTimes` ด้วย)
- ถ้าโปรไฟล์ล็อกอิน JST ไว้แล้ว ส่งแบบไม่เปิดหน้าต่างได้: `node import-session.mjs --upload vercel`
- สคริปต์ตรวจค่าตั้ง Supabase ก่อนเปิด Chrome (ใช้บัญชี worker จาก `config.json` หรือ `.env.local` ไม่ต้องมี config.json ทั้งไฟล์)
- ถ้า worker กำลังทำรอบอยู่ DB ตอบ `worker_busy` — สคริปต์รอ 10 วินาทีแล้วลองใหม่ได้สูงสุด 11 ครั้ง (รวม 100 วินาที เกิน lease 90 วินาที) ถ้ายังไม่สำเร็จให้รันซ้ำ
- DB ปฏิเสธ cookie ว่าง หรือเกิน 64 KB (`invalid_cookies`)

### เมื่อ `vercel` ขึ้น `stopped`
JST เปลี่ยนรูปแบบ response — ให้ dev ตรวจ log ของ function บน Vercel และแก้โค้ดก่อน แล้วหัวหน้ากด **เริ่มใหม่** บนการ์ด Worker (ไม่มีโปรเซสให้รีสตาร์ท) · การเริ่มใหม่ตอบ `worker_busy` ได้ถ้ามีรอบกำลังถือ lease อยู่ — รอสักครู่แล้วกดใหม่

## ความปลอดภัย
- `config.json`, `.session.json`, `logs/` อยู่ใน `.gitignore` — ห้าม commit/แชร์
- รหัสผ่าน/cookie ส่งไปที่ `asia-web.jsterp.com` เท่านั้น · log (`logs/worker-YYYY-MM-DD.jsonl`) ไม่เก็บรหัสผ่าน cookie header หรือเนื้อความข้อความ (เก็บแค่ id รายการ, `target_ms_id`, ผล)
- worker ไม่ใช้ service_role และเรียกเฉพาะ RPC `dsales_worker_*`
- ไม่พยายามผ่าน captcha — ให้คนล็อกอินเองด้วย `import-session.mjs --login`
- ข้อความทั้งหมดส่งในนาม User Dev ของ JST
- worker บน Vercel: รหัสผ่าน JST / บัญชี worker อยู่ใน env ของ Vercel (Production, Sensitive) และ route รับเฉพาะคำขอที่มี `Authorization: Bearer <CRON_SECRET>` (ต้องตรงกับ Vault `dsales_cron_secret`) · `CRON_SECRET` ควรเป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษร

## ทดสอบ (ไม่มี network)
```powershell
node --test
```
