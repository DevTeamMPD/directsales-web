import type { Lead } from '@/lib/api/types';

export interface BadgeCounts { leads: number; bebeplay: number; hosttail: number }

/** ตัวเลขบนเมนู (prototype updateBadges L151-160) นับจากลีดทั้งหมดใน state ไม่ผ่านตัวกรอง */
export function badgeCounts(leads: ReadonlyArray<Pick<Lead, 'owner' | 'status' | 'brand' | 'source'>>, meId: string): BadgeCounts {
  const pool = (b: Lead['brand']) => leads.filter((l) => l.brand === b && l.source === 'campaign' && l.status === 'new' && !l.owner).length;
  return {
    leads: leads.filter((l) => l.owner === meId && (l.status === 'new' || l.status === 'callback')).length,
    bebeplay: pool('bebeplay'),
    hosttail: pool('hosttail'),
  };
}
