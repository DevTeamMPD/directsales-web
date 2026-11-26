import { describe, expect, it } from 'vitest';
import type { Campaign } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import {
  audienceBrand, campaignBadge, campaignBase, campStats, criteriaFilters, emptyCampaignsText, funnel, inCampLine, initialCampaignForm,
  leadsInCampaigns, liveSteps, matchOne, modeOf, namePlaceholder, newCampaignRow, nextTab, normalizeSelCamp, productSummary, quota,
  audienceClaim, criteriaText, demoProducts, selectAllItems, stepFilters, toggleItem,
} from './campaigns';

// ค่าคาดหวังคำนวณด้วยโค้ด legacy/app.js ตรงตัวบนข้อมูลตัวอย่างเดียวกัน (Dev MPD หัวหน้า, วันนี้ 2026-11-04)
const F = fixturePayload();
const admin = { meId: 'r4', isAdmin: true };
const bebe = F.campaigns.filter((c) => c.brand === 'bebeplay');
const camp = (over: Partial<Campaign>): Campaign => ({ ...F.campaigns[0], ...over });

describe('campaign page (prototype renderCampaign L259-298)', () => {
  it('normalizeSelCamp keeps ALL/CAMPS or a campaign of this brand, else ALL (L261)', () => {
    expect(normalizeSelCamp(null, F.campaigns, 'bebeplay')).toBe('ALL');
    expect(normalizeSelCamp('CAMPS', F.campaigns, 'hosttail')).toBe('CAMPS');
    expect(normalizeSelCamp('c-bebe-nov', F.campaigns, 'bebeplay')).toBe('c-bebe-nov');
    expect(normalizeSelCamp('c-bebe-nov', F.campaigns, 'hosttail')).toBe('ALL');
    expect(normalizeSelCamp('gone', F.campaigns, 'bebeplay')).toBe('ALL');
  });
  it('campaignBadge: running / closed / ended (L278-281)', () => {
    expect(campaignBadge(camp({ end: '2026-11-30' }), F.today)).toEqual({ cls: 's-won', text: 'กำลังดำเนินการ' });
    expect(campaignBadge(camp({ end: '' }), F.today)).toEqual({ cls: 's-won', text: 'กำลังดำเนินการ' });
    expect(campaignBadge(camp({ end: '2026-10-20' }), F.today)).toEqual({ cls: 's-new', text: 'จบแล้ว' });
    expect(campaignBadge(camp({ active: false }), F.today)).toEqual({ cls: 's-new', text: 'ปิดอยู่' });
  });
  it('card stats count visible leads: contacted = not new, bar % rounded (L275-285)', () => {
    const card = (id: string, v = admin) => campStats(leadsInCampaigns(F.leads, new Set([id]), v));
    expect(card('c-bebe-nov')).toEqual({ n: 12, done: 6, won: 2, pct: 50 });
    expect(card('c-bebe-oct')).toEqual({ n: 2, done: 1, won: 1, pct: 50 });
    expect(card('c-host-nov')).toEqual({ n: 6, done: 4, won: 1, pct: 67 });
    // เซลล์ r1 เห็นเฉพาะลีดว่าง + ของตัวเอง
    expect(card('c-bebe-nov', { meId: 'r1', isAdmin: false })).toEqual({ n: 4, done: 0, won: 0, pct: 0 });
    expect(campStats([])).toEqual({ n: 0, done: 0, won: 0, pct: 0 });
  });
  it('"ลูกค้าทุกแคมเปญ" and the campaign table base (L272, L654-656)', () => {
    expect(campStats(campaignBase(F.leads, 'CAMPS', bebe, admin))).toEqual({ n: 14, done: 7, won: 3, pct: 50 });
    expect(campaignBase(F.leads, 'c-bebe-nov', bebe, admin)).toHaveLength(12);
  });
  it('quota line (L290)', () => {
    const base = campaignBase(F.leads, 'c-bebe-nov', bebe, admin);
    expect(quota(base, 'r4', 'c-bebe-nov', F.campaigns)).toEqual({ n: 12, mine: 3, free: 4, mode: 'เซลล์จองเอง' });
    expect(quota(base, 'r4', 'CAMPS', F.campaigns).mode).toBe('ตามที่ตั้งไว้ในแต่ละแคมเปญ');
    expect(modeOf('c-bebe-oct', F.campaigns)).toBe('assign');
    expect(modeOf('c-host-nov', F.campaigns)).toBe('auto');
    expect(modeOf('ALL', F.campaigns)).toBe('self');
  });
  it('demo pool card line and empty text (L286, L648-653)', () => {
    expect(inCampLine(F.customers, F.leads, F.campaigns, 'bebeplay')).toBe('เข้าแคมเปญแล้ว 14 · ยังไม่เข้า 45');
    expect(inCampLine(F.customers, F.leads, F.campaigns, 'hosttail')).toBe('เข้าแคมเปญแล้ว 6 · ยังไม่เข้า 23');
    expect(emptyCampaignsText(true)).toBe('ยังไม่มีแคมเปญ — กด "+ สร้างแคมเปญ" ด้านบน');
    expect(emptyCampaignsText(false)).toBe('ยังไม่มีแคมเปญ');
  });
});

describe('campaign builder (prototype campaignForm L782-871)', () => {
  it('starts on the base tab with self mode; tabs advance base → set → aud', () => {
    expect(initialCampaignForm('hosttail')).toEqual({
      tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand: 'hosttail', mode: 'self', max: '', crits: [], prev: false,
    });
    expect([nextTab('base'), nextTab('set')]).toEqual(['set', 'aud']);
    expect([namePlaceholder('bebeplay'), namePlaceholder('hosttail')]).toEqual(['เช่น Bebeplay Q4 2026', 'เช่น Hosttail Q4 2026']);
  });
  it('matchOne: empty fields pass; times is strictly more than (L771-779)', () => {
    const c = { purchases: [{ date: '2026-03-01', bill: '1', sku: 'BBP-BED-01', product: 'เตียงนอนเด็ก', amount: 4990, seller: null }] };
    expect(matchOne(c, { type: 'product', kw: 'bbp-bed' })).toBe(true);
    expect(matchOne(c, { type: 'product', kw: '  ' })).toBe(true);
    expect(matchOne(c, { type: 'total', min: '5000' })).toBe(false);
    expect(matchOne(c, { type: 'total', min: '', max: '4990' })).toBe(true);
    expect(matchOne(c, { type: 'dates', from: '2026-03-02' })).toBe(false);
    expect(matchOne(c, { type: 'order', min: '4990' })).toBe(true);
    expect(matchOne(c, { type: 'times', min: '1' })).toBe(false);
    expect(matchOne(c, { type: 'times', min: '0' })).toBe(true);
  });
  it('funnel narrows step by step from all brand customers without no-call (L785-793)', () => {
    const bed = funnel(F.customers, F.leads, 'bebeplay', [{ type: 'product', kw: 'เตียง' }]);
    expect(bed.steps).toEqual([
      { label: 'ลูกค้าทั้งหมด · Bebeplay', n: 59, pct: 100 },
      { label: 'เงื่อนไข 1 · เคยซื้อสินค้า (ชื่อ / SKU)', n: 26, pct: 44 },
    ]);
    expect(bed.result.slice(0, 3).map((c) => c.name)).toEqual(['พิมพ์ชนก มั่นคง', 'สมศักดิ์ พงษ์ไทย', 'ชลธิชา ใจดี']);
    expect(funnel(F.customers, F.leads, 'bebeplay', [{ type: 'total', min: '3000' }, { type: 'times', min: '1' }]).steps.map((s) => s.n)).toEqual([59, 40, 37]);
    expect(funnel(F.customers, F.leads, 'hosttail', [{ type: 'dates', from: '2026-01-01', to: '' }, { type: 'order', min: '1000' }]).steps.map((s) => s.n))
      .toEqual([29, 25, 18]);
  });
  it('live mode has no customers in state → every step is 0 (prototype quirk kept)', () => {
    expect(funnel([], F.leads, 'bebeplay', [{ type: 'product', kw: 'x' }]).steps).toEqual([
      { label: 'ลูกค้าทั้งหมด · Bebeplay', n: 0, pct: 0 },
      { label: 'เงื่อนไข 1 · เคยซื้อสินค้า (ชื่อ / SKU)', n: 0, pct: 0 },
    ]);
  });
  it('newCampaignRow builds the dsales_campaigns insert (L852)', () => {
    const f = { ...initialCampaignForm('bebeplay'), name: '  Bebeplay Q4  ', desc: ' ', max: '20', mode: 'assign' as const, crits: [{ type: 'product' as const, kw: 'เตียง' }] };
    expect(newCampaignRow(f)).toEqual({
      brand: 'bebeplay', name: 'Bebeplay Q4', description: null, start_date: null, end_date: null, claim_mode: 'assign', max_per_rep: 20,
      active: true, criteria: [{ type: 'product', kw: 'เตียง' }],
    });
    expect(newCampaignRow({ ...f, desc: 'โปร', start: '2026-12-01', end: '2026-12-31', max: '', active: false }))
      .toMatchObject({ description: 'โปร', start_date: '2026-12-01', end_date: '2026-12-31', max_per_rep: null, active: false });
  });
});

describe('campaign segments (live: dsales_base_customers filters)', () => {
  const bed = { sku: 'BBP-BED-01', name: 'เตียงนอนเด็ก' };
  const pen = { sku: 'BBP-PEN-02', name: 'คอกกั้น' };
  it('matchOne product: ticked SKUs win over the keyword', () => {
    const c = { purchases: [{ date: '2026-03-01', bill: '1', sku: 'BBP-BED-01', product: 'เตียงนอนเด็ก', amount: 4990, seller: null }] };
    expect(matchOne(c, { type: 'product', items: [pen] })).toBe(false);
    expect(matchOne(c, { type: 'product', items: [pen, bed], kw: 'zzz' })).toBe(true);
    expect(matchOne(c, { type: 'product', items: [], kw: 'เตียง' })).toBe(true);
  });
  it('criteriaFilters maps every criterion type (stricter value wins when repeated)', () => {
    expect(criteriaFilters([])).toEqual({});
    expect(criteriaFilters([
      { type: 'product', items: [bed, pen], kw: 'เตียง' }, { type: 'product', kw: ' คอก ' }, { type: 'product', kw: '' },
      { type: 'total', min: '1000', max: '50000' }, { type: 'total', min: '3000', max: '' },
      { type: 'dates', from: '2026-01-01', to: '2026-06-30' }, { type: 'order', min: '2000' }, { type: 'times', min: '1' },
    ])).toEqual({
      products: [{ skus: ['BBP-BED-01', 'BBP-PEN-02'] }, { kw: 'คอก' }],
      ltv_min: 3000, ltv_to: 50000, bought_from: '2026-01-01', bought_to: '2026-06-30', bill_min: 2000, orders_min: 2,
    });
    expect(criteriaFilters([{ type: 'total', min: 'abc' }, { type: 'times', min: '' }])).toEqual({});
  });
  it('stepFilters is cumulative; product criteria drop the brand filter', () => {
    const crits = [{ type: 'total' as const, min: '1000' }, { type: 'product' as const, items: [bed] }];
    expect(stepFilters(crits)).toEqual([{ ltv_min: 1000 }, { ltv_min: 1000, products: [{ skus: ['BBP-BED-01'] }] }]);
    expect(audienceBrand('bebeplay', crits)).toBeNull();
    expect(audienceBrand('bebeplay', [{ type: 'total', min: '1000' }, { type: 'product', kw: ' ' }])).toBe('bebeplay');
  });
  it('liveSteps labels + percentages from server counts (null = loading)', () => {
    expect(liveSteps('bebeplay', null, [{ type: 'product', items: [bed] }], [7276, 120])).toEqual([
      { label: 'ลูกค้าทั้งหมด · ทุกแบรนด์', n: 7276, pct: 100 },
      { label: 'เงื่อนไข 1 · เคยซื้อสินค้า (ชื่อ / SKU)', n: 120, pct: 2 },
    ]);
    expect(liveSteps('hosttail', 'hosttail', [], [null])).toEqual([{ label: 'ลูกค้าทั้งหมด · Hosttail', n: null, pct: 0 }]);
  });
  it('SKU picker helpers: toggle, select all (union, no duplicates), summary', () => {
    expect(toggleItem([], bed)).toEqual([bed]);
    expect(toggleItem([bed, pen], bed)).toEqual([pen]);
    expect(selectAllItems([bed], [bed, pen])).toEqual([bed, pen]);
    expect(selectAllItems([bed, pen], [bed, pen], false)).toEqual([]);
    expect(selectAllItems([bed, pen], [pen], false)).toEqual([bed]);
    expect(productSummary({ type: 'product', items: [bed, pen] })).toBe('เลือก 2 SKU');
    expect(productSummary({ type: 'product', kw: 'เตียง' })).toBe('ทุก SKU ที่มีคำว่า "เตียง"');
    expect(productSummary({ type: 'product' })).toBe('ยังไม่ได้เลือกสินค้า');
  });
  it('demoProducts: SKU search over demo purchases, most buyers first, < 2 chars = none', () => {
    const cs = [
      { phone: '1', purchases: [{ date: '2026-01-01', bill: 'a', sku: 'BBP-BED-01', product: 'เตียงนอนเด็ก', amount: 1, seller: null }] },
      { phone: '2', purchases: [{ date: '2026-02-01', bill: 'b', sku: 'BBP-BED-01', product: 'เตียงนอนเด็ก', amount: 1, seller: null },
        { date: '2026-03-01', bill: 'c', sku: 'BBP-BED-02', product: 'เตียงพับ', amount: 1, seller: null }] },
    ];
    expect(demoProducts(cs, 'เตียง')).toEqual([
      { sku: 'BBP-BED-01', product_name: 'เตียงนอนเด็ก', buyers: 2, last_bought: '2026-02-01' },
      { sku: 'BBP-BED-02', product_name: 'เตียงพับ', buyers: 1, last_bought: '2026-03-01' },
    ]);
    expect(demoProducts(cs, 'ต')).toEqual([]);
  });
  it('criteriaText summarises the campaign conditions for the audience panel', () => {
    expect(criteriaText([])).toBe('ไม่มีเงื่อนไข (ลูกค้าทั้งหมดของแบรนด์)');
    expect(criteriaText([
      { type: 'product', items: [bed, pen] }, { type: 'total', min: '1000', max: '' }, { type: 'dates', from: '2026-01-01', to: '' },
      { type: 'order', min: '2000' }, { type: 'times', min: '1' }, { type: 'total', min: '', max: '' },
    ])).toBe('เคยซื้อ: เลือก 2 SKU · ยอดซื้อรวม 1,000 บาทขึ้นไป · ซื้อตั้งแต่ 2026-01-01 · บิลละ 2,000 บาทขึ้นไป · ซื้อมากกว่า 1 ครั้ง');
    expect(criteriaText([{ type: 'total', min: '1000', max: '5000' }, { type: 'dates', from: '', to: '2026-06-30' }]))
      .toBe('ยอดซื้อรวม 1,000–5,000 บาท · ซื้อถึง 2026-06-30');
  });
  it('audienceClaim: closed campaign or assign mode (sales) cannot claim', () => {
    const c = (over: Partial<Campaign>) => camp({ active: true, end: undefined, claimMode: 'self', ...over });
    expect(audienceClaim(c({}), false, '2026-11-25')).toEqual({ can: true, note: null });
    expect(audienceClaim(c({ active: false }), true, '2026-11-25')).toEqual({ can: false, note: 'แคมเปญนี้ปิดหรือสิ้นสุดแล้ว — จองไม่ได้' });
    expect(audienceClaim(c({ end: '2026-11-24' }), true, '2026-11-25').can).toBe(false);
    expect(audienceClaim(c({ claimMode: 'assign' }), false, '2026-11-25')).toEqual({ can: false, note: 'แคมเปญนี้หัวหน้าเป็นผู้มอบหมายลูกค้าให้เซลล์' });
    expect(audienceClaim(c({ claimMode: 'assign' }), true, '2026-11-25').can).toBe(true);
  });
});
