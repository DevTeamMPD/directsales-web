import { describe, expect, it } from 'vitest';
import { BRAND_STORAGE_KEY, effectiveBrand, inBrand, navVisible, pageBrand, readStoredBrand, writeStoredBrand } from './brand';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('global brand', () => {
  it('reads the stored brand; unknown/missing/broken storage = bebeplay', () => {
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'hosttail' }))).toBe('hosttail');
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'all' }))).toBe('all');
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'x' }))).toBe('bebeplay');
    expect(readStoredBrand(mem())).toBe('bebeplay');
    expect(readStoredBrand(undefined)).toBe('bebeplay');
    expect(readStoredBrand({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toBe('bebeplay');
  });
  it('writes the brand and ignores storage errors', () => {
    const s = mem();
    writeStoredBrand(s, 'hosttail');
    expect(s.m.get(BRAND_STORAGE_KEY)).toBe('hosttail');
    expect(() => writeStoredBrand({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 'all')).not.toThrow();
  });
  it('only admins keep "all"', () => {
    expect(effectiveBrand('all', true)).toBe('all');
    expect(effectiveBrand('all', false)).toBe('bebeplay');
    expect(effectiveBrand('hosttail', false)).toBe('hosttail');
  });
  it('matches rows, page brand and campaign menu items', () => {
    expect(inBrand('all', 'hosttail')).toBe(true);
    expect(inBrand('bebeplay', 'hosttail')).toBe(false);
    expect(inBrand('bebeplay', 'bebeplay')).toBe(true);
    expect(pageBrand('all')).toBe('');
    expect(pageBrand('hosttail')).toBe('hosttail');
    expect(navVisible('campaign-hosttail', 'bebeplay')).toBe(false);
    expect(navVisible('campaign-hosttail', 'hosttail')).toBe(true);
    expect(navVisible('campaign-bebeplay', 'all')).toBe(true);
    expect(navVisible('leads', 'hosttail')).toBe(true);
  });
});
