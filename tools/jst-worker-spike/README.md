# JST Worker — ต้นแบบ (spike)

พิสูจน์ว่า Playwright + บัญชี JST กลาง (User Dev) ส่งข้อความได้จริงช่องทางไหน และ session อยู่ได้นานแค่ไหน ก่อนทำ worker เต็มระบบ
แผนและตารางผล: `docs/superpowers/plans/2026-11-20-jst-worker-spike.md`

**ส่งได้เฉพาะห้องแชตทดสอบของพนักงาน** (`testChats` ใน `config.json`) และต้องใส่ `--confirm` · ไม่แตะ Supabase

## ติดตั้ง (เครื่อง worker, Windows)
```powershell
cd C:\jst-worker-spike
npm install
npx playwright install chromium
copy config.example.json config.json
```
ค่าเริ่ม `"channel": "chrome"` = ใช้ Google Chrome ที่ติดตั้งในเครื่อง (ทดสอบ 2026-11-20: Chromium ของ Playwright แบบมีหน้าต่างถูก Windows บล็อก `spawn UNKNOWN` ส่วน Chrome ปกติใช้ได้ทั้งมีหน้าต่างและ headless) · ถ้าเครื่องไม่มี Chrome ตั้ง `"channel": ""` แล้วรัน `npx playwright install chromium`

## คำสั่ง
| คำสั่ง | ทำอะไร |
|---|---|
| `node login.mjs` | เปิดหน้าต่าง Chromium ให้ล็อกอิน JST ด้วย User Dev เอง แล้วเก็บ session ใน `.profile/` |
| `node check.mjs` | ตรวจ session แบบไม่เปิดหน้าต่าง (`logged_in`, จำนวนห้อง) |
| `node open-chat.mjs --chat "<ชื่อแชต>"` | ค้นหาและเปิดห้อง พิมพ์ `ms_id` ให้ใส่ใน `testChats` |
| `node send-test.mjs --ms <ms_id> --text "<ข้อความ>"` | dry-run: เปิดห้อง พิมพ์ แล้วลบ ไม่ส่ง |
| `node send-test.mjs --ms <ms_id> --text "<ข้อความ>" --confirm` | ส่งจริง (ห้องทดสอบเท่านั้น) บันทึกผลใน `logs/send-*.json` |
| `node probe.mjs` | ตรวจ session ทุก 30 นาที เขียน `logs/session-probe.jsonl` (ปล่อยทิ้งไว้ 24–72 ชม.) |

เพิ่ม `--headed` กับ `check` / `open-chat` / `send-test` เพื่อดูหน้าจอระหว่างทำงาน

## ข้อควรรู้
- `.profile/` = session ของ JST มีค่าเท่ารหัสผ่าน ห้ามแชร์/commit (อยู่ใน `.gitignore`)
- เปิดห้องแชต = JST บันทึก User Dev เป็นผู้ดูแลห้องนั้น (เหมือนแอดมินกดเปิดห้อง)
- log เก็บเฉพาะ path / payload / response ของ `/iim/SendMsg` ไม่เก็บ header หรือ cookie — ตรวจอีกครั้งก่อนแชร์
- selector อิงหน้า JST ณ 2026-11-20 ถ้า JST เปลี่ยนหน้า สคริปต์จะหาช่องค้นหา/ห้องไม่เจอและหยุด ไม่ส่งมั่ว

## ทดสอบ (ไม่ต้องใช้เบราว์เซอร์)
```powershell
node --test lib.test.mjs
```
