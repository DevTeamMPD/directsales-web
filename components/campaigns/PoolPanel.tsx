'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PoolDetailModal } from '@/components/modals/PoolDetailModal';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getCustomerPool } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import { PAGE, PATHS, type Brand } from '@/lib/constants';
import { canNext, demoPool, pageRange, poolAction, poolCampNames, poolDetailFooter, type PoolCtx } from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { BrandTags } from './BrandTags';
import { RowButton } from './RowButton';
import { useCustomerClaim } from './useCustomerClaim';

/** ค้นหาถังหลังหยุดพิมพ์ 300 ms (prototype P.t L758) */
export const POOL_DEBOUNCE_MS = 300;

/**
 * ถังลูกค้าทั้งหมดของแบรนด์ (poolPanel L672-688, bindPool L754-760, poolLoad L622-646)
 * - ล็อกอินจริง: dsales_customer_pool_v4 (50 แถว/หน้า, p_from/p_to เมื่อมีช่วงวันที่) โหลดใหม่เมื่อ mount / คำค้น / หน้า / ช่วงวันที่ / poolVersion
 * - โหมด fixture: ลูกค้าตัวอย่าง (demoPool) แบบโหมดตัวอย่างของ prototype
 * - ui.focusSearch (มาจาก "เลือกจากถัง"): โฟกัส #pool-q จนโหลดเสร็จแล้วตั้งกลับเป็น false
 */
export function PoolPanel({ brand }: { brand: Brand }) {
  const { live, pool, poolVersion, ui, customers, leads, meId, isAdmin, reps, campaigns } = useAppState();
  const { setPool, setUi, openModal, handleAuthError } = useActions();
  const act = useLeadActions();
  const claimRow = useCustomerClaim();
  const inputRef = useRef<HTMLInputElement>(null);
  const [qKey, setQKey] = useState(pool.q);
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(live);
  const { from, to } = ui.period;

  // debounce: เปลี่ยนคำค้นที่ใช้โหลด + กลับหน้าแรกพร้อมกัน (โหลดครั้งเดียว)
  useEffect(() => {
    if (pool.q === qKey) return;
    const t = setTimeout(() => {
      setPool({ page: 0 });
      setQKey(pool.q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [pool.q, qKey, setPool]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoading(true);
    setData((d) => ({ ...d, err: '' }));
    getCustomerPool({ search: qKey, offset: pool.page * PAGE, brand, from, to })
      .then((rows) => {
        if (alive) setData({ rows: rows.map((r) => mapPoolRow(r, meId)), total: rowsTotal(rows), err: '' });
      })
      .catch((e: unknown) => {
        if (alive && !handleAuthError(e)) setData((d) => ({ ...d, err: 'โหลดลูกค้าไม่สำเร็จ: ' + errorMessage(e) }));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [live, brand, qKey, pool.page, from, to, poolVersion, meId, handleAuthError]);

  const demo = useMemo(
    () => (live ? null : demoPool(customers, leads, { brand, q: qKey, page: pool.page, period: ui.period, viewer: { meId, isAdmin } })),
    [live, customers, leads, brand, qKey, pool.page, ui.period, meId, isAdmin],
  );
  const rows = demo ? demo.rows : data.rows;
  const total = demo ? demo.total : data.total;
  const busy = !demo && loading;

  // focusSearch: โฟกัสทุกครั้งที่วาดจนกว่าถังจะโหลดเสร็จ (L294)
  useEffect(() => {
    if (ui.focusSearch) inputRef.current?.focus();
  });
  useEffect(() => {
    if (ui.focusSearch && !busy) setUi({ focusSearch: false });
  }, [ui.focusSearch, busy, setUi]);

  const ctx: PoolCtx = { live, isAdmin, meId, leads, reps };
  const claim = (r: PoolRow, seq?: number) => void claimRow(r, brand, seq);
  const openDetail = (r: PoolRow) =>
    openModal(<PoolDetailModal row={r} footer={poolDetailFooter(r, ctx)} onClaim={(seq) => claim(r, seq)} />);

  return (
    <>
      <div className="toolbar">
        <label className="search" htmlFor="pool-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="pool-q" ref={inputRef} type="search" placeholder="ค้นหา เบอร์ / เลขบิล / ชื่อแชต / ชื่อลูกค้า" value={pool.q} onChange={(e) => setPool({ q: e.target.value })} />
        </label>
        {busy ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ / เบอร์</th><th>แคมเปญ</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const names = live ? [] : poolCampNames(r, leads, campaigns);
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="cust-name" data-pool-open={r.id} onClick={() => openDetail(r)}>{r.name}</button>
                      <div className="sub mono">{r.phone}</div>
                      {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                    </td>
                    <td>
                      {live ? <span className="sub">—</span>
                        : names.length ? names.map((n, i) => <div key={`${n}-${i}`} className="camp-cell">{n}</div>)
                          : <span className="sub">ยังไม่เข้าแคมเปญ</span>}
                    </td>
                    <td>{r.segment ? <span className="tag">{r.segment}</span> : <span className="sub">—</span>}</td>
                    <td className="r num">{r.ltv == null ? '—' : baht(Math.round(r.ltv))}</td>
                    <td className="r num">{r.orders ?? '—'}</td>
                    <td>{r.last ? fmtDate(r.last) : '—'}</td>
                    <td><BrandTags brands={r.brands} dash /></td>
                    <td><RowButton a={poolAction(r, ctx)} rowId={r.id} onClaim={() => claim(r)} onUnclaim={act.confirmUnclaim} /></td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} className="empty">{busy ? 'กำลังโหลด…' : 'ไม่พบลูกค้าที่ตรงกับคำค้น'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn sm" data-pool="prev" disabled={pool.page === 0} onClick={() => setPool({ page: pool.page - 1 })}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(pool.page, rows.length, total)}</span>
        <button className="btn sm" data-pool="next" disabled={!canNext(pool.page, rows.length, total)} onClick={() => setPool({ page: pool.page + 1 })}>ถัดไป →</button>
      </div>
    </>
  );
}
