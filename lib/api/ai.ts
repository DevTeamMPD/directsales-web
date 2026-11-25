import type { AiResult } from '@/lib/domain/aiStatus';
import { RpcError } from './errors';

/** บรรทัด NDJSON จาก POST /api/ai/lead-status */
export type AiLine =
  | { type: 'start'; total: number; todo: number; skipped: Array<{ id: string; reason: string }> }
  | { type: 'lead'; id: string; ok: true; result: AiResult }
  | { type: 'lead'; id: string; ok: false; error: string }
  | { type: 'done'; summary: { changed: number; kept: number; skipped: Array<{ id: string; reason: string }> }; usage: { input_tokens: number; output_tokens: number; analysed: number } }
  | { type: 'error'; error: string };

/** เรียกวิเคราะห์สถานะ: ส่งแต่ละบรรทัดให้ onLine ตามลำดับที่ server ส่ง · HTTP error → RpcError ข้อความไทย */
export async function runAiStatus(leadIds: string[], force: boolean, onLine: (l: AiLine) => void): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/ai/lead-status', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leadIds, force }),
    });
  } catch (e) {
    throw new RpcError(e instanceof Error ? e.message : 'fetch failed');
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new RpcError(j?.error ?? `http_${res.status}`, { status: res.status });
  }
  // session หมด: middleware พาไป /login (ได้ HTML แทน NDJSON)
  if (!(res.headers.get('content-type') ?? '').includes('ndjson')) throw new RpcError('not_authenticated', { status: 401 });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(JSON.parse(line) as AiLine);
    }
    if (done) break;
  }
}
