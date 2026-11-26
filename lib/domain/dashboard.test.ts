import { describe, expect, it } from 'vitest';
import { fixturePayload } from '@/lib/fixtures/load';
import type { Period } from '@/lib/state/reducer';
import {
  activityFeed, brandChips, byBrand, commissionTable, commissionTsv, dashStat, monthLabel, parseRate, pct, repBars, scopeLabel,
} from './dashboard';
import { mineOrAll } from './leads';

// ค่าคาดหวังคำนวณด้วยโค้ด renderDashboard ของ legacy/app.js (L301-366) ตรงตัวบนข้อมูลตัวอย่าง
const F = fixturePayload();
const NONE: Period = { from: '', to: '', key: 'all' };
const NOV: Period = { from: '2026-11-01', to: '2026-11-30', key: 'm0' };
const admin = { meId: 'r4', isAdmin: true };
const A = F.leads.filter((l) => mineOrAll(l, admin));
const r2 = { meId: 'r2', isAdmin: false };
const A2 = F.leads.filter((l) => mineOrAll(l, r2));

describe('dashboard stats (prototype stat() L304-310)', () => {
  it('KPI numbers for every brand, one brand, a period and a sales rep', () => {
    expect(dashStat(A, NONE, F.today)).toEqual({ n: 28, c: 16, w: 6, val: 13809, due: 2, wait: 4 });
    expect(dashStat(byBrand(A, 'hosttail'), NONE, F.today)).toEqual({ n: 9, c: 6, w: 2, val: 5249, due: 1, wait: 2 });
    expect(dashStat(byBrand(A, 'bebeplay'), NONE, F.today)).toEqual({ n: 19, c: 10, w: 4, val: 8560, due: 1, wait: 2 });
    expect(dashStat(A, NOV, F.today)).toEqual({ n: 28, c: 1, w: 0, val: 0, due: 2, wait: 4 });
    expect(dashStat(A2, NONE, F.today)).toEqual({ n: 9, c: 4, w: 1, val: 3290, due: 0, wait: 1 });
  });
  it('pct, scope label and brand chips', () => {
    expect([pct(16, 28), pct(6, 16), pct(1, 0)]).toEqual([57, 38, 0]);
    expect([scopeLabel('all'), scopeLabel('bebeplay'), scopeLabel('hosttail')]).toEqual(['ทุกแบรนด์', 'Bebeplay', 'Hosttail']);
    expect(brandChips(A, true).map((c) => [c.key, c.label, c.n, c.dot])).toEqual([
      ['all', 'ทุกแบรนด์', 28, null], ['bebeplay', 'Bebeplay', 19, 'var(--bebe)'], ['hosttail', 'Hosttail', 9, 'var(--host)'],
    ]);
    expect(brandChips(A2, true).map((c) => c.n)).toEqual([9, 6, 3]);
  });
  it('"ทุกแบรนด์" chip is for admins only (global brand: sales reps cannot pick all)', () => {
    expect(brandChips(A2, false).map((c) => [c.key, c.n])).toEqual([['bebeplay', 6], ['hosttail', 3]]);
  });
});

describe('rep bars and activity feed (L313-322)', () => {
  it('bar widths relative to the busiest rep (unrounded); sales see only their row', () => {
    expect(repBars(A, F.reps, admin, NONE).map((r) => [r.id, r.ownedWidth, r.wonWidth, `${r.c}/${r.owned} · ปิด ${r.w}`])).toEqual([
      ['r1', '33.33333333333333%', '11.11111111111111%', '2/3 · ปิด 1'],
      ['r2', '100%', '11.11111111111111%', '4/9 · ปิด 1'],
      ['r3', '44.44444444444444%', '11.11111111111111%', '4/4 · ปิด 1'],
      ['r4', '77.77777777777779%', '33.33333333333333%', '6/7 · ปิด 3'],
    ]);
    expect(repBars(byBrand(A, 'hosttail'), F.reps, admin, NONE).map((r) => [r.ownedWidth, r.wonWidth])).toEqual([
      ['33.33333333333333%', '33.33333333333333%'], ['100%', '0%'], ['100%', '33.33333333333333%'], ['66.66666666666666%', '0%'],
    ]);
    expect(repBars(A2, F.reps, r2, NONE).map((r) => r.id)).toEqual(['r2']);
  });
  it('feed = 8 newest interactions in the period', () => {
    const feed = activityFeed(A, F.reps, NONE);
    expect(feed).toHaveLength(8);
    expect(feed.slice(0, 3).map((i) => [i.lead, i.rep, i.date])).toEqual([
      ['จิราพร มั่นคง', 'อาทิตยา คชสร', '2026-11-01T13:20'],
      ['อนุชา สุขสวัสดิ์', 'กมลชนก ใจดี', '2026-10-31T12:20'],
      ['ณัฐวุฒิ วัฒนา', 'ปรีชา วงศ์ทอง', '2026-10-28T16:20'],
    ]);
    expect(activityFeed(A, F.reps, NOV).map((i) => i.lead)).toEqual(['จิราพร มั่นคง']);
    expect(activityFeed(byBrand(A, 'hosttail'), F.reps, NONE)).toHaveLength(6);
  });
});

describe('commission table (L328-341, L362-363)', () => {
  it('won amount per rep per closing month, bills, commission; reps without a win are left out', () => {
    const t = commissionTable(A, F.reps, NONE, 3);
    expect(t.months).toEqual(['2026-09', '2026-10']);
    expect(t.rows.map((r) => [r.name, r.byM, r.sum, r.bills, Math.round(r.comm)])).toEqual([
      ['อาทิตยา คชสร', [0, 259], 259, 1, 8],
      ['กมลชนก ใจดี', [0, 3290], 3290, 1, 99],
      ['ปรีชา วงศ์ทอง', [0, 4990], 4990, 1, 150],
      ['Dev MPD', [790, 4480], 5270, 3, 158],
    ]);
    expect([t.colSum, t.grand, t.bills]).toEqual([[790, 13019], 13809, 6]);
    expect(commissionTable(A, F.reps, NOV, 0).rows).toEqual([]);
    expect(commissionTable(byBrand(A, 'hosttail'), F.reps, NONE, 0).rows.map((r) => r.name)).toEqual(['อาทิตยา คชสร', 'ปรีชา วงศ์ทอง']);
  });
  it('month labels and the TSV copied to Excel (raw numbers, no total row; empty commission without a rate)', () => {
    expect([monthLabel('2026-10'), monthLabel('2026-01'), monthLabel('none')]).toEqual(['ต.ค. 2026', 'ม.ค. 2026', 'ไม่ระบุวันที่']);
    const tsv = commissionTsv(commissionTable(A, F.reps, NONE, 3)).split('\n');
    expect(tsv[0]).toBe('เซลล์\tก.ย. 2026\tต.ค. 2026\tยอดรวม\tจำนวนบิล\tค่าคอม');
    expect(tsv[4]).toBe('Dev MPD\t790\t4480\t5270\t3\t158');
    expect(tsv).toHaveLength(5);
    expect(commissionTsv(commissionTable(A2, F.reps, NONE, 0)).split('\n')[1]).toBe('กมลชนก ใจดี\t3290\t3290\t1\t');
    expect([parseRate('3.5'), parseRate(''), parseRate('x')]).toEqual([3.5, 0, 0]);
  });
});
