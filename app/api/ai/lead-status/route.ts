import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
  AI_CONCURRENCY, AI_MAX_LEADS, AI_MODEL, AI_STATUSES, AI_SYSTEM_PROMPT, buildLeadPrompt, mergeFlags, planAnalysis,
  type AiContext, type AiResult,
} from '@/lib/domain/aiStatus';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/ai/lead-status  { leadIds: string[], force?: boolean, dryRun?: boolean }  (dryRun = เรียก AI แต่ไม่บันทึกผล ใช้ทดสอบ)  (หัวหน้าเท่านั้น — ตรวจใน dsales_ai_status_context)
 * อ่านข้อมูลลีด → ข้ามลีดที่ไม่มีข้อมูล/ไม่มีอะไรใหม่ → Claude Haiku 5.5 ทีละลีด (พร้อมกัน 5) → dsales_ai_status_apply
 * ตอบเป็น NDJSON ทีละบรรทัด: start → lead (ทุกลีดที่วิเคราะห์) → done (หรือ error)
 * key อ่านจาก ANTHROPIC_API_KEY ฝั่ง server เท่านั้น (ไม่ส่งไปหน้าเว็บ)
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const Result = z.object({
  status: z.enum(AI_STATUSES),
  callback_date: z.string().nullable(),
  confidence: z.number(),
  interest: z.string(),
  reason: z.string(),
  flags: z.array(z.string()),
  next_action: z.string(),
});

type Line =
  | { type: 'start'; total: number; todo: number; skipped: Array<{ id: string; reason: string }> }
  | { type: 'lead'; id: string; ok: true; result: AiResult }
  | { type: 'lead'; id: string; ok: false; error: string }
  | { type: 'done'; summary: unknown; usage: { input_tokens: number; output_tokens: number; analysed: number } }
  | { type: 'error'; error: string };

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, 'ai_not_configured');
  let body: { leadIds?: unknown; force?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, 'invalid_input');
  }
  const ids = Array.isArray(body.leadIds) ? body.leadIds.filter((x): x is string => typeof x === 'string').slice(0, AI_MAX_LEADS + 1) : [];
  if (!ids.length) return json(400, 'invalid_input');
  if (ids.length > AI_MAX_LEADS) return json(400, 'batch_too_large');
  const force = body.force === true;
  const dryRun = body.dryRun === true;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json(401, 'not_authenticated');
  const db = supabase.schema('dsales');

  const contextAt = new Date().toISOString();
  const ctxRes = await db.rpc('dsales_ai_status_context', { p_leads: ids });
  if (ctxRes.error) return json(ctxRes.error.message === 'forbidden' ? 403 : 400, ctxRes.error.message);
  const list = (ctxRes.data ?? []) as AiContext[];
  const { todo, skipped } = planAnalysis(list, force);

  const client = new Anthropic();
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (l: Line) => controller.enqueue(enc.encode(JSON.stringify(l) + '\n'));
      send({ type: 'start', total: list.length, todo: todo.length, skipped });
      const results: Array<AiResult & { lead_id: string }> = [];
      let input = 0;
      let output = 0;
      let next = 0;

      async function analyse(c: AiContext) {
        try {
          const res = await client.messages.parse({
            model: AI_MODEL,
            max_tokens: 4000,
            system: AI_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildLeadPrompt(c) }],
            output_config: { effort: 'low', format: zodOutputFormat(Result) },
          });
          input += res.usage.input_tokens;
          output += res.usage.output_tokens;
          const r = res.parsed_output;
          if (res.stop_reason === 'refusal' || !r) {
            send({ type: 'lead', id: c.id, ok: false, error: res.stop_reason === 'refusal' ? 'refusal' : 'ai_error' });
            return;
          }
          const out: AiResult = { ...r, flags: mergeFlags(c, r.flags) };
          results.push({ ...out, lead_id: c.id });
          send({ type: 'lead', id: c.id, ok: true, result: out });
        } catch (e) {
          send({ type: 'lead', id: c.id, ok: false, error: e instanceof Anthropic.APIError ? `api_${e.status ?? 'error'}` : 'ai_error' });
        }
      }

      try {
        await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, todo.length) }, async () => {
          while (next < todo.length) await analyse(todo[next++]);
        }));
        const usage = { input_tokens: input, output_tokens: output, analysed: todo.length, model: AI_MODEL };
        const applied = results.length && !dryRun
          ? await db.rpc('dsales_ai_status_apply', { p_results: results, p_usage: usage, p_context_at: contextAt })
          : { data: { changed: 0, kept: 0, skipped: [] }, error: null };
        if (applied.error) send({ type: 'error', error: applied.error.message });
        else send({ type: 'done', summary: applied.data, usage });
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : 'ai_error' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
