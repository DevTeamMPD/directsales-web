'use client';

import { useEffect, useMemo, useState } from 'react';
import { PoolDetailModal } from '@/components/modals/PoolDetailModal';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getBaseCustomers } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import { PAGE, PATHS, type Brand } from '@/lib/constants';
import {
  baseAction, canNext, claimBrand, demoBase, dormantText, keepTotal, NO_BRAND_TEXT, pageRange, type BaseScopeKey, type RowAction,
} from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { BrandTags } from './BrandTags';
import { POOL_DEBOUNCE_MS } from './PoolPanel';
import { RowButton } from './RowButton';
import { useCustomerClaim } from './useCustomerClaim';

/** ตัวกรองของหน้า /mine, /pool (คงค่าระหว่างอยู่ในหน้าเดียวกัน) */
interface BaseFilter { brand: '' | Brand; q: string; page: number }

/**
 * ลูกค้าของฉัน (/mine) และถังกลาง (/pool) — หน้าใหม่ของเฟส 1 (spec ข้อ 3) ไม่มีใน prototype ใช้ markup ของถังลูกค้า (poolPanel L672-688)
 * - dsales_base_customers(scope) 50 แถว/หน้า, ค้นหา debounce 300 ms (เบอร์ +66/66/ขีด แปลงใน rpc.ts), เลือกแบรนด์
 * - คอลัมน์ที่สอง "ไม่ซื้อมา N วัน" + tag เจ้าของ (owner_tag)
 * - total ใช้จากหน้าที่มีแถว (หน้าเกินท้ายไม่มี total_count)
 * - ไม่มีการ์ดช่วงวันที่: RPC นี้ไม่กรองตามช่วงวันที่
 */
export function BasePage({ scope }: { scope: BaseScopeKey }) {
  const { live, customers, leads, meId, today, poolVersion } = useAppState();
  const { openModal, toast, handleAuthError } = useActions();
  const act = useLeadActions();
  const claimRow = useCustomerClaim();
  const [f, setF] = useState<BaseFilter>({ brand: '', q: '', page: 0 });
  const [qKey, setQKey] = useState('');
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(live);

  useEffect(() => {
    if (f.q === qKey) return;
    const t = setTimeout(() => {
      setF((x) => ({ ...x, page: 0 }));
      setQKey(f.q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [f.q, qKey]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoading(true);
    setData((d) => ({ ...d, err: '' }));
    getBaseCustomers(scope, { search: qKey, offset: f.page * PAGE, brand: f.brand || null })
      .then((rows) => {
        if (alive) setData((d) => ({ rows: rows.map((r) => mapPoolRow(r, meId)), total: keepTotal(rowsTotal(rows), rows.length, f.page, d.total), err: '' }));
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
  }, [live, scope, qKey, f.page, f.brand, poolVersion, meId, handleAuthError]);

  const demo = useMemo(
    () => (live ? null : demoBase(customers, leads, scope, { brand: f.brand || null, q: qKey, page: f.page, today, meId })),
    [live, customers, leads, scope, f.brand, qKey, f.page, today, meId],
  );
  const rows = demo ? demo.rows : data.rows;
  const total = demo ? demo.total : data.total;
  const busy = !demo && loading;

  const claim = (r: PoolRow, a: RowAction, seq?: number) => {
    const brand = claimBrand(f.brand, r.brands);
    if (!brand) {
      toast(NO_BRAND_TEXT);
      return;
    }
    void claimRow(r, brand, seq, a.text === 'เริ่มติดตาม' ? 'เริ่มติดตามแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ' : undefined);
  };
  const openDetail = (r: PoolRow) => {
    const a = baseAction(r, { meId, leads });
    openModal(<PoolDetailModal row={r} footer={a.kind === 'disabled' ? null : a} onClaim={(seq) => claim(r, a, seq)} />);
  };

  return (
    <>
      <div className="toolbar">
        <label className="search" htmlFor="base-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="base-q" type="search" placeholder="ค้นหา เบอร์ / ชื่อแชต / ชื่อลูกค้า" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
        </label>
        <select id="base-brand" className="select" aria-label="แบรนด์" value={f.brand} onChange={(e) => setF((x) => ({ ...x, brand: e.target.value as BaseFilter['brand'], page: 0 }))}>
          <option value="">ทุกแบรนด์</option>
          <option value="bebeplay">Bebeplay</option>
          <option value="hosttail">Hosttail</option>
        </select>
        {busy ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ / เบอร์</th><th>ไม่ซื้อมา / tag</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const a = baseAction(r, { meId, leads });
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="cust-name" data-pool-open={r.id} onClick={() => openDetail(r)}>{r.name}</button>
                      <div className="sub mono">{r.phone}</div>
                      {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                    </td>
                    <td>
                      <div>{dormantText(r.dormantDays)}</div>
                      {r.ownerTag ? <span className="tag">{r.ownerTag}</span> : null}
                    </td>
                    <td>{r.segment ? <span className="tag">{r.segment}</span> : <span className="sub">—</span>}</td>
                    <td className="r num">{r.ltv == null ? '—' : baht(Math.round(r.ltv))}</td>
                    <td className="r num">{r.orders ?? '—'}</td>
                    <td>{r.last ? fmtDate(r.last) : '—'}</td>
                    <td><BrandTags brands={r.brands} dash /></td>
                    <td><RowButton a={a} rowId={r.id} onClaim={() => claim(r, a)} onUnclaim={act.confirmUnclaim} /></td>
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
        <button className="btn sm" data-pool="prev" disabled={f.page === 0} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(f.page, rows.length, total)}</span>
        <button className="btn sm" data-pool="next" disabled={!canNext(f.page, rows.length, total)} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>ถัดไป →</button>
      </div>
    </>
  );
}
