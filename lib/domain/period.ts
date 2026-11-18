import { fmtDate } from '@/lib/format';
import type { Period } from '@/lib/state/reducer';

// การ์ดช่วงวันที่ของ prototype (legacy/app.js L40-41, L46-78) — คำนวณวันที่แบบ UTC บนข้อความ today จึงไม่ขึ้นกับเขตเวลาเครื่อง

export type PresetKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0';
export const PRESETS: ReadonlyArray<readonly [PresetKey, string]> = [
  ['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7d', '7 วันล่าสุด'], ['m0', 'เดือนนี้'], ['m1', 'เดือนก่อน'], ['y0', 'ปีนี้'],
];

const ALL: Period = { from: '', to: '', key: 'all' };
const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number): string => ymd(new Date(Date.UTC(y, m, d)));

export const hasPeriod = (p: Pick<Period, 'from' | 'to'>): boolean => !!(p.from || p.to);

export const inPeriod = (d: string | null | undefined, p: Pick<Period, 'from' | 'to'>): boolean =>
  !!d && (!p.from || d.slice(0, 10) >= p.from) && (!p.to || d.slice(0, 10) <= p.to);

export function presetRange(k: PresetKey, today: string): [string, string] {
  const t = new Date(today + 'T00:00:00Z');
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  if (k === 'today') return [today, today];
  if (k === '7d') return [ymd(new Date(t.getTime() - 6 * 864e5)), today];
  if (k === 'm0') return [utc(y, m, 1), utc(y, m + 1, 0)];
  if (k === 'm1') return [utc(y, m - 1, 1), utc(y, m, 0)];
  if (k === 'y0') return [utc(y, 0, 1), utc(y, 11, 31)];
  return ['', ''];
}

export function presetPeriod(k: PresetKey, today: string): Period {
  const [from, to] = presetRange(k, today);
  return { from, to, key: k };
}

/** input[type=month] → วันแรกถึงวันสุดท้ายของเดือน; ล้างค่า → ทั้งหมด (L70-73) */
export function monthPeriod(value: string): Period {
  if (!value) return ALL;
  const [yy, mm] = value.split('-').map(Number);
  return { from: `${value}-01`, to: utc(yy, mm, 0), key: 'month' };
}

/** select ปี → ทั้งปี; เลือก "ปี…" ไม่เปลี่ยนอะไร (L74) */
export const yearPeriod = (value: string): Period | null => (value ? { from: `${value}-01-01`, to: `${value}-12-31`, key: 'year' } : null);

/** ช่องวันที่เริ่ม/สิ้นสุด (L75-77) */
export const customPeriod = (from: string, to: string): Period => ({ from, to, key: from || to ? 'custom' : 'all' });

export const yearOptions = (today: string): number[] => {
  const y = +today.slice(0, 4);
  return [y, y - 1, y - 2];
};

export const monthValue = (p: Period): string => (p.key === 'month' ? p.from.slice(0, 7) : '');
export const yearValue = (p: Period): string => (p.key === 'year' ? p.from.slice(0, 4) : '');

export function periodNote(p: Period): string {
  if (!hasPeriod(p)) return 'ยังไม่ได้กรองช่วงวันที่';
  return `กรอง ${p.from ? fmtDate(p.from) : '…'} – ${p.to ? fmtDate(p.to) : '…'} · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)`;
}
