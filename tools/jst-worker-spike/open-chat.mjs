// Step 4: ค้นหาและเปิดห้องแชต แล้วพิมพ์ ms_id / ชื่อ / ช่องทาง / หมดช่วงส่งไหม (ไม่พิมพ์ ไม่ส่งข้อความ)
// node open-chat.mjs --chat "<ชื่อแชต>" [--ms <ms_id>] [--headed]
// หมายเหตุ: เปิดห้อง = JST บันทึกบัญชีที่ล็อกอินเป็นผู้ดูแลห้องนั้น — ใช้กับห้องทดสอบของพนักงานเท่านั้น
import { gotoChat, listSessions, loadConfig, openJst, parseArgs, searchAndOpen } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (typeof args.chat !== 'string') {
  console.error('ใช้: node open-chat.mjs --chat "<ชื่อแชต>" [--ms <ms_id>] [--headed]');
  process.exit(2);
}
const config = loadConfig();
const { context, page } = await openJst(config, { headless: !args.headed });
try {
  const g = await gotoChat(page, config);
  if (!g.loggedIn) throw new Error('ยังไม่ได้ล็อกอิน JST — รัน node login.mjs ก่อน');
  const room = await searchAndOpen(page, { chat: args.chat, ms: typeof args.ms === 'string' ? args.ms : '' });
  if (!room) {
    console.log(JSON.stringify({ found: false, results: await listSessions(page) }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ found: true, room }, null, 2));
    console.log('ใส่ใน config.json → testChats:', JSON.stringify({ name: room.name, msId: Number(room.ms), note: room.provider }));
  }
} finally {
  if (args.headed) await page.waitForTimeout(5000);
  await context.close();
}
