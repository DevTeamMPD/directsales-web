// ถูกปลุกทุกนาทีจาก pg_cron (dsales.dsales_tick_kick) — worker ส่งข้อความ/ผูกห้องหนึ่งรอบ
// spec: docs/superpowers/specs/2026-11-26-cloud-tick-worker-design.md · logic อยู่ใน lib/cron/tick-handler.ts
import { createClient } from '@supabase/supabase-js';
import { handleTick, type QueueConfig, type TickDeps } from '@/lib/cron/tick-handler';
import { createQueueClient } from '@/tools/jst-worker/queue-client.mjs';
import { runTick } from '@/tools/jst-worker/tick.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ใช้ client เดิมเมื่อ instance ยังอุ่น (ไม่ต้องล็อกอิน Supabase ทุกรอบ)
let queue: ReturnType<typeof createQueueClient> | null = null;

const deps: TickDeps = {
  runTick,
  getQueue: (cfg: QueueConfig) => (queue ??= createQueueClient({ ...cfg, createClient, autoRefreshToken: false })),
};

export function POST(request: Request): Promise<Response> {
  return handleTick(request, process.env, deps);
}
