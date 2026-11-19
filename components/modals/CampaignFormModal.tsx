'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseButton } from '@/components/ui/CloseButton';
import { errorMessage } from '@/lib/api/errors';
import { mapCampaign } from '@/lib/api/map';
import { createCampaign } from '@/lib/api/rpc';
import type { CampaignCriterion } from '@/lib/api/types';
import { BRAND, CRIT, FIXTURE_NO_WRITE, MODES, PATHS, type Brand, type ClaimMode, type CritType } from '@/lib/constants';
import {
  funnel, initialCampaignForm, MODE_HELP, namePlaceholder, newCampaignRow, nextTab, type CampaignForm, type CampaignTab,
} from '@/lib/domain/campaigns';
import { baht } from '@/lib/format';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

const TABS: ReadonlyArray<readonly [CampaignTab, string]> = [['base', 'ข้อมูลพื้นฐาน'], ['set', 'การตั้งค่า'], ['aud', 'กลุ่มลูกค้า']];
type CritKey = 'kw' | 'min' | 'max' | 'from' | 'to';

/**
 * popup F ตัวสร้างแคมเปญ (campaignForm L782-871) หัวหน้าเท่านั้น
 * - พิมพ์/เลือกในช่องอัปเดตค่าโดยไม่ "วาดใหม่" (โฟกัสอยู่ที่เดิม); สลับแท็บ / ถัดไป / ย้อนกลับ / เพิ่ม-ลบ-เปลี่ยนชนิดเงื่อนไข / ดูตัวอย่าง
 *   = prototype วาด popup ใหม่ → เลื่อนกลับบนสุดแล้วโฟกัสช่องแรก (input/select/textarea/button.btn) เหมือน openModal
 * - funnel นับจาก state.customers (ล็อกอินจริง = [] จึงเป็น 0 เหมือน prototype)
 * - สร้าง: insert dsales_campaigns (ไม่สร้างลีด) → เลือกแคมเปญใหม่ → ไปหน้าแบรนด์ของแคมเปญ
 */
export function CampaignFormModal({ brand }: { brand: Brand }) {
  const { customers, leads, live } = useAppState();
  const { toast, closeModal, once, setUi, dispatch, handleAuthError } = useActions();
  const router = useRouter();
  const seq = useModalSeq();
  const [f, setF] = useState<CampaignForm>(() => initialCampaignForm(brand));
  const [draws, setDraws] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<CampaignForm>) => setF((x) => ({ ...x, ...patch }));
  const redraw = (patch: Partial<CampaignForm>) => {
    set(patch);
    setDraws((n) => n + 1);
  };
  const setCrits = (fn: (crits: CampaignCriterion[]) => CampaignCriterion[], again: boolean) =>
    (again ? redraw : set)({ crits: fn(f.crits) });

  useLayoutEffect(() => {
    if (!draws) return; // เปิดครั้งแรก: ModalRoot โฟกัส #cf-name ให้แล้ว
    const m = tabsRef.current?.closest('.modal');
    m?.scrollTo(0, 0);
    m?.querySelector<HTMLElement>('input,select,textarea,button.btn')?.focus();
  }, [draws]);

  const { steps, result } = useMemo(() => funnel(customers, leads, f.brand, f.crits), [customers, leads, f.brand, f.crits]);

  async function create() {
    if (!f.name.trim()) {
      redraw({ tab: 'base' });
      toast('ใส่ชื่อแคมเปญก่อน');
      return;
    }
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('create-campaign', async () => {
      try {
        const c = mapCampaign(await createCampaign(newCampaignRow(f)));
        dispatch({ type: 'upsertCampaign', campaign: c });
        setUi({ selCamp: c.id, status: 'all' });
        closeModal(seq);
        router.push(`/campaigns/${c.brand}`);
        toast('สร้างแคมเปญแล้ว · เลือกลูกค้าเข้าแคมเปญจากถัง "ลูกค้าทั้งหมด" ด้วยปุ่ม จอง');
      } catch (e) {
        if (handleAuthError(e)) return;
        toast('สร้างแคมเปญไม่สำเร็จ: ' + errorMessage(e));
      }
    });
  }

  return (
    <>
      <div className="modal-h"><h3>สร้างแคมเปญใหม่</h3><CloseButton /></div>
      <div className="utabs" ref={tabsRef}>
        {TABS.map(([k, t]) => (
          <button key={k} type="button" className={`utab ${f.tab === k ? 'active' : ''}`} data-ca="tab" data-tab={k} onClick={() => redraw({ tab: k })}>
            {t}
            {k === 'aud' && f.crits.length ? <span className="count">{f.crits.length}</span> : null}
          </button>
        ))}
      </div>
      <div className="modal-b" style={{ paddingTop: 16 }}>
        {f.tab === 'base' ? (
          <>
            <div className="field">
              <label htmlFor="cf-name">ชื่อแคมเปญ <span className="req">*</span></label>
              <input className="input" id="cf-name" data-k="name" value={f.name} placeholder={namePlaceholder(f.brand)} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cf-desc">คำอธิบาย <span className="opt">(ไม่บังคับ)</span></label>
              <textarea className="textarea" id="cf-desc" data-k="desc" placeholder="สรุปวัตถุประสงค์ของแคมเปญนี้…" value={f.desc} onChange={(e) => set({ desc: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cf-brand">แบรนด์</label>
                <select className="select" id="cf-brand" data-k="brand" value={f.brand} onChange={(e) => set({ brand: e.target.value as Brand })}>
                  <option value="bebeplay">Bebeplay</option>
                  <option value="hosttail">Hosttail</option>
                </select>
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label className="switch">
                  <input type="checkbox" data-k="active" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
                  <span></span>เปิดใช้งานทันที
                </label>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cf-start">วันเริ่มต้น <span className="opt">(ไม่บังคับ)</span></label>
                <input className="input" type="date" id="cf-start" data-k="start" value={f.start} onChange={(e) => set({ start: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="cf-end">วันสิ้นสุด <span className="opt">(ไม่บังคับ)</span></label>
                <input className="input" type="date" id="cf-end" data-k="end" value={f.end} onChange={(e) => set({ end: e.target.value })} />
              </div>
            </div>
          </>
        ) : f.tab === 'set' ? (
          <>
            <div className="field">
              <label>วิธีจองลีดของแคมเปญนี้</label>
              {(Object.keys(MODES) as ClaimMode[]).map((k) => (
                <label key={k} className="radio-card">
                  <input type="radio" name="cf-mode" data-k="mode" value={k} checked={f.mode === k} onChange={() => set({ mode: k })} />
                  <span><b>{MODES[k]}</b><span className="sub">{MODE_HELP[k]}</span></span>
                </label>
              ))}
            </div>
            <div className="field">
              <label htmlFor="cf-max">จำนวนลีดสูงสุดที่เซลล์แต่ละคนจองได้ <span className="opt">(ไม่บังคับ)</span></label>
              <input className="input" id="cf-max" type="number" min="1" data-k="max" value={f.max} placeholder="ไม่จำกัด" onChange={(e) => set({ max: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <p className="help">กำหนดเงื่อนไขกรองลูกค้าที่จะเข้าแคมเปญนี้ ถ้าไม่กำหนดจะใช้ลูกค้าทั้งหมดของ {BRAND[f.brand]}</p>
            <div id="funnel">
              <div className="funnel">
                {steps.map((s, i) => (
                  <div key={i} className={`funnel-row ${i === 0 ? 'first' : ''}`}>
                    <span>{s.label}</span>
                    <b className="num">{s.n.toLocaleString('th-TH')} คน</b>
                    <div className="bar"><i style={{ width: `${s.pct}%` }} /></div>
                  </div>
                ))}
              </div>
              {f.prev ? (
                result.length ? (
                  <>
                    <div className="mini-table table-wrap">
                      <table>
                        <thead><tr><th>ชื่อ</th><th>เบอร์</th><th className="r">ยอดซื้อรวม</th><th className="r">ซื้อ (ครั้ง)</th></tr></thead>
                        <tbody>
                          {result.slice(0, 8).map((c) => (
                            <tr key={c.id}>
                              <td>{c.name}</td>
                              <td className="mono">{c.phone}</td>
                              <td className="r num">{baht(c.purchases.reduce((s, p) => s + p.amount, 0))}</td>
                              <td className="r num">{c.purchases.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sub">แสดง {Math.min(8, result.length)} จาก {result.length} คน</div>
                  </>
                ) : (
                  <div className="empty">ไม่มีลูกค้าที่ตรงเงื่อนไขทั้งหมด</div>
                )
              ) : null}
            </div>
            {f.crits.map((cr, i) => (
              <div key={i} className="crit-row">
                <select className="select" data-ct={i} aria-label="ประเภทเงื่อนไข" value={cr.type}
                  onChange={(e) => setCrits((cs) => cs.map((x, j) => (j === i ? { type: e.target.value as CritType } : x)), true)}>
                  {(Object.keys(CRIT) as CritType[]).map((k) => <option key={k} value={k}>{CRIT[k].label}</option>)}
                </select>
                {CRIT[cr.type].fields.map(([t, n, ph]) => (
                  <input key={n} className="input" type={t} min={t === 'number' ? '0' : undefined} data-cf={`${i}:${n}`} placeholder={ph} aria-label={ph}
                    value={cr[n as CritKey] ?? ''}
                    onChange={(e) => setCrits((cs) => cs.map((x, j) => (j === i ? { ...x, [n]: e.target.value } : x)), false)} />
                ))}
                <button type="button" className="icon-btn" data-ca="del" data-i={i} aria-label="ลบเงื่อนไข" onClick={() => setCrits((cs) => cs.filter((_, j) => j !== i), true)}>
                  <svg viewBox="0 0 24 24"><path d={PATHS.trash} /></svg>
                </button>
              </div>
            ))}
            <div className="crit-actions">
              <button type="button" className="btn sm" data-ca="add" onClick={() => setCrits((cs) => [...cs, { type: 'product' }], true)}>+ เพิ่มเงื่อนไข</button>
              <button type="button" className="btn sm" data-ca="prev" onClick={() => redraw({ prev: !f.prev })}>{f.prev ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}</button>
            </div>
          </>
        )}
      </div>
      <div className="modal-f">
        {f.tab === 'aud' ? (
          <>
            <button type="button" className="btn" data-ca="back" onClick={() => redraw({ tab: 'set' })}>← ย้อนกลับ</button>
            <button type="button" className="btn primary" data-ca="create" onClick={() => void create()}>สร้างแคมเปญ</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" data-close>ยกเลิก</button>
            <button type="button" className="btn primary" data-ca="next" disabled={!f.name.trim()} onClick={() => f.name.trim() && redraw({ tab: nextTab(f.tab) })}>ถัดไป →</button>
          </>
        )}
      </div>
    </>
  );
}
