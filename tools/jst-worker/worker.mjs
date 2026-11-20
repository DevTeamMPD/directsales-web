// JST outreach worker — node worker.mjs [--once] [--config <path>]
// ดึงงานจาก Supabase (dsales_worker_claim) → ส่งผ่าน endpoint ภายในของ JST → รายงานผล
// log: logs/worker-YYYY-MM-DD.jsonl (ไม่มีรหัสผ่าน cookie header หรือเนื้อความข้อความ)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createJstClient, DEFAULT_BASE_URL } from './jst-client.mjs';
import { createQueueClient } from './queue-client.mjs';
import { createWorker } from './worker-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(ROOT, 'logs');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

/** KEY=VALUE จาก .env.local ที่รากโปรเจกต์ (นอก git) — ใช้เติมค่าที่ config.json เว้นว่าง; process.env มาก่อน */
function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function loadConfig(path) {
  if (!existsSync(path)) throw new Error(`ไม่พบ ${path} — คัดลอก config.example.json เป็น config.json แล้วกรอกค่า`);
  const c = JSON.parse(readFileSync(path, 'utf8'));
  const env = { ...readEnvFile(resolve(ROOT, '..', '..', '.env.local')), ...process.env };
  c.jst = c.jst || {};
  c.supabase = c.supabase || {};
  c.jst.accountId ||= env.JST_USER || '';
  c.jst.password ||= env.JST_PASSWORD || '';
  c.supabase.url ||= env.NEXT_PUBLIC_SUPABASE_URL || '';
  c.supabase.anonKey ||= env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  c.supabase.email ||= env.DSALES_WORKER_EMAIL || '';
  c.supabase.password ||= env.DSALES_WORKER_PASSWORD || '';
  const missing = [];
  if (!c.workerId) missing.push('workerId');
  if (!c.supabase?.url) missing.push('supabase.url');
  if (!c.supabase?.anonKey) missing.push('supabase.anonKey');
  if (!c.supabase?.email) missing.push('supabase.email');
  if (!c.supabase?.password) missing.push('supabase.password');
  if (missing.length) throw new Error(`config.json ขาด: ${missing.join(', ')}`);
  return {
    workerId: String(c.workerId),
    pollSeconds: Number(c.pollSeconds) > 0 ? Number(c.pollSeconds) : 5,
    jst: { baseUrl: c.jst?.baseUrl || DEFAULT_BASE_URL, accountId: c.jst?.accountId || '', password: c.jst?.password || '' },
    supabase: c.supabase,
  };
}

function log(level, msg, fields = {}) {
  const line = { at: new Date().toISOString(), level, msg, ...fields };
  const text = JSON.stringify(line);
  (level === 'error' || level === 'warn' ? console.error : console.log)(text);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, `worker-${line.at.slice(0, 10)}.jsonl`), text + '\n');
  } catch {
    /* เขียน log ไม่ได้ไม่ควรหยุด worker */
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(resolve(ROOT, typeof args.config === 'string' ? args.config : 'config.json'));
  const sessionFile = join(ROOT, '.session.json');

  const jst = createJstClient({ ...config.jst, sessionFile });
  const queue = createQueueClient({
    supabaseUrl: config.supabase.url,
    anonKey: config.supabase.anonKey,
    email: config.supabase.email,
    password: config.supabase.password,
    createClient,
  });

  // sleep ที่ตัดได้เมื่อกด Ctrl+C
  let wake = null;
  const sleep = (ms) =>
    new Promise((res) => {
      const t = setTimeout(() => {
        wake = null;
        res();
      }, ms);
      wake = () => {
        clearTimeout(t);
        wake = null;
        res();
      };
    });

  const worker = createWorker({
    jst,
    queue,
    clock: { now: () => Date.now() },
    sleep,
    log,
    config: { workerId: config.workerId, pollSeconds: config.pollSeconds },
  });

  let stopping = false;
  const onSignal = (sig) => {
    if (stopping) {
      log('warn', `${sig} again — exiting now`);
      process.exit(130);
    }
    stopping = true;
    log('info', `${sig} — finishing current job, then sending final heartbeat`);
    worker.stop();
    wake?.();
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  log('info', 'worker start', {
    workerId: config.workerId,
    once: !!args.once,
    jstSession: jst.hasSession() ? 'loaded' : 'none',
    jstAutoLogin: !!(config.jst.accountId && config.jst.password),
  });
  const last = await worker.run({ once: !!args.once });
  log('info', 'worker exit', { last, ...worker.status });
  process.exit(last === 'queue_error' || (worker.status.state === 'stopped' && !stopping) ? 1 : 0);
}

main().catch((e) => {
  log('error', 'fatal', { error: String(e?.message || e).slice(0, 500) });
  process.exit(1);
});
