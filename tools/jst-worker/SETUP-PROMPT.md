# Prompt สำหรับตั้งเครื่อง worker (คัดลอกทั้งก้อนไปวางใน Claude Code บนเครื่อง worker)

```
ช่วยตั้งเครื่องนี้เป็น "JST outreach worker" ของโปรเจกต์ MPD Direct Sale ให้หน่อย ทำทีละขั้นและบอกผลทุกขั้น

ข้อมูล
- Repo: https://github.com/DevTeamMPD/directsales-web  branch: feat/outreach-worker
- โฟลเดอร์ที่ต้องการ: C:\jst-worker\directsales-web
- โค้ด worker อยู่ที่ tools/jst-worker (อ่าน tools/jst-worker/README.md ก่อนเริ่ม)
- Supabase URL: https://nroyacasuchqniaiuirk.supabase.co
- Supabase publishable key (ไม่ใช่ความลับ): sb_publishable_436ixg3EhSGskzcgrGU7OQ_pVAzvaku
- บัญชี Supabase ของ worker: dev@mpdgroup.co · บัญชี JST: rpa@mpdgroup.co
- workerId ของเครื่องนี้: office-1

ขั้นตอน
1. ตรวจว่ามี Node.js 24 ขึ้นไป, Git และ Google Chrome — ถ้าไม่มีให้บอกฉันว่าต้องติดตั้งอะไร (อย่าติดตั้งเองโดยไม่ถาม)
2. git clone -b feat/outreach-worker https://github.com/DevTeamMPD/directsales-web.git C:\jst-worker\directsales-web
   (ถ้า GitHub ขอล็อกอิน ให้ฉันล็อกอินเอง)
3. cd C:\jst-worker\directsales-web\tools\jst-worker แล้ว npm install
4. สร้าง config.json จาก config.example.json: ใส่ workerId = office-1, supabase.url, supabase.anonKey (ค่าด้านบน), supabase.email = dev@mpdgroup.co, jst.accountId = rpa@mpdgroup.co
   — ห้ามใส่รหัสผ่านเอง ให้เว้น supabase.password กับ jst.password ว่างไว้ แล้วบอกให้ฉันเปิดไฟล์ไปกรอกเอง (config.json อยู่ใน .gitignore)
5. รอฉันบอกว่ากรอกรหัสผ่านแล้ว จากนั้นรัน node import-session.mjs --login — จะเปิดหน้าต่าง Chrome ให้ฉันล็อกอิน JST ด้วย rpa@mpdgroup.co เอง แล้วสคริปต์บันทึก .session.json
6. ทดสอบ 1 รอบ: node worker.mjs --once — ต้องไม่มี error และ log ต้องขึ้น "worker start" กับ "worker exit" (ถ้าคิวว่างจะเป็น last: idle ซึ่งปกติ)
7. ให้ฉันเช็กในเว็บ Direct Sale หน้า ตั้งค่า → การ์ด Worker ว่าเห็น office-1 ออนไลน์
8. รันจริงแบบค้างไว้: node worker.mjs (เปิดหน้าต่างทิ้งไว้)
9. ถามฉันก่อนว่าจะให้ตั้ง Task Scheduler ให้ worker เริ่มเองตอนล็อกอินเครื่องไหม ถ้าตกลง ให้สร้างไฟล์ start-worker.bat ที่ cd ไปโฟลเดอร์ worker แล้ว node worker.mjs และตั้ง task "JST Outreach Worker" ทำงานตอนผู้ใช้ล็อกอิน (ไม่ต้องใช้สิทธิ์ admin)

กติกา
- ห้ามพิมพ์/แสดง/commit รหัสผ่าน, config.json, .session.json, หรือ cookie
- ห้าม git push และห้ามแก้โค้ด ถ้าเจอ error ให้คัดลอก log (logs/worker-*.jsonl) มาให้ฉันดู
- โหมดทดสอบในเว็บยังเปิดอยู่: worker จะส่งทุกข้อความไป "ห้องทดสอบ" ที่ตั้งไว้ ไม่ใช่ลูกค้าจริง — ห้ามปิดโหมดนี้
```

## อัปเดตโค้ดบนเครื่อง worker ภายหลัง
```powershell
cd C:\jst-worker\directsales-web
git pull
cd tools\jst-worker
npm install
```
แล้วปิด worker เดิม (Ctrl+C) และรัน `node worker.mjs` ใหม่
