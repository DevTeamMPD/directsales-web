// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSession } from './import-session.mjs';

const JAR = [{ name: 'sid', value: 'secret-cookie-value' }];

function setup(results) {
  const calls = [];
  const sleeps = [];
  const logs = [];
  const queue = {
    async sessionPut(workerId, jar) {
      calls.push([workerId, jar]);
      const r = results[Math.min(calls.length - 1, results.length - 1)];
      if (r instanceof Error) throw r;
    },
  };
  const opts = { sleep: async (ms) => sleeps.push(ms), log: (m) => logs.push(m), attempts: 6, waitMs: 10_000 };
  return { calls, sleeps, logs, queue, opts };
}

test('uploadSession: success on first try does not wait', async () => {
  const s = setup([null]);
  await uploadSession(s.queue, 'vercel', JAR, s.opts);
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.calls[0], ['vercel', JAR]);
  assert.deepEqual(s.sleeps, []);
  assert.deepEqual(s.logs, []);
});

test('uploadSession: worker_busy then success waits 10s once', async () => {
  const s = setup([new Error('worker_busy'), null]);
  await uploadSession(s.queue, 'vercel', JAR, s.opts);
  assert.equal(s.calls.length, 2);
  assert.deepEqual(s.sleeps, [10_000]);
  assert.equal(s.logs.length, 1);
  assert.match(s.logs[0], /รอ 10 วินาที/);
});

test('uploadSession: busy 6 times throws without a 7th call and never logs cookies', async () => {
  const s = setup([new Error('worker_busy')]);
  await assert.rejects(() => uploadSession(s.queue, 'vercel', JAR, s.opts), /worker_busy/);
  assert.equal(s.calls.length, 6);
  assert.equal(s.sleeps.length, 5);
  assert.ok(!s.logs.join('\n').includes('secret-cookie-value'));
});

test('uploadSession: any other error throws immediately', async () => {
  const s = setup([new Error('not_worker')]);
  await assert.rejects(() => uploadSession(s.queue, 'vercel', JAR, s.opts), /not_worker/);
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.sleeps, []);
});
