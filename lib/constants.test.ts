import { describe, expect, it } from 'vitest';
import { CRIT, JST_HELPER_URL, MODES, PAGE, STATUS, TH_MONTHS } from './constants';

describe('constants copied from the prototype', () => {
  it('keeps labels and order', () => {
    expect(Object.keys(STATUS)).toEqual(['new', 'following', 'callback', 'won', 'lost', 'unreachable']);
    expect(STATUS.won).toBe('ปิดการขายแล้ว');
    expect(MODES.auto).toBe('เด้งเข้าเซลล์ที่ขายล่าสุด');
    expect(PAGE).toBe(50);
    expect(TH_MONTHS).toHaveLength(12);
    expect(TH_MONTHS[10]).toBe('พ.ย.');
    expect(Object.keys(CRIT)).toEqual(['product', 'total', 'dates', 'order', 'times']);
    expect(CRIT.times.fields).toEqual([['number', 'min', 'มากกว่ากี่ครั้ง']]);
  });
  it('defaults the JST helper to the local port', () => {
    expect(JST_HELPER_URL).toBe('http://127.0.0.1:47321');
  });
});
