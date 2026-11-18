import { describe, expect, it } from 'vitest';
import { DS_ICONS, iconSrc } from './icons';

describe('channel icons', () => {
  it('ports every legacy icon', () => {
    expect(Object.keys(DS_ICONS).sort()).toEqual(['facebook', 'instagram', 'lazada', 'line', 'other', 'shopee', 'tiktok', 'website']);
    expect(DS_ICONS.line).toMatch(/^data:image\/png;base64,/);
    expect(DS_ICONS.tiktok).toMatch(/^data:image\/svg\+xml/);
  });
  it('falls back to the "other" icon', () => {
    expect(iconSrc('shopee')).toBe(DS_ICONS.shopee);
    expect(iconSrc('myspace')).toBe(DS_ICONS.other);
  });
});
