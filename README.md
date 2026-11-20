# MPD Direct Sale

เว็บแอปของทีม Direct Sale (MPD Group: Bebeplay / Hosttail) ให้เซลล์โทร/แชตหาลูกค้าเก่า จองลูกค้าจากถัง ติดตามแคมเปญ และให้หัวหน้าดูภาพรวมทีม

- Next.js 15 (App Router) + React 19 + TypeScript · Supabase (schema `dsales`, ล็อกอินด้วยอีเมล/รหัสผ่าน) · Vercel
- หน้าตาตามดีไซน์ "Direct Sale CRM" (`styles/tokens.css` + `styles/app.css`) — prototype เดิมใน `legacy/` ใช้เทียบข้อความ/การทำงานใน e2e เท่านั้น
- รายละเอียดสำหรับนักพัฒนา (กติกา DB, โหมด fixture, ขั้นตอน migration): `CLAUDE.md`

## หน้า

| URL | หน้า | สิทธิ์ |
|---|---|---|
| `/login` | เข้าสู่ระบบ | ทุกคน |
| `/leads` | Direct Sale — ลีดของฉัน (หัวหน้าเห็นทุกคน), บันทึกโทร/แชต, ตรวจการทักแชตจาก JST | สมาชิก |
| `/mine` | ลูกค้าของฉัน (ลีดที่ดูแล + ลูกค้าตาม tag JST) | สมาชิก |
| `/pool` | ถังกลาง (ลูกค้าเก่าที่ยังไม่มีเจ้าของ) | สมาชิก |
| `/campaigns/bebeplay`, `/campaigns/hosttail` | แคมเปญ + ถังลูกค้าทั้งหมดของแบรนด์ | สมาชิก (สร้างแคมเปญ = หัวหน้า) |
| `/dashboard` | ภาพรวมทีม + ยอดที่ปิดได้รายเดือนต่อเซลล์ (ค่าคอม) | สมาชิก |
| `/setup` | ทีมเซลล์, ผูก tag JST, วิธีจองของแคมเปญ | หัวหน้า |

ใช้งานได้เฉพาะสมาชิกที่หัวหน้าเพิ่มไว้ในหน้า "ตั้งค่า" และยังเปิดใช้งาน (บัญชีอื่นล็อกอินได้แต่เห็นการ์ด "ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า")

## เริ่มพัฒนา

```bash
npm install
cp .env.example .env.local      # ใส่ NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key)
npm run dev                     # http://localhost:3000
```

ดูหน้าตาโดยไม่ล็อกอิน (ข้อมูลตัวอย่าง, `next dev` เท่านั้น): `NEXT_PUBLIC_FIXTURES=1 npm run dev`

## ตรวจก่อน commit / deploy

```bash
npm run typecheck && npm run lint && npm test
npm run build && npm run check:fixtures
npm run test:e2e                # เทียบหน้าตากับ prototype (ต้องต่ออินเทอร์เน็ต) แล้ว npm run build ใหม่ก่อน check:fixtures
```

## Deploy

Vercel: production deploy จาก branch `main` (branch อื่นได้ Preview deployment) · `vercel.json` ตั้ง `framework: nextjs` ไว้แล้ว ไม่ต้องเปลี่ยน Framework Preset ของโปรเจกต์ · Node 24 (`engines`) — env ที่ต้องตั้ง: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_JST_HELPER_URL`, `NEXT_PUBLIC_JST_URL_TEMPLATE` (ว่างได้) — ห้ามตั้ง `NEXT_PUBLIC_FIXTURES=1`

## เปิดแชตใน JST / โทร / ตรวจการทักแชต

- ปุ่มโทร (เปิด `tel:` + คัดลอกเบอร์) และไอคอนช่องทางแชตแยกตามร้าน อยู่ในตารางลีดและ popup ลูกค้า
- กดไอคอน หรือกด "จอง" เว็บเปิดหน้าแชต JST (`NEXT_PUBLIC_JST_CHAT_URL`, ค่าเริ่ม `https://asia-web.jsterp.com/iim/index`) ในแท็บเดิม + คัดลอกชื่อแชต แล้วสคริปต์ Tampermonkey บนหน้า JST ค้นหาและเปิดห้องให้เอง — ดู `tools/jst-userscript/README.md` (ไม่ได้ติดตั้งสคริปต์ = กด Ctrl+V ในช่องค้นหา JST เอง) · ตั้ง `NEXT_PUBLIC_JST_CHAT_URL` เป็นค่าว่างเพื่อกลับไปใช้ตัวช่วยเดิม `tools/jst-helper`
- ตรวจว่าเซลล์ทักแชตจริงด้วย `dsales_customer_chats` (นับข้อความฝั่งแอดมินหลังเวลาจอง) — ตรวจอัตโนมัติไม่เกิน 10 ลีดต่อรอบเมื่อเปิดหน้า Direct Sale

ฐานข้อมูล: `docs/DATABASE.md` · แผน/สเปก: `docs/superpowers/`
