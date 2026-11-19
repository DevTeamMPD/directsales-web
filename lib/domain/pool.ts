import type { Campaign, DemoCustomer, Lead, PoolRow, Rep } from '@/lib/api/types';
import { PAGE, type Brand } from '@/lib/constants';
import { canUnclaimAny, isDnc, releasedByMe, repName, type Viewer } from './leads';
import { hasPeriod, inPeriod } from './period';
import type { Period } from '@/lib/state/reducer';

// ถังลูกค้า "ลูกค้าทั้งหมด" (legacy/app.js L614-760) และหน้า /mine, /pool (spec ข้อ 3) เป็นฟังก์ชันล้วน

/** ปุ่มท้ายแถว: จอง (outline) / ยกเลิกจอง (danger) / ปุ่มกดไม่ได้ */
export type RowAction =
  | { kind: 'claim'; text: string }
  | { kind: 'unclaim'; text: 'ยกเลิกจอง'; leadId: string }
  | { kind: 'disabled'; text: string };

export interface PoolCtx { live: boolean; isAdmin: boolean; meId: string; leads: ReadonlyArray<Lead>; reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>> }

const unclaim = (leadId: string): RowAction => ({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId });
const disabled = (text: string): RowAction => ({ kind: 'disabled', text });

/** poolAction (L694-704) */
export function poolAction(r: PoolRow, ctx: PoolCtx): RowAction {
  if (ctx.live) {
    if (r.noCall) return disabled('ไม่สะดวกให้โทร');
    if (r.mine) {
      const l = r.leadId ? ctx.leads.find((x) => x.id === r.leadId) : undefined;
      return l && r.leadId && canUnclaimAny(l, ctx.meId) ? unclaim(r.leadId) : disabled('จองแล้ว');
    }
    if (r.taken) return disabled(ctx.isAdmin && r.takenName ? 'จองโดย ' + r.takenName : 'จองแล้ว');
    return { kind: 'claim', text: 'จอง' };
  }
  if (r.releasedByMe) return disabled('คัดออกแล้ว');
  if (r.taken) {
    if (r.taken === ctx.meId) return r.mineReserved && r.leadId ? unclaim(r.leadId) : disabled('จองแล้ว');
    return disabled(ctx.isAdmin ? 'จองโดย ' + (repName(ctx.reps, r.taken) || '') : 'จองแล้ว');
  }
  return { kind: 'claim', text: 'จอง' };
}

/** badge "จองแล้ว / จองโดย …" ที่หัว popup E (L729) */
export function takenBadge(r: PoolRow, ctx: Pick<PoolCtx, 'isAdmin' | 'reps'>): string | null {
  if (!r.taken) return null;
  if (r.taken === 'other' && !(ctx.isAdmin && r.takenName)) return 'จองแล้ว';
  return 'จองโดย ' + (repName(ctx.reps, r.taken) || r.takenName || '');
}

/** ปุ่มท้าย popup E (L740): จอง = ยังไม่มีคนจองและไม่ใช่ห้ามโทร; ยกเลิกจอง = ของฉันและยกเลิกได้ */
export function poolDetailFooter(r: PoolRow, ctx: PoolCtx): RowAction | null {
  if (!r.taken && !r.noCall) return { kind: 'claim', text: 'จอง' };
  if (r.taken === ctx.meId && r.leadId) {
    const l = ctx.leads.find((x) => x.id === r.leadId);
    if (ctx.live ? !!l && canUnclaimAny(l, ctx.meId) : !!r.mineReserved) return unclaim(r.leadId);
  }
  return null;
}

/** ช่อง "แคมเปญ" ของโหมดตัวอย่าง (L689-693) — ล็อกอินจริงแสดง "—" */
export function poolCampNames(r: Pick<PoolRow, 'phone'>, leads: ReadonlyArray<Lead>, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'name'>>): string[] {
  return leads
    .filter((l) => l.phone === r.phone && l.campaignId)
    .map((l) => campaigns.find((c) => c.id === l.campaignId)?.name)
    .filter((n): n is string => !!n);
}

/** "1–50 จาก 60" (L686) — total ว่าง/0 = ไม่แสดง */
export function pageRange(page: number, rowCount: number, total: number | null): string {
  if (!total) return '';
  const from = page * PAGE;
  return `${(from + 1).toLocaleString('th-TH')}–${(from + rowCount).toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')}`;
}
/** ปุ่ม "ถัดไป →" (L687) */
export const canNext = (page: number, rowCount: number, total: number | null): boolean => !(total === null || page * PAGE + rowCount >= total);

const sumAmount = (c: Pick<DemoCustomer, 'purchases'>): number => c.purchases.reduce((s, p) => s + p.amount, 0);
const ownedLead = (leads: ReadonlyArray<Lead>, phone: string): Lead | undefined => leads.find((l) => l.phone === phone && l.owner);

/** โหมดตัวอย่าง: จำนวนลูกค้าทั้งแบรนด์ (L642) */
export const demoGrand = (customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, brand: Brand): number =>
  customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone)).length;

/** โหมดตัวอย่าง (L636-640): ค้นหา ชื่อ/ชื่อแชต/เบอร์ (ตัวเลข)/เลขบิล, ไม่รวมห้ามโทร, ช่วงวันที่ตามวันซื้อล่าสุด, เรียงยอดซื้อมากสุด */
export function demoPool(
  customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>,
  o: { brand: Brand | null; q: string; page: number; period: Period; viewer: Viewer },
): { rows: PoolRow[]; total: number } {
  const q = o.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const all = customers
    .filter((c) => (!o.brand || c.brand === o.brand) && !isDnc(leads, c.phone) && (
      !q || c.name.toLowerCase().includes(q) || (c.chatName || '').toLowerCase().includes(q) || (!!qd && c.phone.includes(qd))
      || c.purchases.some((p) => p.bill.includes(q))
    ))
    .filter((c) => !hasPeriod(o.period) || inPeriod(c.purchases[0]?.date, o.period))
    .sort((a, b) => sumAmount(b) - sumAmount(a));
  const rows = all.slice(o.page * PAGE, o.page * PAGE + PAGE).map((c): PoolRow => {
    const tl = ownedLead(leads, c.phone);
    return {
      id: c.id, name: c.name, phone: c.phone, segment: '', ltv: sumAmount(c), orders: c.purchases.length, last: c.purchases[0]?.date ?? null,
      brands: [c.brand], chat: c.chatName, leadId: tl?.id ?? null, mine: false, noCall: false, takenName: '', taken: tl?.owner ?? null,
      dormantDays: null, ownerTag: null,
      releasedByMe: leads.some((l) => l.phone === c.phone && releasedByMe(l, o.viewer)),
      mineReserved: tl?.owner === o.viewer.meId && !tl?.noCall && tl?.status !== 'won',
    };
  });
  return { rows, total: all.length };
}

/* ---------- /mine และ /pool (dsales_base_customers) ---------- */
export type BaseScopeKey = 'mine' | 'pool';

/** แบรนด์ที่ใช้จอง (spec ข้อ 3): แบรนด์ที่เลือกในตัวกรอง หรือแบรนด์แรกของลูกค้าที่เป็น bebeplay/hosttail; ไม่มี = null */
export function claimBrand(selected: string | null | undefined, brands: ReadonlyArray<string>): Brand | null {
  if (selected === 'bebeplay' || selected === 'hosttail') return selected;
  const b = brands.find((x) => x === 'bebeplay' || x === 'hosttail');
  return (b as Brand | undefined) ?? null;
}
export const NO_BRAND_TEXT = 'เลือกแบรนด์ที่ช่องด้านบนก่อนจอง';

/**
 * ปุ่มของ /mine, /pool (spec ข้อ 3): ห้ามโทร → disabled; ของฉันที่มีลีดแล้ว → ยกเลิกจอง/จองแล้ว; ของฉันตาม tag ที่ยังไม่มีลีด → เริ่มติดตาม;
 * เป็นของเซลล์คนอื่น (ลีดหรือ tag) → disabled "เป็นลูกค้าของ <ชื่อ/tag>"; ว่าง → จอง
 */
export function baseAction(r: PoolRow, ctx: Pick<PoolCtx, 'meId' | 'leads'>): RowAction {
  if (r.noCall) return disabled('ไม่สะดวกให้โทร');
  if (r.mine) {
    const l = r.leadId ? ctx.leads.find((x) => x.id === r.leadId) : undefined;
    if (l && r.leadId && l.owner === ctx.meId) return canUnclaimAny(l, ctx.meId) ? unclaim(r.leadId) : disabled('จองแล้ว');
    return { kind: 'claim', text: 'เริ่มติดตาม' };
  }
  if (r.taken) {
    const who = r.takenName || r.ownerTag;
    return disabled(who ? `เป็นลูกค้าของ ${who}` : 'จองแล้ว');
  }
  return { kind: 'claim', text: 'จอง' };
}

export const dormantText = (days: number | null): string => (days == null ? '—' : `ไม่ซื้อมา ${days.toLocaleString('th-TH')} วัน`);

/** total ของ /mine, /pool: ใช้จากหน้าที่มีแถว (dsales_base_customers คืน total_count เฉพาะเมื่อมีแถว) หน้าเกินท้ายคงค่าเดิม */
export const keepTotal = (rowsTotal: number, rowCount: number, page: number, prev: number | null): number | null =>
  rowCount ? rowsTotal : page === 0 ? 0 : prev;

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / 864e5);

/** โหมด fixture ของ /mine, /pool: ของฉัน = มีลีดเบอร์นี้ที่ฉันดูแล, ถังกลาง = ไม่มีใครดูแล — เรียงยอดซื้อมากสุด */
export function demoBase(
  customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, scope: BaseScopeKey,
  o: { brand: Brand | null; q: string; page: number; today: string; meId: string },
): { rows: PoolRow[]; total: number } {
  const q = o.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const all = customers
    .filter((c) => {
      const owner = ownedLead(leads, c.phone)?.owner ?? null;
      return (scope === 'mine' ? owner === o.meId : owner === null) && (!o.brand || c.brand === o.brand)
        && (!q || c.name.toLowerCase().includes(q) || (c.chatName || '').toLowerCase().includes(q) || (!!qd && c.phone.includes(qd)));
    })
    .sort((a, b) => sumAmount(b) - sumAmount(a));
  const rows = all.slice(o.page * PAGE, o.page * PAGE + PAGE).map((c): PoolRow => {
    const l = leads.find((x) => x.phone === c.phone);
    const owner = l?.owner ?? null;
    const last = c.purchases[0]?.date ?? null;
    return {
      id: c.id, name: c.name, phone: c.phone, segment: '', ltv: sumAmount(c), orders: c.purchases.length, last, brands: [c.brand],
      chat: c.chatName, leadId: l?.id ?? null, mine: owner === o.meId, noCall: !!l?.noCall, takenName: '',
      taken: owner ? (owner === o.meId ? o.meId : 'other') : null, dormantDays: last ? daysBetween(last, o.today) : null, ownerTag: null,
    };
  });
  return { rows, total: all.length };
}
