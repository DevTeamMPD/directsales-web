// node --test — โหมดรอบ (Vercel): initialState / exportState / tick (fake jst / queue / clock)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaRequired, JstError, SessionExpired } from './jst-client.mjs';
import { createWorker } from './worker-core.mjs';

const ROOM = { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'P', name: 'คุณเอ', expired: false };
const job = (over = {}) => ({
  id: 'q1', ms_id: 555, target_ms_id: 555, test_redirect: false, page: 'P', provider: 'Line',
  chat_name: 'คุณเอ', message: 'สวัสดีค่ะ', attempts: 1, enqueued_at: '2026-11-20T03:00:00.000Z', requested_by: 'u1', ...over,
});
const targets = (n) => Array.from({ length: n }, (_, i) => ({ buyer_id: `buyer${i + 1}`, shop_prefix: 'LOA' }));
const T0 = Date.parse('2026-11-26T04:00:00Z');
const copy = (x) => JSON.parse(JSON.stringify(x));

function setup({ jobs = [], linkTargets = [], jst = {}, initialState, config = {} } = {}) {
  const queue = {
    jobs: [...jobs], targets: [...linkTargets], reports: [], heartbeats: [], saves: [], claims: 0, claimError: null, reportError: null,
    async claim() {
      queue.claims++;
      if (queue.claimError) throw queue.claimError;
      return queue.jobs.shift() ?? null;
    },
    async report(id, status, error, jstMsgId) {
      if (queue.reportError) throw queue.reportError;
      queue.reports.push({ id, status, error, jstMsgId });
    },
    async heartbeat(workerId, state, sessionOk, lastError) {
      queue.heartbeats.push({ workerId, state, sessionOk, lastError });
    },
    async linkTargets() {
      const t = queue.targets;
      queue.targets = [];
      return t;
    },
    async linkSave(w, id, rooms) {
      queue.saves.push(id);
      return rooms.length;
    },
  };
  const j = {
    sends: [], searches: [], pings: 0, logins: 0,
    async room(msId) {
      return { ...ROOM, msId: Number(msId) };
    },
    async recentMessages() {
      return [];
    },
    async send(room, text) {
      j.sends.push(text);
      return { ok: true, raw: { success: true, data: { msg_id: 1 } } };
    },
    async searchByBuyerId(id) {
      j.searches.push(id);
      return [];
    },
    async ping() {
      j.pings++;
      return true;
    },
    async login() {
      j.logins++;
    },
    sessionMtime: () => 0,
    ...jst,
  };
  const clock = { t: T0, now: () => clock.t };
  const worker = createWorker({
    jst: j, queue, clock, log: () => {},
    sleep: async (ms) => {
      clock.t += ms;
    },
    config: { workerId: 'w1', ...config },
    initialState,
  });
  return { worker, queue, jst: j, clock };
}

test('exportState → initialState keeps a pause across workers', async () => {
  const failing = { async send() { throw new JstError('boom'); } };
  const a = setup({ jobs: [1, 2, 3, 4, 5].map((n) => job({ id: `q${n}` })), jst: failing });
  for (let i = 0; i < 5; i++) await a.worker.processOne();
  const saved = copy(a.worker.exportState());
  assert.equal(saved.state, 'paused');
  assert.equal(saved.failures, 5);

  const b = setup({ jobs: [job()], initialState: saved });
  assert.equal(await b.worker.processOne(), 'paused');
  assert.equal(b.queue.claims, 0);
  b.clock.t += 16 * 60_000;
  assert.equal(await b.worker.processOne(), 'sent');
});

test('needs_login survives; state set back to running (session upload) resumes', async () => {
  const a = setup({
    jobs: [job()],
    jst: { async room() { throw new SessionExpired(); }, async login() { throw new CaptchaRequired(); } },
  });
  assert.equal(await a.worker.processOne(), 'requeued');
  const saved = copy(a.worker.exportState());
  assert.equal(saved.state, 'needs_login');
  assert.equal(saved.sessionOk, false);

  const b = setup({ jobs: [job()], initialState: saved });
  assert.equal(await b.worker.processOne(), 'needs_login');
  assert.equal(b.queue.claims, 0);

  const c = setup({ jobs: [job()], initialState: { ...saved, state: 'running' } });
  assert.equal(await c.worker.processOne(), 'sent');
});

test('a report that could not be delivered is flushed by the next worker before it claims', async () => {
  const a = setup({ jobs: [job()] });
  a.queue.reportError = new Error('supabase down');
  await assert.rejects(a.worker.processOne(), /queue_unavailable/);
  const saved = copy(a.worker.exportState());
  assert.equal(saved.pendingReports.length, 1);
  assert.equal(saved.pendingReports[0].status, 'sent');

  const b = setup({ initialState: saved });
  assert.equal(await b.worker.processOne(), 'idle');
  assert.deepEqual(b.queue.reports.map((r) => [r.id, r.status]), [['q1', 'sent']]);
  assert.equal(b.worker.exportState().pendingReports.length, 0);
});

test('tick sends at most one job, heartbeats once and does not ping after a JST call', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job(), job({ id: 'q2' })] });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'sent');
  assert.equal(out.state, 'running');
  assert.equal(jst.sends.length, 1);
  assert.equal(queue.jobs.length, 1);
  assert.equal(jst.pings, 0);
  assert.deepEqual(queue.heartbeats, [{ workerId: 'w1', state: 'running', sessionOk: true, lastError: null }]);
  assert.equal(worker.exportState().lastJstOkAt, clock.t);
});

test('tick with no job links up to maxLinks and keeps the rest for the next tick', async () => {
  const { worker, jst, clock } = setup({ linkTargets: targets(5) });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000, maxLinks: 3 });
  assert.equal(out.result, 'linked');
  assert.equal(out.links, 3);
  assert.deepEqual(jst.searches, ['buyer1', 'buyer2', 'buyer3']);
  assert.deepEqual(worker.exportState().linkTargets.map((t) => t.buyer_id), ['buyer4', 'buyer5']);
});

test('tick stops linking when the next lookup would pass the deadline', async () => {
  const { worker, jst, clock } = setup({ linkTargets: targets(5) });
  const out = await worker.tick({ deadlineMs: clock.t + 2000, maxLinks: 10 }); // ห่างกัน 1.5 วินาที → ได้ 2 รหัส
  assert.equal(out.links, 2);
  assert.equal(jst.searches.length, 2);
});

test('a quiet tick pings JST when the last success is older than pingAfterMs, then not again', async () => {
  const { worker, queue, jst, clock } = setup();
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'idle');
  assert.equal(out.pinged, true);
  assert.equal(jst.pings, 1);
  assert.equal(queue.heartbeats[0].sessionOk, true);
  clock.t += 60_000;
  const again = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(again.pinged, false);
  assert.equal(jst.pings, 1);
});

test('ping: an expired session logs in again; a captcha puts the worker in needs_login', async () => {
  let first = true;
  const a = setup({
    jst: {
      async ping() {
        if (first) {
          first = false;
          throw new SessionExpired();
        }
        return true;
      },
    },
  });
  await a.worker.tick({ deadlineMs: a.clock.t + 40_000 });
  assert.equal(a.jst.logins, 1);
  assert.deepEqual(a.queue.heartbeats[0], { workerId: 'w1', state: 'running', sessionOk: true, lastError: null });

  const b = setup({ jst: { async ping() { throw new SessionExpired(); }, async login() { throw new CaptchaRequired(); } } });
  const out = await b.worker.tick({ deadlineMs: b.clock.t + 40_000 });
  assert.equal(out.state, 'needs_login');
  assert.equal(b.queue.heartbeats[0].state, 'needs_login');
  assert.equal(b.queue.heartbeats[0].sessionOk, false);
});

test('the login limit (3 per hour) carries over between ticks', async () => {
  const { worker, queue, jst, clock } = setup({
    jst: { async ping() { throw new SessionExpired(); } },
    initialState: { loginTimes: [T0 - 60_000, T0 - 120_000, T0 - 180_000] },
  });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(jst.logins, 0);
  assert.equal(out.state, 'needs_login');
  assert.match(queue.heartbeats[0].lastError, /^login_limit/);
});

test('a stopped worker stays stopped: no claim, no ping, heartbeat says stopped', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job()], initialState: { state: 'stopped', lastError: 'ShapeError: x' } });
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'stopped');
  assert.equal(queue.claims, 0);
  assert.equal(jst.pings, 0);
  assert.deepEqual(queue.heartbeats[0], { workerId: 'w1', state: 'stopped', sessionOk: null, lastError: 'ShapeError: x' });
});

test('Supabase down during a tick: result queue_error, nothing sent', async () => {
  const { worker, queue, jst, clock } = setup({ jobs: [job()] });
  queue.claimError = new Error('fetch failed');
  const out = await worker.tick({ deadlineMs: clock.t + 40_000 });
  assert.equal(out.result, 'queue_error');
  assert.equal(jst.sends.length, 0);
});

test('garbage in initialState is ignored', () => {
  const { worker } = setup({ initialState: { state: 'weird', failures: 'x', loginTimes: 'no', pendingReports: [{}], linkTargets: [{ nope: 1 }], lastJstOkAt: 'x' } });
  assert.deepEqual(worker.exportState(), {
    state: 'running', sessionOk: null, lastError: null, failures: 0, pausedUntil: 0, loginTimes: [],
    pendingReports: [], linkTargets: [], linkPausedUntil: 0, lastJstOkAt: 0,
  });
});
