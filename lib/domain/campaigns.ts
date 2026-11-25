import type { BaseFilterJson, Campaign, CampaignCriterion, DemoCustomer, Lead, NewCampaign, ProductItem, ProductRow } from '@/lib/api/types';
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
    if (cr.items?.length) return P.some((p) => cr.items!.some((it) => it.sku === p.sku));
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

/* ---------- กลุ่มลูกค้าจริง (ล็อกอินจริง: dsales_base_customers + ตัวกรองของแคมเปญ) ---------- */

const num = (v: unknown): number | null => (has(v) && Number.isFinite(Number(v)) ? Number(v) : null);
const maxOf = (a: number | undefined, b: number): number => (a === undefined ? b : Math.max(a, b));
const minOf = (a: number | undefined, b: number): number => (a === undefined ? b : Math.min(a, b));

/** เงื่อนไขสินค้ามีค่า (ติ๊ก SKU หรือพิมพ์คำค้น) */
const productSet = (cr: CampaignCriterion): boolean => cr.type === 'product' && (!!cr.items?.length || !!(cr.kw || '').trim());

/**
 * criteria ของแคมเปญ → ตัวกรองของ dsales_base_customers (ช่องว่าง = ไม่เป็นเงื่อนไข เหมือน matchOne)
 * สินค้า: ติ๊ก SKU = ซื้อ SKU ใดก็ได้ในข้อนั้น (ไม่ติ๊กแต่มีคำค้น = ทุก SKU ที่มีคำนั้น) · หลายข้อ = ต้องซื้อครบทุกข้อ
 * ยอดซื้อรวม → ltv_min / ltv_to (รวมค่าขอบ) · ช่วงวันที่ → bought_from / bought_to · ยอดต่อบิล → bill_min · ซื้อมากกว่า N ครั้ง → orders_min = N + 1
 * เงื่อนไขชนิดเดียวกันหลายข้อ = เอาค่าที่เข้มกว่า
 */
export function criteriaFilters(crits: ReadonlyArray<CampaignCriterion>): BaseFilterJson {
  const f: BaseFilterJson = {};
  for (const cr of crits) {
    if (cr.type === 'product') {
      if (!productSet(cr)) continue;
      const g = cr.items?.length ? { skus: cr.items.map((x) => x.sku) } : { kw: (cr.kw || '').trim() };
      f.products = [...(f.products ?? []), g];
    } else if (cr.type === 'total') {
      const lo = num(cr.min);
      const hi = num(cr.max);
      if (lo !== null) f.ltv_min = maxOf(f.ltv_min, lo);
      if (hi !== null) f.ltv_to = minOf(f.ltv_to, hi);
    } else if (cr.type === 'dates') {
      if (cr.from) f.bought_from = f.bought_from && f.bought_from > cr.from ? f.bought_from : cr.from;
      if (cr.to) f.bought_to = f.bought_to && f.bought_to < cr.to ? f.bought_to : cr.to;
    } else if (cr.type === 'order') {
      const v = num(cr.min);
      if (v !== null) f.bill_min = maxOf(f.bill_min, v);
    } else if (cr.type === 'times') {
      const v = num(cr.min);
      if (v !== null) f.orders_min = maxOf(f.orders_min, Math.floor(v) + 1);
    }
  }
  return f;
}

/** ตัวกรองสะสมของแต่ละขั้น funnel (ขั้น i = เงื่อนไข 1..i) */
export const stepFilters = (crits: ReadonlyArray<CampaignCriterion>): BaseFilterJson[] => crits.map((_, i) => criteriaFilters(crits.slice(0, i + 1)));

/** แบรนด์ที่ใช้กรอง: มีเงื่อนไขสินค้าแล้วไม่กรองแบรนด์ซ้ำ (สินค้าบอกแบรนด์อยู่แล้ว — แบรนด์ของลูกค้าในฐานยังไม่ครบ) */
export const audienceBrand = (brand: Brand, crits: ReadonlyArray<CampaignCriterion>): Brand | null => (crits.some(productSet) ? null : brand);

export interface LiveStep { label: string; n: number | null; pct: number }
/** funnel ล็อกอินจริง: counts[0] = ทั้งหมด, counts[i] = หลังเงื่อนไข i (null = กำลังโหลด) */
export function liveSteps(brand: Brand, filterBrand: Brand | null, crits: ReadonlyArray<CampaignCriterion>, counts: ReadonlyArray<number | null>): LiveStep[] {
  const top = counts[0] || 1;
  return [`ลูกค้าทั้งหมด · ${filterBrand ? BRAND[brand] : 'ทุกแบรนด์'}`, ...crits.map((cr, i) => `เงื่อนไข ${i + 1} · ${CRIT[cr.type].label}`)].map((label, i) => {
    const n = counts[i] ?? null;
    return { label, n, pct: n === null ? 0 : Math.round((n / top) * 100) };
  });
}

/* ---------- ตัวเลือก SKU ---------- */
export const toggleItem = (items: ReadonlyArray<ProductItem>, it: ProductItem): ProductItem[] =>
  items.some((x) => x.sku === it.sku) ? items.filter((x) => x.sku !== it.sku) : [...items, it];
/** เลือกทั้งหมดของผลค้นหา (on) / เอาออกทั้งหมด (off) — SKU ที่เลือกไว้จากคำค้นอื่นคงอยู่ */
export function selectAllItems(items: ReadonlyArray<ProductItem>, results: ReadonlyArray<ProductItem>, on = true): ProductItem[] {
  if (!on) return items.filter((x) => !results.some((r) => r.sku === x.sku));
  return [...items, ...results.filter((r) => !items.some((x) => x.sku === r.sku))];
}
export function productSummary(cr: CampaignCriterion): string {
  if (cr.items?.length) return `เลือก ${cr.items.length.toLocaleString('th-TH')} SKU`;
  const k = (cr.kw || '').trim();
  return k ? `ทุก SKU ที่มีคำว่า "${k}"` : 'ยังไม่ได้เลือกสินค้า';
}

/** โหมด fixture: ค้น SKU จากประวัติซื้อของลูกค้าตัวอย่าง (แบบ dsales_product_search: ≥ 2 ตัว, ผู้ซื้อมากก่อน) */
export function demoProducts(customers: ReadonlyArray<Pick<DemoCustomer, 'phone' | 'purchases'>>, q: string): ProductRow[] {
  const k = q.trim().toLowerCase();
  if (k.length < 2) return [];
  const m = new Map<string, { name: string; phones: Set<string>; last: string }>();
  for (const c of customers) {
    for (const p of c.purchases) {
      if (!p.sku || !(p.sku + ' ' + p.product).toLowerCase().includes(k)) continue;
      const e = m.get(p.sku) ?? { name: p.product, phones: new Set<string>(), last: '' };
      e.phones.add(c.phone);
      if (p.date > e.last) e.last = p.date;
      m.set(p.sku, e);
    }
  }
  return [...m.entries()]
    .map(([sku, e]) => ({ sku, product_name: e.name, buyers: e.phones.size, last_bought: e.last || null }))
    .sort((a, b) => b.buyers - a.buyers || a.sku.localeCompare(b.sku));
}

const thb = (v: string | undefined): string => Number(v).toLocaleString('th-TH');
/** สรุปเงื่อนไขของแคมเปญเป็นบรรทัดเดียว (แผงลูกค้าตามเงื่อนไข) — ช่องว่างข้าม */
export function criteriaText(crits: ReadonlyArray<CampaignCriterion>): string {
  const parts = crits.flatMap((cr): string[] => {
    if (cr.type === 'product') return productSet(cr) ? [`เคยซื้อ: ${productSummary(cr)}`] : [];
    if (cr.type === 'total') {
      const lo = num(cr.min);
      const hi = num(cr.max);
      if (lo !== null && hi !== null) return [`ยอดซื้อรวม ${thb(cr.min)}–${thb(cr.max)} บาท`];
      if (lo !== null) return [`ยอดซื้อรวม ${thb(cr.min)} บาทขึ้นไป`];
      return hi !== null ? [`ยอดซื้อรวมไม่เกิน ${thb(cr.max)} บาท`] : [];
    }
    if (cr.type === 'dates') {
      if (cr.from && cr.to) return [`ซื้อ ${cr.from} ถึง ${cr.to}`];
      if (cr.from) return [`ซื้อตั้งแต่ ${cr.from}`];
      return cr.to ? [`ซื้อถึง ${cr.to}`] : [];
    }
    if (cr.type === 'order') return num(cr.min) !== null ? [`บิลละ ${thb(cr.min)} บาทขึ้นไป`] : [];
    if (cr.type === 'times') return num(cr.min) !== null ? [`ซื้อมากกว่า ${thb(cr.min)} ครั้ง`] : [];
    return [];
  });
  return parts.length ? parts.join(' · ') : 'ไม่มีเงื่อนไข (ลูกค้าทั้งหมดของแบรนด์)';
}

/** ปุ่มจองในแผงลูกค้าตามเงื่อนไข: แคมเปญปิด/สิ้นสุด = จองไม่ได้ · โหมดมอบหมาย = เฉพาะหัวหน้า */
export function audienceClaim(c: Pick<Campaign, 'active' | 'end' | 'claimMode'>, isAdmin: boolean, today: string): { can: boolean; note: string | null } {
  if (!campaignActive(c, today)) return { can: false, note: 'แคมเปญนี้ปิดหรือสิ้นสุดแล้ว — จองไม่ได้' };
  if (c.claimMode === 'assign' && !isAdmin) return { can: false, note: 'แคมเปญนี้หัวหน้าเป็นผู้มอบหมายลูกค้าให้เซลล์' };
  return { can: true, note: null };
}
