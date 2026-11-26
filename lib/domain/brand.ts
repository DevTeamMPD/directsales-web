import type { Brand } from '@/lib/constants';

/** แบรนด์ใหญ่ที่เลือกใน topbar — 'all' ได้เฉพาะหัวหน้า */
export type BrandScope = Brand | 'all';
export const BRAND_STORAGE_KEY = 'dsales.brand';
const DEFAULT_BRAND: BrandScope = 'bebeplay';

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
const isScope = (v: unknown): v is BrandScope => v === 'bebeplay' || v === 'hosttail' || v === 'all';

/** ค่าที่จำไว้ในเครื่อง · ไม่มี/ผิด/อ่านไม่ได้ (โหมดส่วนตัว) = Bebeplay */
export function readStoredBrand(s: KV | undefined): BrandScope {
  try {
    const v = s?.getItem(BRAND_STORAGE_KEY);
    return isScope(v) ? v : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}
export function writeStoredBrand(s: KV | undefined, b: BrandScope): void {
  try {
    s?.setItem(BRAND_STORAGE_KEY, b);
  } catch {
    /* เขียนไม่ได้ (โหมดส่วนตัว/เต็ม) — ใช้ได้เฉพาะรอบนี้ */
  }
}
/** เซลล์เลือก "ทั้งหมด" ไม่ได้ */
export const effectiveBrand = (b: BrandScope, isAdmin: boolean): BrandScope => (b === 'all' && !isAdmin ? DEFAULT_BRAND : b);
export const inBrand = (scope: BrandScope, brand: Brand): boolean => scope === 'all' || scope === brand;
/** ค่าแบรนด์ของหน้าที่รับ '' = ทุกแบรนด์ (เช่น /mine /pool) */
export const pageBrand = (scope: BrandScope): '' | Brand => (scope === 'all' ? '' : scope);
/** เมนูแคมเปญแสดงเฉพาะแบรนด์ที่เลือก */
export function navVisible(key: string, scope: BrandScope): boolean {
  const m = /^campaign-(bebeplay|hosttail)$/.exec(key);
  return !m || inBrand(scope, m[1] as Brand);
}
