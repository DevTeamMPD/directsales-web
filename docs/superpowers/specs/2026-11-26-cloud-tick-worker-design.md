# Worker ส่งข้อความบน Vercel (ปลุกทุกนาที) + เครื่องออฟฟิศเป็นตัวสำรอง — Design

> วันที่ 2026-11-26 · ต่อยอด `2026-11-20-jst-outreach-worker-design.md` (คิว, RPC ของ worker, กติกาการส่ง ยังใช้ตามเดิมทั้งหมด)
> เหตุผล: เครื่อง worker ที่ออฟฟิศ (`office-1`) ปิด/หลับบ่อย ทำให้การส่งข้อความและการผูกห้องหยุดเงียบ ๆ
> นอกขอบเขต: การแจ้งเตือนเมื่อ worker ล่มทั้งสองตัว · `BatchSendMsg` · migration ใน PR #8 (`dsales_room_customer_last`) · การปิดโหมดทดสอบ (ผู้ใช้ตัดสินใจเอง)

## 1. เป้าหมายและการตัดสินใจ

worker ตัวหลักย้ายไปรันเป็นฟังก์ชันบน Vercel ที่ถูกปลุกทุก 1 นาทีจาก pg_cron ของ Supabase ส่วน `office-1` รันลูปเดิมต่อไปเป็นตัวสำรอง และรับงานเองเมื่อตัวหลักเงียบ

| เรื่อง | ตัดสินใจ |
|---|---|
| ตัวปลุก | **pg_cron → `net.http_post` → route บน Vercel** แบบเดียวกับ `cdp.trigger_cron_route` ที่ใช้อยู่ในฐานข้อมูลนี้ (ไม่ใช้ Vercel Cron) |
| บทบาท | เดิมเลือก Vercel = ตัวหลัก · **ผู้ใช้เปลี่ยนเมื่อ 2026-11-26 ตอนขึ้นระบบ: `office-1` = ตัวหลัก, `vercel` = ตัวสำรอง** (เครื่องออฟฟิศส่งข้อความแรกได้ในไม่กี่วินาที ส่วนรอบปลุกนาทีละครั้งรอได้ถึง 60 วินาที) สลับได้ด้วยค่า `worker_primary` ค่าเดียว — กติกาด้านล่างใช้ได้ทั้งสองทาง |
| การรับช่วง | ตัวสำรองได้งานเมื่อตัวหลักไม่ `running` หรือ heartbeat เก่ากว่า 3 นาที — ตัดสินในฐานข้อมูล ไม่ใช่ในโค้ด worker |
| ตรรกะการส่ง | ใช้ `worker-core.mjs` / `jst-client.mjs` / `queue-client.mjs` ชุดเดิม เพิ่มทางเข้าแบบ "หนึ่งรอบ" ลูปเดิมของ `office-1` ไม่เปลี่ยนพฤติกรรม |
| สถานะข้ามรอบ | ฟังก์ชันจำอะไรข้ามรอบไม่ได้ → cookie ของ JST เก็บใน **Supabase Vault**, ตัวนับของ worker เก็บในตาราง `dsales_worker_state` |
| บัญชี Supabase ของ worker | `dev@mpdgroup.co` เหมือนเดิม (RPC ตรวจ `dsales_worker_uid()`) — ไม่ใช้ service_role |
| ภูมิภาค | ไม่ระบุใน route ใช้ค่าของโปรเจกต์ Vercel (โซล `icn1` ภูมิภาคเดียวกับ Supabase `ap-northeast-2`) |

## 2. สิ่งที่รู้จาก spike (2026-11-25/26, branch `spike/jst-from-vercel`)

- ล็อกอิน JST จากฟังก์ชันบน Vercel ผ่านในครั้งเดียว ไม่ขอ captcha (1.25 วินาที)
- session ไม่ผูกกับ IP: cookie จากเครื่อง dev (IP ไทย) ใช้จาก Vercel (สหรัฐฯ) ได้ และกลับกัน
- บัญชี User Dev มีได้หลาย session พร้อมกัน: เครื่อง dev, Vercel และ `office-1` ใช้ได้พร้อมกันทั้งหมด
- cookie ทั้งสองชุดยังใช้ได้หลังผ่านไปราว 20 ชั่วโมง และ JST ไม่ได้เปลี่ยนค่า cookie ระหว่างใช้
- Next.js import `tools/jst-worker/jst-client.mjs` เข้า route ได้ตรง ๆ (build ผ่านบน Vercel)
- ยังไม่ได้ทดสอบ: `SendMsg` จาก Vercel, การล็อกอินซ้ำหลายครั้ง, อายุ session เกิน 20 ชั่วโมง, ความหน่วงจากโซล (จากสหรัฐฯ ราว 260 ms ต่อคำขอ)

## 3. การทำงานต่อรอบ

```
pg_cron (ทุกนาที) → dsales.dsales_tick_kick() → net.http_post → POST /api/cron/outreach-tick
  1. ตรวจ Authorization: Bearer <CRON_SECRET>          ไม่ตรง = 401
  2. ล็อกอิน Supabase ด้วยบัญชี worker (ใช้ client เดิมถ้า instance ยังอุ่น)
  3. dsales_worker_state_begin('vercel')               คืน null = รอบก่อนยังไม่จบ → จบรอบนี้
  4. สร้าง jst client จาก cookie ที่ได้ + worker จากตัวนับที่ได้
  5. worker.tick(): ส่งผลที่ค้างรายงาน → claim → ส่ง 1 งาน → report
     ไม่มีงานส่ง = ผูกห้องด้วยรหัสผู้ซื้อไม่เกิน 10 รหัส (ห่างกัน 1.5 วินาที) หรือจนครบ 40 วินาที
     รอบที่ไม่ได้เรียก JST เลย และตรวจ session สำเร็จครั้งล่าสุดเกิน 10 นาที = jst.ping() หนึ่งครั้ง
  6. heartbeat('vercel', state, session_ok, last_error)
  7. dsales_worker_state_end('vercel', ตัวนับใหม่, cookie ถ้าเปลี่ยน)
```

- ระยะห่างระหว่างข้อความยังคุมโดย `worker_interval_seconds` ใน `dsales_worker_claim` เหมือนเดิม — หนึ่งรอบส่งได้ไม่เกิน 1 ข้อความ
- route ตั้ง `maxDuration = 60`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` · คำตอบเป็น JSON สรุปผล (ไม่มี cookie รหัสผ่าน หรือเนื้อความข้อความ) · ไม่มี `CRON_SECRET` ใน env = ปฏิเสธทุกคำขอ (Preview ที่ไม่ได้ตั้งค่าจึงไม่ทำงาน)
- `jst.ping()` = `getSessions` ขอ 1 แถวแล้วทิ้งผล ใช้ยืนยันว่า session ยังใช้ได้ตอนที่ worker ไม่มีงาน (เช่นช่วงเป็นตัวสำรอง) — session หลุดจะล็อกอินใหม่ตามกติกาเดิม ทำให้ `jst_session_ok` บนการ์ดเป็นค่าจริงเสมอ
- รอบที่ไม่มีอะไรทำเรียกฐานข้อมูล 4 ครั้ง (`state_begin`, `claim`, `heartbeat`, `state_end`) เทียบกับลูปเดิมที่เรียก `claim` 12 ครั้งต่อนาที · `link_targets` เรียกเฉพาะเมื่อรายการที่เก็บไว้หมด (ชุดละ 50) และเว้น 30 นาทีเมื่อไม่มีรหัสเหลือ เหมือนเดิม
- ปลุกทุกนาทีเสมอแม้คิวว่าง เพราะ heartbeat ของตัวหลักคือสิ่งที่บอกตัวสำรองว่ายังไม่ต้องรับช่วง

## 4. ฐานข้อมูล (schema `dsales`)

### 4.1 ตารางและค่าใหม่
| ชื่อ | รายละเอียด |
|---|---|
| ตาราง `dsales_worker_state` | `worker_id text PK`, `runtime jsonb not null default '{}'`, `lease_until timestamptz`, `updated_at timestamptz` · เปิด RLS ไม่มี grant ให้ `authenticated`/`anon` |
| Vault secret `dsales_jst_session_<worker_id>` | cookie ของ JST เป็น JSON `[{name, value}]` — มีค่าเท่ารหัสผ่าน เขียน/อ่านผ่าน RPC ข้างล่างเท่านั้น |
| Vault secret `dsales_app_url`, `dsales_cron_secret` | ที่อยู่ production และรหัสลับของตัวปลุก (ผู้ใช้สร้างเองใน Supabase) |
| setting `worker_primary` | ค่าเริ่ม `"office-1"` · ว่าง/ไม่มี = ไม่มีตัวสำรอง (พฤติกรรมเดิม) |
| setting `worker_tick_enabled` | ค่าเริ่ม `false` · สวิตช์ปิดตัวปลุกโดยไม่ต้องแก้ cron |
| cron `dsales-outreach-tick` | `* * * * *` → `select dsales.dsales_tick_kick()` |

`runtime` เก็บสิ่งที่ `worker-core` เคยจำไว้ในหน่วยความจำ: `state`, `sessionOk`, `lastError`, `failures`, `pausedUntil`, `loginTimes`, `pendingReports`, `linkTargets`, `linkPausedUntil`, `lastJstOkAt`

การเขียน Vault จากฟังก์ชัน security definer ต้องยืนยันตอน dry-run ของ migration (ฟังก์ชัน `cdp.trigger_cron_route` ที่มีอยู่อ่าน Vault ได้ แต่ยังไม่เห็นตัวอย่างการเขียน) — ถ้าเขียนไม่ได้ให้หยุดและกลับมาทบทวนที่เก็บ cookie ก่อนทำต่อ

### 4.2 RPC ใหม่ของ worker (security definer, ตรวจ `dsales_worker_uid()`, revoke จาก public/anon)
- `dsales_worker_state_begin(p_worker text, p_lease_seconds int default 90) returns jsonb` — ถ้า `lease_until > now()` คืน `null` · ไม่เช่นนั้นตั้ง `lease_until = now() + p_lease_seconds` แล้วคืน `{runtime, cookies}` (สร้างแถวถ้ายังไม่มี)
- `dsales_worker_state_end(p_worker text, p_runtime jsonb, p_cookies jsonb default null) returns void` — บันทึก `runtime`, เขียน Vault เมื่อ `p_cookies` ไม่เป็น null, ล้าง `lease_until`
- `dsales_worker_session_put(p_worker text, p_cookies jsonb) returns void` — ใช้ตอนคนล็อกอินเองแล้วอัปโหลด: เขียน Vault และตั้ง `runtime.state` กลับเป็น `running` ถ้าเดิมเป็น `needs_login`

ฟังก์ชันรอบที่ตายกลางทาง (เกินเวลา/แครช) ไม่ได้เรียก `state_end` → lease หมดเองใน 90 วินาที · งานที่ค้าง `sending` ถูกคืนคิวหลัง 10 นาทีตามกติกาเดิม และรอบถัดไปตรวจข้อความในห้องก่อนส่งซ้ำ

### 4.3 RPC ที่แก้
- ฟังก์ชันภายใน `dsales_worker_is_standby(p_worker text) returns boolean` — จริงเมื่อ `worker_primary` มีค่า, ไม่ใช่ `p_worker`, และแถวของตัวหลักใน `dsales_worker_status` มี `state = 'running'` กับ `heartbeat_at > now() - interval '3 minutes'`
- `dsales_worker_claim(p_worker)` — ถ้า `dsales_worker_is_standby(p_worker)` คืน `null` หลังจากถือ advisory lock และคืนแถว `sending` ที่ค้างเกิน 10 นาทีเข้าคิวแล้ว (ตัวสำรองจึงยังกู้แถวที่ค้าง เมื่อตัวหลักส่ง heartbeat แต่ไม่รายงานผล) ส่วนที่เหลือเหมือนเดิม
- `dsales_worker_link_targets(p_worker, p_limit)` — ถ้าเป็นตัวสำรอง คืนชุดว่าง (สองตัวจะไม่ค้นรหัสซ้ำกัน)
- `dsales_worker_status_get()` — เพิ่ม `primary` (ค่า `worker_primary`) ในผลลัพธ์ และ `is_primary` ต่อ worker

### 4.4 RPC ใหม่ของเว็บ (หัวหน้าเท่านั้น)
- `dsales_worker_state_reset(p_worker text) returns jsonb` (สถานะแบบเดียวกับ `dsales_worker_status_get()`) — ตั้ง `runtime` เป็น `{}` และล้าง lease · ตอบ `worker_busy` ขณะรอบหนึ่งถือ lease (ลองใหม่หลังรอบนั้นจบ) · ใช้แทน "รีสตาร์ท worker" เมื่อ worker บน Vercel อยู่ในสถานะ `stopped` (JST เปลี่ยนรูปแบบ response) หลัง dev ตรวจแล้ว
- `dsales_worker_primary_set(p_worker text) returns jsonb` (สถานะแบบเดียวกับ `dsales_worker_status_get()`) — ตั้ง `worker_primary` (รับเฉพาะ worker_id ที่มีใน `dsales_worker_status` หรือค่าว่าง)

### 4.5 ตัวปลุก
`dsales_tick_kick() returns bigint` (security definer, `search_path = ''`, ไม่ grant ให้ใคร): ถ้า `worker_tick_enabled` ไม่เป็น true หรือไม่มี secret ครบสองตัว คืน `null` · ไม่เช่นนั้น `net.http_post(url := <dsales_app_url> || '/api/cron/outreach-tick', headers := Authorization Bearer <dsales_cron_secret>, body := '{}', timeout_milliseconds := 55000)`

## 5. โค้ด

```
tools/jst-worker/
  jst-client.mjs     รับ sessionStore { load(), save(cookies) } · ค่าเริ่ม = ไฟล์ .session.json แบบเดิม · เพิ่ม ping()
  session-store.mjs  ใหม่: fileStore(path) และ memoryStore(cookies) (memoryStore จำว่า cookie ถูกเปลี่ยนหรือไม่)
  worker-core.mjs    เพิ่ม initialState, exportState() และ tick({ deadlineMs, maxLinks })
  queue-client.mjs   เพิ่ม stateBegin / stateEnd / sessionPut · ล็อกอินใหม่เมื่อ token อายุเกิน 45 นาที
  tick.mjs           ใหม่: ลำดับขั้นของหนึ่งรอบ (ข้อ 3 ขั้น 3–7) รับ dependency เข้ามา ไม่มี I/O ของตัวเอง
  import-session.mjs เพิ่ม --upload <worker_id>: ล็อกอินเองใน Chrome แล้วส่ง cookie ขึ้นด้วย dsales_worker_session_put
app/api/cron/outreach-tick/route.ts   ตรวจรหัสลับ → ประกอบ dependency → เรียก tick.mjs
lib/cron/auth.ts                      เทียบ Bearer token แบบเวลาคงที่ (มี test)
middleware.ts                         ไม่ตรวจ session ของ Supabase กับ path /api/cron/
components/setup/OutreachPanels.tsx   การ์ด Worker: ป้าย "ตัวหลัก"/"ตัวสำรอง", ปุ่มตั้งตัวหลัก, ปุ่ม "เริ่มใหม่" ของ worker ที่ stopped
```

- `worker.tick()` ใช้ `processOne()` เดิมสำหรับงานส่ง และ `linkOne()` เดิมสำหรับการผูกห้อง — กติกา `paused` / `needs_login` / `stopped` / จำกัดล็อกอิน 3 ครั้งต่อชั่วโมง คงเดิม
- สถานะ `needs_login` ในโหมดรอบ: คงอยู่ใน `runtime` จนมีการเรียก `dsales_worker_session_put` (แทนการดูเวลาแก้ไขของไฟล์) · ในโหมดลูปยังดูไฟล์ตามเดิม
- `office-1`: โค้ดเดิมใช้ได้ทันที ตั้ง `pollSeconds: 30` ใน `config.json` เพราะเป็นตัวสำรอง และสลับ checkout มา `main`
- route ใช้ `@supabase/supabase-js` ของแอป (ส่ง `createClient` เข้า `queue-client` เหมือนที่ `worker.mjs` ทำ)
- เอกสารที่ต้องแก้ตาม: `tools/jst-worker/README.md` (โหมดรอบ, ตัวหลัก/ตัวสำรอง, `--upload`), `CLAUDE.md` (migration ใหม่, env ใหม่, ตารางภายในใหม่), `docs/DATABASE.md` (RPC ใหม่)

## 6. กรณีผิดพลาด

| เหตุการณ์ | การทำงาน |
|---|---|
| Vercel หรือ pg_cron หยุด | heartbeat ของ `vercel` เก่าเกิน 3 นาที → `office-1` ได้งานเอง |
| JST ขอ captcha / ล็อกอินไม่ผ่านบน Vercel | `vercel` เป็น `needs_login` → `office-1` รับช่วง · แก้ด้วย `node import-session.mjs --upload vercel` จากเครื่องไหนก็ได้ |
| ล้มเหลวติดกัน 5 งานบน Vercel | `vercel` เป็น `paused` 15 นาที → `office-1` รับช่วงระหว่างนั้น |
| JST เปลี่ยนรูปแบบ response (`ShapeError`) | `vercel` เป็น `stopped` · `office-1` รับช่วงแล้วจะหยุดด้วยเหตุเดียวกัน — ต้องให้ dev ตรวจ แล้วกด "เริ่มใหม่" |
| ทั้งสองตัวหยุด | คิวค้าง `queued` ไม่หาย · การ์ด Worker แสดงทั้งสองตัวออฟไลน์/ไม่ running |
| สองรอบซ้อนกัน (pg_net ส่งซ้ำ, รอบก่อนช้า) | `state_begin` คืน `null` รอบหลังจบทันที |
| Supabase ใช้ไม่ได้ระหว่างรอบ | ไม่ส่ง JST · ผลที่ส่งแล้วแต่รายงานไม่ได้เก็บใน `pendingReports` แล้วรายงานรอบถัดไป (ถ้า `state_end` ก็ล้มด้วย งานจะถูกคืนคิวหลัง 10 นาทีและตรวจซ้ำจากข้อความในห้อง) |
| เรียก route โดยไม่มีรหัสลับ | 401 ไม่ทำอะไร |

## 7. ความปลอดภัย

- env บน Vercel (Production, แบบ Sensitive): `JST_USER`, `JST_PASSWORD`, `DSALES_WORKER_EMAIL`, `DSALES_WORKER_PASSWORD`, `CRON_SECRET` — ผู้ใช้ใส่เอง · `CRON_SECRET` ต้องตรงกับ Vault `dsales_cron_secret`
- cookie ของ JST อยู่ใน Vault (เข้ารหัส) ไม่อยู่ในตารางธรรมดา · ตาราง `dsales_worker_state` เพิ่มในรายการตารางภายในที่ห้าม grant ของ `CLAUDE.md`
- route ไม่ log cookie รหัสผ่าน header หรือเนื้อความข้อความ (เก็บแค่ id รายการ, `target_ms_id`, ผล เหมือน worker เดิม)
- ความเสี่ยงที่เพิ่มจากเดิม: รหัสผ่าน User Dev และ `dev@mpdgroup.co` อยู่บน Vercel ด้วย (เดิมอยู่บนเครื่อง worker เท่านั้น) · session ของ JST อยู่ในฐานข้อมูลที่ใช้ร่วมกับระบบอื่น (ผู้ดูแลฐานข้อมูลอ่าน Vault ได้)

## 8. การทดสอบ

- **DB** (ขั้นตอน migration ใน `CLAUDE.md`): `28_worker_primary_standby.sql` (ตัวสำรองไม่ได้งานเมื่อตัวหลักสด/running, ได้งานเมื่อ heartbeat เก่าหรือ state อื่น, ไม่มี `worker_primary` = พฤติกรรมเดิม, `link_targets` ว่างสำหรับตัวสำรอง) · `29_worker_state.sql` (lease กันซ้อน/หมดอายุเอง, cookie ไป-กลับผ่าน Vault, `session_put` ปลด `needs_login`, `state_reset` และ `primary_set` เฉพาะหัวหน้า, เซลล์และผู้ที่ไม่ใช่ worker เรียกไม่ได้, ตารางอ่านตรงไม่ได้) · `30_tick_kick.sql` (ปิดสวิตช์/ไม่มี secret = ไม่ยิง, ไม่มีใครเรียกได้นอกจาก cron)
- **worker** (`node --test`): session store สองแบบ · `exportState` → `initialState` ได้พฤติกรรมเดียวกับลูปต่อเนื่อง (paused, needs_login, จำกัดล็อกอิน, pendingReports) · `tick` หยุดตามเวลาและจำนวนรหัส, ข้ามเมื่อ lease ไม่ว่าง, ไม่เขียน cookie เมื่อไม่เปลี่ยน · test เดิมทั้งหมดต้องผ่านโดยไม่แก้
- **เว็บ**: unit test ของ `lib/cron/auth.ts` และข้อความ/ป้ายของการ์ด Worker · e2e โหมด fixture ของการ์ด (ป้ายตัวหลัก/ตัวสำรอง, ปุ่ม)
- **ทดสอบจริง**: ตามข้อ 9 ในโหมดทดสอบ (ส่งเข้าห้องทดสอบเท่านั้น)

## 9. การขึ้นระบบ

1. apply migration (ค่าเริ่ม: `worker_primary = office-1`, `worker_tick_enabled = false` → ยังไม่มีอะไรเปลี่ยน)
2. ผู้ใช้ใส่ env 5 ตัวบน Vercel และสร้าง Vault secret 2 ตัว → merge ขึ้น production
3. เปิด `worker_tick_enabled` → `vercel` เริ่ม heartbeat ในฐานะตัวสำรอง ดูการ์ด Worker ว่าออนไลน์และ session JST ใช้ได้
4. ตั้งตัวหลักเป็น `vercel` → ส่งชุดทดสอบ 2–3 รายการ ดูว่า `locked_by = vercel` และข้อความถึงห้องทดสอบ (เป็นการทดสอบ `SendMsg` จาก Vercel ครั้งแรก)
5. ทดสอบการรับช่วง: ปิด `worker_tick_enabled` ชั่วคราว → ส่งชุดทดสอบ → `office-1` ต้องรับงานภายใน 3–4 นาที (3 นาทีของ heartbeat + รอบถามคิวของ `office-1`) → เปิดกลับ
6. `office-1`: สลับมา `main`, ตั้ง `pollSeconds: 30`, รีสตาร์ท
7. เก็บกวาด spike: branch `spike/jst-from-vercel`, Preview, env `JST_PASSWORD` ของ Preview, ไฟล์ session ในเครื่อง

**ย้อนกลับ:** ตั้งตัวหลักเป็น `office-1` หรือปิด `worker_tick_enabled` (มีผลรอบถัดไป ไม่ต้อง deploy)

**สิ่งที่ผู้ใช้ต้องทำเอง:** ใส่ env บน Vercel · สร้าง Vault secret · อนุมัติ migration, push และ merge · งานข้อ 6 บนเครื่องออฟฟิศ · ตัดสินใจปิดโหมดทดสอบ
