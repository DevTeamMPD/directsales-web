// node --test — runTick: lease → worker.tick → บันทึกสถานะ (fake queue / jst)
import test from 'node:test';
import assert from 'node:assert/strict';
import { runTick } from './tick.mjs';

const ROOM = { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'P', name: 'คุณเอ', expired: false };
const JOB = {
  id: 'q1', ms_id: 555, target_ms_id: 555, test_redirect: false, page: 'P', provider: 'Line',
  chat_name: 'คุณเอ', message: 'สวัสดีค่ะ', attempts: 1, enqueued_at: '2026-11-20T03:00:00.000Z', requested_by: 'u1',
};

function fakeQueue({ begun, jobs = [] } = {}) {
  const q = {
    begins: [], ends: [], reports: [], heartbeats: [], claims: 0, jobs: [...jobs],
    async stateBegin(workerId, lease) {
      q.begins.push([workerId, lease]);
      return begun === undefined ? { runtime: {}, cookies: [] } : begun;
    },
    async stateEnd(workerId, runtime, cookies) {
      q.ends.push({ workerId, runtime, cookies });
    },
    async claim() {
      q.claims++;
      return q.jobs.shift() ?? null;
    },
    async report(id, status) {
      q.reports.push([id, status]);
    },
    async heartbeat(workerId, state, sessionOk) {
      q.heartbeats.push([workerId, state, sessionOk]);
    },
    async linkTargets() {
      return [];
    },
    async linkSave() {
      return 0;
    },
  };
  return q;
}

/** createJst ปลอม: เก็บ options ที่ได้รับ · onPing ใช้จำลอง JST เปลี่ยน cookie */
function fakeJstFactory({ onPing = () => {} } = {}) {
  const seen = { opts: null, sends: [] };
  const create = (opts) => {
    seen.opts = opts;
    return {
      async room(msId) {
        return { ...ROOM, msId: Number(msId) };
      },
      async recentMessages() {
        return [];
      },
      async send(room, text) {
        seen.sends.push(text);
        return { ok: true, raw: { success: true, data: { msg_id: 9 } } };
      },
      async searchByBuyerId() {
        return [];
      },
      async ping() {
        onPing(opts.sessionStore);
        return true;
      },
      async login() {},
      sessionMtime: () => 0,
    };
  };
  return { create, seen };
}

const args = (over) => ({ workerId: 'vercel', jstConfig: { accountId: 'u', password: 'p' }, now: () => 1_000_000, sleep: async () => {}, ...over });

test('lease held → skipped, nothing else is called', async () => {
  const queue = fakeQueue({ begun: null });
  const { create, seen } = fakeJstFactory();
  assert.deepEqual(await runTick(args({ queue, createJst: create })), { skipped: 'busy' });
  assert.equal(seen.opts, null);
  assert.equal(queue.claims, 0);
  assert.equal(queue.ends.length, 0);
});

test('normal tick: stored cookies and runtime go in, one job is sent, state is saved without cookies', async () => {
  const queue = fakeQueue({ begun: { runtime: { failures: 2 }, cookies: [{ name: 'a', value: '1' }] }, jobs: [JOB] });
  const { create, seen } = fakeJstFactory();
  const out = await runTick(args({ queue, createJst: create }));
  assert.deepEqual(queue.begins, [['vercel', 90]]);
  assert.equal(seen.opts.accountId, 'u');
  assert.deepEqual(seen.opts.sessionStore.load(), [{ name: 'a', value: '1' }]);
  assert.deepEqual(seen.sends, ['สวัสดีค่ะ']);
  assert.deepEqual(queue.reports, [['q1', 'sent']]);
  assert.equal(out.skipped, null);
  assert.equal(out.result, 'sent');
  assert.equal(out.cookiesSaved, false);
  assert.equal(queue.ends.length, 1);
  assert.equal(queue.ends[0].workerId, 'vercel');
  assert.equal(queue.ends[0].runtime.state, 'running');
  assert.equal(queue.ends[0].runtime.failures, 0); // ส่งสำเร็จ = ล้างตัวนับ
  assert.equal(queue.ends[0].cookies, null);
});

test('cookies changed during the tick are written back', async () => {
  const queue = fakeQueue();
  const { create } = fakeJstFactory({ onPing: (store) => store.save([{ name: 'a', value: '2' }]) });
  const out = await runTick(args({ queue, createJst: create }));
  assert.equal(out.pinged, true);
  assert.equal(out.cookiesSaved, true);
  assert.deepEqual(queue.ends[0].cookies, [{ name: 'a', value: '2' }]);
});

test('state is still saved when the tick throws, and the error is rethrown', async () => {
  const queue = fakeQueue();
  const { create } = fakeJstFactory();
  const createWorkerFn = () => ({
    async tick() {
      throw new Error('boom');
    },
    exportState: () => ({ state: 'running', failures: 7 }),
  });
  await assert.rejects(runTick(args({ queue, createJst: create, createWorkerFn })), /boom/);
  assert.deepEqual(queue.ends, [{ workerId: 'vercel', runtime: { state: 'running', failures: 7 }, cookies: null }]);
});
