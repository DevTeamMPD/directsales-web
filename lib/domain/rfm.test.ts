import { describe, expect, it } from 'vitest';
import { RFM_SEGMENTS, rfmCountMap, rfmRule, rfmSegment } from './rfm';

describe('RFM segments (same rules as dsales.dsales_rfm)', () => {
  it('first matching rule wins, with the agreed boundaries', () => {
    const cases: Array<[number | null, number | null, string | null]> = [
      [6, 30, 'Champion'], [6, 31, 'Loyal'], [6, 90, 'Loyal'], [6, 91, "Shouldn't Lose"],
      [4, 90, 'Loyal'], [5, 91, 'Sleepers'], [3, 91, 'Sleepers'],
      [3, 60, 'Promising'], [2, 61, 'Need Attention'], [3, 90, 'Need Attention'],
      [2, 91, 'Lost'], [1, 91, 'Lost'], [1, 10, 'Warm'], [1, 60, 'Warm'], [1, 61, 'Cold'], [1, 90, 'Cold'],
      [null, 10, null], [0, 10, null], [3, null, null],
    ];
    for (const [o, d, want] of cases) expect([o, d, rfmSegment(o, d)]).toEqual([o, d, want]);
  });
  it('lists the nine segments in chip order with a Thai rule each', () => {
    expect(RFM_SEGMENTS.map((s) => s.key)).toEqual(['Champion', 'Loyal', 'Promising', 'Need Attention', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost']);
    expect(rfmRule('Warm')).toBe('ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 60 วัน');
    expect(rfmRule('อื่น')).toBe('');
  });
  it('rfmCountMap turns RPC rows / demo rows into counts', () => {
    expect(rfmCountMap([{ segment: 'Lost', n: 5 }, { segment: '', n: 2 }])).toEqual({ Lost: 5, '': 2 });
    expect(rfmCountMap([{ segment: 'Warm' }, { segment: 'Warm' }, { segment: null }].map((r) => ({ segment: r.segment ?? '', n: 1 })))).toEqual({ Warm: 2, '': 1 });
  });
});
