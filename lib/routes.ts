import type { Campaign } from '@/lib/api/types';
import { BRAND } from '@/lib/constants';

/** key เดียวกับ data-route ของ prototype */
export type RouteKey = 'leads' | 'mine' | 'pool' | 'campaign-bebeplay' | 'campaign-hosttail' | 'dashboard' | 'setup';

const PATH_KEYS: Record<string, RouteKey> = {
  '/leads': 'leads', '/mine': 'mine', '/pool': 'pool', '/campaigns/bebeplay': 'campaign-bebeplay',
  '/campaigns/hosttail': 'campaign-hosttail', '/dashboard': 'dashboard', '/setup': 'setup',
};

const TITLES: Record<Exclude<RouteKey, 'campaign-bebeplay' | 'campaign-hosttail'>, [string, string]> = {
  leads: ['Direct Sale', 'ลูกค้าเก่า Direct Sale Lead'],
  mine: ['ลูกค้าของฉัน', ''],
  pool: ['ถังกลาง', ''],
  dashboard: ['Dashboard', 'ภาพรวมทีม Direct Sale'],
  setup: ['ตั้งค่า', ''],
};

export function routeKey(pathname: string | null): RouteKey {
  const p = (pathname || '/').replace(/\/+$/, '');
  return PATH_KEYS[p] ?? 'leads';
}

export function routeMeta(pathname: string | null, campaigns: ReadonlyArray<Pick<Campaign, 'brand'>>): { key: RouteKey; title: string; sub: string } {
  const key = routeKey(pathname);
  if (key === 'campaign-bebeplay' || key === 'campaign-hosttail') {
    const brand = key === 'campaign-bebeplay' ? 'bebeplay' : 'hosttail';
    return { key, title: `แคมเปญ ${BRAND[brand]}`, sub: `${campaigns.filter((c) => c.brand === brand).length} แคมเปญ` };
  }
  const [title, sub] = TITLES[key];
  return { key, title, sub };
}
