// One worker run (per-tick mode on Vercel): take lease -> load state -> worker.tick() -> save state.
// No I/O of its own: queue and the jst factory are injected (app/api/cron/outreach-tick/route.ts assembles them).
import { createJstClient } from './jst-client.mjs';
import { memoryStore } from './session-store.mjs';
import { createWorker } from './worker-core.mjs';

/**
 * -> { skipped: 'busy' } when the previous run has not finished
 * -> { skipped: null, result, links, pinged, state, cookiesSaved }
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
  // Always save (releases the lease + keeps pendingReports); write cookies back only if JST changed them
  await queue.stateEnd(workerId, worker.exportState(), store.dirty ? store.cookies() : null);
  if (failure) throw failure;
  return { skipped: null, ...out, cookiesSaved: store.dirty };
}
