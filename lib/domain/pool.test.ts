import { describe, expect, it } from 'vitest';
import type { Lead, PoolRow } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import { EMPTY_FILTERS } from './baseFilters';
import type { Period } from '@/lib/state/reducer';
import {
  baseAction, canNext, clampPage, claimBrand, demoBase, demoGrand, demoPool, dormantText, keepTotal, pageRange, poolAction, poolCampNames,
  poolDetailFooter, takenBadge,
} from './pool';

// ค่าคาดหวังคำนวณด้วยโค้ด legacy/app.js ตรงตัว (poolLoad โหมดตัวอย่าง L636-640, poolAction L694-704)
const F = fixturePayload();
const NONE: Period = { from: '', to: '', key: 'all' };
const admin = { meId: 'r4', isAdmin: true };
const ctx = { live: false, isAdmin: true, meId: 'r4', leads: F.leads, reps: F.reps };
const pool = (over: Partial<Parameters<typeof demoPool>[2]> = {}) =>
  demoPool(F.customers, F.leads, { brand: 'bebeplay', q: '', page: 0, period: NONE, viewer: admin, ...over });
const row = (over: Partial<PoolRow>): PoolRow => ({
  id: 'i1', name: 'ก', phone: '0812345678', segment: '', ltv: 0, orders: 0, last: null, brands: ['bebeplay'], chat: '', leadId: null,
  mine: false, noCall: false, takenName: '', taken: null, dormantDays: null, ownerTag: null, chatRooms: [], chatBrands: [], ...over,
});
const lead = (over: Partial<Lead>): Lead => ({ ...F.leads[0], ...over });

describe('demo pool (fixture mode = prototype demo)', () => {
  it('brand total without no-call customers, 50 per page, sorted by spend', () => {
    expect(demoGrand(F.customers, F.leads, 'bebeplay')).toBe(59);
    expect(demoGrand(F.customers, F.leads, 'hosttail')).toBe(29);
    const p0 = pool();
    expect([p0.total, p0.rows.length, pool({ page: 1 }).rows.length]).toEqual([59, 50, 9]);
    expect(p0.rows.slice(0, 3).map((r) => [r.id, r.name, r.ltv])).toEqual([
      ['C5063', 'พิมพ์ชนก มั่นคง', 14850], ['C5087', 'ศิริพร เจริญผล', 11560], ['C5048', 'ธีรเดช บุญมา', 10650],
    ]);
  });
  it('searches name / chat name / phone digits / bill, and filters the period by the latest purchase', () => {
    expect(pool({ q: 'mom' }).rows.map((r) => r.id)).toEqual([
      'C5061', 'C5057', 'C5039', 'C5018', 'C5054', 'C5058', 'C5034', 'C5052', 'C5088', 'C5007', 'C5003', 'C5028', 'C5019', 'C5045', 'C5040', 'C5006',
    ]);
    expect(pool({ q: '086-435' }).rows.map((r) => r.id)).toEqual(['C5000']);
    expect(pool({ q: '895016' }).rows.map((r) => r.id)).toEqual(['C5000']);
    expect(pool({ period: { from: '2026-10-01', to: '2026-10-31', key: 'm1' } }).total).toBe(8);
  });
  it('row buttons: reserved by others / mine / free (admin Dev MPD)', () => {
    const taken = pool().rows.filter((r) => r.taken).map((r) => [r.id, poolAction(r, ctx)]);
    expect(taken).toEqual([
      ['C5018', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5010', { kind: 'disabled', text: 'จองโดย อาทิตยา คชสร' }],
      ['C5016', { kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1016' }],
      ['C5012', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5015', { kind: 'disabled', text: 'จองแล้ว' }],
      ['C5027', { kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1027' }],
      ['C5019', { kind: 'disabled', text: 'จองโดย กมลชนก ใจดี' }],
      ['C5025', { kind: 'disabled', text: 'จองโดย ปรีชา วงศ์ทอง' }],
    ]);
    expect(poolAction(pool().rows[0], ctx)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('a sales rep sees "จองแล้ว" for others and can unclaim own', () => {
    const r1 = { ...ctx, isAdmin: false, meId: 'r1' };
    const rows = pool({ viewer: { meId: 'r1', isAdmin: false } }).rows;
    expect(poolAction(rows.find((r) => r.id === 'C5010') as PoolRow, r1)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L1010' });
    expect(poolAction(rows.find((r) => r.id === 'C5018') as PoolRow, r1)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({ releasedByMe: true }), r1)).toEqual({ kind: 'disabled', text: 'คัดออกแล้ว' });
  });
  it('campaign names of a pool row (demo only)', () => {
    expect(poolCampNames({ phone: F.leads[1].phone }, F.leads, F.campaigns)).toEqual(['Bebeplay · ลูกค้าเก่า 6 เดือน']);
    expect(poolCampNames({ phone: '0000000000' }, F.leads, F.campaigns)).toEqual([]);
  });
});

describe('live pool rows (dsales_customer_pool_v4)', () => {
  const live = { ...ctx, live: true, leads: [lead({ id: 'L9', owner: 'r4', claimedBy: 'r4', status: 'following', noCall: false })] };
  it('poolAction: no-call, mine (unclaimable or not), taken (admin sees the name), free', () => {
    expect(poolAction(row({ noCall: true, taken: 'other' }), live)).toEqual({ kind: 'disabled', text: 'ไม่สะดวกให้โทร' });
    expect(poolAction(row({ mine: true, taken: 'r4', leadId: 'L9' }), live)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(poolAction(row({ mine: true, taken: 'r4', leadId: 'L404' }), live)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({ taken: 'other', takenName: 'กมลชนก' }), live)).toEqual({ kind: 'disabled', text: 'จองโดย กมลชนก' });
    expect(poolAction(row({ taken: 'other', takenName: 'กมลชนก' }), { ...live, isAdmin: false })).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(poolAction(row({}), live)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('popup E: taken badge and footer (L729, L740)', () => {
    expect(takenBadge(row({}), live)).toBeNull();
    expect(takenBadge(row({ taken: 'other' }), live)).toBe('จองแล้ว');
    expect(takenBadge(row({ taken: 'other', takenName: 'กมลชนก' }), live)).toBe('จองโดย กมลชนก');
    expect(takenBadge(row({ taken: 'other', takenName: 'กมลชนก' }), { ...live, isAdmin: false })).toBe('จองแล้ว');
    expect(takenBadge(row({ taken: 'r4', mine: true }), live)).toBe('จองโดย Dev MPD');
    expect(poolDetailFooter(row({}), live)).toEqual({ kind: 'claim', text: 'จอง' });
    expect(poolDetailFooter(row({ noCall: true }), live)).toBeNull();
    expect(poolDetailFooter(row({ taken: 'r4', mine: true, leadId: 'L9' }), live)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(poolDetailFooter(row({ taken: 'other' }), live)).toBeNull();
  });
  it('clampPage steps back one page when a trailing page comes back empty', () => {
    expect([clampPage(2, 0), clampPage(1, 0), clampPage(0, 0)]).toEqual([1, 0, 0]);
    expect([clampPage(1, 9), clampPage(0, 50)]).toEqual([1, 0]);
  });
  it('page range text and next button (L686-687)', () => {
    expect(pageRange(0, 50, 1234)).toBe('1–50 จาก 1,234');
    expect(pageRange(1, 9, 59)).toBe('51–59 จาก 59');
    expect(pageRange(0, 0, 0)).toBe('');
    expect(pageRange(0, 0, null)).toBe('');
    expect([canNext(0, 50, 59), canNext(1, 9, 59), canNext(0, 0, null)]).toEqual([true, false, false]);
  });
});

describe('/mine and /pool (dsales_base_customers, spec ข้อ 3)', () => {
  const mineCtx = { meId: 'r4', leads: [lead({ id: 'L9', owner: 'r4', claimedBy: 'r4', status: 'following', noCall: false }), lead({ id: 'L8', owner: 'r4', status: 'won' })] };
  it('claimBrand: the brand filter, or the first sellable brand of the customer', () => {
    expect(claimBrand('hosttail', ['bebeplay'])).toBe('hosttail');
    expect(claimBrand('all', ['other', 'hosttail', 'bebeplay'])).toBe('hosttail');
    expect(claimBrand('', ['other'])).toBeNull();
    expect(claimBrand(null, [])).toBeNull();
  });
  it('baseAction covers no-call, my lead, my tag customer without a lead, another rep, free', () => {
    expect(baseAction(row({ noCall: true, mine: true }), mineCtx)).toEqual({ kind: 'disabled', text: 'ไม่สะดวกให้โทร' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L9' }), mineCtx)).toEqual({ kind: 'unclaim', text: 'ยกเลิกจอง', leadId: 'L9' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L8' }), mineCtx)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L404' }), mineCtx)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: null, ownerTag: 'Admin_Dev' }), mineCtx)).toEqual({ kind: 'claim', text: 'เริ่มติดตาม' });
    // ลูกค้าตาม tag ของฉันที่เคยยกเลิกจอง: ลีดยังอยู่แต่ไม่มีเจ้าของ → ต้องเริ่มติดตามใหม่ได้ (dsales_claim_customer รับลีดเดิมคืน)
    const released = { ...mineCtx, leads: [...mineCtx.leads, lead({ id: 'L7', owner: null, claimedBy: null })] };
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L7', ownerTag: 'Admin_Dev' }), released)).toEqual({ kind: 'claim', text: 'เริ่มติดตาม' });
    expect(baseAction(row({ mine: true, taken: 'r4', leadId: 'L404', ownerTag: 'Admin_Dev' }), mineCtx)).toEqual({ kind: 'claim', text: 'เริ่มติดตาม' });
    expect(baseAction(row({ taken: 'other', takenName: 'กมลชนก' }), mineCtx)).toEqual({ kind: 'disabled', text: 'เป็นลูกค้าของ กมลชนก' });
    expect(baseAction(row({ taken: 'other', ownerTag: 'Admin_Ploy' }), mineCtx)).toEqual({ kind: 'disabled', text: 'เป็นลูกค้าของ Admin_Ploy' });
    expect(baseAction(row({ taken: 'other' }), mineCtx)).toEqual({ kind: 'disabled', text: 'จองแล้ว' });
    expect(baseAction(row({}), mineCtx)).toEqual({ kind: 'claim', text: 'จอง' });
  });
  it('dormant text and total from the first page', () => {
    expect([dormantText(null), dormantText(1234)]).toEqual(['—', 'ไม่ซื้อมา 1,234 วัน']);
    expect([keepTotal(120, 50, 0, null), keepTotal(0, 0, 3, 120), keepTotal(0, 0, 0, 120)]).toEqual([120, 120, 0]);
  });
  it('demoBase splits fixture customers into mine / pool', () => {
    const o = { brand: null, q: '', page: 0, today: F.today, meId: 'r4' };
    const mine = demoBase(F.customers, F.leads, 'mine', o);
    const free = demoBase(F.customers, F.leads, 'pool', o);
    expect(mine.rows.every((r) => r.mine && r.taken === 'r4')).toBe(true);
    expect(free.rows.every((r) => !r.taken)).toBe(true);
    expect(mine.total + free.total).toBeLessThanOrEqual(F.customers.length);
    expect(mine.total).toBeGreaterThan(0);
    expect(free.rows[0].dormantDays).toBeGreaterThan(0);
    expect(demoBase(F.customers, F.leads, 'pool', { ...o, brand: 'hosttail' }).rows.every((r) => r.brands[0] === 'hosttail')).toBe(true);
  });
  it('demoBase carries the fixture chat rooms, RFM and tags and honours the filters', () => {
    const o = { brand: null, q: '', page: 0, today: F.today, meId: 'r4' };
    const all = demoBase(F.customers, F.leads, 'pool', o);
    expect(all.rows.some((r) => r.chatRooms.length > 1)).toBe(true);
    expect(all.rows.every((r) => r.chatBrands.every((b) => r.chatRooms.some((x) => x.brand === b && x.sendable)))).toBe(true);
    const loyal = demoBase(F.customers, F.leads, 'pool', { ...o, filters: { ...EMPTY_FILTERS, rfm: ['Loyal'] } });
    expect(loyal.total).toBeGreaterThan(0);
    expect(loyal.total).toBeLessThan(all.total);
    expect(loyal.rows.every((r) => r.segment === 'Loyal')).toBe(true);
    const fb = demoBase(F.customers, F.leads, 'pool', { ...o, filters: { ...EMPTY_FILTERS, provider: 'facebook' } });
    expect(fb.rows.every((r) => r.chatRooms.some((x) => x.provider === 'facebook'))).toBe(true);
    const chat = demoBase(F.customers, F.leads, 'pool', { ...o, brand: 'hosttail', filters: { ...EMPTY_FILTERS, hasChat: true } });
    expect(chat.rows.every((r) => r.chatBrands.includes('hosttail'))).toBe(true);
    const old = demoBase(F.customers, F.leads, 'pool', { ...o, filters: { ...EMPTY_FILTERS, sort: 'dormant_desc' } });
    expect(old.rows[0].dormantDays).toBe(Math.max(...all.rows.map((r) => r.dormantDays ?? 0)));
  });
});
