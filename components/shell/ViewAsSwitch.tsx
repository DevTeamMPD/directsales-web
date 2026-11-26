'use client';

import { viewAsOptions } from '@/lib/domain/viewAs';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * หัวหน้าเลือก "มุมมอง": ทั้งทีม หรือเซลล์ 1 คน (อยู่ใต้กล่องผู้ใช้ในเมนูซ้าย)
 * เลือกเซลล์แล้ว Direct Sale / ลูกค้าของฉัน = ของเซลล์คนนั้น และจอง/ส่งข้อความ = ในนามเซลล์ (บันทึก/ปิดการขายนับให้เจ้าของลีด)
 */
export function ViewAsSwitch() {
  const { isAdmin, live, reps, meId, viewAs } = useAppState();
  const { setViewAs } = useActions();
  if (!isAdmin || !live) return null;
  const opts = viewAsOptions(reps, meId);
  if (!opts.length) return null;
  return (
    <div className={`view-as${viewAs ? ' on' : ''}`}>
      <label htmlFor="view-as" className="me-label">มุมมอง</label>
      <select id="view-as" className="select" value={viewAs ?? ''} onChange={(e) => setViewAs(e.target.value || null)}>
        <option value="">ทั้งทีม (หัวหน้า)</option>
        {opts.map((o) => <option key={o.value} value={o.value}>ทำแทน {o.label}</option>)}
      </select>
    </div>
  );
}

/** แถบเตือนบนทุกหน้าขณะทำแทนเซลล์ */
export function ViewAsBar() {
  const { viewAs, reps } = useAppState();
  const { setViewAs } = useActions();
  if (!viewAs) return null;
  const name = reps.find((r) => r.id === viewAs)?.name ?? '';
  return (
    <div className="view-as-bar" id="view-as-bar" role="status">
      <span>กำลังดูและทำงานแทน <b>{name}</b> · จอง/ส่งข้อความเป็นของเซลล์คนนี้ · บันทึกและปิดการขายนับผลงานให้เจ้าของลีด</span>
      <button type="button" className="btn sm" onClick={() => setViewAs(null)}>กลับเป็นมุมมองทั้งทีม</button>
    </div>
  );
}
