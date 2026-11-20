// Step 2: เปิด Chromium แบบเห็นหน้าจอให้ผู้ใช้ล็อกอิน JST ด้วยบัญชี User Dev เอง แล้วเก็บ session ไว้ใน .profile/
// node login.mjs
import { gotoChat, loadConfig, openJst, SEL } from './lib.mjs';

const config = loadConfig();
const { context, page } = await openJst(config, { headless: false });
await page.goto(config.jstUrl, { waitUntil: 'domcontentloaded' });
console.log('ล็อกอิน JST ในหน้าต่างที่เปิดขึ้นด้วยบัญชี User Dev (รอได้ถึง 10 นาที)…');
try {
  await page.locator(SEL.searchInput).first().waitFor({ state: 'visible', timeout: 10 * 60 * 1000 });
} catch {
  console.error('ไม่เห็นหน้าแชตภายใน 10 นาที — ถ้าล็อกอินแล้วแต่ไปหน้าอื่น ให้เปิด', config.jstUrl, 'ในหน้าต่างนั้นแล้วรันใหม่');
  await context.close();
  process.exit(1);
}
const r = await gotoChat(page, config);
console.log(JSON.stringify({ logged_in: r.loggedIn, sessions: r.sessions }));
console.log('บันทึก session ไว้ที่', config.profileDir, '(ห้ามแชร์/commit โฟลเดอร์นี้)');
await context.close();
