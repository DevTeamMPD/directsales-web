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
  sleep,
  log = () => {},
  budgetMs = 40_000,
  maxLinks = 10,
  leaseSeconds = 90,
  createJst = createJstClient,
  createWorkerFn = createWorker,
}) {
  const started = now();
  const begun = await queue.stateBegin(workerId, leaseSeconds);
  if (!begun) return { skipped: 'busy' };

  const store = memoryStore(begun.cookies);
  const jst = createJst({ ...jstConfig, sessionStore: store });
  const worker = createWorkerFn({ jst, queue, clock: { now }, sleep, log, config: { workerId }, initialState: begun.runtime });

  let out;
  let failure = null;
  try {
    out = await worker.tick({ deadlineMs: started + budgetMs, maxLinks });
  } catch (e) {
    failure = e;
  }
  // บันทึกเสมอ (ปล่อย lease + เก็บ pendingReports) · cookie เขียนกลับเฉพาะเมื่อ JST เปลี่ยนค่า
  await queue.stateEnd(workerId, worker.exportState(), store.dirty ? store.cookies() : null);
  if (failure) throw failure;
  return { skipped: null, ...out, cookiesSaved: store.dirty };
}
