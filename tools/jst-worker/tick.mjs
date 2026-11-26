// หนึ่งรอบของ worker (โหมดรอบบน Vercel): ถือ lease → โหลดสถานะ → worker.tick() → บันทึกสถานะ
// ไม่มี I/O ของตัวเอง — รับ queue / ตัวสร้าง jst เข้ามา (app/api/cron/outreach-tick/route.ts เป็นผู้ประกอบ)
import { createJstClient } from './jst-client.mjs';
import { memoryStore } from './session-store.mjs';
import { createWorker } from './worker-core.mjs';

/**
 * → { skipped: 'busy' } เมื่อรอบก่อนยังไม่จบ
 * → { skipped: null, result, links, pinged, state, cookiesSaved }
 */
export async function runTick({
  workerId,
  queue,
  jstConfig = {},
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = (_level, _msg, _fields) => {},
  budgetMs = 40_000,
  maxLinks = 10,
  leaseSeconds = 90,
  createJst = createJstClient,
  createWorkerFn = createWorker,
}) {
  const started = now();
  const begun = await queue.stateBegin(workerId, leaseSeconds);
  if (!begun) return { skipped: 'busy' };

  let store;
  let worker;
  let out = null;
  let failure = null;
  try {
    store = memoryStore(begun.cookies);
    const jst = createJst({ ...jstConfig, sessionStore: store });
    worker = createWorkerFn({ jst, queue, clock: { now }, sleep, log, config: { workerId }, initialState: begun.runtime });
  } catch (e) {
    // ตั้งค่าไม่สำเร็จ: ปล่อย lease ด้วย runtime เดิม (ทำเต็มที่) แล้วโยน error ของการตั้งค่า
    try {
      await queue.stateEnd(workerId, begun.runtime ?? {}, null);
    } catch (e2) {
      log('error', 'state save failed', { error: String(e2?.message || e2).slice(0, 200), result: null });
    }
    throw e;
  }
  try {
    out = await worker.tick({ deadlineMs: started + budgetMs, maxLinks });
  } catch (e) {
    failure = e;
  }
  // บันทึกเสมอ (ปล่อย lease + เก็บ pendingReports) · cookie เขียนกลับเฉพาะเมื่อ JST เปลี่ยนค่า · ลองซ้ำหนึ่งครั้ง
  let saveError = null;
  const cookiesOut = store.dirty ? store.cookies() : null;
  for (let i = 0; i < 2; i++) {
    try {
      await queue.stateEnd(workerId, worker.exportState(), cookiesOut);
      saveError = null;
      break;
    } catch (e) {
      saveError = e;
    }
  }
  // ถ้าพังเพราะ cookie (เช่น DB ปฏิเสธ invalid_cookies) อย่างน้อยเก็บ runtime (loginTimes / needs_login) ไว้
  if (saveError && cookiesOut !== null) {
    log('error', 'state save with cookies failed — saving runtime only', { error: String(saveError?.message || saveError).slice(0, 200), result: out?.result ?? null });
    try {
      await queue.stateEnd(workerId, worker.exportState(), null);
      saveError = null;
    } catch (e) {
      saveError = e;
    }
  }
  if (saveError) log('error', 'state save failed', { error: String(saveError?.message || saveError).slice(0, 200), result: out?.result ?? null });
  if (failure) throw failure; // error ของ tick มาก่อน
  if (saveError) throw saveError;
  return { skipped: null, ...out, cookiesSaved: store.dirty };
}
