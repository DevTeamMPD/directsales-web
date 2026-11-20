// node --test   (fake jst / queue / clock — ไม่มี network)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaRequired, JstError, LoginFailed, SessionExpired, ShapeError } from './jst-client.mjs';
import { createWorker, extractMsgId, findAlreadySent, parseJstTime, QueueUnavailable } from './worker-core.mjs';

const ENQ = '2026-11-20T03:00:00.000Z'; // = 10:00 เวลาไทย

function job(over = {}) {
  return {
    id: 'q1', ms_id: 555, target_ms_id: 555, test_redirect: false, page: 'Bebeplay OA', provider: 'Line',
    chat_name: 'คุณเอ', message: 'สวัสดีค่ะ', attempts: 1, enqueued_at: ENQ, requested_by: 'u1', ...over,
  };
}
const ROOM = { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'Bebeplay OA', name: 'คุณเอ ', expired: false };

function fakeQueue(jobs = []) {
  const q = {
    jobs: [...jobs], reports: [], heartbeats: [], claims: 0,
    claimError: null, reportError: null,
    async claim(workerId) {
      q.claims++;
      if (q.claimError) throw q.claimError;
      assert.equal(workerId, 'w1');
      return q.jobs.shift() ?? null;
    },
    async report(id, status, error, jstMsgId) {
      if (q.reportError) throw q.reportError;
      q.reports.push({ id, status, error, jstMsgId });
    },
    async heartbeat(workerId, state, sessionOk, lastError) {
      q.heartbeats.push({ workerId, state, sessionOk, lastError });
    },
  };
  return q;
}

function fakeJst(over = {}) {
  const j = {
    sends: [], rooms: [], logins: 0, mtime: 1000, reloads: 0,
    async room(msId) {
      j.rooms.push(msId);
      return { ...ROOM, msId: Number(msId) };
    },
    async recentMessages() {
      return [];
    },
    async send(room, text) {
      j.sends.push({ msId: room.msId, text });
      return { ok: true, raw: { success: true, data: { msg_id: 4242 } } };
    },
    async login() {
      j.logins++;
    },
    sessionMtime: () => j.mtime,
    reloadSession() {
      j.reloads++;
    },
    ...over,
  };
  return j;
}

function setup({ jobs = [], jst = {}, config = {} } = {}) {
  const queue = fakeQueue(jobs);
  const j = fakeJst(jst);
  const clock = { t: Date.parse('2026-11-20T04:00:00Z'), now: () => clock.t };
  const sleeps = [];
  const worker = createWorker({
    jst: j, queue, clock, log: () => {},
    sleep: async (ms) => {
      sleeps.push(ms);
      clock.t += ms;
    },
    config: { workerId: 'w1', ...config },
  });
  return { worker, queue, jst: j, clock, sleeps };
}

/* ---------- helpers ---------- */

test('parseJstTime: Bangkok local strings, seconds, ms, ISO', () => {
  assert.equal(parseJstTime('2026-11-20 10:00:00'), Date.parse(ENQ));
  assert.equal(parseJstTime(1795600000), 1795600000000);
  assert.equal(parseJstTime('1795600000000'), 1795600000000);
  assert.equal(parseJstTime('2026-11-20T03:00:00Z'), Date.parse(ENQ));
  assert.equal(parseJstTime('nope'), null);
  assert.equal(parseJstTime(null), null);
});

test('extractMsgId handles number, string and object data', () => {
  assert.equal(extractMsgId({ data: 12 }), '12');
  assert.equal(extractMsgId({ data: 'abc' }), 'abc');
  assert.equal(extractMsgId({ data: { msg_id: 7 } }), '7');
  assert.equal(extractMsgId({ data: null }), null);
  assert.equal(extractMsgId({ data: true }), null);
});

test('findAlreadySent: Out + same text + after enqueue only', () => {
  const m = (o) => ({ msgId: 1, io: 'Out', content: 'สวัสดีค่ะ', status: 'ok', sendTime: '2026-11-20 10:05:00', ...o });
  assert.ok(findAlreadySent([m()], ' สวัสดีค่ะ ', ENQ));
  assert.equal(findAlreadySent([m({ io: 'In' })], 'สวัสดีค่ะ', ENQ), null);
  assert.equal(findAlreadySent([m({ content: 'อื่น' })], 'สวัสดีค่ะ', ENQ), null);
  assert.equal(findAlreadySent([m({ sendTime: '2026-11-20 09:59:00' })], 'สวัสดีค่ะ', ENQ), null);
  assert.equal(findAlreadySent([m({ sendTime: 'garbage' })], 'สวัสดีค่ะ', ENQ), null);
});

/* ---------- processOne ---------- */

test('no job → idle, nothing sent', async () => {
  const { worker, jst, queue } = setup();
  assert.equal(await worker.processOne(), 'idle');
  assert.equal(jst.sends.length, 0);
  assert.equal(queue.reports.length, 0);
});

test('happy path: room → send → report sent with jst msg id', async () => {
  const { worker, jst, queue } = setup({ jobs: [job()] });
  assert.equal(await worker.processOne(), 'sent');
  assert.deepEqual(jst.sends, [{ msId: 555, text: 'สวัสดีค่ะ' }]);
  assert.deepEqual(queue.reports, [{ id: 'q1', status: 'sent', error: null, jstMsgId: '4242' }]);
  assert.equal(worker.status.sessionOk, true);
});

test('test redirect: sends message to target_ms_id and skips the name check', async () => {
  const j = job({ ms_id: 555, target_ms_id: 111, test_redirect: true, chat_name: 'ลูกค้าจริง', message: '[ทดสอบ → ลูกค้าจริง] สวัสดีค่ะ' });
  const { worker, jst, queue } = setup({ jobs: [j], jst: { async room(id) { return { ...ROOM, msId: id, name: 'ห้องทดสอบพนักงาน' }; } } });
  assert.equal(await worker.processOne(), 'sent');
  assert.deepEqual(jst.sends, [{ msId: 111, text: '[ทดสอบ → ลูกค้าจริง] สวัสดีค่ะ' }]);
  assert.equal(queue.reports[0].status, 'sent');
});

test('room_mismatch only in normal mode', async () => {
  const jstOver = { async room(id) { return { ...ROOM, msId: id, name: 'คนอื่น' }; } };
  const a = setup({ jobs: [job()], jst: jstOver });
  assert.equal(await a.worker.processOne(), 'failed');
  assert.deepEqual(a.queue.reports, [{ id: 'q1', status: 'failed', error: 'room_mismatch', jstMsgId: null }]);
  assert.equal(a.jst.sends.length, 0);

  const b = setup({ jobs: [job({ test_redirect: true, target_ms_id: 111 })], jst: jstOver });
  assert.equal(await b.worker.processOne(), 'sent');

  const c = setup({ jobs: [job({ chat_name: null })], jst: jstOver });
  assert.equal(await c.worker.processOne(), 'sent'); // ไม่มี chat_name ให้เทียบ
});

test('room not found → failed room_not_found', async () => {
  const { worker, queue, jst } = setup({ jobs: [job()], jst: { async room() { return null; } } });
  assert.equal(await worker.processOne(), 'failed');
  assert.equal(queue.reports[0].error, 'room_not_found');
  assert.equal(jst.sends.length, 0);
});

test('expired room → failed window_closed', async () => {
  const { worker, queue, jst } = setup({ jobs: [job()], jst: { async room(id) { return { ...ROOM, msId: id, expired: true }; } } });
  assert.equal(await worker.processOne(), 'failed');
  assert.equal(queue.reports[0].error, 'window_closed');
  assert.equal(jst.sends.length, 0);
});

test('retry (attempts > 1): already sent after enqueue → report sent without sending', async () => {
  let asked = 0;
  const { worker, queue, jst } = setup({
    jobs: [job({ attempts: 2 })],
    jst: {
      async recentMessages(room) {
        asked++;
        assert.equal(room.coId, 9);
        return [{ msgId: 99, io: 'Out', content: 'สวัสดีค่ะ', status: 'ok', sendTime: '2026-11-20 10:01:00' }];
      },
    },
  });
  assert.equal(await worker.processOne(), 'sent');
  assert.equal(asked, 1);
  assert.equal(jst.sends.length, 0);
  assert.deepEqual(queue.reports, [{ id: 'q1', status: 'sent', error: null, jstMsgId: '99' }]);
});

test('retry with no matching message → sends; first attempt never checks history', async () => {
  let asked = 0;
  const jstOver = { async recentMessages() { asked++; return [{ msgId: 1, io: 'Out', content: 'สวัสดีค่ะ', sendTime: '2026-11-20 09:00:00' }]; } };
  const a = setup({ jobs: [job({ attempts: 3 })], jst: jstOver });
  assert.equal(await a.worker.processOne(), 'sent');
  assert.equal(a.jst.sends.length, 1);
  assert.equal(asked, 1);

  const b = setup({ jobs: [job({ attempts: 1 })], jst: jstOver });
  await b.worker.processOne();
  assert.equal(asked, 1);
});

test('JstError → requeue with jst_error message', async () => {
  const { worker, queue } = setup({ jobs: [job()], jst: { async send() { throw new JstError('ห้องนี้ไม่ได้รับอนุญาต'); } } });
  assert.equal(await worker.processOne(), 'requeued');
  assert.deepEqual(queue.reports, [{ id: 'q1', status: 'requeue', error: 'jst_error: ห้องนี้ไม่ได้รับอนุญาต', jstMsgId: null }]);
  assert.equal(worker.status.state, 'running');
});

test('SessionExpired → login once → retry succeeds', async () => {
  let calls = 0;
  const { worker, queue, jst } = setup({
    jobs: [job()],
    jst: {
      async room(id) {
        calls++;
        if (calls === 1) throw new SessionExpired();
        return { ...ROOM, msId: id };
      },
    },
  });
  assert.equal(await worker.processOne(), 'sent');
  assert.equal(jst.logins, 1);
  assert.equal(jst.sends.length, 1);
  assert.equal(queue.reports[0].status, 'sent');
  assert.equal(worker.status.sessionOk, true);
});

test('SessionExpired again after re-login → requeue + needs_login', async () => {
  const { worker, queue, jst } = setup({ jobs: [job(), job({ id: 'q2' })], jst: { async room() { throw new SessionExpired(); } } });
  assert.equal(await worker.processOne(), 'requeued');
  assert.equal(jst.logins, 1);
  assert.equal(queue.reports[0].status, 'requeue');
  assert.equal(worker.status.state, 'needs_login');
  assert.equal(await worker.processOne(), 'needs_login');
  assert.equal(queue.claims, 1);
});

test('re-login limited to 3 per hour', async () => {
  let loggedIn = 0;
  const jobs = Array.from({ length: 5 }, (_, i) => job({ id: `q${i}` }));
  const { worker, jst, clock } = setup({
    jobs,
    jst: {
      async room(id) {
        // ทุก job: ครั้งแรกหลุด ครั้งที่สอง (หลังล็อกอิน) ผ่าน
        if (loggedIn === jst.logins) throw new SessionExpired();
        loggedIn = jst.logins;
        return { ...ROOM, msId: id };
      },
    },
  });
  for (let i = 0; i < 3; i++) {
    assert.equal(await worker.processOne(), 'sent');
    clock.t += 60_000;
  }
  assert.equal(await worker.processOne(), 'requeued');
  assert.equal(jst.logins, 3);
  assert.equal(worker.status.state, 'needs_login');
  assert.match(worker.status.lastError, /login_limit/);
});

test('CaptchaRequired → needs_login, no further sends until the session file changes', async () => {
  const jobs = [job(), job({ id: 'q2' }), job({ id: 'q3' })];
  let expired = true;
  const { worker, queue, jst } = setup({
    jobs,
    jst: {
      async room(id) {
        if (expired) throw new SessionExpired();
        return { ...ROOM, msId: id };
      },
      async login() {
        throw new CaptchaRequired();
      },
    },
  });
  assert.equal(await worker.processOne(), 'requeued');
  assert.equal(worker.status.state, 'needs_login');
  assert.equal(worker.status.sessionOk, false);
  assert.deepEqual(queue.reports[0], { id: 'q1', status: 'requeue', error: 'session_expired', jstMsgId: null });

  for (let i = 0; i < 3; i++) assert.equal(await worker.processOne(), 'needs_login');
  assert.equal(queue.claims, 1);
  assert.equal(jst.sends.length, 0);

  // ผู้ใช้รัน import-session.mjs → ไฟล์ session เปลี่ยน → ทำงานต่อ
  expired = false;
  jst.mtime = 2000;
  assert.equal(await worker.processOne(), 'sent');
  assert.equal(jst.reloads, 1);
  assert.equal(worker.status.state, 'running');
});

test('LoginFailed → needs_login', async () => {
  const { worker } = setup({ jobs: [job()], jst: { async room() { throw new SessionExpired(); }, async login() { throw new LoginFailed('bad password'); } } });
  await worker.processOne();
  assert.equal(worker.status.state, 'needs_login');
  assert.match(worker.status.lastError, /bad password/);
});

test('ShapeError → requeue + stopped, loop stops claiming', async () => {
  const { worker, queue, jst } = setup({ jobs: [job(), job({ id: 'q2' })], jst: { async room() { throw new ShapeError('/iim/getSessions: bad field(s) name'); } } });
  assert.equal(await worker.processOne(), 'requeued');
  assert.equal(queue.reports[0].status, 'requeue');
  assert.equal(worker.status.state, 'stopped');
  assert.equal(await worker.processOne(), 'stopped');
  assert.equal(queue.claims, 1);
  assert.equal(jst.sends.length, 0);
});

test('5 consecutive failures → paused 15 min, then resumes', async () => {
  const jobs = Array.from({ length: 7 }, (_, i) => job({ id: `q${i}` }));
  let fail = true;
  const { worker, queue, clock } = setup({
    jobs,
    jst: {
      async send(room, text) {
        if (fail) throw new JstError('boom');
        return { ok: true, raw: { success: true, data: 1 } };
      },
    },
  });
  for (let i = 0; i < 5; i++) assert.equal(await worker.processOne(), 'requeued');
  assert.equal(worker.status.state, 'paused');
  assert.equal(await worker.processOne(), 'paused');
  assert.equal(queue.claims, 5);

  clock.t += 14 * 60_000;
  assert.equal(await worker.processOne(), 'paused');
  clock.t += 2 * 60_000;
  fail = false;
  assert.equal(await worker.processOne(), 'sent');
  assert.equal(worker.status.state, 'running');
  assert.equal(worker.status.failures, 0);
});

test('a success resets the failure counter', async () => {
  const jobs = Array.from({ length: 9 }, (_, i) => job({ id: `q${i}` }));
  let n = 0;
  const { worker } = setup({
    jobs,
    jst: {
      async send() {
        n++;
        if (n === 5) return { ok: true, raw: { success: true } };
        throw new JstError('boom');
      },
    },
  });
  for (let i = 0; i < 8; i++) await worker.processOne();
  assert.equal(worker.status.state, 'running');
  assert.equal(worker.status.failures, 3);
});

test('claim fails → QueueUnavailable, JST never touched', async () => {
  const { worker, queue, jst } = setup({ jobs: [job()] });
  queue.claimError = new Error('fetch failed');
  await assert.rejects(worker.processOne(), QueueUnavailable);
  assert.equal(jst.rooms.length, 0);
  assert.equal(jst.sends.length, 0);
});

test('report fails after a send → kept pending, retried before the next claim, no new sends meanwhile', async () => {
  const { worker, queue, jst } = setup({ jobs: [job(), job({ id: 'q2' })] });
  queue.reportError = new Error('network down');
  await assert.rejects(worker.processOne(), QueueUnavailable);
  assert.equal(jst.sends.length, 1);
  assert.equal(worker.status.pendingReports, 1);

  await assert.rejects(worker.processOne(), QueueUnavailable); // ยังรายงานไม่ได้ → ไม่ claim ไม่ส่ง
  assert.equal(queue.claims, 1);
  assert.equal(jst.sends.length, 1);

  queue.reportError = null;
  assert.equal(await worker.processOne(), 'sent');
  assert.deepEqual(queue.reports.map((r) => [r.id, r.status]), [['q1', 'sent'], ['q2', 'sent']]);
  assert.equal(jst.sends.length, 2);
});

test('pending report rejected as invalid_state (released as stale) is dropped', async () => {
  const { worker, queue } = setup({ jobs: [job()] });
  queue.reportError = new Error('network down');
  await assert.rejects(worker.processOne(), QueueUnavailable);
  queue.reportError = new Error('dsales_worker_report: invalid_state');
  assert.equal(await worker.processOne(), 'idle');
  assert.equal(worker.status.pendingReports, 0);
});

test('invalid claim shape → stopped, nothing sent', async () => {
  const { worker, jst, queue } = setup({ jobs: [job({ target_ms_id: null })] });
  assert.equal(await worker.processOne(), 'stopped');
  assert.equal(jst.sends.length, 0);
  assert.equal(queue.reports[0].status, 'requeue');
  assert.equal(worker.status.state, 'stopped');
});

/* ---------- run ---------- */

test('run --once: heartbeat, one job, final heartbeat', async () => {
  const { worker, queue, jst } = setup({ jobs: [job(), job({ id: 'q2' })] });
  assert.equal(await worker.run({ once: true }), 'sent');
  assert.equal(jst.sends.length, 1);
  assert.ok(queue.heartbeats.length >= 2);
  assert.deepEqual(queue.heartbeats[0], { workerId: 'w1', state: 'running', sessionOk: null, lastError: null });
  assert.equal(queue.heartbeats.at(-1).sessionOk, true);
});

test('run: idle polls every pollSeconds, heartbeat every 60 s, stop() sends final stopped heartbeat', async () => {
  const { worker, queue, sleeps } = setup({ config: { pollSeconds: 5 } });
  const origClaim = queue.claim;
  queue.claim = async (w) => {
    if (queue.claims >= 30) worker.stop();
    return origClaim(w);
  };
  await worker.run();
  assert.ok(sleeps.every((ms) => ms === 5000));
  const states = queue.heartbeats.map((h) => h.state);
  assert.equal(states.at(-1), 'stopped');
  // 30 รอบ × 5 วินาที = 150 วินาที → heartbeat ตอนเริ่ม + ทุก 60 วินาที (2) + ตอนหยุด
  assert.equal(queue.heartbeats.length, 4);
});

test('run: Supabase failures back off 5 s → 60 s and never call JST', async () => {
  const { worker, queue, jst, sleeps } = setup({ jobs: [job()] });
  queue.claimError = new Error('503');
  const origSleep = sleeps.push.bind(sleeps);
  sleeps.push = (ms) => {
    origSleep(ms);
    if (sleeps.length >= 7) worker.stop();
    return sleeps.length;
  };
  await worker.run();
  assert.deepEqual(sleeps.slice(0, 7), [5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  assert.equal(jst.rooms.length, 0);
  assert.equal(jst.sends.length, 0);
  assert.match(worker.status.lastError, /queue_unavailable/);
});

test('run --once with Supabase down → returns queue_error', async () => {
  const { worker, queue } = setup();
  queue.claimError = new Error('down');
  assert.equal(await worker.run({ once: true }), 'queue_error');
});
