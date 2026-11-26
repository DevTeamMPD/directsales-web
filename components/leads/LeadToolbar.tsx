'use client';

import { useEffect, useMemo } from 'react';
import type { Lead } from '@/lib/api/types';
import { PATHS } from '@/lib/constants';
import { inBrand } from '@/lib/domain/brand';
import { CHIP_DOT, chipLabel, statusCounts, STATUS_CHIPS, type SortKey } from '@/lib/domain/leads';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * toolbar ลีด: ค้นหา (กรองทุกตัวอักษร ไม่ debounce — input เดิมไม่ถูกสร้างใหม่ focus/caret จึงอยู่ที่เดิม),
 * ชิปสถานะพร้อมจำนวน (นับจาก base ที่ผ่านช่วงวันที่), แคมเปญ (หน้า Direct Sale — เฉพาะแบรนด์ใหญ่ที่เลือก), เรียง, เซลล์ (หัวหน้า)
 */
export function LeadToolbar({ base, withCampSelect }: { base: Lead[]; withCampSelect: boolean }) {
  const { ui, today, isAdmin, reps, campaigns, brand } = useAppState();
  const { setUi } = useActions();
  const counts = useMemo(() => statusCounts(base, ui.period, today), [base, ui.period, today]);
  const brandCamps = useMemo(() => campaigns.filter((c) => inBrand(brand, c.brand)), [campaigns, brand]);
  // แคมเปญที่เลือกไว้เป็นของอีกแบรนด์ (เพิ่งสลับแบรนด์ใหญ่) = กลับเป็นแคมเปญทั้งหมด
  const campOut = withCampSelect && campaigns.some((c) => c.id === ui.camp && !inBrand(brand, c.brand));
  useEffect(() => {
    if (campOut) setUi({ camp: 'all' });
  }, [campOut, setUi]);
  return (
    <div className="toolbar">
      <label className="search" htmlFor="q">
        <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
        <input id="q" type="search" placeholder="ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า" value={ui.q} onChange={(e) => setUi({ q: e.target.value })} />
      </label>
      <div className="chip-row">
        {STATUS_CHIPS.map((s) => (
          <button key={s} className={`chip ${ui.status === s ? 'active' : ''}`} data-chip={s} onClick={() => setUi({ status: s })}>
            {s === 'all' ? null : <i className="dot" style={{ background: CHIP_DOT[s] }} />}
            {chipLabel(s)} ({counts[s]})
          </button>
        ))}
      </div>
      {withCampSelect ? (
        <select id="camp-sel" className="select" aria-label="แคมเปญ" value={campOut ? 'all' : ui.camp} onChange={(e) => setUi({ camp: e.target.value })}>
          <option value="all">แคมเปญทั้งหมด</option>
          <option value="self">เซลล์ขุดเอง</option>
          {brandCamps.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : null}
      <select id="sort-sel" className="select" aria-label="เรียงตาม" value={ui.sort} onChange={(e) => setUi({ sort: e.target.value as SortKey })}>
        <option value="due">เรียง: วันนัดใกล้สุด</option>
        <option value="spend">เรียง: ยอดซื้อสูงสุด</option>
        <option value="none">เรียง: ตามเดิม</option>
      </select>
      {isAdmin ? (
        <select id="rep-sel" className="select" aria-label="เซลล์" value={ui.rep} onChange={(e) => setUi({ rep: e.target.value })}>
          <option value="all">เซลล์ทุกคน</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
