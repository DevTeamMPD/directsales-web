'use client';

import {
  customPeriod, monthPeriod, monthValue, periodNote, presetPeriod, PRESETS, yearOptions, yearPeriod, yearValue,
} from '@/lib/domain/period';
import type { Period } from '@/lib/state/reducer';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** การ์ดช่วงวันที่ (ทุกหน้ายกเว้นตั้งค่า) ค่าคงอยู่ข้ามหน้าใน state.ui.period */
export function PeriodCard() {
  const { ui, today } = useAppState();
  const { setUi, setPool, dispatch } = useActions();
  const P = ui.period;
  // prototype: เปลี่ยนช่วงแล้วถังลูกค้ากลับไปหน้าแรกและโหลดใหม่ (ui.pool.page = 0, loaded = false)
  const apply = (p: Period) => {
    setUi({ period: p });
    setPool({ page: 0 });
    dispatch({ type: 'invalidatePool' });
  };
  return (
    <div className="period card">
      <div className="period-row">
        <b className="sub">ช่วงวันที่</b>
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" className={`chip ${P.key === k ? 'active' : ''}`} data-pk={k} onClick={() => apply(presetPeriod(k, today))}>
            {label}
          </button>
        ))}
        <input type="month" id="p-month" className="input pin" aria-label="เลือกเดือน" value={monthValue(P)} onChange={(e) => apply(monthPeriod(e.target.value))} />
        <select
          id="p-year"
          className="select"
          aria-label="เลือกปี"
          value={yearValue(P)}
          onChange={(e) => {
            const p = yearPeriod(e.target.value);
            if (p) apply(p);
          }}
        >
          <option value="">ปี…</option>
          {yearOptions(today).map((v) => (
            <option key={v} value={String(v)}>{v}</option>
          ))}
        </select>
        <input type="date" id="p-from" className="input pin" aria-label="ตั้งแต่วันที่" value={P.from} onChange={(e) => apply(customPeriod(e.target.value, P.to))} />
        <span className="sub">ถึง</span>
        <input type="date" id="p-to" className="input pin" aria-label="ถึงวันที่" value={P.to} onChange={(e) => apply(customPeriod(P.from, e.target.value))} />
      </div>
      <div className="sub">{periodNote(P)}</div>
    </div>
  );
}
