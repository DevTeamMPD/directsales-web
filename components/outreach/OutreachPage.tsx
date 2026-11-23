'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CallButton } from '@/components/leads/ContactBar';
import { errorMessage } from '@/lib/api/errors';
import { cancelOutreach, getOutreachBatch, getOutreachBatches, getWorkerStatus } from '@/lib/api/rpc';
import type { BatchDetail, BatchRow, WorkerStatus } from '@/lib/api/types';
import { BRAND, FIXTURE_NO_WRITE } from '@/lib/constants';
import { inBrand } from '@/lib/domain/brand';
import { repName } from '@/lib/domain/leads';
import {
  channelLabel, countBadges, hasPending, itemErrorText, itemsPending, OUTREACH_POLL_MS, shouldPoll, skipLabel, stamp, statusBadge, statusLabel,
  workerBanners,
} from '@/lib/domain/outreach';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** document.visibilityState === 'visible' (เปลี่ยนตาม visibilitychange) */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/**
 * หน้า /outreach "ส่งข้อความ" (spec ข้อ 6.3): แถบสถานะ worker, รายการชุดที่ส่ง → รายละเอียดรายคน (สถานะ, เวลาส่ง, เหตุผล,
 * ยกเลิกรายการที่รอ, ปุ่มโทรสำหรับห้องที่หมดช่วงส่ง) · โหลดใหม่ทุก 10 วินาทีเฉพาะตอนหน้าแสดงอยู่และยังมีรายการรอ/กำลังส่ง
 * โหมด fixture: ข้อมูลตัวอย่าง (state.outreachDemo) ปุ่มยกเลิกแสดง toast โหมด fixture
 * แสดงเฉพาะชุดของแบรนด์ใหญ่ที่เลือก (สลับไปอีกแบรนด์ = ปิดรายละเอียดชุดของแบรนด์เดิม)
 */
export function OutreachPage() {
  const { live, outreachDemo, reps, brand } = useAppState();
  const { toast, toastError, handleAuthError, once } = useActions();
  const visible = usePageVisible();
  const [liveBatches, setLiveBatches] = useState<BatchRow[] | null>(null);
  const [liveWorker, setLiveWorker] = useState<WorkerStatus | null>(null);
  const [liveDetail, setLiveDetail] = useState<BatchDetail | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  const allBatches = live ? liveBatches : outreachDemo?.batches ?? null;
  const batches = useMemo(
    () => (live && allBatches === null ? null : (allBatches ?? []).filter((b) => inBrand(brand, b.brand))),
    [live, allBatches, brand],
  );
  const [shownBrand, setShownBrand] = useState(brand);
  if (shownBrand !== brand) {
    setShownBrand(brand);
    const open = allBatches?.find((b) => b.id === selId);
    if (open && !inBrand(brand, open.brand)) {
      setSelId(null);
      setPicked(new Set());
    }
  }
  const worker = live ? liveWorker : outreachDemo?.worker ?? null;
  const detail = live ? (liveDetail?.batch.id === selId ? liveDetail : null) : selId ? outreachDemo?.details[selId] ?? null : null;

  const loadList = useCallback(async () => {
    try {
      const [b, w] = await Promise.all([getOutreachBatches(), getWorkerStatus().catch((e: unknown) => {
        if (handleAuthError(e)) throw e;
        return null; // สถานะ worker โหลดไม่ได้ไม่ควรทำให้รายการชุดหาย
      })]);
      setLiveBatches(b || []);
      setLiveWorker(w);
      setErr('');
    } catch (e) {
      if (handleAuthError(e)) return;
      setErr('โหลดรายการส่งข้อความไม่สำเร็จ: ' + errorMessage(e));
      setLiveBatches((x) => x ?? []);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (live) void loadList();
  }, [live, loadList, tick]);

  useEffect(() => {
    if (!live || !selId) return;
    let alive = true;
    getOutreachBatch(selId).then(
      (d) => {
        if (alive) setLiveDetail(d);
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setErr('โหลดรายละเอียดชุดไม่สำเร็จ: ' + errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [live, selId, tick, handleAuthError]);

  // โหลดใหม่ทุก 10 วินาที เฉพาะตอนหน้าแสดงอยู่และยังมีรายการรอ/กำลังส่ง
  const pending = (batches ?? []).some((b) => hasPending(b.counts)) || (!!detail && itemsPending(detail.items));
  const poll = shouldPoll(live, visible, pending);
  useEffect(() => {
    if (!poll) return;
    const t = setInterval(() => setTick((n) => n + 1), OUTREACH_POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const openBatch = (id: string) => {
    setSelId((cur) => (cur === id ? null : id));
    setPicked(new Set());
  };
  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const queuedIds = (detail?.items ?? []).filter((i) => i.status === 'queued').map((i) => i.id);
  const pickedQueued = queuedIds.filter((id) => picked.has(id));

  async function onCancel(ids: string[]) {
    if (!ids.length) return;
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('outreach-cancel', async () => {
      try {
        const n = await cancelOutreach(ids);
        toast(`ยกเลิกแล้ว ${Number(n || 0).toLocaleString('th-TH')} รายการ`);
        setPicked(new Set());
        setTick((x) => x + 1);
      } catch (e) {
        toastError(e);
      }
    });
  }

  const banners = workerBanners(worker);

  return (
    <>
      {banners.map((b) => (
        <div key={b.text} className={b.kind === 'warn' ? 'warn' : 'demo-note'} data-banner={b.kind}>{b.text}</div>
      ))}
      {err ? <div className="login-err">{err}</div> : null}
      <div className="card table-wrap">
        <table id="ob-table">
          <thead>
            <tr><th>เวลา</th><th>แบรนด์</th><th>Template</th><th>ผู้ส่ง</th><th className="r">จำนวน</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {batches === null ? (
              <tr><td colSpan={6} className="empty">กำลังโหลด…</td></tr>
            ) : batches.length ? (
              batches.map((b) => (
                <tr key={b.id} className={selId === b.id ? 'sel' : undefined}>
                  <td><button className="cust-name" data-batch={b.id} onClick={() => openBatch(b.id)}>{stamp(b.created_at)}</button></td>
                  <td><span className={`tag ${b.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[b.brand] ?? b.brand}</span></td>
                  <td>{b.template_name || '—'}</td>
                  <td>{repName(reps, b.requested_by) || '—'}</td>
                  <td className="r num">{Number(b.total || 0).toLocaleString('th-TH')}</td>
                  <td>
                    <div className="toolbar" style={{ gap: 4 }}>
                      {countBadges(b.counts, b.skipped).map((c) => <span key={c.text} className={`badge plain ${c.cls}`}>{c.text}</span>)}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="empty">ยังไม่มีการส่งข้อความ — เลือกลูกค้าที่หน้า ลูกค้าของฉัน / ถังกลาง แล้วกด ส่งข้อความ</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selId ? (
        <div className="panel" id="ob-detail">
          <div className="panel-h">
            <h2>{detail ? `${detail.batch.template_name || 'ชุดส่งข้อความ'} · ${stamp(detail.batch.created_at)}` : 'รายละเอียดชุด'}</h2>
            <button className="btn sm danger" id="ob-cancel" disabled={!pickedQueued.length} onClick={() => void onCancel(pickedQueued)}>
              ยกเลิกที่เลือก{pickedQueued.length ? ` (${pickedQueued.length})` : ''}
            </button>
          </div>
          <div className="panel-b">
            {!detail ? (
              <div className="empty">กำลังโหลด…</div>
            ) : (
              <>
                <div className="mini-table table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 1 }}>
                          <input
                            type="checkbox" aria-label="เลือกรายการที่รอส่งทั้งหมด" disabled={!queuedIds.length}
                            checked={!!queuedIds.length && pickedQueued.length === queuedIds.length}
                            onChange={(e) => setPicked(e.target.checked ? new Set(queuedIds) : new Set())}
                          />
                        </th>
                        <th>ลูกค้า / เบอร์</th><th>ช่องทาง · เพจ</th><th>สถานะ</th><th>เวลาส่ง</th><th>หมายเหตุ</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.length ? (
                        detail.items.map((it) => (
                          <tr key={it.id} data-item={it.id}>
                            <td>
                              {it.status === 'queued' ? (
                                <input type="checkbox" aria-label={`เลือก ${it.chat_name || it.phone}`} checked={picked.has(it.id)} onChange={() => togglePick(it.id)} />
                              ) : null}
                            </td>
                            <td><b>{it.chat_name || '—'}</b><div className="sub mono">{it.phone}</div></td>
                            <td>{channelLabel(it.provider, it.page)}</td>
                            <td><span className={`badge ${statusBadge(it.status)}`}>{statusLabel(it.status)}</span></td>
                            <td>{it.sent_at ? stamp(it.sent_at) : '—'}</td>
                            <td className="note-cell">{itemErrorText(it.error) || '—'}</td>
                            <td>
                              {it.error === 'window_closed' ? (
                                <span className="ch-bar mini"><CallButton phone={it.phone} /></span>
                              ) : it.status === 'queued' ? (
                                <button className="btn sm" data-cancel={it.id} onClick={() => void onCancel([it.id])}>ยกเลิก</button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={7} className="empty">ไม่มีรายการในคิว</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {detail.batch.skipped?.length ? (
                  <div style={{ marginTop: 12 }} id="ob-skipped">
                    <div className="sub"><b>ข้ามตอนสั่งส่ง {detail.batch.skipped.length.toLocaleString('th-TH')} รายการ</b></div>
                    {detail.batch.skipped.map((x) => (
                      <div key={x.phone} className="list-row">
                        <div className="mono">{x.phone}</div>
                        <span className="badge s-lost plain">{skipLabel(x.reason)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
      <p className="help">
        {poll ? 'อัปเดตอัตโนมัติทุก 10 วินาที' : 'กดเวลาของชุดเพื่อดูรายละเอียดรายคน'} · ห้องที่หมดช่วงส่ง (ลูกค้าไม่ได้ทักมาเกิน 7 วัน) ให้โทรหาแทน
      </p>
    </>
  );
}
