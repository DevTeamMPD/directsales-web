import { describe, expect, it } from 'vitest';
import type { ChatRoom, PoolRow } from '@/lib/api/types';
import {
  buildFilterJson, DORMANT_PRESETS, EMPTY_FILTERS, filtersFromQuery, filtersToQuery, hasFilters, LTV_PRESETS, matchesFilters, ORDERS_PRESETS,
  PROVIDER_OPTIONS, resultCountText, RFM_OPTIONS, roomNote, roomTitle, SORT_OPTIONS, sortBaseRows, tagOptions, toggleRfm, type BaseFilters,
} from './baseFilters';

const F = (over: Partial<BaseFilters> = {}): BaseFilters => ({ ...EMPTY_FILTERS, ...over });
const room = (over: Partial<ChatRoom> = {}): ChatRoom => ({ msId: 1, provider: 'line', page: 'bebeplayspace', brand: 'bebeplay', sendable: true, ...over });
const row = (over: Partial<PoolRow> = {}): PoolRow => ({
  id: 'i1', name: 'ก', phone: '0812345678', segment: '', ltv: 2000, orders: 2, last: '2026-08-01', brands: ['bebeplay'], chat: '', leadId: null,
  mine: false, noCall: false, takenName: '', taken: null, dormantDays: 95, ownerTag: null, chatRooms: [], chatBrands: [], ...over,
});

describe('labels and presets', () => {
  it('lists the Thai presets of the filter row', () => {
    expect(DORMANT_PRESETS.map((p) => [p.min, p.max])).toEqual([[30, 60], [61, 90], [91, 180], [181, 365], [366, null]]);
    expect(LTV_PRESETS.map((p) => p.label)).toEqual(['ยอดซื้อสะสม ≥ 1,000', 'ยอดซื้อสะสม ≥ 5,000', 'ยอดซื้อสะสม ≥ 10,000', 'ยอดซื้อสะสม ≥ 50,000']);
    expect(ORDERS_PRESETS.map((p) => p.min)).toEqual([2, 3, 5]);
    expect(PROVIDER_OPTIONS.map((p) => p.value)).toEqual(['line', 'shopee', 'lazada', 'facebook', 'instagram', 'tiktok']);
    expect(PROVIDER_OPTIONS[0].label).toBe('ช่องทาง LINE');
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual(['มูลค่าสูงสุด', 'หายนานสุด', 'เพิ่งหายไป', 'ซื้อล่าสุด', 'ซื้อบ่อยสุด']);
    expect(RFM_OPTIONS.at(-1)).toEqual({ value: '', label: 'ยังไม่จัดกลุ่ม' });
  });
});

describe('buildFilterJson', () => {
  it('is {} without filters and with the default sort', () => {
    expect(buildFilterJson(EMPTY_FILTERS)).toEqual({});
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
  });
  it('maps every UI field to the p_filters keys', () => {
    expect(buildFilterJson(F({
      rfm: ['Loyal', ''], dormant: '61-90', ltv: '5000', orders: '3', provider: 'shopee', tag: ' Admin_Pop ', hasChat: true, sort: 'dormant_desc',
    }))).toEqual({
      rfm: ['Loyal', ''], dormant_min: 61, dormant_max: 90, ltv_min: 5000, orders_min: 3, provider: 'shopee', tag: 'Admin_Pop', has_chat: true, sort: 'dormant_desc',
    });
  });
  it('sends only dormant_min for the open-ended preset and drops unknown keys', () => {
    expect(buildFilterJson(F({ dormant: '366-' }))).toEqual({ dormant_min: 366 });
    expect(buildFilterJson(F({ dormant: 'x', ltv: '7', orders: '9', provider: 'web' }))).toEqual({});
    expect(hasFilters(F({ sort: 'orders_desc' }))).toBe(true);
  });
  it('toggles an RFM chip', () => {
    expect(toggleRfm(F(), 'Loyal').rfm).toEqual(['Loyal']);
    expect(toggleRfm(F({ rfm: ['Loyal', ''] }), 'Loyal').rfm).toEqual(['']);
  });
});

describe('tagOptions / resultCountText', () => {
  it('dedupes tags case-insensitively, drops blanks and "none", sorts', () => {
    expect(tagOptions(['Admin_Pop', 'admin_pop', null, ' ', 'Admin_Ann', 'none'])).toEqual(['Admin_Ann', 'Admin_Pop']);
  });
  it('shows the number of matching customers', () => {
    expect(resultCountText(1234)).toBe('พบ 1,234 คน');
    expect(resultCountText(null)).toBe('');
  });
});

describe('URL round trip', () => {
  it('writes only non-default values and reads them back', () => {
    const f = F({ rfm: ['At Risk', ''], dormant: '30-60', provider: 'line', tag: 'none', hasChat: true, sort: 'last_desc' });
    const qs = filtersToQuery(f, 'hosttail');
    expect(qs).toBe('brand=hosttail&rfm=At+Risk&rfm=&dormant=30-60&provider=line&tag=none&chat=1&sort=last_desc');
    expect(filtersFromQuery('?' + qs)).toEqual({ brand: 'hosttail', filters: f });
    expect(filtersToQuery(EMPTY_FILTERS, '')).toBe('');
  });
  it('ignores unknown values', () => {
    expect(filtersFromQuery('?brand=x&rfm=Foo&dormant=1-2&ltv=7&sort=zzz&chat=yes')).toEqual({ brand: '', filters: EMPTY_FILTERS });
  });
});

describe('matchesFilters (fixture mode)', () => {
  it('filters by segment, dormant range, LTV and orders', () => {
    expect(matchesFilters(row(), F({ rfm: [''] }), null)).toBe(true);
    expect(matchesFilters(row({ segment: 'Loyal' }), F({ rfm: [''] }), null)).toBe(false);
    expect(matchesFilters(row(), F({ dormant: '91-180' }), null)).toBe(true);
    expect(matchesFilters(row(), F({ dormant: '30-60' }), null)).toBe(false);
    expect(matchesFilters(row({ dormantDays: null }), F({ dormant: '366-' }), null)).toBe(false);
    expect(matchesFilters(row(), F({ ltv: '5000' }), null)).toBe(false);
    expect(matchesFilters(row(), F({ orders: '2' }), null)).toBe(true);
  });
  it('filters by tag (case-insensitive, none = no tag)', () => {
    expect(matchesFilters(row({ ownerTag: 'Admin_Pop' }), F({ tag: 'admin_pop' }), null)).toBe(true);
    expect(matchesFilters(row({ ownerTag: 'Admin_Pop' }), F({ tag: 'none' }), null)).toBe(false);
    expect(matchesFilters(row(), F({ tag: 'none' }), null)).toBe(true);
  });
  it('has_chat uses the brand filter when given; provider needs a linked room', () => {
    const r = row({ chatBrands: ['hosttail'], chatRooms: [room({ provider: 'shopee', brand: 'hosttail' })] });
    expect(matchesFilters(r, F({ hasChat: true }), null)).toBe(true);
    expect(matchesFilters(r, F({ hasChat: true }), 'bebeplay')).toBe(false);
    expect(matchesFilters(r, F({ provider: 'shopee' }), null)).toBe(true);
    expect(matchesFilters(r, F({ provider: 'line' }), null)).toBe(false);
  });
});

describe('sortBaseRows', () => {
  const rows = [
    row({ id: 'a', ltv: 100, dormantDays: 40, last: '2026-09-25', orders: 1 }),
    row({ id: 'b', ltv: 900, dormantDays: 400, last: '2025-09-30', orders: 5 }),
    row({ id: 'c', ltv: 500, dormantDays: null, last: null, orders: null }),
  ];
  const ids = (s: Parameters<typeof sortBaseRows>[1]) => sortBaseRows(rows, s).map((r) => r.id);
  it('sorts by each option with missing values last', () => {
    expect(ids('ltv')).toEqual(['b', 'c', 'a']);
    expect(ids('dormant_desc')).toEqual(['b', 'a', 'c']);
    expect(ids('dormant_asc')).toEqual(['a', 'b', 'c']);
    expect(ids('last_desc')).toEqual(['a', 'b', 'c']);
    expect(ids('orders_desc')).toEqual(['b', 'a', 'c']);
  });
});

describe('room icons', () => {
  it('explains rooms the worker cannot send to', () => {
    expect(roomNote(room())).toBeNull();
    expect(roomNote(room({ provider: 'facebook', sendable: false }))).toBe('เกิน 24 ชม. ส่งผ่าน worker ไม่ได้');
    expect(roomNote(room({ brand: null, sendable: false }))).toBe('เพจนอกแบรนด์');
    expect(roomTitle(room())).toBe('LINE · bebeplayspace — เปิดแชตใน JST');
    expect(roomTitle(room({ provider: 'facebook', page: 'MPD Outlet', brand: null, sendable: false }))).toBe(
      'Facebook · MPD Outlet — เพจนอกแบรนด์ (กดเพื่อเปิดแชตใน JST)',
    );
  });
});
