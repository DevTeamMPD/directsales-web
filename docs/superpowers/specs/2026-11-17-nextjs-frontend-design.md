# MPD Direct Sale · หน้าเว็บ Next.js (Design Spec)

> วันที่: 2026-11-17 · สถานะ: รอตรวจ
> อ้างอิง: `2026-11-17-direct-sale-design.md` (ระบบรวม), `2026-11-17-prototype-inventory.md` (รายการ feature ของ prototype พร้อมเลขบรรทัด `app.js`)
> ขอบเขต: เขียนหน้าเว็บใหม่ด้วย Next.js ให้ **หน้าตาและการทำงานเหมือน prototype ทุกอย่าง** + หน้าใหม่ของเฟส 1 ใช้ RPC ใน schema `dsales` ที่ทำเสร็จแล้ว (แผนเฟส 0–1 Task 1–10)

## 1. เป้าหมายและหลักการ

1. **Stack เดียวกับโปรเจกต์ Inventory:** Next.js 15 (App Router) + TypeScript strict + `@supabase/ssr` + Tailwind CSS 3 + Vercel
2. **หน้าตาเหมือน prototype 100%:** ใช้ `styles.css` เดิมเป็น global stylesheet และเขียน JSX ด้วย class name เดิม (ไม่ใช้ component ของ shadcn/ui แทนของเดิม) เกณฑ์: ภาพหน้าจอทุกหน้าที่ 375px และ 1280px ตรงกับ prototype
3. **ล็อกอินครั้งเดียว:** ล็อกอินด้วยบัญชี Supabase ครั้งแรกแล้วจำ session ไว้ในเครื่อง (cookie) ไม่ต้องล็อกอินซ้ำจนกว่าจะออกจากระบบหรือ session หมดอายุ เปิดหน้าไหนโดยยังไม่ล็อกอิน → ไปหน้า `/login` ข้อมูลลูกค้าไม่ถูกส่งให้คนที่ไม่ได้ล็อกอิน
4. **ไม่มีโหมดดูตัวอย่าง** (ตัด `data.js` / localStorage ออกจาก production)
5. **ไม่แก้ DB เกินจำเป็น:** ใช้ RPC/ตารางที่มีอยู่ เพิ่มเฉพาะที่ข้อ 6 ระบุ

## 2. สิ่งที่ต้องย้าย (parity)

ทั้งหมดตาม `2026-11-17-prototype-inventory.md` ข้อ 1–10 สรุป:

| ส่วน | รายละเอียด (ดู inventory) |
|---|---|
| Shell | sidebar + กลุ่มเมนู + badge, topbar (ชื่อหน้า/คำอธิบาย/ปุ่มต่อหน้า), กล่อง "me", ปุ่มออกจากระบบ, เมนูมือถือ + scrim (ข้อ 1) |
| หน้า | Direct Sale (`/leads`), แคมเปญ Bebeplay/Hosttail (`/campaigns/[brand]`) + ถังลูกค้าทั้งหมด, Dashboard (`/dashboard`), ตั้งค่า (`/setup`, หัวหน้าเท่านั้น) (ข้อ 2, 7) |
| ตัวกรองร่วม | การ์ดช่วงเวลา, toolbar ลีด (สถานะ/เซลล์/แคมเปญ/ค้นหา/เรียง), ตารางลีด (ข้อ 2) |
| Popup | รายละเอียดลูกค้า (แท็บ), บันทึกโทร/แชต, ยืนยันยกเลิกจอง, เลือกจากถัง, รายละเอียดลูกค้าในถัง, ตัวสร้างแคมเปญ (ข้อ 3) |
| กติกาลีด | สถานะ, การจอง/มอบหมาย/บันทึก/ห้ามโทร/คัดออก/ยกเลิกจอง, ตัวกรอง `visible` / `mineOrAll` / `periodOk` ฯลฯ (ข้อ 4) |
| JST | ปุ่มช่องทาง, `jstOpen` (helper → urlTemplate → คัดลอก), เปิดอัตโนมัติหลังจอง, ปุ่มโทร (`tel:` + คัดลอกเบอร์), ตรวจทักแชต + `verifyMine` (ข้อ 6) |
| พฤติกรรมย่อย | toast 2.2 วิ, debounce ค้นหา 300 ms, focus ช่องค้นหา, ปิด popup ด้วย Esc/mousedown ที่พื้นหลัง ฯลฯ (ข้อ 10) |

**เปลี่ยนจาก prototype โดยตั้งใจ**
- ตัดโหมดตัวอย่างและ `.demo-note` ทั้งหมด
- ตัด fallback "อีเมล `dev@mpdgroup.co` = หัวหน้า" สิทธิ์มาจาก `dsales_me()` อย่างเดียว
- URL จริงต่อหน้าแทน `#hash` (`/leads`, `/mine`, `/pool`, `/campaigns/bebeplay`, …) ปุ่ม back ของเบราว์เซอร์ใช้ได้
- แก้ลำดับ map ข้อความ error ให้ `customer_not_found` แสดงข้อความของตัวเอง (inventory ข้อ 5)

**คงไว้ตาม prototype แม้รู้ว่าจะเปลี่ยนในเฟส 2:** ตารางค่าคอมใน Dashboard (คิดจากยอดที่เซลล์บันทึกเอง) และโหมดแคมเปญ `auto` ที่ map เป็น `self`

## 3. หน้าใหม่ของเฟส 1

| หน้า | ใช้ RPC | รายละเอียด |
|---|---|---|
| `/mine` ลูกค้าของฉัน | `dsales_base_customers('mine', …)` | ตารางแบบเดียวกับถังลูกค้า (คอลัมน์ที่สอง = "ไม่ซื้อมา N วัน" + tag) ตัวเลือกแบรนด์ ค้นหา (debounce 300 ms) แบ่งหน้า 50 ปุ่ม "เริ่มติดตาม" (สร้างลีดด้วย `dsales_claim_customer`) / "ยกเลิกจอง" |
| `/pool` ถังกลาง | `dsales_base_customers('pool', …)` | เหมือนกันแต่ปุ่ม "จอง" |
| การ์ด "ผูก tag JST กับเซลล์" ใน `/setup` | `dsales_jst_admin_tags`, `dsales_member_tags`, `dsales_set_member_tags` | หัวหน้าเลือก tag `Admin_*` ให้เซลล์ (multi-select) บันทึกแล้วแสดงสถานะกำลังบันทึก (ใช้เวลาหลายวินาทีเพราะคำนวณฐานลูกค้าใหม่) |

การจัดการตามที่ผู้ตรวจ RPC แนะนำ:
- ลูกค้าที่ `no_call = true` → ปุ่มจอง/เริ่มติดตาม disabled ข้อความ "ไม่สะดวกให้โทร"
- ค้นหาเบอร์: แปลง `+66` / `66` / ขีด / ช่องว่าง เป็นรูป `0xxxxxxxxx` ก่อนส่ง
- จองต้องมีแบรนด์ `bebeplay` หรือ `hosttail`: ใช้แบรนด์ที่เลือกในตัวกรอง หรือแบรนด์แรกของลูกค้าที่เป็นหนึ่งในสองนี้ ไม่มี → toast "เลือกแบรนด์ที่ช่องด้านบนก่อนจอง"
- ลูกค้าที่เป็นของเซลล์คนอื่นตาม tag → ปุ่ม disabled "เป็นลูกค้าของ <ชื่อ/ tag>" (หัวหน้าเปลี่ยนเจ้าของด้วยการแก้ tag)
- `total_count` ใช้จากหน้าแรกของผลค้นหา (หน้าที่เกินท้ายจะไม่มีค่า)
- map error: `taken`, `no_call`, `forbidden`, `invalid_phone`, `invalid_brand`, `customer_not_found`, `member_not_found`, `not_authenticated`, `tag_taken: <tag>` เป็นข้อความไทย

## 4. สถาปัตยกรรม

```
app/
  layout.tsx              # <html lang="th">, ฟอนต์, globals.css
  login/page.tsx          # หน้า login (หน้าตาตาม .login-card เดิม)
  (app)/layout.tsx        # Shell: sidebar + topbar + ตัวให้ข้อมูล (DataProvider) + toast + modal root
  (app)/leads/page.tsx    # Direct Sale (หน้าแรกหลังล็อกอิน; "/" redirect มาที่นี่)
  (app)/mine/page.tsx
  (app)/pool/page.tsx
  (app)/campaigns/[brand]/page.tsx
  (app)/dashboard/page.tsx
  (app)/setup/page.tsx    # หัวหน้าเท่านั้น (คนอื่น redirect ไป /leads)
middleware.ts             # ไม่มี session → /login (ยกเว้น /login และไฟล์ static)
lib/
  supabase/client.ts      # createBrowserClient(...).schema('dsales') + auth
  supabase/server.ts      # createServerClient สำหรับ middleware/server
  api/                    # ฟังก์ชันเรียก RPC แต่ละตัว + แปลงผล (mapLead, mapCampaign, mapPoolRow) + map error
  domain/                 # กติกาลีด/ตัวกรอง/สถิติ (เป็นฟังก์ชันล้วน ทดสอบได้)
  format.ts               # baht, fmtDate, fmtDT, nowStamp, localStamp
  constants.ts            # BRAND, STATUS, MODES, PLAT, CRIT, PAGE
  icons.ts                # ไอคอนช่องทาง (ย้ายจาก icons.js)
  jst.ts                  # jstOpen, jstTarget, channelsOf, platformOf
components/               # แยกตามส่วน: shell/, leads/, pool/, campaigns/, dashboard/, setup/, modals/, ui/ (ปุ่ม/badge/toast ที่ใช้ class เดิม)
styles/prototype.css      # คัดลอกจาก styles.css (แก้เฉพาะที่จำเป็น)
legacy/                   # เว็บ prototype เดิม (index.html, app.js, …) เก็บไว้เทียบหน้าตาจนกว่าจะ parity ครบ แล้วลบ
```

- **การดึงข้อมูล:** ฝั่ง client เป็นหลัก แบบเดียวกับ prototype หลังล็อกอิน `DataProvider` โหลด `dsales_me`, `dsales_team`, `dsales_campaigns`, `dsales_my_leads(1000)` ครั้งเดียว เก็บใน React state (context + reducer) และอัปเดตจากผลของ RPC ที่แก้ข้อมูล (`upsertLead`) — ไม่โหลดใหม่ทั้งหน้า
- **ตัวกรอง/สถานะ UI** (ช่วงเวลา, สถานะ, เซลล์, ค้นหา, เรียง, แบรนด์ Dashboard) อยู่ใน context เดียวกัน คงค่าข้ามหน้าเหมือน prototype
- **CSS:** `styles/prototype.css` = `styles.css` เดิม นำเข้าใน `app/layout.tsx` Tailwind ติดตั้งแต่ **ปิด preflight** (`corePlugins.preflight = false`) เพื่อไม่ให้ reset ทับหน้าตาเดิม
- **ฟอนต์:** IBM Plex Sans Thai (400/500/600/700) + IBM Plex Mono (500) ผ่าน `next/font/google` ตั้งเป็นตัวแปร CSS ที่ `--font` / `--mono` ใช้
- **ค่า config:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_JST_HELPER_URL` (ค่าเริ่ม `http://127.0.0.1:47321`), `NEXT_PUBLIC_JST_URL_TEMPLATE` (ว่างได้) ตั้งใน Vercel และ `.env.local` (มี `.env.example`)
- **เวลา:** ทุกการคำนวณ "วันนี้" ใช้เขตเวลา `Asia/Bangkok` (ไม่พึ่งเขตเวลาของเครื่อง)

## 5. สิทธิ์เข้าใช้งาน

Supabase project นี้มีบัญชีพนักงานจากระบบอื่นราว 150 คน และตอนนี้ `dsales_register()` เพิ่มทุกคนที่ล็อกอินเป็นเซลล์อัตโนมัติ

**ข้อเสนอ (รอยืนยัน):** เข้าใช้ได้เฉพาะสมาชิกที่หัวหน้าเพิ่มไว้และ `active`
- ล็อกอินได้แต่ไม่ใช่สมาชิก → หน้า "ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า" + ปุ่มออกจากระบบ ไม่โหลดข้อมูลใด ๆ
- หน้า `/setup` มีฟอร์ม "เพิ่มเซลล์ด้วยอีเมล" (เลือกบทบาท เซลล์/หัวหน้า) และปุ่มปิด/เปิดใช้งาน
- สมาชิกที่ถูกปิดใช้งาน เรียก RPC ที่อ่าน/แก้ข้อมูลลูกค้าไม่ได้

ต้องแก้ DB (migration ใหม่ใน schema `dsales`): `dsales_register()` ไม่เพิ่มสมาชิกเองอีก, เพิ่ม `dsales_add_member(p_email, p_role)` / `dsales_set_member_active(p_user, p_active)` (หัวหน้าเท่านั้น), `dsales_me()` คืน `is_member` / `active`, และฟังก์ชันที่ใช้ `dsales_uid()` ตรวจว่าเป็นสมาชิก active (ผ่าน helper ตัวเดียว) — สมาชิกเดิม 1 คน (บัญชีที่ใช้อยู่) ตั้งเป็นหัวหน้า active

## 6. การทดสอบ

- **Unit (Vitest):** `lib/format.ts`, `lib/domain/*` (ตัวกรอง/สถิติ/สิทธิ์ยกเลิกจอง), `lib/api/*` mappers + map error, `lib/jst.ts` (platformOf, channelsOf, jstTarget) — เทียบผลกับ prototype ด้วยข้อมูลจาก `legacy/data.js`
- **หน้าตา (Playwright, เฉพาะเครื่อง dev):** โหมด fixture ที่ใช้ได้เฉพาะ `next dev` + `NEXT_PUBLIC_FIXTURES=1` (ข้ามการล็อกอินและใช้ข้อมูลจาก `legacy/data.js`) ถ่ายภาพหน้าจอทุกหน้า/ทุก popup ที่ 375px และ 1280px เทียบกับ prototype ใน `legacy/` (เปิดในโหมดตัวอย่าง) ต่างกันเกินเกณฑ์ → ตก โหมด fixture ต้องไม่ถูก build เข้า production (ตรวจใน test)
- **ตรวจกับข้อมูลจริง (คนทำ):** ผู้ใช้ล็อกอินบัญชีจริงแล้วไล่ checklist ทุกหน้า (รายการใน plan)
- **Build:** `next build`, `tsc --noEmit`, `next lint` ต้องผ่าน

## 7. Deploy

1. Vercel project เดิม: เปลี่ยน Framework Preset เป็น Next.js, ตั้ง env ตามข้อ 4
2. merge branch เข้า branch ที่ Vercel ใช้ deploy production (ต้องถามผู้ใช้ก่อน push/merge)
3. หลัง deploy: ผู้ใช้ไล่ checklist บน production แล้วลบ `legacy/`

## 8. ไม่อยู่ในขอบเขต

- Dashboard KPI/นับยอดแบบใหม่ (เฟส 2), คิวส่งข้อความ/batch (เฟส 3), JST Worker (เฟส 4), RLS (เฟส 5)
- ปุ่ม "เปิดใน Meta Inbox" (ต้องมีตาราง page_id ก่อน — เฟส 3)
- PWA / ติดตั้งเป็นแอป
