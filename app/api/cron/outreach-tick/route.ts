// ถูกปลุกทุกนาทีจาก pg_cron (dsales.dsales_tick_kick) — worker ส่งข้อความ/ผูกห้องหนึ่งรอบ
// spec: docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md · ห้าม log cookie รหัสผ่าน หรือเนื้อความข้อความ
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { bearerMatches } from '@/lib/cron/auth';
import { createQueueClient } from '@/tools/jst-worker/queue-client.mjs';
import { runTick } from '@/tools/jst-worker/tick.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WORKER_ID = 'vercel';

// ใช้ client เดิมเมื่อ instance ยังอุ่น (ไม่ต้องล็อกอิน Supabase ทุกรอบ)
let queue: ReturnType<typeof createQueueClient> | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function log(level: string, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, msg, worker: WORKER_ID, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const env = process.env;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.DSALES_WORKER_EMAIL;
  const password = env.DSALES_WORKER_PASSWORD;
  if (!supabaseUrl || !anonKey || !email || !password) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }
  queue ??= createQueueClient({ supabaseUrl, anonKey, email, password, createClient, autoRefreshToken: false });
  try {
    const out = await runTick({
      workerId: WORKER_ID,
      queue,
      jstConfig: { accountId: env.JST_USER || '', password: env.JST_PASSWORD || '' },
      sleep,
      log,
    });
    return NextResponse.json({ ok: true, region: env.VERCEL_REGION ?? null, ...out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = String((e as Error)?.message || e).slice(0, 300);
    log('error', 'tick failed', { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
