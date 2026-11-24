import type { LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';
import { dueInfo, releaseInfo, releaseTagShown } from '@/lib/domain/leads';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge s-${status}`}>{STATUS[status]}</span>;
}

export function DueTag({ callback, today }: { callback: string | null; today: string }) {
  const d = dueInfo(callback, today);
  return d ? <div className={`due ${d.cls}`}>{d.text}</div> : null;
}

/** "เหลือ N วัน" ก่อนระบบคืนลีดจาก Direct Sale อัตโนมัติ (แสดงเมื่อเหลือ ≤ 7 วัน ไม่แสดงกับลีดที่ปิดการขายแล้ว) */
export function ReleaseTag({ dsSince, status, today }: { dsSince: string | null | undefined; status: LeadStatus; today: string }) {
  const r = releaseInfo(dsSince, status, today);
  return releaseTagShown(r) && r ? (
    <div className={`due ${r.cls}`} title="ครบ 30 วันใน Direct Sale แล้วยังไม่ปิดการขาย ระบบจะคืนลูกค้ารายนี้อัตโนมัติ">{r.text}</div>
  ) : null;
}
