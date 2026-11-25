'use client';

import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getBaseCustomers } from '@/lib/api/rpc';
import type { Campaign, PoolRow } from '@/lib/api/types';
import { PAGE, PATHS } from '@/lib/constants';
import { audienceBrand, audienceClaim, criteriaFilters, criteriaText } from '@/lib/domain/campaigns';
import { canNext, clampPage, pageRange } from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { POOL_DEBOUNCE_MS } from './PoolPanel';
import { useCustomerClaim } from './useCustomerClaim';

/**
 * แผง "ลูกค้าตามเงื่อนไข" ของการ์ดแคมเปญ: ลูกค้าในฐานที่ตรง criteria และยังไม่มีเจ้าของ (dsales_base_customers 'pool' + criteriaFilters)
 * ปุ่ม จอง = dsales_claim_customer(..., campaign) → ลีดผูกแคมเปญ ย้ายไปแท็บ "ลีดในแคมเปญ" และหน้า Direct Sale ของผู้จอง
 * ใช้เฉพาะล็อกอินจริง (CampaignPage ไม่แสดงในโหมด fixture)
 */
export function CampaignAudience({ campaign }: { campaign: Campaign }) {
  const { poolVersion, meId, isAdmin, today } = useAppState();
  const { handleAuthError } = useActions();
  const claimRow = useCustomerClaim();
  const [q, setQ] = useState('');
  const [qKey, setQKey] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(true);
  const filters = useMemo(() => criteriaFilters(campaign.criteria), [campaign.criteria]);
  const brand = audienceBrand(campaign.brand, campaign.criteria);
  const fKey = JSON.stringify(filters);
  const claim = audienceClaim(campaign, isAdmin, today);

  useEffect(() => {
    setPage(0);
    setQ('');
    setQKey('');
  }, [campaign.id]);

  useEffect(() => {
    if (q === qKey) return;
    const t = setTimeout(() => {
      setPage(0);
      setQKey(q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, qKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBaseCustomers('pool', { search: qKey, offset: page * PAGE, brand, filters: JSON.parse(fKey) })
      .then((rows) => {
        if (!alive) return;
        if (clampPage(page, rows.length) !== page) {
          setPage(clampPage(page, 0));
          return;
        }
        setData({ rows: rows.map((r) => mapPoolRow(r, meId)), total: rowsTotal(rows), err: '' });
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
  }, [qKey, page, brand, fKey, poolVersion, meId, handleAuthError]);

  return (
    <>
      <div className="quota card" style={{ padding: '10px 14px' }} id="aud-summary">
        เงื่อนไข: <b>{criteriaText(campaign.criteria)}</b> · ตรงเงื่อนไขและยังไม่มีเจ้าของ{' '}
        <b>{data.total === null ? '…' : data.total.toLocaleString('th-TH')}</b> คน
        {claim.note ? <div className="sub">{claim.note}</div> : null}
      </div>
      <div className="toolbar">
        <label className="search" htmlFor="aud-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="aud-q" type="search" placeholder="ค้นหา เบอร์ / ชื่อแชต / ชื่อลูกค้า" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {loading ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ / เบอร์</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th></th></tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((r) => (
                <tr key={r.id} data-aud={r.phone}>
                  <td>
                    <b>{r.name}</b>
                    <div className="sub mono">{r.phone}</div>
                    {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                  </td>
                  <td>{r.segment ? <span className="tag">{r.segment}</span> : <span className="sub">—</span>}</td>
                  <td className="r num">{r.ltv == null ? '—' : baht(Math.round(r.ltv))}</td>
                  <td className="r num">{r.orders ?? '—'}</td>
                  <td>{r.last ? fmtDate(r.last) : '—'}</td>
                  <td>
                    {r.noCall ? <button className="btn sm" disabled>ไม่สะดวกให้โทร</button>
                      : claim.can ? (
                        <button className="btn sm outline" data-aud-claim={r.phone}
                          onClick={() => void claimRow(r, campaign.brand, undefined, `จองเข้าแคมเปญ ${campaign.name} แล้ว · ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ`, campaign.id)}>
                          จอง
                        </button>
                      ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="empty">{loading ? 'กำลังโหลด…' : 'ไม่มีลูกค้าที่ตรงเงื่อนไขและยังว่างอยู่'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(page, data.rows.length, data.total)}</span>
        <button className="btn sm" disabled={!canNext(page, data.rows.length, data.total)} onClick={() => setPage(page + 1)}>ถัดไป →</button>
      </div>
    </>
  );
}
