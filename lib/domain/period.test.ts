import { describe, expect, it } from 'vitest';
import {
  customPeriod, hasPeriod, inPeriod, monthPeriod, monthValue, periodNote, presetPeriod, presetRange, PRESETS, yearOptions, yearPeriod, yearValue,
} from './period';

const T = '2026-11-04';

describe('period (prototype presetRange L47-56, bindPeriod L67-78, periodHtml L57-66)', () => {
  it('presetRange uses UTC date maths on the today string', () => {
    expect(presetRange('today', T)).toEqual(['2026-11-04', '2026-11-04']);
    expect(presetRange('7d', T)).toEqual(['2026-10-29', '2026-11-04']);
    expect(presetRange('m0', T)).toEqual(['2026-11-01', '2026-11-30']);
    expect(presetRange('m1', T)).toEqual(['2026-10-01', '2026-10-31']);
    expect(presetRange('y0', T)).toEqual(['2026-01-01', '2026-12-31']);
    expect(presetRange('all', T)).toEqual(['', '']);
  });
  it('crosses month and year boundaries', () => {
    expect(presetRange('m1', '2026-01-15')).toEqual(['2025-12-01', '2025-12-31']);
    expect(presetRange('7d', '2026-03-03')).toEqual(['2026-02-25', '2026-03-03']);
    expect(presetPeriod('m0', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29', key: 'm0' });
  });
  it('month input → first..last day; cleared → all', () => {
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28', key: 'month' });
    expect(monthPeriod('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29', key: 'month' });
    expect(monthPeriod('')).toEqual({ from: '', to: '', key: 'all' });
  });
  it('year select and custom dates', () => {
    expect(yearPeriod('2025')).toEqual({ from: '2025-01-01', to: '2025-12-31', key: 'year' });
    expect(yearPeriod('')).toBeNull();
    expect(customPeriod('2026-11-01', '')).toEqual({ from: '2026-11-01', to: '', key: 'custom' });
    expect(customPeriod('', '')).toEqual({ from: '', to: '', key: 'all' });
  });
  it('card footer text', () => {
    expect(periodNote({ from: '', to: '', key: 'all' })).toBe('ยังไม่ได้กรองช่วงวันที่');
    expect(periodNote({ from: '2026-11-01', to: '', key: 'custom' }))
      .toBe('กรอง 1/11/2026 – … · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)');
    expect(periodNote({ from: '2026-10-01', to: '2026-10-31', key: 'm1' }))
      .toBe('กรอง 1/10/2026 – 31/10/2026 · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)');
  });
  it('chips, year options and the values shown in the inputs', () => {
    expect(PRESETS.map(([, t]) => t)).toEqual(['ทั้งหมด', 'วันนี้', '7 วันล่าสุด', 'เดือนนี้', 'เดือนก่อน', 'ปีนี้']);
    expect(yearOptions(T)).toEqual([2026, 2025, 2024]);
    expect(monthValue({ from: '2026-02-01', to: '2026-02-28', key: 'month' })).toBe('2026-02');
    expect(monthValue({ from: '2026-02-01', to: '2026-02-28', key: 'custom' })).toBe('');
    expect(yearValue({ from: '2025-01-01', to: '2025-12-31', key: 'year' })).toBe('2025');
    expect(yearValue({ from: '', to: '', key: 'all' })).toBe('');
  });
  it('hasPeriod / inPeriod compare the YYYY-MM-DD prefix', () => {
    const nov = { from: '2026-11-01', to: '2026-11-30' };
    expect(hasPeriod({ from: '', to: '' })).toBe(false);
    expect(hasPeriod({ from: '', to: '2026-11-30' })).toBe(true);
    expect(inPeriod('2026-11-30T23:59', nov)).toBe(true);
    expect(inPeriod('2026-10-31T10:00', nov)).toBe(false);
    expect(inPeriod(null, nov)).toBe(false);
    expect(inPeriod('2020-01-01', { from: '', to: '2026-11-30' })).toBe(true);
  });
});
