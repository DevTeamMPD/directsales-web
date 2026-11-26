import { PATHS } from '@/lib/constants';
import type { BadgeCounts } from '@/lib/domain/badges';
import type { RouteKey } from '@/lib/routes';

export interface NavItem { key: RouteKey; href: string; label: string; icon: string; badge?: keyof BadgeCounts; id?: string }
export interface NavGroup { label: string; id?: string; adminOnly?: boolean; items: NavItem[] }

export const NAV: NavGroup[] = [
  { label: 'ข้อมูลลูกค้าเก่า', items: [{ key: 'leads', href: '/leads', label: 'Direct Sale', icon: PATHS.phone, badge: 'leads' }] },
  {
    label: 'ฐานลูกค้าเก่า',
    items: [
      { key: 'mine', href: '/mine', label: 'ลูกค้าของฉัน', icon: PATHS.person },
      { key: 'pool', href: '/pool', label: 'ถังกลาง', icon: PATHS.list },
      { key: 'rfm', href: '/rfm', label: 'กลุ่ม RFM', icon: PATHS.rfm },
      { key: 'outreach', href: '/outreach', label: 'ส่งข้อความ', icon: PATHS.send },
    ],
  },
  {
    label: 'แคมเปญ',
    items: [
      { key: 'campaign-bebeplay', href: '/campaigns/bebeplay', label: 'Bebeplay', icon: PATHS.megaphone, badge: 'bebeplay' },
      { key: 'campaign-hosttail', href: '/campaigns/hosttail', label: 'Hosttail', icon: PATHS.megaphone, badge: 'hosttail' },
    ],
  },
  { label: 'Overview', items: [{ key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: PATHS.grid }] },
  { label: 'Tool', id: 'nav-tool', adminOnly: true, items: [{ key: 'setup', href: '/setup', label: 'ตั้งค่า', icon: PATHS.gear, id: 'nav-setup' }] },
];
