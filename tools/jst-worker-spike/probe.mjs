// Step 7: ตรวจ session ทุก N นาที (config.probeMinutes, ค่าเริ่ม 30) เขียน logs/session-probe.jsonl — ปล่อยทิ้งไว้ 24–72 ชม.
// node probe.mjs   (หยุดด้วย Ctrl+C)
import { checkSession, loadConfig, logLine } from './lib.mjs';

const config = loadConfig();
const every = config.probeMinutes * 60 * 1000;
let firstLost = null;
console.log(`ตรวจ session ทุก ${config.probeMinutes} นาที → logs/session-probe.jsonl (Ctrl+C เพื่อหยุด)`);
for (;;) {
  const r = await checkSession(config);
  logLine('session-probe.jsonl', r);
  if (!r.logged_in && !firstLost) firstLost = new Date();
  console.log(new Date().toLocaleString('th-TH'), r.logged_in ? `ล็อกอินอยู่ (${r.sessions} ห้อง)` : `หลุด${firstLost ? ' ตั้งแต่ ' + firstLost.toLocaleString('th-TH') : ''}`);
  await new Promise((res) => setTimeout(res, every));
}
