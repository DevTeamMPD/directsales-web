import type { Lead } from '@/lib/api/types';
import { inBrand, type BrandScope } from '@/lib/domain/brand';

export interface BadgeCounts { leads: number; bebeplay: number; hosttail: number }

/** ตัวเลขบนเมนู (prototype updateBadges L151-160) นับจากลีดทั้งหมดใน state ไม่ผ่านตัวกรอง · badge Direct Sale นับเฉพาะแบรนด์ใหญ่ที่เลือก */
export function badgeCounts(
  leads: ReadonlyArray<Pick<Lead, 'owner' | 'status' | 'brand' | 'source'>>,
  meId: string,
  scope: BrandScope = 'all',
): BadgeCounts {
  const pool = (b: Lead['brand']) => leads.filter((l) => l.brand === b && l.source === 'campaign' && l.status === 'new' && !l.owner).length;
  return {
    leads: leads.filter((l) => l.owner === meId && (l.status === 'new' || l.status === 'callback') && inBrand(scope, l.brand)).length,
    bebeplay: pool('bebeplay'),
    hosttail: pool('hosttail'),
  };
}
