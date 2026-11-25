'use client';

import { useMemo, useState } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { runAiStatus, type AiLine } from '@/lib/api/ai';
import { getMyLeads, undoAiStatus } from '@/lib/api/rpc';
import type { Lead } from '@/lib/api/types';
import { AI_MAX_LEADS, AI_STATUS_TEXT, aiCost, aiSkipText, summaryText, type AiResult } from '@/lib/domain/aiStatus';
import { useActions, useAppState } from '@/lib/state/AppProvider';

type Phase = 'ready' | 'running' | 'done';
type Row = { ok: true; result: AiResult } | { ok: false; error: string };

/**
 * popup "วิเคราะห์สถานะ (AI)" (หัวหน้า, ล็อกอินจริงเท่านั้น): ลีดที่ส่งมา (ติ๊กไว้ หรือรายการที่กรองอยู่) เฉพาะที่มีเจ้าของและยังไม่ปิดการขาย ≤ 50
 * → POST /api/ai/lead-status (NDJSON) แสดงผลทีละลีด → จบแล้วโหลดลีดใหม่ แสดงว่าเปลี่ยนจริงหรือคงเดิม + ปุ่มย้อนกลับ
 */
export function AiStatusModal({ leads, scopeText }: { leads: Lead[]; scopeText: string }) {
  const { leads: all } = useAppState();
  const { once, toast, toastError, upsertLead } = useActions();
  const targets = useMemo(() => leads.filter((l) => !!l.owner && l.status !== 'won').slice(0, AI_MAX_LEADS), [leads]);
  const over = leads.filter((l) => !!l.owner && l.status !== 'won').length - targets.length;
  const [phase, setPhase] = useState<Phase>('ready');
  const [force, setForce] = useState(false);
  const [todo, setTodo] = useState(0);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [skipped, setSkipped] = useState<Array<{ id: string; reason: string }>>([]);
  const [summary, setSummary] = useState('');
  const byId = useMemo(() => new Map(all.map((l) => [l.id, l])), [all]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  async function start() {
    await once('ai-status', async () => {
      setPhase('running');
      setRows({});
      setSkipped([]);
      setSummary('');
      let skipList: Array<{ id: string; reason: string }> = [];
      const onLine = (l: AiLine) => {
        if (l.type === 'start') {
          setTodo(l.todo);
          skipList = l.skipped;
          setSkipped(l.skipped);
        } else if (l.type === 'lead') {
          setRows((r) => ({ ...r, [l.id]: l.ok ? { ok: true, result: l.result } : { ok: false, error: l.error } }));
        } else if (l.type === 'done') {
          const all2 = [...skipList, ...l.summary.skipped];
          setSkipped(all2);
          setSummary(summaryText({ changed: l.summary.changed, kept: l.summary.kept, skipped: all2.length }, aiCost(l.usage.input_tokens, l.usage.output_tokens)));
        } else {
          toast('บันทึกผล AI ไม่สำเร็จ: ' + l.error);
        }
      };
      try {
        await runAiStatus(targets.map((l) => l.id), force, onLine);
        (await getMyLeads(1000, 0)).forEach(upsertLead);
      } catch (e) {
        toastError(e);
      } finally {
        setPhase('done');
      }
    });
  }

  async function undo(id: string) {
    await once(`ai-undo:${id}`, async () => {
      try {
        upsertLead(await undoAiStatus(id));
        toast('ย้อนกลับสถานะแล้ว');
      } catch (e) {
        toastError(e);
      }
    });
  }

  const analysed = Object.keys(rows);
  const pct = todo ? Math.round((analysed.length / todo) * 100) : phase === 'done' ? 100 : 0;

  return (
    <>
      <div className="modal-h"><h3>วิเคราะห์สถานะด้วย AI</h3><CloseButton /></div>
      <div className="modal-b" id="ai-status">
        <p className="help">
          {scopeText} · วิเคราะห์ <b>{targets.length.toLocaleString('th-TH')}</b> ลีด (เฉพาะที่มีเจ้าของและยังไม่ปิดการขาย สูงสุด {AI_MAX_LEADS} ลีดต่อครั้ง)
          {over > 0 ? ` · ที่เหลือ ${over.toLocaleString('th-TH')} ลีดกดอีกรอบ` : ''}
        </p>
        <p className="help">AI อ่านแชตและบันทึกล่าสุดแล้วเปลี่ยนสถานะให้เมื่อมั่นใจตั้งแต่ 70% ขึ้นไป (ไม่ปิดการขายให้) ทุกการเปลี่ยนมีบันทึกในประวัติลูกค้าและย้อนกลับได้</p>
        {phase === 'ready' ? (
          <label className="switch">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span></span>วิเคราะห์ซ้ำ แม้ไม่มีความเคลื่อนไหวใหม่ตั้งแต่ครั้งก่อน
          </label>
        ) : (
          <>
            <div className="funnel-row first">
              <span>{phase === 'running' ? 'กำลังวิเคราะห์…' : summary || 'เสร็จแล้ว'}</span>
              <b className="num">{analysed.length.toLocaleString('th-TH')} / {todo.toLocaleString('th-TH')}</b>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
            <div id="ai-rows">
              {analysed.map((id) => {
                const r = rows[id];
                const l = byId.get(id);
                const ai = l?.ai;
                const applied = phase === 'done' && !!ai?.applied && !ai.undoneAt && l?.status === ai.status;
                return (
                  <div key={id} className="list-row ai-row" data-ai={id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{nameOf(id)}</b>{' '}
                      {r.ok ? (
                        <>
                          <span className={`tag ${applied ? 's-won' : ''}`}>
                            {applied ? `เปลี่ยนเป็น ${AI_STATUS_TEXT[r.result.status] ?? r.result.status}` : `${phase === 'done' ? 'คงเดิม' : 'AI แนะนำ'} · ${AI_STATUS_TEXT[r.result.status] ?? r.result.status}`}
                          </span>{' '}
                          <span className="sub">มั่นใจ {Math.round(r.result.confidence * 100)}%</span>
                          {r.result.flags.map((f) => <div key={f} className="sub ai-flag">⚠ {f}</div>)}
                          <div className="sub">{r.result.reason}</div>
                          {r.result.next_action ? <div className="sub">→ {r.result.next_action}</div> : null}
                        </>
                      ) : <span className="badge s-lost plain">{aiSkipText(r.error)}</span>}
                    </div>
                    {applied ? <button className="btn sm" data-ai-undo={id} onClick={() => void undo(id)}>ย้อนกลับ</button> : null}
                  </div>
                );
              })}
            </div>
            {skipped.length ? (
              <details>
                <summary className="sub" style={{ cursor: 'pointer' }}>ข้าม {skipped.length.toLocaleString('th-TH')} ลีด</summary>
                {skipped.map((s) => (
                  <div key={s.id} className="list-row"><span>{nameOf(s.id)}</span><span className="sub">{aiSkipText(s.reason)}</span></div>
                ))}
              </details>
            ) : null}
          </>
        )}
      </div>
      <div className="modal-f">
        <button className="btn" data-close>{phase === 'done' ? 'ปิด' : 'ยกเลิก'}</button>
        {phase !== 'done' ? (
          <button className="btn primary" id="ai-start" disabled={phase === 'running' || !targets.length} onClick={() => void start()}>
            {phase === 'running' ? 'กำลังวิเคราะห์…' : `เริ่มวิเคราะห์ ${targets.length.toLocaleString('th-TH')} ลีด`}
          </button>
        ) : null}
      </div>
    </>
  );
}
