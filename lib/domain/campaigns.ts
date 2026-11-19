import type { Campaign, CampaignCriterion, DemoCustomer, Lead, NewCampaign } from '@/lib/api/types';
import { BRAND, CRIT, MODES, type Brand, type ClaimMode } from '@/lib/constants';
import { isDnc, visible, type Viewer } from './leads';

// หน้าแคมเปญ + ตัวสร้างแคมเปญของ prototype (legacy/app.js L259-298, L647-663, L763-871) เป็นฟังก์ชันล้วน

/** การ์ดที่เลือกบนหน้าแคมเปญ: 'ALL' = ถังลูกค้าทั้งหมด, 'CAMPS' = ลูกค้าทุกแคมเปญ, อื่น ๆ = id แคมเปญ */
export const SEL_ALL = 'ALL';
export const SEL_CAMPS = 'CAMPS';

/** L261: การ์ดที่เลือกไว้ต้องเป็น ALL / CAMPS หรือแคมเปญของแบรนด์นี้ ไม่งั้นกลับไป ALL */
export function normalizeSelCamp(sel: string | null, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'brand'>>, brand: Brand): string {
  if (sel === SEL_ALL || sel === SEL_CAMPS) return sel;
  return sel && campaigns.find((c) => c.id === sel)?.brand === brand ? sel : SEL_ALL;
}

/** L278: เปิดอยู่และยังไม่เลยวันสิ้นสุด */
export const campaignActive = (c: Pick<Campaign, 'active' | 'end'>, today: string): boolean => c.active !== false && (!c.end || c.end >= today);

/** badge ของการ์ดแคมเปญ (L281) */
export function campaignBadge(c: Pick<Campaign, 'active' | 'end'>, today: string): { cls: 's-won' | 's-new'; text: string } {
  if (campaignActive(c, today)) return { cls: 's-won', text: 'กำลังดำเนินการ' };
  return { cls: 's-new', text: c.active === false ? 'ปิดอยู่' : 'จบแล้ว' };
}

export interface CampStats { n: number; done: number; won: number; pct: number }
/** สถิติการ์ด (L275-277, L655-656): ติดต่อแล้ว = สถานะไม่ใช่ใหม่, bar = done/n ปัดเป็น % */
export function campStats(ls: ReadonlyArray<Pick<Lead, 'status'>>): CampStats {
  const done = ls.filter((l) => l.status !== 'new').length;
  return { n: ls.length, done, won: ls.filter((l) => l.status === 'won').length, pct: ls.length ? Math.round((done / ls.length) * 100) : 0 };
}

/** ลีดในแคมเปญชุดนี้ที่ผู้ใช้เห็น (visible L37) */
export function leadsInCampaigns(leads: ReadonlyArray<Lead>, ids: ReadonlySet<string>, v: Viewer): Lead[] {
  return leads.filter((l) => !!l.campaignId && ids.has(l.campaignId) && visible(l, v));
}

/** base ของตาราง (L272): CAMPS = ทุกแคมเปญของแบรนด์, อื่น ๆ = แคมเปญที่เลือก — ผ่าน visible() */
export function campaignBase(leads: ReadonlyArray<Lead>, sel: string, brandCampaigns: ReadonlyArray<Pick<Campaign, 'id'>>, v: Viewer): Lead[] {
  const ids = sel === SEL_CAMPS ? new Set(brandCampaigns.map((c) => c.id)) : new Set([sel]);
  return leadsInCampaigns(leads, ids, v);
}

/** วิธีจองของการ์ดที่เลือก (L269): ไม่ใช่แคมเปญ (ALL/CAMPS) = self */
export const modeOf = (sel: string, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'claimMode'>>): ClaimMode =>
  campaigns.find((c) => c.id === sel)?.claimMode || 'self';

export interface Quota { n: number; mine: number; free: number; mode: string }
/** แถบ .quota (L290) */
export function quota(base: ReadonlyArray<Pick<Lead, 'owner'>>, meId: string, sel: string, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'claimMode'>>): Quota {
  return {
    n: base.length,
    mine: base.filter((l) => l.owner === meId).length,
    free: base.filter((l) => !l.owner).length,
    mode: sel === SEL_CAMPS ? 'ตามที่ตั้งไว้ในแต่ละแคมเปญ' : MODES[modeOf(sel, campaigns)],
  };
}

export const emptyCampaignsText = (isAdmin: boolean): string => `ยังไม่มีแคมเปญ${isAdmin ? ' — กด "+ สร้างแคมเปญ" ด้านบน' : ''}`;

/** โหมดตัวอย่าง (L648-653): ลูกค้าในถังของแบรนด์ (ไม่นับห้ามโทร) ที่มีลีดในแคมเปญของแบรนด์แล้ว (จับคู่ด้วยเบอร์) */
export function inCampLine(
  customers: ReadonlyArray<Pick<DemoCustomer, 'brand' | 'phone'>>, leads: ReadonlyArray<Lead>, campaigns: ReadonlyArray<Pick<Campaign, 'id' | 'brand'>>, brand: Brand,
): string {
  const ids = new Set(campaigns.filter((c) => c.brand === brand).map((c) => c.id));
  const phones = new Set(leads.filter((l) => !!l.campaignId && ids.has(l.campaignId)).map((l) => l.phone));
  const mine = customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone));
  const inC = mine.filter((c) => phones.has(c.phone)).length;
  return `เข้าแคมเปญแล้ว ${inC} · ยังไม่เข้า ${mine.length - inC}`;
}

/* ---------- ตัวสร้างแคมเปญ (popup F) ---------- */
export type CampaignTab = 'base' | 'set' | 'aud';
export interface CampaignForm {
  tab: CampaignTab; name: string; desc: string; active: boolean; start: string; end: string; brand: Brand;
  mode: ClaimMode; max: string; crits: CampaignCriterion[]; prev: boolean;
}
export const initialCampaignForm = (brand: Brand): CampaignForm => ({
  tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand, mode: 'self', max: '', crits: [], prev: false,
});

/** คำอธิบายใต้ตัวเลือกวิธีจอง (L814) */
export const MODE_HELP: Record<ClaimMode, string> = {
  self: 'เซลล์กดจองลีดที่ยังว่างเอง ลีดที่จองแล้วคนอื่นจะไม่เห็น',
  assign: 'หัวหน้าเลือกมอบหมายลีดให้เซลล์แต่ละคน',
  auto: 'ลีดเข้าถังของเซลล์ที่เคยขายให้ลูกค้ารายนั้นล่าสุดทันที ที่เหลือให้จองเอง',
};

export const namePlaceholder = (brand: Brand): string => `เช่น ${brand === 'hosttail' ? 'Hosttail Q4 2026' : 'Bebeplay Q4 2026'}`;

/** ปุ่ม "ถัดไป →" (L843): base → set → aud */
export const nextTab = (tab: CampaignTab): CampaignTab => (tab === 'base' ? 'set' : 'aud');

const has = (v: unknown): boolean => v !== undefined && v !== null && String(v) !== '';

/** เงื่อนไขหนึ่งข้อ (L771-779) ช่องว่าง = ผ่าน */
export function matchOne(c: Pick<DemoCustomer, 'purchases'>, cr: CampaignCriterion): boolean {
  const P = c.purchases;
  if (cr.type === 'product') {
    const k = (cr.kw || '').trim().toLowerCase();
    return !k || P.some((p) => (p.product + ' ' + p.sku).toLowerCase().includes(k));
  }
  if (cr.type === 'total') {
    const t = P.reduce((s, p) => s + p.amount, 0);
    return (!has(cr.min) || t >= Number(cr.min)) && (!has(cr.max) || t <= Number(cr.max));
  }
  if (cr.type === 'dates') return P.some((p) => (!cr.from || p.date >= cr.from) && (!cr.to || p.date <= cr.to));
  if (cr.type === 'order') return !has(cr.min) || P.some((p) => p.amount >= Number(cr.min));
  if (cr.type === 'times') return !has(cr.min) || P.length > Number(cr.min);
  return true;
}

export interface FunnelStep { label: string; n: number; pct: number }
/**
 * funnel (L785-793): ลูกค้าทั้งแบรนด์ (ไม่นับห้ามโทร) แล้วกรองทีละเงื่อนไข (AND); pct = n / ขั้นแรก ปัดเป็น %
 * ล็อกอินจริง customers = [] เสมอ จึงเป็น 0 ทุกขั้น (พฤติกรรมเดิมของ prototype)
 */
export function funnel(customers: ReadonlyArray<DemoCustomer>, leads: ReadonlyArray<Lead>, brand: Brand, crits: ReadonlyArray<CampaignCriterion>): { steps: FunnelStep[]; result: DemoCustomer[] } {
  let cur = customers.filter((c) => c.brand === brand && !isDnc(leads, c.phone));
  const raw: Array<{ label: string; n: number }> = [{ label: `ลูกค้าทั้งหมด · ${BRAND[brand]}`, n: cur.length }];
  crits.forEach((cr, i) => {
    cur = cur.filter((c) => matchOne(c, cr));
    raw.push({ label: `เงื่อนไข ${i + 1} · ${CRIT[cr.type].label}`, n: cur.length });
  });
  const top = raw[0].n || 1;
  return { steps: raw.map((s) => ({ ...s, pct: Math.round((s.n / top) * 100) })), result: cur };
}

/** แถว insert ของ dsales_campaigns (L852) — ไม่สร้างลีด */
export function newCampaignRow(f: CampaignForm): NewCampaign {
  return {
    brand: f.brand, name: f.name.trim(), description: f.desc.trim() || null, start_date: f.start || null, end_date: f.end || null,
    claim_mode: f.mode, max_per_rep: f.max ? Number(f.max) : null, active: !!f.active, criteria: f.crits,
  };
}
