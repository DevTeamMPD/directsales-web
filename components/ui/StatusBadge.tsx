import type { LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';
import { dueInfo } from '@/lib/domain/leads';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge s-${status}`}>{STATUS[status]}</span>;
}

export function DueTag({ callback, today }: { callback: string | null; today: string }) {
  const d = dueInfo(callback, today);
  return d ? <div className={`due ${d.cls}`}>{d.text}</div> : null;
}
