import { describe, expect, it } from 'vitest';
import type { Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import type { Period } from '@/lib/state/reducer';
import {
  bills, canUnclaim, canUnclaimAny, chipLabel, CHIP_DOT, claimBlock, contactedIn, dueInfo, filtered, isDnc, lastSeller, mineOrAll,
  periodOk, releasedByMe, statusCounts, STATUS_CHIPS, total, visible, wonIn, type LeadFilter,
} from './leads';

const F = fixturePayload();
const L = F.leads;
const byId = (id: string): Lead => {
  const l = L.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};
const ids = (a: Lead[]) => a.map((l) => l.id);
const NONE: Period = { from: '', to: '', key: 'all' };
const NOV: Period = { from: '2026-11-01', to: '2026-11-30', key: 'm0' };
const OCT: Period = { from: '2026-10-01', to: '2026-10-31', key: 'm1' };
const admin = { meId: 'r4', isAdmin: true };
const sales = (meId: string) => ({ meId, isAdmin: false });
const base = L.filter((l) => mineOrAll(l, admin));
const f = (over: Partial<LeadFilter> = {}): LeadFilter => ({ q: '', status: 'all', rep: 'all', camp: 'all', sort: 'due', period: NONE, today: F.today, ...over });
const lead = (over: Partial<Lead>): Lead => ({ ...byId('L1000'), ...over });

describe('lead helpers (prototype L31, L80, L122)', () => {
  it('total / bills / lastSeller from fixture purchases and live summary fields', () => {
    expect([bills(byId('L1000')), total(byId('L1000')), lastSeller(byId('L1000'), F.reps)]).toEqual([['895016'], 790, 'r3']);
    expect([bills(byId('L1005')), total(byId('L1005')), lastSeller(byId('L1005'), F.reps)])
      .toEqual([['394039', '502585', '749306', '993023'], 6029, 'r1']);
    // live: dsales_lead_json ส่ง total/bills มาแล้วและ purchases = []
    expect(total(lead({ total: 2490, purchases: [] }))).toBe(2490);
    expect(bills(lead({ bills: [], purchases: byId('L1005').purchases }))).toEqual([]);
    expect(lastSeller(lead({ purchases: [] }), F.reps)).toBeNull();
  });
  it('isDnc matches any no-call lead with the same phone', () => {
    expect(isDnc(L, '0644338237')).toBe(true);
    expect(isDnc(L, '0864355692')).toBe(false);
  });
});

describe('visibility (prototype L35-38)', () => {
  it('visible / mineOrAll per viewer', () => {
    expect(L.filter((l) => visible(l, admin))).toHaveLength(26);
    expect(base).toHaveLength(28);
    expect(L.filter((l) => visible(l, sales('r1')))).toHaveLength(7);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r1'))))).toEqual(['L1010', 'L1013', 'L1020']);
    expect(L.filter((l) => visible(l, sales('r2')))).toHaveLength(13);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r2'))))).toEqual(['L1000', 'L1005', 'L1006', 'L1008', 'L1011', 'L1012', 'L1018', 'L1019', 'L1024']);
    expect(L.filter((l) => visible(l, sales('r3')))).toHaveLength(9);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r3'))))).toEqual(['L1017', 'L1023', 'L1025', 'L1026']);
  });
  it('releasedByMe hides a released lead from that sales rep only', () => {
    const rel = lead({ owner: null, releasedBy: ['r1'] });
    expect(releasedByMe(rel, sales('r1'))).toBe(true);
    expect(visible(rel, sales('r1'))).toBe(false);
    expect(visible(rel, sales('r2'))).toBe(true);
    expect(releasedByMe(rel, { meId: 'r1', isAdmin: true })).toBe(false);
    expect(visible(byId('L1004'), admin)).toBe(true);
  });
});

describe('period filters (prototype L43-45)', () => {
  it('periodOk / contactedIn / wonIn over all fixture leads', () => {
    const count = (p: Period) => [
      L.filter((l) => periodOk(l, p)).length, L.filter((l) => contactedIn(l, p)).length, L.filter((l) => wonIn(l, p)).length,
    ];
    expect(count(NONE)).toEqual([28, 16, 6]);
    expect(count(NOV)).toEqual([10, 1, 0]);
    expect(count(OCT)).toEqual([16, 11, 5]);
  });
});

describe('filtered / sortLeads / statusCounts (prototype L165-185, L219-225)', () => {
  it('default admin view: due ascending, no callback last, otherwise original order', () => {
    expect(ids(filtered(base, f()))).toEqual([
      'L1014', 'L1025', 'L1023', 'L1019', 'L1000', 'L1001', 'L1002', 'L1003', 'L1004', 'L1005', 'L1006', 'L1007', 'L1008', 'L1009',
      'L1010', 'L1011', 'L1012', 'L1013', 'L1015', 'L1016', 'L1017', 'L1018', 'L1020', 'L1021', 'L1022', 'L1024', 'L1026', 'L1027',
    ]);
    expect(ids(filtered(base, f({ period: NOV })))).toEqual(['L1014', 'L1025', 'L1023', 'L1019', 'L1001', 'L1003', 'L1004', 'L1007', 'L1009', 'L1013']);
    expect(ids(filtered(L.filter((l) => mineOrAll(l, sales('r2'))), f())))
      .toEqual(['L1019', 'L1000', 'L1005', 'L1006', 'L1008', 'L1011', 'L1012', 'L1018', 'L1024']);
  });
  it('status chip counts (period-aware)', () => {
    expect(statusCounts(base, NONE, F.today)).toEqual({ all: 28, overdue: 2, today: 1, new: 12, following: 3, callback: 4, won: 6, unreachable: 3, lost: 0, nocall: 2 });
    expect(statusCounts(base, NOV, F.today)).toEqual({ all: 10, overdue: 2, today: 1, new: 5, following: 1, callback: 4, won: 0, unreachable: 0, lost: 0, nocall: 1 });
    expect(statusCounts(L.filter((l) => mineOrAll(l, sales('r3'))), NONE, F.today))
      .toEqual({ all: 4, overdue: 1, today: 1, new: 0, following: 0, callback: 2, won: 1, unreachable: 1, lost: 0, nocall: 0 });
  });
  it('status chip / rep / campaign filters', () => {
    expect(ids(filtered(base, f({ status: 'overdue' })))).toEqual(['L1014', 'L1025']);
    expect(ids(filtered(base, f({ status: 'today' })))).toEqual(['L1023']);
    expect(ids(filtered(base, f({ status: 'nocall' })))).toEqual(['L1011', 'L1013']);
    expect(ids(filtered(base, f({ status: 'won' })))).toEqual(['L1012', 'L1015', 'L1020', 'L1021', 'L1022', 'L1026']);
    expect(ids(filtered(base, f({ rep: 'r1' })))).toEqual(['L1010', 'L1013', 'L1020']);
    expect(ids(filtered(base, f({ camp: 'self' })))).toEqual(['L1025', 'L1000', 'L1005', 'L1010', 'L1015', 'L1020']);
    expect(ids(filtered(base, f({ camp: 'c-host-nov' })))).toEqual(['L1014', 'L1023', 'L1002', 'L1008', 'L1011', 'L1017', 'L1026']);
  });
  it('search: name, phone (dashes ignored), bill, shop — trimmed and case-insensitive', () => {
    expect(ids(filtered(base, f({ q: 'ใจดี' })))).toEqual(['L1019', 'L1009']);
    expect(ids(filtered(base, f({ q: '089' })))).toEqual(['L1001', 'L1009', 'L1022']);
    expect(ids(filtered(base, f({ q: '086-435' })))).toEqual(['L1000']);
    expect(ids(filtered(base, f({ q: '895016' })))).toEqual(['L1000']);
    expect(ids(filtered(base, f({ q: '  ธนากร ' })))).toEqual(['L1000', 'L1020']);
    expect(ids(filtered(base, f({ q: 'LOA_' })))).toEqual(['L1025', 'L1000', 'L1005', 'L1010', 'L1015', 'L1020']);
  });
  it('sort: spend = total descending, none = original order', () => {
    const spend = filtered(base, f({ sort: 'spend' })).slice(0, 5);
    expect(ids(spend)).toEqual(['L1026', 'L1008', 'L1011', 'L1020', 'L1009']);
    expect(spend.map(total)).toEqual([15360, 10888, 10757, 10629, 9750]);
    expect(ids(filtered(base, f({ sort: 'none' }))).slice(0, 5)).toEqual(['L1000', 'L1001', 'L1002', 'L1003', 'L1004']);
  });
  it('chips: order, labels and dot colours', () => {
    expect(STATUS_CHIPS.map(chipLabel)).toEqual([
      'ทั้งหมด', 'เลยนัด', 'นัดวันนี้', 'ยังไม่ติดต่อ', 'กำลังติดตาม', 'รอติดต่อ', 'ปิดการขายแล้ว', 'ติดต่อไม่ได้', 'ไม่สนใจ', 'ไม่สะดวกให้โทร',
    ]);
    expect([CHIP_DOT.overdue, CHIP_DOT.today, CHIP_DOT.unreachable, CHIP_DOT.nocall]).toEqual(['var(--bad)', 'var(--warn)', 'var(--violet)', 'var(--bad)']);
  });
});

describe('row rules (prototype L89-90, L186-191, L884-887)', () => {
  it('canUnclaim needs claimedBy = me; canUnclaimAny only needs owner = me', () => {
    const mine = lead({ owner: 'r1', claimedBy: 'r1', status: 'following', noCall: false });
    expect(canUnclaim(mine, 'r1')).toBe(true);
    const assigned: Lead = { ...mine, claimedBy: null }; // หัวหน้ามอบหมายให้ (ไม่ได้จองเอง)
    expect(canUnclaim(assigned, 'r1')).toBe(false);
    expect(canUnclaimAny(assigned, 'r1')).toBe(true);
    expect(canUnclaimAny({ ...mine, status: 'won' }, 'r1')).toBe(false);
    expect(canUnclaimAny({ ...mine, noCall: true }, 'r1')).toBe(false);
    expect(canUnclaim(mine, 'r2')).toBe(false);
    expect(L.filter((l) => canUnclaim(l, 'r4'))).toHaveLength(0);
  });
  it('dueInfo labels', () => {
    expect(dueInfo('2026-11-03', F.today)).toEqual({ cls: 'overdue', text: 'เลยนัด 3/11/2026' });
    expect(dueInfo('2026-11-04', F.today)).toEqual({ cls: 'today', text: 'นัดวันนี้ 4/11/2026' });
    expect(dueInfo('2026-11-06', F.today)).toEqual({ cls: '', text: 'นัดติดต่อ 6/11/2026' });
    expect(dueInfo(null, F.today)).toBeNull();
  });
  it('claimBlock: taken lead, maxPerRep per campaign, otherwise allowed', () => {
    const camp = { ...F.campaigns[0], maxPerRep: 1 }; // c-bebe-nov: r4 ดูแลอยู่ 3 ลีด (L1016, L1022, L1027)
    expect(claimBlock(byId('L1006'), camp, L, 'r4')).toBe('ลีดนี้มีคนจองไปแล้ว');
    expect(claimBlock(byId('L1001'), camp, L, 'r4')).toBe('จองได้สูงสุด 1 ลีดต่อคนในแคมเปญนี้');
    expect(claimBlock(byId('L1001'), { ...camp, maxPerRep: 4 }, L, 'r4')).toBeNull();
    expect(claimBlock(byId('L1001'), { ...camp, maxPerRep: null }, L, 'r4')).toBeNull();
    expect(claimBlock(byId('L1001'), undefined, L, 'r4')).toBeNull();
  });
});
