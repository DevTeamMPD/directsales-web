import { describe, expect, it } from 'vitest';
import { normalizeSearchPhone } from './phone';

describe('normalizeSearchPhone (same rules as dsales.dsales_norm_phone)', () => {
  it('converts +66 / 66 / 660 forms to 0xxxxxxxxx', () => {
    expect(normalizeSearchPhone('+66 81 234 5678')).toBe('0812345678');
    expect(normalizeSearchPhone('66812345678')).toBe('0812345678');
    expect(normalizeSearchPhone('660812345678')).toBe('0812345678');
  });
  it('strips dashes, spaces and brackets and adds the missing 0 to 9-digit mobiles', () => {
    expect(normalizeSearchPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeSearchPhone('812345678')).toBe('0812345678');
    expect(normalizeSearchPhone('(02) 123 4567')).toBe('021234567');
  });
  it('keeps partial numbers as digits', () => {
    expect(normalizeSearchPhone(' 0812 ')).toBe('0812');
  });
  it('leaves names and chat names untouched (trimmed)', () => {
    expect(normalizeSearchPhone('  สุภาพร ใจดี ')).toBe('สุภาพร ใจดี');
    expect(normalizeSearchPhone('baby_love101')).toBe('baby_love101');
    expect(normalizeSearchPhone('')).toBe('');
  });
});
