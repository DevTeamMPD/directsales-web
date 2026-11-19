import type { ContactType, Lead, Rep } from '@/lib/api/types';
import { BRAND, TH_MONTHS, type Brand } from '@/lib/constants';
import type { Period } from '@/lib/state/reducer';
import { contactedIn, repName, wonIn, type Viewer } from './leads';
import { hasPeriod, inPeriod } from './period';

// Dashboard ของ prototype (legacy/app.js L301-366) เป็นฟังก์ชันล้วน — ตัวเลขทั้งหมดคิดจากลีดใน state (mineOrAll) และช่วงวันที่

export type DashBrand = 'all' | Brand;

export interface DashStat { n: number; c: number; w: number; val: number; due: number; wait: number }

/** stat(arr) (L304-309): ติดต่อแล้ว = contactedIn, ปิดการขาย = wonIn, ยอด = closedAmount ?? ยอดซื้อแรก ?? 0, เลยนัด = callback < วันนี้ */
export function dashStat(arr: ReadonlyArray<Lead>, period: Period, today: string): DashStat {
  const w = arr.filter((l) => wonIn(l, period));
  return {
    n: arr.length,
    c: arr.filter((l) => contactedIn(l, period)).length,
    w: w.length,
    val: w.reduce((s, l) => s + (l.closedAmount ?? l.purchases[0]?.amount ?? 0), 0),
    due: arr.filter((l) => !!l.callback && l.callback < today).length,
    wait: arr.filter((l) => l.status === 'callback').length,
  };
}

/** L310 */
export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);

/** L312 */
export const scopeLabel = (b: DashBrand): string => (b === 'all' ? 'ทุกแบรนด์' : BRAND[b]);

export const byBrand = (A: ReadonlyArray<Lead>, b: DashBrand): Lead[] => (b === 'all' ? [...A] : A.filter((l) => l.brand === b));

/** ชิปแบรนด์ (L323-324) นับจาก A ทั้งหมด */
export function brandChips(A: ReadonlyArray<Lead>): Array<{ key: DashBrand; label: string; n: number; dot: string | null }> {
  return [
    { key: 'all', label: 'ทุกแบรนด์', n: A.length, dot: null },
    { key: 'bebeplay', label: 'Bebeplay', n: A.filter((l) => l.brand === 'bebeplay').length, dot: 'var(--bebe)' },
    { key: 'hosttail', label: 'Hosttail', n: A.filter((l) => l.brand === 'hosttail').length, dot: 'var(--host)' },
  ];
}

export interface RepBar { id: string; name: string; owned: number; c: number; w: number; ownedWidth: string; wonWidth: string }

/** ผลงานรายเซลล์ (L313-319): เซลล์เห็นเฉพาะแถวตัวเอง; ความกว้าง bar เทียบกับเซลล์ที่ดูแลลีดมากสุด (ไม่ปัดเศษ เหมือน prototype) */
export function repBars(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Rep>, v: Viewer, period: Period): RepBar[] {
  const maxN = Math.max(1, ...reps.map((r) => L.filter((l) => l.owner === r.id).length));
  return reps
    .filter((r) => v.isAdmin || r.id === v.meId)
    .map((r) => {
      const mine = L.filter((l) => l.owner === r.id);
      const w = mine.filter((l) => wonIn(l, period)).length;
      return {
        id: r.id, name: r.name, owned: mine.length, c: mine.filter((l) => contactedIn(l, period)).length, w,
        ownedWidth: `${(mine.length / maxN) * 100}%`, wonWidth: `${mine.length ? (w / maxN) * 100 : 0}%`,
      };
    });
}

export interface FeedItem { key: string; type: ContactType; lead: string; rep: string; date: string; note: string }

/** กิจกรรมล่าสุด (L320-322): 8 บันทึกล่าสุดในช่วงวันที่ เรียงใหม่ → เก่า */
export function activityFeed(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>, period: Period): FeedItem[] {
  return L.flatMap((l) => l.interactions.filter((i) => !hasPeriod(period) || inPeriod(i.date, period)).map((i) => ({ i, l })))
    .sort((a, b) => b.i.date.localeCompare(a.i.date))
    .slice(0, 8)
    .map(({ i, l }) => ({ key: `${l.id}-${i.id}`, type: i.type, lead: l.name, rep: repName(reps, i.rep) || '', date: i.date, note: i.note }));
}

/** หัวคอลัมน์เดือน (L328-329): "พ.ย. 2026" / "ไม่ระบุวันที่" */
export const monthLabel = (k: string): string => (k === 'none' ? 'ไม่ระบุวันที่' : `${TH_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`);

export interface CommRow { name: string; byM: number[]; sum: number; bills: number; cnt: number; comm: number }
export interface CommTable { months: string[]; rows: CommRow[]; colSum: number[]; grand: number; bills: number; rate: number }

/** ตารางยอดที่ปิดได้รายเดือนต่อเซลล์ (L330-341): ลีดที่ปิดการขายในช่วงและมีผู้ดูแล, เฉพาะเซลล์ที่มีอย่างน้อย 1 ราย */
export function commissionTable(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Rep>, period: Period, rate: number): CommTable {
  const won = L.filter((l) => wonIn(l, period)).filter((l) => l.owner);
  const mkey = (l: Lead): string => (l.closedAt ? l.closedAt.slice(0, 7) : 'none');
  const months = [...new Set(won.map(mkey))].sort();
  const rows = reps
    .map((r) => {
      const mine = won.filter((l) => l.owner === r.id);
      const byM = months.map((m) => mine.filter((l) => mkey(l) === m).reduce((s, l) => s + (l.closedAmount ?? 0), 0));
      const sum = byM.reduce((a, b) => a + b, 0);
      return { name: r.name, byM, sum, bills: mine.reduce((s, l) => s + l.closedBills.length, 0), cnt: mine.length, comm: (sum * rate) / 100 };
    })
    .filter((r) => r.cnt);
  const colSum = months.map((_, i) => rows.reduce((s, r) => s + r.byM[i], 0));
  return { months, rows, colSum, grand: colSum.reduce((a, b) => a + b, 0), bills: rows.reduce((s, r) => s + r.bills, 0), rate };
}

/** "คัดลอกตาราง" (L362-363): หัวตาราง + แถวเซลล์เป็นตัวเลขดิบ (ไม่มีแถวรวม) คั่นด้วย tab */
export function commissionTsv(t: CommTable): string {
  const rows: Array<Array<string | number>> = [
    ['เซลล์', ...t.months.map(monthLabel), 'ยอดรวม', 'จำนวนบิล', 'ค่าคอม'],
    ...t.rows.map((r) => [r.name, ...r.byM, r.sum, r.bills, t.rate ? Math.round(r.comm) : '']),
  ];
  return rows.map((r) => r.join('\t')).join('\n');
}

/** ช่องอัตราค่าคอม (L360): ค่าว่าง/ไม่ใช่ตัวเลข = 0 */
export const parseRate = (s: string): number => Number(s) || 0;
