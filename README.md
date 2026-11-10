# MPD Direct Sale (Preview)

เว็บแอปสำหรับทีม Direct Sale: บันทึกการโทร/แชตลูกค้าเก่า ทั้งที่เซลล์ขุดเองและที่จองจากแคมเปญ

เปิด `index.html` ในเบราว์เซอร์ได้เลย (ไม่ต้อง build) ข้อมูลใน `data.js` เป็นตัวอย่างสำหรับ Preview
และสิ่งที่บันทึกจะเก็บใน localStorage ของเบราว์เซอร์เท่านั้น

เมนู: Direct Sale · แคมเปญ (Bebeplay / Hosttail) · Dashboard · ตั้งค่า

## เปิดแชตใน JST / โทร / ตรวจการทักแชท
- ปุ่มโทรและไอคอนช่องทางแชต (LINE, Shopee, Facebook, Lazada, TikTok, Instagram, เว็บไซต์) อยู่ใน popup ลูกค้า และแถวย่อในตาราง Direct Sale แยกตามร้านที่ลูกค้าเคยสั่ง
- กดไอคอน หรือกด "จอง" เว็บจะสั่งตัวช่วยบนเครื่องเซลล์ให้เปิดแชตลูกค้าใน JST — ดู `tools/jst-helper/README.md`
- ตรวจว่าเซลล์ทักแชทจริง: ฟังก์ชัน Supabase `dsales_customer_chats` นับข้อความ `dir='admin'` ใน `iim_messages` หลังเวลาที่จอง (จับคู่แชตกับลูกค้าด้วยชื่อแชต/ชื่อผู้ซื้อ) และ `dsales_customer_channels` ดึงร้าน/ช่องทางจาก `order_tracking`
