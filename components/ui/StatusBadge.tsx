import type { LeadAi, LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';
import { aiTag } from '@/lib/domain/aiStatus';
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

/** ผลวิเคราะห์ AI ล่าสุด (วางเมาส์ดูความสนใจ/คำเตือน/ขั้นต่อไป) */
export function AiTag({ ai }: { ai: LeadAi | null | undefined }) {
  const t = aiTag(ai);
  return t ? <div><span className={`tag ai-tag ${t.warn ? 'warn' : ''}`} title={t.title}>{t.text}</span></div> : null;
}
