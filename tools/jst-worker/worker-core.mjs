// ตรรกะลูปหลักของ worker (ไม่มี I/O ของตัวเอง — รับ dependency เข้ามา เพื่อให้ test ได้)
// deps: { jst, queue, clock: { now() }, sleep(ms), log(level, msg, fields), config }
// สเปก §5 + สัญญา §2: ส่ง `message` ไปที่ `target_ms_id` เสมอ
import { CaptchaRequired, JstError, LoginFailed, LoginUnavailable, SessionExpired, ShapeError } from './jst-client.mjs';

export const STATES = Object.freeze({ running: 'running', paused: 'paused', needsLogin: 'needs_login', stopped: 'stopped' });

const DEFAULTS = {
  pollSeconds: 5,
  heartbeatSeconds: 60,
  pauseMinutes: 15,
  failureLimit: 5,
  maxLoginsPerHour: 3,
  backoffMinMs: 5000,
  backoffMaxMs: 60000,
  afterJobMs: 1000,
};

/** Supabase ใช้ไม่ได้ — ห้ามส่ง JST จนกว่าจะกลับมา */
export class QueueUnavailable extends Error {
  constructor(cause) {
    super(`queue_unavailable: ${cause?.message || cause}`);
    this.name = 'QueueUnavailable';
    this.cause = cause;
  }
}

const clip = (s, n = 300) => String(s ?? '').slice(0, n);

/**
 * เวลาของ JST → ms (หรือ null ถ้าอ่านไม่ได้)
 * ตัวเลข: วินาทีหรือมิลลิวินาที · 'YYYY-MM-DD HH:mm:ss' ไม่มีเขตเวลา = เวลาไทย (+07:00)
 */
export function parseJstTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n;
  }
  const s = String(v).trim();
  const local = /^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/.exec(s);
  if (local) {
    const [, y, mo, d, h, mi, se = '00', frac = ''] = local;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${se}${frac}+07:00`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** jst msg id จาก response ของ SendMsg (ยังไม่รู้รูปแบบแน่ — ลองหลายแบบ) */
export function extractMsgId(raw) {
  const d = raw?.data ?? raw?.Data;
  if (typeof d === 'number' || (typeof d === 'string' && d.trim() !== '')) return String(d);
  if (d && typeof d === 'object') {
    const v = d.msg_id ?? d.msgId ?? d.id ?? d.MsgId;
    if (v != null && v !== '') return String(v);
  }
  return null;
}

/** ข้อความเดียวกันจากฝั่งเรา (Out) ที่ส่งหลังเข้าคิว → ส่งไปแล้ว */
export function findAlreadySent(messages, text, enqueuedAt) {
  const since = Date.parse(enqueuedAt);
  const want = String(text).trim();
  return (
    messages.find((m) => {
      if (String(m.io).toLowerCase() !== 'out') return false;
      if (String(m.content).trim() !== want) return false;
      const t = parseJstTime(m.sendTime);
      // เวลาอ่านไม่ได้ = ไม่ถือว่าส่งแล้ว (ส่งซ้ำดีกว่ารายงานว่าส่งทั้งที่ไม่ได้ส่ง)
      return t != null && !Number.isNaN(since) && t >= since;
    }) || null
  );
}

export function createWorker({ jst, queue, clock = { now: () => Date.now() }, sleep, log = () => {}, config = {} }) {
  const cfg = { ...DEFAULTS, ...config };
  if (!cfg.workerId) throw new Error('config.workerId is required');

  const s = {
    state: STATES.running,
    sessionOk: null, // ยังไม่รู้จนกว่าจะเรียก JST สำเร็จ/ล้มเหลว
    lastError: null,
    failures: 0,
    pausedUntil: 0,
    loginTimes: [],
    needsLoginMtime: 0,
    lastHeartbeat: -Infinity,
    pendingReports: [],
    backoffMs: 0,
    stopRequested: false,
    sentCount: 0,
  };

  /* ---------- heartbeat ---------- */

  async function heartbeat({ force = false, state } = {}) {
    const now = clock.now();
    if (!force && now - s.lastHeartbeat < cfg.heartbeatSeconds * 1000) return;
    s.lastHeartbeat = now;
    try {
      await queue.heartbeat(cfg.workerId, state || s.state, s.sessionOk, s.lastError ? clip(s.lastError, 500) : null);
    } catch (e) {
      log('warn', 'heartbeat failed', { error: clip(e?.message) });
    }
  }

  function setState(state, lastError) {
    if (lastError !== undefined) s.lastError = lastError;
    if (s.state !== state) {
      log(state === STATES.running ? 'info' : 'warn', `state → ${state}`, { lastError: s.lastError });
      s.state = state;
      s.lastHeartbeat = -Infinity; // แจ้งสถานะใหม่ทันทีรอบถัดไป
    }
  }

  function enterNeedsLogin(reason) {
    s.sessionOk = false;
    setState(STATES.needsLogin, reason);
    s.needsLoginMtime = jst.sessionMtime ? jst.sessionMtime() : 0;
  }

  /* ---------- queue (ห้ามส่ง JST ถ้ารายงานผลไม่ได้) ---------- */

  async function report(job, d) {
    const item = { id: job.id, status: d.status, error: d.error ?? null, jstMsgId: d.jstMsgId ?? null };
    try {
      await queue.report(item.id, item.status, item.error, item.jstMsgId);
    } catch (e) {
      s.pendingReports.push(item);
      throw new QueueUnavailable(e);
    }
  }

  async function flushPending() {
    while (s.pendingReports.length) {
      const item = s.pendingReports[0];
      try {
        await queue.report(item.id, item.status, item.error, item.jstMsgId);
      } catch (e) {
        const msg = String(e?.message || e);
        // รายการถูกปล่อยคืนคิวแล้ว (stale_sending > 10 นาที) — รอบหน้าจะเช็กซ้ำจาก getMsgs เอง
        if (/invalid_state|not_found/.test(msg)) {
          log('error', 'pending report dropped', { id: item.id, status: item.status, error: clip(msg) });
        } else throw new QueueUnavailable(e);
      }
      s.pendingReports.shift();
    }
  }

  /* ---------- JST ---------- */

  function loginAllowed() {
    const hourAgo = clock.now() - 3600_000;
    s.loginTimes = s.loginTimes.filter((t) => t > hourAgo);
    return s.loginTimes.length < cfg.maxLoginsPerHour;
  }

  /** true = ล็อกอินได้ · ไม่ได้ = ตั้ง state ให้แล้ว และคืน decision สำหรับ report */
  async function relogin() {
    if (!loginAllowed()) {
      enterNeedsLogin('login_limit: JST login attempted too often in the last hour');
      return { ok: false, decision: { status: 'requeue', error: 'session_expired' } };
    }
    s.loginTimes.push(clock.now());
    try {
      await jst.login();
      s.sessionOk = true;
      log('info', 'JST login ok');
      return { ok: true };
    } catch (e) {
      if (e instanceof CaptchaRequired || e instanceof LoginFailed || e instanceof LoginUnavailable) {
        enterNeedsLogin(`${e.name}: ${clip(e.message)}`);
        return { ok: false, decision: { status: 'requeue', error: 'session_expired' } };
      }
      if (e instanceof ShapeError) {
        s.sessionOk = false;
        setState(STATES.stopped, `ShapeError: ${clip(e.message)}`);
        return { ok: false, decision: { status: 'requeue', error: 'session_expired' } };
      }
      // เครือข่าย / JST ล่มชั่วคราว — ลองใหม่งานถัดไป (จำกัด 3 ครั้ง/ชม.)
      s.lastError = `login: ${clip(e?.message || e)}`;
      return { ok: false, decision: { status: 'requeue', error: 'session_expired' }, countFailure: true };
    }
  }

  /** ห้อง → ตรวจ → (dedupe) → ส่ง · คืน decision ยังไม่ report */
  async function attempt(job) {
    const r = await jst.room(job.target_ms_id);
    s.sessionOk = true;
    if (!r) return { status: 'failed', error: 'room_not_found' };
    if (!job.test_redirect && typeof job.chat_name === 'string' && job.chat_name.trim() !== '' && r.name.trim() !== job.chat_name.trim()) {
      return { status: 'failed', error: 'room_mismatch' };
    }
    if (r.expired) return { status: 'failed', error: 'window_closed' };
    if (Number(job.attempts) > 1) {
      const msgs = await jst.recentMessages(r);
      const hit = findAlreadySent(msgs, job.message, job.enqueued_at);
      if (hit) return { status: 'sent', error: null, jstMsgId: hit.msgId == null ? null : String(hit.msgId), deduped: true };
    }
    const res = await jst.send(r, job.message);
    return { status: 'sent', error: null, jstMsgId: extractMsgId(res.raw) };
  }

  function decideError(e) {
    if (e instanceof JstError) return { decision: { status: 'requeue', error: `jst_error: ${clip(e.message)}` }, countFailure: true };
    if (e instanceof SessionExpired) {
      enterNeedsLogin(`SessionExpired after re-login: ${clip(e.message)}`);
      return { decision: { status: 'requeue', error: 'session_expired' } };
    }
    if (e instanceof CaptchaRequired || e instanceof LoginFailed || e instanceof LoginUnavailable) {
      enterNeedsLogin(`${e.name}: ${clip(e.message)}`);
      return { decision: { status: 'requeue', error: 'session_expired' } };
    }
    if (e instanceof ShapeError) {
      setState(STATES.stopped, `ShapeError: ${clip(e.message)}`);
      return { decision: { status: 'requeue', error: `shape_error: ${clip(e.message)}` } };
    }
    return { decision: { status: 'requeue', error: `worker_error: ${clip(e?.message || e)}` }, countFailure: true };
  }

  async function runJob(job) {
    try {
      return { decision: await attempt(job) };
    } catch (e) {
      if (!(e instanceof SessionExpired)) return decideError(e);
      s.sessionOk = false;
      log('warn', 'JST session expired — logging in again');
      const lr = await relogin();
      if (!lr.ok) return { decision: lr.decision, countFailure: lr.countFailure };
      try {
        return { decision: await attempt(job) };
      } catch (e2) {
        return decideError(e2);
      }
    }
  }

  function validJob(job) {
    return (
      job && typeof job === 'object' && job.id &&
      Number.isSafeInteger(Number(job.target_ms_id)) && Number(job.target_ms_id) > 0 &&
      typeof job.message === 'string' && job.message.trim() !== ''
    );
  }

  /* ---------- หนึ่งรอบ ---------- */

  /** คืน 'idle' | 'sent' | 'failed' | 'requeued' | 'paused' | 'needs_login' | 'stopped' · Supabase ล่ม → โยน QueueUnavailable */
  async function processOne() {
    if (s.state === STATES.stopped) return 'stopped';
    if (s.state === STATES.needsLogin) {
      const m = jst.sessionMtime ? jst.sessionMtime() : 0;
      if (m && m !== s.needsLoginMtime) {
        jst.reloadSession?.();
        s.sessionOk = null;
        s.failures = 0;
        log('info', 'session file changed — resuming');
        setState(STATES.running, null);
      } else return 'needs_login';
    }
    if (s.state === STATES.paused) {
      if (clock.now() < s.pausedUntil) return 'paused';
      s.failures = 0;
      setState(STATES.running, s.lastError);
    }

    await flushPending();

    let job;
    try {
      job = await queue.claim(cfg.workerId);
    } catch (e) {
      throw new QueueUnavailable(e);
    }
    if (!job) return 'idle';

    if (!validJob(job)) {
      setState(STATES.stopped, 'invalid_job: claim returned an unexpected shape');
      if (job && job.id) await report(job, { status: 'requeue', error: 'invalid_job' });
      return 'stopped';
    }

    const { decision, countFailure } = await runJob(job);
    log(decision.status === 'sent' ? 'info' : 'warn', `job ${decision.status}`, {
      id: job.id,
      target_ms_id: job.target_ms_id,
      test_redirect: !!job.test_redirect,
      attempts: job.attempts,
      error: decision.error || undefined,
      deduped: decision.deduped || undefined,
    });
    await report(job, decision);

    if (decision.status === 'sent') {
      s.failures = 0;
      s.sentCount++;
      return 'sent';
    }
    if (s.state === STATES.running && decision.error) s.lastError = decision.error;
    if (s.state === STATES.running && (decision.status === 'failed' || countFailure)) {
      s.failures++;
      if (s.failures >= cfg.failureLimit) {
        s.pausedUntil = clock.now() + cfg.pauseMinutes * 60_000;
        setState(STATES.paused, `${s.failures} consecutive failures (last: ${decision.error})`);
      }
    }
    return decision.status === 'failed' ? 'failed' : 'requeued';
  }

  /* ---------- ลูป ---------- */

  async function run({ once = false } = {}) {
    await heartbeat({ force: true });
    let last;
    while (!s.stopRequested) {
      try {
        last = await processOne();
        s.backoffMs = 0;
      } catch (e) {
        if (!(e instanceof QueueUnavailable)) throw e;
        s.backoffMs = s.backoffMs ? Math.min(s.backoffMs * 2, cfg.backoffMaxMs) : cfg.backoffMinMs;
        s.lastError = clip(e.message);
        log('warn', 'supabase unavailable — backing off', { ms: s.backoffMs, error: clip(e.message) });
        if (once) {
          last = 'queue_error';
          break;
        }
        await sleep(s.backoffMs);
        continue;
      }
      await heartbeat();
      if (once) break;
      const worked = last === 'sent' || last === 'failed' || last === 'requeued';
      await sleep(worked ? cfg.afterJobMs : cfg.pollSeconds * 1000);
    }
    if (s.stopRequested) await heartbeat({ force: true, state: STATES.stopped });
    else await heartbeat({ force: true });
    return last;
  }

  return {
    processOne,
    run,
    heartbeat,
    stop() {
      s.stopRequested = true;
    },
    get status() {
      return {
        state: s.state,
        sessionOk: s.sessionOk,
        lastError: s.lastError,
        failures: s.failures,
        pausedUntil: s.pausedUntil,
        pendingReports: s.pendingReports.length,
        sentCount: s.sentCount,
        backoffMs: s.backoffMs,
      };
    },
  };
}
