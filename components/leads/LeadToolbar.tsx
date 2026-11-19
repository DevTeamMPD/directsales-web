'use client';

import { useMemo } from 'react';
import type { Lead } from '@/lib/api/types';
import { PATHS } from '@/lib/constants';
import { CHIP_DOT, chipLabel, statusCounts, STATUS_CHIPS, type SortKey } from '@/lib/domain/leads';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * toolbar ลีด: ค้นหา (กรองทุกตัวอักษร ไม่ debounce — input เดิมไม่ถูกสร้างใหม่ focus/caret จึงอยู่ที่เดิม),
 * ชิปสถานะพร้อมจำนวน (นับจาก base ที่ผ่านช่วงวันที่), แคมเปญ (หน้า Direct Sale), เรียง, เซลล์ (หัวหน้า)
 */
export function LeadToolbar({ base, withCampSelect }: { base: Lead[]; withCampSelect: boolean }) {
  const { ui, today, isAdmin, reps, campaigns } = useAppState();
  const { setUi } = useActions();
  const counts = useMemo(() => statusCounts(base, ui.period, today), [base, ui.period, today]);
  return (
    <div className="toolbar">
      <label className="search" htmlFor="q">
        <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
        <input id="q" type="search" placeholder="ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า" value={ui.q} onChange={(e) => setUi({ q: e.target.value })} />
      </label>
      {STATUS_CHIPS.map((s) => (
        <button key={s} className={`chip ${ui.status === s ? 'active' : ''}`} data-chip={s} onClick={() => setUi({ status: s })}>
          {s === 'all' ? null : <i className="dot" style={{ background: CHIP_DOT[s] }} />}
          {chipLabel(s)} ({counts[s]})
        </button>
      ))}
      {withCampSelect ? (
        <select id="camp-sel" className="select" aria-label="แคมเปญ" value={ui.camp} onChange={(e) => setUi({ camp: e.target.value })}>
          <option value="all">แคมเปญทั้งหมด</option>
          <option value="self">เซลล์ขุดเอง</option>
          {campaigns.map((c) => (
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
