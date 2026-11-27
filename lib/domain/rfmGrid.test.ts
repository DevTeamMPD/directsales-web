import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG } from './rfm';
import { rfmGrid } from './rfmGrid';

const rect = (key: string, row: number, col: number, rowSpan = 1, colSpan = 1, primary = true) => ({ key, row, col, rowSpan, colSpan, primary });

describe('rfmGrid (map of the /rfm page)', () => {
  it('default rules: F bands top-down from the most frequent, R bands left-to-right from the longest gone', () => {
    const g = rfmGrid(DEFAULT_RFM_CONFIG);
    expect(g.fBands.map((b) => b.label)).toEqual(['6+ ครั้ง', '4–5 ครั้ง', '3 ครั้ง', '2 ครั้ง', '1 ครั้ง']);
    expect(g.fBands.map((b) => b.short)).toEqual(['6+', '4–5', '3', '2', '1']);
    expect(g.rBands.map((b) => b.label)).toEqual(['เกิน 90 วัน', '61–90 วัน', '31–60 วัน', '0–30 วัน']);
    expect(g.rBands.map((b) => b.short)).toEqual(['เกิน 90', '61–90', '31–60', '0–30']);
    expect(g.rBands[0]).toMatchObject({ min: 91, max: null });
  });
  it('default rules: the layout of the approved mockup, one primary rectangle per segment', () => {
    expect(rfmGrid(DEFAULT_RFM_CONFIG).rects).toEqual([
      rect("Shouldn't Lose", 0, 0), rect('Loyal', 0, 1, 2, 2), rect('Champion', 0, 3),
      rect('Sleepers', 1, 0, 2, 1), rect('Loyal', 1, 3, 1, 1, false),
      rect('Need Attention', 2, 1, 2, 1), rect('Promising', 2, 2, 2, 2),
      rect('Lost', 3, 0, 2, 1),
      rect('Cold', 4, 1), rect('Warm', 4, 2), rect('Hot', 4, 3),
    ]);
  });
  it('moving a boundary adds a band and moves the rectangles', () => {
    const cfg = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s.key === 'Warm' ? { ...s, rMin: 21 } : s));
    const g = rfmGrid(cfg);
    expect(g.rBands.map((b) => b.short)).toEqual(['เกิน 90', '61–90', '31–60', '21–30', '0–20']);
    expect(g.rects.find((x) => x.key === 'Hot')).toEqual(rect('Hot', 4, 4));
    expect(g.rects.find((x) => x.key === 'Warm')).toEqual(rect('Warm', 4, 2, 1, 2));
  });
  it('a segment whose rule is shadowed by earlier rules has no rectangle; every cell belongs to exactly one rectangle', () => {
    const cfg = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Cold' ? { ...s, rMin: 31, rMax: 60 } : s));
    const g = rfmGrid(cfg);
    expect(g.rects.some((x) => x.key === 'Cold')).toBe(false);
    const area = g.rects.reduce((n, x) => n + x.rowSpan * x.colSpan, 0);
    expect(area).toBe(g.fBands.length * g.rBands.length);
  });
  it('without a fallback segment the uncovered cells have no rectangle', () => {
    const g = rfmGrid(DEFAULT_RFM_CONFIG.filter((s) => !s.fallback));
    expect(g.rects.some((x) => x.key === 'Lost')).toBe(false);
    expect(g.rects.reduce((n, x) => n + x.rowSpan * x.colSpan, 0)).toBe(g.fBands.length * g.rBands.length - 2);
  });
});
