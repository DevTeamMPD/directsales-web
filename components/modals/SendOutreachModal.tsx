'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CloseButton } from '@/components/ui/CloseButton';
import { errorMessage } from '@/lib/api/errors';
import { enqueueOutreach, getMyLeads, getTemplates, getWorkerStatus, previewOutreach } from '@/lib/api/rpc';
import type { EnqueueResult, PreviewRow, Template, WorkerStatus } from '@/lib/api/types';
import { BRAND, FIXTURE_NO_WRITE, type Brand } from '@/lib/constants';
import {
  activeTemplates, brandRoomCounts, brandRoomHint, channelLabel, demoPreview, skipLabel, skipReasonText, splitPreview, workerBanners, type SelRow,
} from '@/lib/domain/outreach';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

/** แสดงข้อความเต็มของ 5 รายการแรก ที่เหลือพับไว้ (กดเปิดดูทีละรายการ) */
const EXPANDED = 5;

/**
 * popup ส่งข้อความ (spec ข้อ 6.2): เลือกแบรนด์ + template ที่เปิดใช้ → dsales_outreach_preview → ตัวอย่างข้อความรายคน + รายการที่ถูกข้าม
 * → "ส่ง N รายการ" (dsales_enqueue_outreach จองลูกค้าจากถังกลางในตัว) → toast + ลิงก์ไปหน้า /outreach, ล้างที่เลือก, โหลดถัง/ลีดใหม่
 * แบรนด์เริ่มต้นมาจาก BasePage (defaultOutreachBrand: แบรนด์ที่คนที่เลือกมีห้องแชตมากที่สุด) + บรรทัดบอกจำนวนคนที่มีห้องของแต่ละแบรนด์
 * แถวที่ถูกข้ามเพราะไม่มีห้อง/หมดช่วงของแบรนด์นี้แต่มีห้องของอีกแบรนด์ → "มีห้องแชตของ <แบรนด์> — เปลี่ยนแบรนด์ด้านบน"
 * แถบเตือนสถานะ worker (ออฟไลน์ + เห็นล่าสุดเมื่อไร / ต้องล็อกอิน / หยุด) ทั้งก่อนและหลังกดส่ง — ข้อความจะค้างคิวถ้า worker ไม่ทำงาน
 * โหมด fixture: template ตัวอย่าง + preview จากลูกค้าตัวอย่าง ปุ่มส่งแสดง toast โหมด fixture
 */
export function SendOutreachModal({ rows, defaultBrand, onSent }: { rows: SelRow[]; defaultBrand: Brand; onSent: () => void }) {
  const { live, outreachDemo, customers, meId } = useAppState();
  const { toast, toastError, handleAuthError, once, upsertLead, dispatch, closeModal } = useActions();
  const seq = useModalSeq();
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const [liveTemplates, setLiveTemplates] = useState<{ brand: Brand; list: Template[] } | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [livePreview, setLivePreview] = useState<{ key: string; rows: PreviewRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EnqueueResult | null>(null);
  const phones = useMemo(() => rows.map((r) => r.phone), [rows]);
  const roomHint = useMemo(() => brandRoomHint(brandRoomCounts(rows)), [rows]);
  const [liveWorker, setLiveWorker] = useState<WorkerStatus | null>(null);
  const workerWarns = workerBanners(live ? liveWorker : outreachDemo?.worker).filter((b) => b.kind === 'warn').map((b) => b.text);

  // สถานะ worker (โหลดครั้งเดียวตอนเปิด popup) — โหลดไม่ได้ = ไม่แสดงแถบเตือน
  useEffect(() => {
    if (!live) return;
    let alive = true;
    getWorkerStatus().then(
      (w) => {
        if (alive) setLiveWorker(w);
      },
      (e: unknown) => {
        handleAuthError(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, handleAuthError]);
  const warnBar = workerWarns.map((t) => <div key={t} className="warn" data-banner="warn">{t}</div>);

  // template ที่เปิดใช้ของแบรนด์ที่เลือก
  useEffect(() => {
    if (!live) return;
    let alive = true;
    setErr('');
    getTemplates(brand).then(
      (list) => {
        if (alive) setLiveTemplates({ brand, list: list || [] });
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('โหลด template ไม่สำเร็จ: ' + errorMessage(e));
        setLiveTemplates({ brand, list: [] });
      },
    );
    return () => {
      alive = false;
    };
  }, [live, brand, handleAuthError]);

  const templates = useMemo(() => {
    if (!live) return activeTemplates(outreachDemo?.templates ?? [], brand);
    return liveTemplates?.brand === brand ? activeTemplates(liveTemplates.list, brand) : null;
  }, [live, outreachDemo, liveTemplates, brand]);
  const template = templates?.find((t) => t.id === templateId) ?? templates?.[0] ?? null;

  // preview ทุกครั้งที่เปลี่ยน template (ไม่เขียนอะไรลง DB)
  const previewKey = template ? `${template.id}|${phones.join(',')}` : '';
  useEffect(() => {
    if (!live || !template) return;
    let alive = true;
    setErr('');
    previewOutreach(phones, template.id).then(
      (r) => {
        if (alive) setLivePreview({ key: `${template.id}|${phones.join(',')}`, rows: r || [] });
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('สร้างตัวอย่างข้อความไม่สำเร็จ: ' + errorMessage(e));
        setLivePreview({ key: `${template.id}|${phones.join(',')}`, rows: [] });
      },
    );
    return () => {
      alive = false;
    };
  }, [live, template, phones, handleAuthError]);

  const preview = useMemo<PreviewRow[] | null>(() => {
    if (!template) return null;
    if (!live) return demoPreview(rows, template, customers, meId);
    return livePreview?.key === previewKey ? livePreview.rows : null;
  }, [live, template, rows, customers, meId, livePreview, previewKey]);
  const { send, skip } = splitPreview(preview ?? []);
  const rowOf = (phone: string) => rows.find((r) => r.phone === phone);
  const nameOf = (phone: string) => rowOf(phone)?.name || '';

  async function onSend() {
    if (!template || !send.length) return;
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('enqueue-outreach', async () => {
      setSending(true);
      try {
        const res = await enqueueOutreach(send.map((r) => r.phone), template.id);
        setResult(res);
        toast(`เข้าคิวส่งข้อความ ${res.queued.toLocaleString('th-TH')} รายการ${res.skipped?.length ? ` · ข้าม ${res.skipped.length.toLocaleString('th-TH')} รายการ` : ''}`);
        onSent();
        dispatch({ type: 'invalidatePool' }); // enqueue จองลูกค้าจากถังกลางให้แล้ว
        getMyLeads(1000, 0).then((ls) => ls.forEach(upsertLead), () => {}); // ลีดที่เพิ่งจองเข้าหน้า Direct Sale
      } catch (e) {
        toastError(e);
      } finally {
        setSending(false);
      }
    });
  }

  if (result) {
    return (
      <>
        <div className="modal-h"><h3>เข้าคิวส่งข้อความแล้ว</h3><CloseButton /></div>
        <div className="modal-b" id="so-result">
          {warnBar}
          <div className="stats3">
            <div className="stat hi"><b>{result.queued.toLocaleString('th-TH')}</b><span>เข้าคิว</span></div>
            <div className="stat"><b>{(result.skipped?.length ?? 0).toLocaleString('th-TH')}</b><span>ข้าม</span></div>
            <div className="stat"><b>{BRAND[brand]}</b><span>{template?.name}</span></div>
          </div>
          {result.skipped?.length ? (
            <div>
              {result.skipped.map((x) => (
                <div key={x.phone} className="list-row">
                  <div><b>{nameOf(x.phone) || x.phone}</b> <span className="sub mono">{x.phone}</span></div>
                  <span className="badge s-lost plain">{skipLabel(x.reason)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="help">worker จะส่งทีละข้อความตามระยะห่างที่ตั้งไว้ ดูความคืบหน้าได้ที่เมนู ส่งข้อความ</p>
        </div>
        <div className="modal-f">
          <button className="btn" data-close>ปิด</button>
          <Link className="btn primary" href="/outreach" id="so-progress" onClick={() => closeModal(seq)}>ดูความคืบหน้า</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="modal-h">
        <h3>ส่งข้อความ</h3>
        <span className="tag">เลือก {rows.length.toLocaleString('th-TH')} คน</span>
        <CloseButton />
      </div>
      <div className="modal-b">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="so-brand">แบรนด์</label>
            <select className="select" id="so-brand" value={brand} disabled={sending} onChange={(e) => { setBrand(e.target.value as Brand); setTemplateId(''); }}>
              {(Object.keys(BRAND) as Brand[]).map((b) => <option key={b} value={b}>{BRAND[b]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="so-template">Template</label>
            <select className="select" id="so-template" value={template?.id ?? ''} disabled={sending || !templates?.length} onChange={(e) => setTemplateId(e.target.value)}>
              {templates === null ? <option value="">กำลังโหลด…</option> : null}
              {templates?.length === 0 ? <option value="">ไม่มี template</option> : null}
              {templates?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="sub" id="so-brand-hint">{roomHint}</div>
        {warnBar}
        {err ? <div className="login-err">{err}</div> : null}
        {templates?.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>ยังไม่มี template ที่เปิดใช้ของ {BRAND[brand]} (หัวหน้าสร้างได้ที่เมนู ตั้งค่า)</div>
        ) : template && preview === null ? (
          <div className="empty" style={{ padding: 24 }}>กำลังสร้างตัวอย่างข้อความ…</div>
        ) : preview ? (
          <>
            <div className="sub" id="so-summary">จะส่ง <b>{send.length.toLocaleString('th-TH')}</b> รายการ · ข้าม <b>{skip.length.toLocaleString('th-TH')}</b> รายการ</div>
            {send.length ? (
              <div id="so-send-list">
                {send.map((r, i) => (
                  <details key={r.phone} className="list-row" open={i < EXPANDED} data-preview={r.phone} style={{ display: 'block' }}>
                    <summary style={{ cursor: 'pointer' }}>
                      <b>{r.name || nameOf(r.phone)}</b> <span className="sub mono">{r.phone}</span>{' '}
                      <span className="tag">{channelLabel(r.provider, r.page)}</span>
                    </summary>
                    <div className="tl-note" style={{ whiteSpace: 'pre-wrap' }}>{r.message}</div>
                  </details>
                ))}
              </div>
            ) : null}
            {skip.length ? (
              <div id="so-skip-list">
                <div className="sub"><b>ข้าม (ไม่ส่ง)</b></div>
                {skip.map((r) => (
                  <div key={r.phone} className="list-row" data-skip={r.phone} style={{ flexWrap: 'wrap', rowGap: 4 }}>
                    <div style={{ minWidth: 150 }}><b>{r.name || nameOf(r.phone) || r.phone}</b> <span className="sub mono">{r.phone}</span></div>
                    <span className="badge s-lost plain">{skipReasonText(r.skip, rowOf(r.phone), brand)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <p className="help">ลูกค้าในถังกลางจะถูกจองให้คุณตอนกดส่ง · ส่งทีละข้อความผ่าน JST ในนามแอดมินของร้าน</p>
      </div>
      <div className="modal-f">
        <button className="btn" data-close>ยกเลิก</button>
        <button className="btn primary" id="so-send" disabled={sending || !template || !send.length} onClick={() => void onSend()}>
          {sending ? 'กำลังส่ง…' : `ส่ง ${send.length.toLocaleString('th-TH')} รายการ`}
        </button>
      </div>
    </>
  );
}
