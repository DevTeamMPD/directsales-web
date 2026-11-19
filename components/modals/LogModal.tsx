'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { logContact, setNoCall, unclaimLead } from '@/lib/api/rpc';
import type { ContactType, Lead } from '@/lib/api/types';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import {
  buildLogSave, initialLogForm, LOG_RESULTS, logSections, logStatusOptions, logSteps, validateLog,
  type LogField, type LogForm, type LogProgress, type LogStatus,
} from '@/lib/domain/log';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

export function LogModal({ id, type }: { id: string; type: ContactType }) {
  const { leads } = useAppState();
  const l = leads.find((x) => x.id === id);
  return l ? <LogFormView lead={l} type={type} /> : null;
}

function LogFormView({ lead: l, type }: { lead: Lead; type: ContactType }) {
  const { today, live } = useAppState();
  const { closeModal, toast, toastError, upsertLead, dispatch } = useActions();
  const [f, setF] = useState<LogForm>(() => initialLogForm(l, type, today));
  const [prevStatus] = useState(l.status);
  const busy = useRef(false);
  const progress = useRef<LogProgress | null>(null);
  const seq = useModalSeq();
  const cbRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const billsRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<LogForm>) => setF((x) => ({ ...x, ...patch }));
  const sec = logSections(f.status);
  const focusField = (field: LogField) => ({ callback: cbRef, note: noteRef, bills: billsRef })[field].current?.focus();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bad = validateLog(f, today);
    if (bad) {
      toast(bad.msg);
      focusField(bad.field);
      return;
    }
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const plan = buildLogSave(f, { id: l.id, status: prevStatus });
    const { key, steps } = logSteps(plan, progress.current);
    if (progress.current?.key !== key) progress.current = { key, done: [] };
    const run = progress.current;
    try {
      // ทีละขั้น จำขั้นที่สำเร็จ: ถ้า setNoCall/unclaim ล้มแล้วกดบันทึกซ้ำ จะไม่เรียก dsales_log ซ้ำ (ประวัติไม่ซ้ำ 2 รอบ)
      for (const step of steps) {
        if (step === 'log') upsertLead(await logContact(plan.input));
        else if (step === 'dnc') upsertLead(await setNoCall(l.id, true));
        else upsertLead(await unclaimLead(l.id));
        run.done.push(step);
      }
      closeModal(seq);
      dispatch({ type: 'invalidatePool' });
      toast(plan.msg);
    } catch (err) {
      toastError(err);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <div className="modal-h"><h3>บันทึก · {l.name}</h3><CloseButton /></div>
      <form id="log-form" noValidate onSubmit={onSubmit}>
        <div className="modal-b">
          {l.noCall ? <div className="warn">ลูกค้ารายนี้ไม่สะดวกให้โทร ติดต่อได้ทางแชตเท่านั้น</div> : null}
          <div className="field">
            <label>ช่องทาง</label>
            <div className="seg" id="seg">
              <button
                type="button"
                data-t="call"
                className={f.type === 'call' ? 'active' : ''}
                disabled={!!l.noCall}
                title={l.noCall ? 'ลูกค้ารายนี้ห้ามโทร ติดต่อทางแชตเท่านั้น' : undefined}
                onClick={() => set({ type: 'call', result: LOG_RESULTS.call[0] })}
              >
                โทร
              </button>
              <button type="button" data-t="chat" className={f.type === 'chat' ? 'active' : ''} onClick={() => set({ type: 'chat', result: LOG_RESULTS.chat[0] })}>
                แชต
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-res">ผลการติดต่อ</label>
              <select className="select" id="f-res" value={f.result} onChange={(e) => set({ result: e.target.value })}>
                {LOG_RESULTS[f.type].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-status">สถานะลูกค้าหลังบันทึก</label>
              <select className="select" id="f-status" value={f.status} onChange={(e) => set({ status: e.target.value as LogStatus })}>
                {logStatusOptions(!!l.noCall).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="field wide" id="cb-wrap" hidden={!sec.callback}>
              <label htmlFor="f-cb">วันที่นัดติดต่อ <span className="req">*</span></label>
              <input className="input" type="date" id="f-cb" ref={cbRef} min={today} value={f.callback} onChange={(e) => set({ callback: e.target.value })} />
            </div>
            <div className="field wide">
              <label htmlFor="f-interest">สินค้าที่ลูกค้าสนใจ</label>
              <input className="input" id="f-interest" value={f.interest} placeholder="เช่น เตียงนอนเด็ก, ทรายแมว" onChange={(e) => set({ interest: e.target.value })} />
            </div>
            <div className="field wide" id="won-wrap" hidden={!sec.won}>
              <label htmlFor="f-bills">เลขบิลที่ขายได้ (อ้างอิงตอนผูกข้อมูล คั่นหลายบิลด้วยจุลภาค)</label>
              <input className="input" id="f-bills" ref={billsRef} value={f.bills} placeholder="เช่น 312345, 312399" onChange={(e) => set({ bills: e.target.value })} />
              <label htmlFor="f-amount" style={{ marginTop: 8 }}>ยอดที่ปิดได้ (บาท)</label>
              <input className="input" id="f-amount" type="number" min="0" step="1" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
              <label htmlFor="f-closed" style={{ marginTop: 8 }}>วันที่ปิดการขาย</label>
              <input className="input" id="f-closed" type="date" value={f.closed} onChange={(e) => set({ closed: e.target.value })} />
            </div>
            <div className="field wide" id="warn-wrap" hidden={!sec.warn}>
              <div className="warn" id="warn-text">{sec.warn}</div>
            </div>
            <div className="field wide">
              <label htmlFor="f-note">หมายเหตุ <span className="req" id="note-req" hidden={!sec.warn}>* ใส่เหตุผล</span></label>
              <textarea className="textarea" id="f-note" ref={noteRef} placeholder="สรุปสิ่งที่คุยกับลูกค้า" value={f.note} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn" data-close>ยกเลิก</button>
          <button className="btn primary">บันทึก</button>
        </div>
      </form>
    </>
  );
}
