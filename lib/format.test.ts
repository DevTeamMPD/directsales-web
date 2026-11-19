import { describe, expect, it } from 'vitest';
import { baht, fmtDate, fmtDT, localStamp, nowStamp, todayBangkok } from './format';

describe('baht', () => {
  it('formats numbers like the prototype (th-TH + ".-")', () => {
    expect(baht(1234.5)).toBe('1,234.5.-');
    expect(baht(1234567)).toBe('1,234,567.-');
    expect(baht('2490')).toBe('2,490.-');
  });
  it('treats empty values as 0', () => {
    expect(baht(0)).toBe('0.-');
    expect(baht(null)).toBe('0.-');
    expect(baht(undefined)).toBe('0.-');
  });
});

describe('fmtDate / fmtDT', () => {
  it('fmtDate drops leading zeros and keeps the Gregorian year', () => {
    expect(fmtDate('2026-11-04')).toBe('4/11/2026');
    expect(fmtDate('2026-01-09T10:20')).toBe('9/1/2026');
  });
  it('fmtDate shows a dash for empty values', () => {
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(null)).toBe('—');
  });
  it('fmtDT adds HH:MM only when the string has a time', () => {
    expect(fmtDT('2026-11-04T09:05')).toBe('4/11/2026 09:05');
    expect(fmtDT('2026-11-04')).toBe('4/11/2026');
    expect(fmtDT(null)).toBe('—');
  });
});

describe('Asia/Bangkok time', () => {
  it('todayBangkok switches date at Bangkok midnight', () => {
    expect(todayBangkok(new Date('2026-11-03T16:59:00Z'))).toBe('2026-11-03');
    expect(todayBangkok(new Date('2026-11-03T17:00:00Z'))).toBe('2026-11-04');
  });
  it('nowStamp is today + Bangkok HH:MM', () => {
    expect(nowStamp(new Date('2026-11-04T02:05:00Z'))).toBe('2026-11-04T09:05');
    expect(nowStamp(new Date('2026-11-04T02:05:00Z'), '2026-11-01')).toBe('2026-11-01T09:05');
  });
  it('localStamp converts server timestamps to Bangkok YYYY-MM-DDTHH:MM', () => {
    expect(localStamp('2026-11-04T02:05:00+00:00')).toBe('2026-11-04T09:05');
    expect(localStamp('2026-11-04T17:00:00.123456+00:00')).toBe('2026-11-05T00:00');
    expect(localStamp(null)).toBeNull();
    expect(localStamp('')).toBe('');
    expect(localStamp('not a date')).toBe('not a date');
  });
});
