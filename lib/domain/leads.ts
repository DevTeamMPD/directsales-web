import type { Campaign, Lead, Rep } from '@/lib/api/types';
import { STATUS, type LeadStatus } from '@/lib/constants';
import { fmtDate, todayBangkok } from '@/lib/format';
import type { Period, UiFilters } from '@/lib/state/reducer';
import { hasPeriod, inPeriod } from './period';

// กติกาลีดของ prototype (legacy/app.js L28-45, L80, L89-90, L122, L165-191, L219-225, L884-887) เป็นฟังก์ชันล้วน ไม่อ่าน state เอง

export interface Viewer { meId: string; isAdmin: boolean }
type RepNames = ReadonlyArray<Pick<Rep, 'id' | 'name'>>;

export const repName = (reps: RepNames, id: string | null | undefined): string | undefined =>
  id ? reps.find((r) => r.id === id)?.name : undefined;

/** ยอดซื้อรวม (L31): live ใช้ total จาก server, fixture รวมจากประวัติซื้อ */
export const total = (l: Pick<Lead, 'total' | 'purchases'>): number =>
  l.total != null ? Number(l.total) : l.purchases.reduce((s, p) => s + p.amount, 0);

/** เลขบิลที่เคยซื้อ (L122): live ใช้ bills จาก server (ว่างได้), fixture ใช้บิลไม่ซ้ำจากประวัติซื้อ */
export const bills = (l: Pick<Lead, 'bills' | 'purchases'>): string[] => l.bills ?? [...new Set(l.purchases.map((p) => p.bill))];

/** เซลล์ที่ขายล่าสุด (L80) = รายการซื้อแรกที่ผู้ขายเป็นเซลล์ในทีม (live ไม่มีผู้ขาย → null) */
export const lastSeller = (l: Pick<Lead, 'purchases'>, reps: ReadonlyArray<Pick<Rep, 'id'>>): string | null =>
  l.purchases.find((p) => p.seller && reps.some((r) => r.id === p.seller))?.seller || null;

/** ห้ามโทร (L35): มีลีดเบอร์นี้ที่ noCall */
export const isDnc = (leads: ReadonlyArray<Pick<Lead, 'phone' | 'noCall'>>, phone: string): boolean =>
  leads.some((l) => l.phone === phone && !!l.noCall);

export const releasedByMe = (l: Pick<Lead, 'releasedBy'>, v: Viewer): boolean => !v.isAdmin && !!l.releasedBy?.includes(v.meId);

/** หน้าแคมเปญ/การ์ด (L37): เซลล์เห็นเฉพาะลีดว่างกับของตัวเอง ไม่เห็นห้ามโทร/ที่ตัวเองคัดออก */
export const visible = (l: Pick<Lead, 'noCall' | 'releasedBy' | 'owner'>, v: Viewer): boolean =>
  !l.noCall && !releasedByMe(l, v) && (v.isAdmin || !l.owner || l.owner === v.meId);

/** หน้า Direct Sale / Dashboard (L38) */
export const mineOrAll = (l: Pick<Lead, 'owner'>, v: Viewer): boolean => v.isAdmin || l.owner === v.meId;

type Dated = Pick<Lead, 'owner' | 'interactions' | 'callback' | 'closedAt' | 'status'>;

/** ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ ที่เหลือต้องมีการติดต่อ/นัด/ปิดการขายในช่วง (L43) */
export const periodOk = (l: Dated, p: Period): boolean =>
  !hasPeriod(p) || !l.owner || l.interactions.some((i) => inPeriod(i.date, p)) || inPeriod(l.callback, p) || inPeriod(l.closedAt, p);

export const contactedIn = (l: Dated, p: Period): boolean => (hasPeriod(p) ? l.interactions.some((i) => inPeriod(i.date, p)) : l.status !== 'new');

export const wonIn = (l: Dated, p: Period): boolean => l.status === 'won' && (!hasPeriod(p) || inPeriod(l.closedAt, p));

/** ปุ่ม "ยกเลิกจอง" ในตาราง (L89): ต้องจองเอง (ไม่ใช่หัวหน้ามอบหมาย) ยังไม่ปิดการขาย และไม่ใช่ห้ามโทร */
export const canUnclaim = (l: Pick<Lead, 'owner' | 'claimedBy' | 'noCall' | 'status'>, meId: string): boolean =>
  l.owner === meId && l.claimedBy === meId && !l.noCall && l.status !== 'won';

/** ถังลูกค้า / popup ยืนยัน (L90): ไม่ต้องจองเอง */
export const canUnclaimAny = (l: Pick<Lead, 'owner' | 'noCall' | 'status'>, meId: string): boolean =>
  l.owner === meId && !l.noCall && l.status !== 'won';

export type StatusChip = 'all' | 'overdue' | 'today' | LeadStatus | 'nocall';
export const STATUS_CHIPS: readonly StatusChip[] = ['all', 'overdue', 'today', 'new', 'following', 'callback', 'won', 'unreachable', 'lost', 'nocall'];
const EXTRA: Partial<Record<StatusChip, string>> = { overdue: 'เลยนัด', today: 'นัดวันนี้', nocall: 'ไม่สะดวกให้โทร' };
export const CHIP_DOT: Record<Exclude<StatusChip, 'all'>, string> = {
  new: 'var(--grey)', following: 'var(--info)', callback: 'var(--warn)', won: 'var(--ok)', lost: 'var(--bad)', unreachable: 'var(--violet)',
  overdue: 'var(--bad)', today: 'var(--warn)', nocall: 'var(--bad)',
};
export const chipLabel = (s: StatusChip): string => (s === 'all' ? 'ทั้งหมด' : EXTRA[s] ?? STATUS[s as LeadStatus]);

type Matchable = Pick<Lead, 'callback' | 'noCall' | 'status'>;
export function matchStatus(l: Matchable, s: string, today: string): boolean {
  if (s === 'all') return true;
  if (s === 'today') return l.callback === today;
  if (s === 'overdue') return !!(l.callback && l.callback < today);
  if (s === 'nocall') return !!l.noCall;
  return l.status === s;
}

/** ตัวเลขในวงเล็บของชิปสถานะ (L220-221) นับจาก base ที่ผ่าน periodOk */
export function statusCounts(base: ReadonlyArray<Lead>, period: Period, today: string): Record<StatusChip, number> {
  const inRange = base.filter((l) => periodOk(l, period));
  return Object.fromEntries(STATUS_CHIPS.map((s) => [s, inRange.filter((l) => matchStatus(l, s, today)).length])) as Record<StatusChip, number>;
}

export type SortKey = UiFilters['sort'];

/** L181-185: due = วันนัดใกล้สุด (ไม่มีนัดไว้ท้าย), spend = ยอดซื้อมากสุด, none = ตามเดิม (sort ของ JS เสถียร) */
export function sortLeads(a: ReadonlyArray<Lead>, sort: SortKey): Lead[] {
  if (sort === 'due') return [...a].sort((x, y) => (x.callback || '9999').localeCompare(y.callback || '9999'));
  if (sort === 'spend') return [...a].sort((x, y) => total(y) - total(x));
  return [...a];
}

export interface LeadFilter { q: string; status: string; rep: string; camp: string; sort: SortKey; period: Period; today: string }

/** L165-180: ช่วงวันที่ → ชิปสถานะ → เซลล์ → แคมเปญ → คำค้น → เรียง */
export function filtered(base: ReadonlyArray<Lead>, f: LeadFilter): Lead[] {
  const q = f.q.trim().toLowerCase();
  const out = base.filter((l) => {
    if (!periodOk(l, f.period)) return false;
    if (!matchStatus(l, f.status, f.today)) return false;
    if (f.rep !== 'all' && l.owner !== f.rep) return false;
    if (f.camp !== 'all' && (f.camp === 'self' ? l.source !== 'self' : l.campaignId !== f.camp)) return false;
    if (!q) return true;
    return l.name.toLowerCase().includes(q) || l.phone.includes(q.replace(/-/g, '')) || bills(l).some((b) => b.includes(q)) || l.shop.toLowerCase().includes(q);
  });
  return sortLeads(out, f.sort);
}

/** ป้ายวันนัดใต้ badge สถานะ (L186-191) */
export function dueInfo(callback: string | null | undefined, today: string): { cls: '' | 'overdue' | 'today'; text: string } | null {
  if (!callback) return null;
  if (callback < today) return { cls: 'overdue', text: `เลยนัด ${fmtDate(callback)}` };
  if (callback === today) return { cls: 'today', text: `นัดวันนี้ ${fmtDate(callback)}` };
  return { cls: '', text: `นัดติดต่อ ${fmtDate(callback)}` };
}

/** ข้อความ toast เมื่อจองลีดแคมเปญไม่ได้ (L886-887; maxPerRep ตรวจฝั่ง client เท่านั้น) หรือ null = จองได้ */
export function claimBlock(
  l: Pick<Lead, 'owner'>, camp: Pick<Campaign, 'id' | 'maxPerRep'> | undefined, leads: ReadonlyArray<Pick<Lead, 'campaignId' | 'owner'>>, meId: string,
): string | null {
  if (l.owner) return 'ลีดนี้มีคนจองไปแล้ว';
  if (camp?.maxPerRep && leads.filter((x) => x.campaignId === camp.id && x.owner === meId).length >= camp.maxPerRep) {
    return `จองได้สูงสุด ${camp.maxPerRep} ลีดต่อคนในแคมเปญนี้`;
  }
  return null;
}

/** ระยะที่ลีดอยู่ใน Direct Sale ได้ก่อนระบบคืนอัตโนมัติ (setting ds_max_days ใน DB, migration 20261123130000) */
export const DS_MAX_DAYS = 30;
/** แสดงแท็ก "เหลือ N วัน" เมื่อเหลือไม่เกินกี่วัน */
export const DS_WARN_DAYS = 7;

const dayNo = (ymd: string): number => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

/** วันที่เหลือก่อนคืนอัตโนมัติ (นับจากวันที่เข้า Direct Sale ตามเวลาไทย) — null = ไม่มีนาฬิกา หรือปิดการขายแล้ว */
export function releaseInfo(
  dsSince: string | null | undefined, status: LeadStatus, today: string, maxDays: number = DS_MAX_DAYS,
): { days: number; cls: '' | 'today' | 'overdue'; text: string } | null {
  if (!dsSince || status === 'won') return null;
  const since = todayBangkok(new Date(dsSince));
  const days = Math.max(0, maxDays - (dayNo(today) - dayNo(since)));
  if (days === 0) return { days, cls: 'overdue', text: `ครบ ${maxDays} วัน รอคืนอัตโนมัติ` };
  return { days, cls: days <= 3 ? 'overdue' : days <= DS_WARN_DAYS ? 'today' : '', text: `เหลือ ${days} วัน` };
}

export const releaseTagShown = (r: ReturnType<typeof releaseInfo>): boolean => !!r && r.days <= DS_WARN_DAYS;
