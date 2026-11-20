// node --test   (createClient ปลอม — ไม่มี network)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueueClient, QueueError } from './queue-client.mjs';

function fakeCreateClient(log, { signInError = null, rpcResult = () => ({ data: null, error: null }) } = {}) {
  return (url, key, opts) => {
    log.push({ create: { url, key, opts } });
    return {
      auth: {
        async signInWithPassword(creds) {
          log.push({ signIn: creds.email });
          return signInError ? { data: null, error: { message: signInError } } : { data: { session: {} }, error: null };
        },
      },
      async rpc(name, args) {
        log.push({ rpc: name, args });
        return rpcResult(name, args);
      },
    };
  };
}

const base = { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', email: 'w@x', password: 'pw' };

test('signs in once with dsales schema options, then calls RPCs with contract args', async () => {
  const log = [];
  const job = { id: 'q1', target_ms_id: 1 };
  const q = createQueueClient({ ...base, createClient: fakeCreateClient(log, { rpcResult: (n) => ({ data: n === 'dsales_worker_claim' ? job : null, error: null }) }) });
  assert.deepEqual(log[0].create.opts, { db: { schema: 'dsales' }, auth: { persistSession: false, autoRefreshToken: true } });
  assert.deepEqual(await q.claim('w1'), job);
  await q.report('q1', 'sent', null, 42);
  await q.heartbeat('w1', 'running', true, null);
  assert.equal(log.filter((l) => l.signIn).length, 1);
  const rpcs = log.filter((l) => l.rpc);
  assert.deepEqual(rpcs.map((r) => [r.rpc, r.args]), [
    ['dsales_worker_claim', { p_worker: 'w1' }],
    ['dsales_worker_report', { p_id: 'q1', p_status: 'sent', p_error: null, p_jst_msg_id: '42' }],
    ['dsales_worker_heartbeat', { p_worker: 'w1', p_state: 'running', p_session_ok: true, p_last_error: null }],
  ]);
});

test('claim with no job returns null; RPC error throws QueueError', async () => {
  const log = [];
  const q = createQueueClient({ ...base, createClient: fakeCreateClient(log, { rpcResult: (n) => (n === 'dsales_worker_report' ? { data: null, error: { message: 'invalid_state' } } : { data: null, error: null }) }) });
  assert.equal(await q.claim('w1'), null);
  await assert.rejects(q.report('q1', 'sent'), (e) => e instanceof QueueError && /invalid_state/.test(e.message));
});

test('sign-in failure throws and is retried on the next call', async () => {
  const log = [];
  const q = createQueueClient({ ...base, createClient: fakeCreateClient(log, { signInError: 'Invalid login credentials' }) });
  await assert.rejects(q.claim('w1'), QueueError);
  await assert.rejects(q.claim('w1'), QueueError);
  assert.equal(log.filter((l) => l.signIn).length, 2);
  assert.equal(log.filter((l) => l.rpc).length, 0);
});
