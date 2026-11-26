// ตัวจัดการ POST /api/cron/outreach-tick (route.ts เป็นแค่ wrapper) — แยกมาเพื่อทดสอบได้
// ห้าม log หรือคืน cookie รหัสผ่าน หรือเนื้อความข้อความ · body ของ error ไม่มีข้อความ error (pg_net เก็บ response ไว้ในตารางที่ใช้ร่วม)
import { bearerMatches } from './auth';

export const WORKER_ID = 'vercel';
const JST_TIMEOUT_MS = 8000; // กัน JST ช้าจนรอบเกิน maxDuration

export type TickOutput = Record<string, unknown>;

export interface QueueConfig {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
}

export interface TickDeps {
  runTick: (opts: {
    workerId: string;
    queue: unknown;
    jstConfig: { accountId: string; password: string; timeoutMs: number };
    sleep: (ms: number) => Promise<void>;
    log: (level: string, msg: string, fields?: Record<string, unknown>) => void;
  }) => Promise<TickOutput>;
  /** สร้าง/ใช้ซ้ำ queue client */
  getQueue: (cfg: QueueConfig) => unknown;
}

export type TickEnv = Record<string, string | undefined>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function log(level: string, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ at: new Date().toISOString(), level, msg, worker: WORKER_ID, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleTick(request: Request, env: TickEnv, deps: TickDeps): Promise<Response> {
  if (!bearerMatches(request.headers.get('authorization'), env.CRON_SECRET)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.DSALES_WORKER_EMAIL;
  const password = env.DSALES_WORKER_PASSWORD;
  if (!supabaseUrl || !anonKey || !email || !password) {
    return json({ ok: false, error: 'not_configured' }, 500);
  }
  try {
    const queue = deps.getQueue({ supabaseUrl, anonKey, email, password });
    const out = await deps.runTick({
      workerId: WORKER_ID,
      queue,
      jstConfig: { accountId: env.JST_USER || '', password: env.JST_PASSWORD || '', timeoutMs: JST_TIMEOUT_MS },
      sleep,
      log,
    });
    const ok = out.result !== 'queue_error';
    return json({ ok, region: env.VERCEL_REGION ?? null, ...out }, ok ? 200 : 503);
  } catch (e) {
    const message = String((e as Error)?.message || e).slice(0, 300);
    log('error', 'tick failed', { error: message });
    const kind = e instanceof Error ? e.name : 'unknown';
    return json({ ok: false, error: 'tick_failed', kind }, 500);
  }
}
