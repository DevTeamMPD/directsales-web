// Step 5–6: ส่งข้อความทดสอบไป "ห้องทดสอบใน allowlist" เท่านั้น
// dry-run (ค่าเริ่ม): เปิดห้อง → พิมพ์ข้อความลงช่อง → ลบออก ไม่กดส่ง
// ส่งจริง:          node send-test.mjs --ms <ms_id> --text "ข้อความ" --confirm
// บันทึก request/response ของ /iim/SendMsg และผล getMsgs ลง logs/send-<เวลา>.json (ไม่เก็บ header/cookie)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { allowedChat, gotoChat, loadConfig, LOG_DIR, openJst, parseArgs, redactExchange, searchAndOpen, SEL } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();
const target = allowedChat(config, args.ms);
const text = typeof args.text === 'string' ? args.text : '';
if (!target) {
  console.error(`ms_id "${args.ms ?? ''}" ไม่อยู่ใน testChats ของ config.json — spike ส่งได้เฉพาะห้องทดสอบของพนักงาน`);
  process.exit(2);
}
if (!text.trim() || text.length > 4000) {
  console.error('ใส่ --text "ข้อความ" (1–4000 ตัวอักษร)');
  process.exit(2);
}
const confirm = args.confirm === true;

const { context, page } = await openJst(config, { headless: !args.headed });
const exchanges = [];
page.on('response', async (res) => {
  const url = res.url();
  if (!/\/iim\/(SendMsg|BatchSendMsg|ReSendMsg)\b/i.test(url)) return;
  let body = null;
  try {
    body = await res.text();
  } catch {
    /* response ถูกปิดไปแล้ว */
  }
  exchanges.push(redactExchange({ url, method: res.request().method(), postData: res.request().postData(), status: res.status(), body }));
});

const result = { at: new Date().toISOString(), target, confirm, text };
try {
  const g = await gotoChat(page, config);
  if (!g.loggedIn) throw new Error('ยังไม่ได้ล็อกอิน JST — รัน node login.mjs ก่อน');
  const room = await searchAndOpen(page, { chat: target.name, ms: String(target.msId) });
  if (!room || room.ms !== String(target.msId)) throw new Error(`เปิดห้อง ${target.msId} ไม่ได้ (ได้ ${room ? room.ms : 'ไม่พบ'}) — ไม่ส่ง`);
  result.room = room;
  if (room.expired) console.warn('⚠ ห้องนี้มี class isExpired (หมดช่วงส่งได้ เช่น FB/IG เกิน 24 ชม.) — ส่งต่อเพื่อดูว่า JST ตอบอะไร');

  const box = page.locator(SEL.composer).first();
  await box.waitFor({ state: 'visible', timeout: 10000 });
  await box.fill(text);

  if (!confirm) {
    await box.fill('');
    result.outcome = 'dry-run: เปิดห้องและพิมพ์ได้ ไม่ได้กดส่ง (ใส่ --confirm เพื่อส่งจริง)';
  } else {
    const msgsAfter = page.waitForResponse((r) => /\/iim\/getMsgs\b/i.test(r.url()), { timeout: 20000 }).catch(() => null);
    const sendRes = page.waitForResponse((r) => /\/iim\/SendMsg\b/i.test(r.url()), { timeout: 20000 }).catch(() => null);
    await page.locator(SEL.sendButton).first().click();
    const sr = await sendRes;
    result.sendStatus = sr ? sr.status() : 'ไม่มี request /iim/SendMsg ภายใน 20 วินาที';
    const mr = await msgsAfter;
    if (mr) {
      try {
        const j = await mr.json();
        const list = Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : [];
        const mine = list.filter((m) => typeof m.msg_content === 'string' && m.msg_content.includes(text.slice(0, 30)));
        result.messages = mine.map((m) => ({ msg_id: m.msg_id, status: m.status, io_type: m.io_type, send_time: m.send_time, send_result_translate: m.send_result_translate }));
      } catch {
        result.messages = 'อ่าน getMsgs ไม่ได้';
      }
    }
    await page.waitForTimeout(3000);
    result.toast = await page.$$eval('.j-message, .el-message, [class*=message-box], [class*=notify]', (els) =>
      els.filter((e) => e.offsetParent).map((e) => e.textContent.trim()).filter(Boolean).slice(0, 5),
    );
    result.outcome = 'ส่งแล้ว — ตรวจว่าข้อความถึงมือถือผู้ทดสอบไหม แล้วจดผลในแผน';
  }
} catch (e) {
  result.error = String(e?.message || e);
  process.exitCode = 1;
} finally {
  result.exchanges = exchanges;
  mkdirSync(LOG_DIR, { recursive: true });
  const file = join(LOG_DIR, `send-${result.at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, exchanges: exchanges.length }, null, 2));
  console.log('บันทึกผลไว้ที่', file);
  if (args.headed) await page.waitForTimeout(5000);
  await context.close();
}
