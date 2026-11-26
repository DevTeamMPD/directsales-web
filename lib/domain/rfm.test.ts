import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG, RFM_SEGMENTS, rfmCountMap, rfmRule, rfmRuleText, rfmSegment, rfmSlug, type RfmSeg } from './rfm';

describe('RFM segments (same rules as the seed of dsales.dsales_rfm_segments)', () => {
  it('first matching rule wins, with the agreed boundaries', () => {
    const cases: Array<[number | null, number | null, string | null]> = [
      [6, 30, 'Champion'], [6, 31, 'Loyal'], [6, 90, 'Loyal'], [6, 91, "Shouldn't Lose"],
      [4, 30, 'Loyal'], [4, 90, 'Loyal'], [5, 91, 'Sleepers'], [3, 91, 'Sleepers'],
      [3, 60, 'Promising'], [2, 61, 'Need Attention'], [3, 90, 'Need Attention'],
      [2, 91, 'Lost'], [1, 91, 'Lost'], [1, 0, 'Hot'], [1, 30, 'Hot'], [1, 31, 'Warm'], [1, 60, 'Warm'], [1, 61, 'Cold'], [1, 90, 'Cold'],
      [null, 10, null], [0, 10, null], [3, null, null],
    ];
    for (const [o, d, want] of cases) expect([o, d, rfmSegment(o, d)]).toEqual([o, d, want]);
  });
  it('uses the config it is given', () => {
    const cfg: RfmSeg[] = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s.key === 'Warm' ? { ...s, rMin: 21 } : s));
    expect([rfmSegment(1, 20, cfg), rfmSegment(1, 21, cfg), rfmSegment(1, 25)]).toEqual(['Hot', 'Warm', 'Hot']);
    expect(rfmSegment(1, 10, cfg.filter((s) => !s.fallback && s.key !== 'Hot'))).toBeNull();
  });
  it('default config: 10 segments in rule order, Lost is the fallback, every segment has its action context', () => {
    expect(DEFAULT_RFM_CONFIG.map((s) => s.key)).toEqual(['Champion', "Shouldn't Lose", 'Loyal', 'Sleepers', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', 'Lost']);
    expect(DEFAULT_RFM_CONFIG.map((s) => s.sort)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(DEFAULT_RFM_CONFIG.filter((s) => s.fallback).map((s) => s.key)).toEqual(['Lost']);
    expect(DEFAULT_RFM_CONFIG.every((s) => s.tone && s.behavior && s.action)).toBe(true);
  });
  it('lists the ten segments in chip order', () => {
    expect(RFM_SEGMENTS.map((s) => s.key)).toEqual(['Champion', 'Loyal', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost']);
    expect(RFM_SEGMENTS.every((s) => s.label === s.key)).toBe(true);
  });
  it('writes the rule of a segment in Thai from its numbers', () => {
    expect(rfmRule('Champion')).toBe('ซื้อ 6 ครั้งขึ้นไป · ซื้อล่าสุดไม่เกิน 30 วัน');
    expect(rfmRule("Shouldn't Lose")).toBe('ซื้อ 6 ครั้งขึ้นไป · หายไปเกิน 90 วัน');
    expect(rfmRule('Sleepers')).toBe('ซื้อ 3–5 ครั้ง · หายไปเกิน 90 วัน');
    expect(rfmRule('Need Attention')).toBe('ซื้อ 2–3 ครั้ง · ซื้อล่าสุด 61–90 วัน');
    expect(rfmRule('Hot')).toBe('ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 30 วัน');
    expect(rfmRule('Warm')).toBe('ซื้อครั้งเดียว · ซื้อล่าสุด 31–60 วัน');
    expect(rfmRule('Lost')).toBe('ลูกค้าที่เหลือทั้งหมดที่ไม่เข้ากลุ่มอื่น');
    expect(rfmRule('อื่น')).toBe('');
    expect(rfmRuleText({ ...DEFAULT_RFM_CONFIG[4], fMin: 2, fMax: 2, rMin: 10, rMax: 20 })).toBe('ซื้อ 2 ครั้ง · ซื้อล่าสุด 10–20 วัน');
    expect(rfmRule('Hot', DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s)))).toBe('ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 20 วัน');
  });
  it('rfmSlug gives the CSS name of a segment', () => {
    expect(DEFAULT_RFM_CONFIG.map((s) => rfmSlug(s.key))).toEqual(['champion', 'shouldn-t-lose', 'loyal', 'sleepers', 'promising', 'need-attention', 'hot', 'warm', 'cold', 'lost']);
  });
  it('rfmCountMap turns RPC rows / demo rows into counts', () => {
    expect(rfmCountMap([{ segment: 'Warm' }, { segment: 'Warm' }, { segment: null }].map((r) => ({ segment: r.segment ?? '', n: 1 })))).toEqual({ Warm: 2, '': 1 });
    expect(rfmCountMap([{ segment: 'Lost', n: '12' }])).toEqual({ Lost: 12 });
  });
});
