'use client';

import { useEffect, useMemo, useState } from 'react';
import { BasePage } from '@/components/campaigns/BasePage';
import { errorMessage } from '@/lib/api/errors';
import { getRfmMap } from '@/lib/api/rpc';
import type { RfmMapRow } from '@/lib/api/types';
import { EMPTY_FILTERS } from '@/lib/domain/baseFilters';
import { pageBrand } from '@/lib/domain/brand';
import { demoBase } from '@/lib/domain/pool';
import { rfmGrid } from '@/lib/domain/rfmGrid';
import { RFM_SCOPE_LABEL, rfmMapStats, rfmPageFromQuery, rfmPageToQuery, rfmScopes, rfmSummaryText, type RfmPageState } from '@/lib/domain/rfmPage';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { useActor } from '@/lib/state/useActor';
import { RfmActionCard } from './RfmActionCard';
import { RfmMap } from './RfmMap';

/**
 * หน้า "กลุ่มลูกค้า RFM" (spec 2026-11-26): แผนที่กลุ่ม → การ์ดแนวทางของกลุ่มที่เลือก → รายชื่อลูกค้าของกลุ่ม (BasePage ฝัง)
 * - ขอบเขต: หัวหน้า = ทั้งทีม / ลูกค้าของฉัน / ถังกลาง · เซลล์และหัวหน้าในมุมมองเซลล์ = ลูกค้าของฉัน / ถังกลาง
 * - ตัวเลขบนแผนที่ = ลูกค้าทุกคนในขอบเขตที่มีกลุ่ม (dsales_rfm_map.n) · รายชื่อ = เฉพาะคนที่ติดต่อได้ (≥ 30 วัน) ตามกติกาเดิม
 * - กลุ่มและขอบเขตเก็บใน URL (?seg=&scope=) · แบรนด์ = แบรนด์ใหญ่ใน topbar
 */
export function RfmPage() {
  const { live, isAdmin, viewAs, brand: scopeBrand, poolVersion, customers, leads, today, rfmConfig } = useAppState();
  const { actorId: meId, forUser } = useActor();
  const { handleAuthError } = useActions();
  const b = pageBrand(scopeBrand);
  const scopes = useMemo(() => rfmScopes(isAdmin && !viewAs), [isAdmin, viewAs]);
  const [st, setSt] = useState<RfmPageState>(() => rfmPageFromQuery(typeof window === 'undefined' ? '' : window.location.search, scopes, rfmConfig));
  // เปลี่ยนมุมมอง (หัวหน้าเข้า/ออกจากมุมมองเซลล์) แล้วขอบเขตเดิมใช้ไม่ได้ = ขอบเขตแรกของมุมมองใหม่
  const scope = scopes.includes(st.scope) ? st.scope : scopes[0];
  const seg = rfmConfig.find((s) => s.key === st.seg) ?? null;

  useEffect(() => {
    const qs = rfmPageToQuery({ seg: seg?.key ?? '', scope }, scopes[0]);
    if (qs === window.location.search.replace(/^\?/, '')) return;
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
  }, [seg, scope, scopes]);

  const [liveMap, setLiveMap] = useState<{ key: string; rows: RfmMapRow[]; err: string } | null>(null);
  const mapKey = `${scope}|${b}|${poolVersion}|${forUser ?? ''}`;
  useEffect(() => {
    if (!live) return;
    let alive = true;
    getRfmMap(scope, b || null, scope === 'mine' ? forUser : null).then(
      (rows) => {
        if (alive) setLiveMap({ key: mapKey, rows: rows || [], err: '' });
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setLiveMap({ key: mapKey, rows: [], err: 'โหลดจำนวนลูกค้าต่อกลุ่มไม่สำเร็จ: ' + errorMessage(e) });
      },
    );
    return () => {
      alive = false;
    };
  }, [live, scope, b, mapKey, forUser, handleAuthError]);

  // โหมด fixture: นับจากลูกค้าตัวอย่างด้วยกติกาเดียวกับ /mine /pool (ไม่มีกติกา 30 วัน → ติดต่อได้ = ทั้งหมด)
  const demoRows = useMemo<RfmMapRow[] | null>(() => {
    if (live) return null;
    return [...rfmConfig.map((s) => s.key), ''].map((key) => {
      const n = demoBase(customers, leads, scope, { brand: b || null, q: '', page: 0, today, meId, filters: { ...EMPTY_FILTERS, rfm: [key] } }).total;
      return { segment: key, n, contactable: n };
    });
  }, [live, rfmConfig, customers, leads, scope, b, today, meId]);

  const current = live ? (liveMap?.key === mapKey ? liveMap : null) : null;
  const rows = demoRows ?? (current && !current.err ? current.rows : null);
  const stats = useMemo(() => (rows ? rfmMapStats(rows) : null), [rows]);
  const grid = useMemo(() => rfmGrid(rfmConfig), [rfmConfig]);
  const pick = (key: string) => setSt((x) => ({ ...x, scope, seg: x.seg === key ? '' : key }));

  return (
    <>
      <div className="toolbar" id="rfm-scope">
        {scopes.map((s) => (
          <button key={s} type="button" className={`chip ${scope === s ? 'active' : ''}`} data-scope={s} aria-pressed={scope === s} onClick={() => setSt((x) => ({ ...x, scope: s }))}>
            {RFM_SCOPE_LABEL[s]}
          </button>
        ))}
        <span className="sub num" id="rfm-summary">{stats ? rfmSummaryText(stats.scored, stats.unscored) : current?.err ? '' : 'กำลังโหลด…'}</span>
      </div>
      {current?.err ? <div className="login-err">{current.err}</div> : null}
      <div className="rfm-top">
        <section className="card rfm-card" aria-label="แผนที่กลุ่มลูกค้า">
          <div className="rfm-head">
            <h2>แผนที่กลุ่มลูกค้า</h2>
            <span className="sub">แกนตั้ง F = ความถี่ · แกนนอน R = ซื้อล่าสุด</span>
          </div>
          <RfmMap grid={grid} counts={stats ? stats.n : null} selected={seg?.key ?? ''} onSelect={pick} />
          <div className="rfm-foot sub">
            <span>← หายไปนาน</span>
            <span className="lbl-long">ซื้อล่าสุด (R) · จำนวนวันนับจากวันที่ซื้อครั้งล่าสุด</span>
            <span>เพิ่งซื้อ →</span>
          </div>
        </section>
        <RfmActionCard
          seg={seg} n={seg && stats ? (stats.n[seg.key] ?? 0) : null}
          contactable={seg && stats ? (stats.contactable[seg.key] ?? 0) : null} scored={stats ? stats.scored : null}
        />
      </div>
      {seg ? (
        <div className="rfm-list" id="rfm-list">
          <BasePage key={scope} scope={scope} fixedRfm={seg.key} />
        </div>
      ) : null}
    </>
  );
}
