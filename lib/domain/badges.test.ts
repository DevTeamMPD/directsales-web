import { describe, expect, it } from 'vitest';
import type { Brand, LeadSource, LeadStatus } from '@/lib/api/types';
import { badgeCounts } from './badges';

const L = (owner: string | null, status: LeadStatus, brand: Brand = 'bebeplay', source: LeadSource = 'campaign') => ({ owner, status, brand, source });

describe('badgeCounts (prototype updateBadges)', () => {
  it('counts my open leads (new + callback) for Direct Sale', () => {
    expect(badgeCounts([L('me', 'new'), L('me', 'callback'), L('me', 'won'), L('other', 'new'), L(null, 'new')], 'me').leads).toBe(2);
  });
  it('counts unowned new campaign leads per brand', () => {
    const leads = [L(null, 'new', 'bebeplay'), L(null, 'new', 'hosttail'), L(null, 'new', 'hosttail'), L(null, 'following', 'hosttail'),
      L('me', 'new', 'hosttail'), L(null, 'new', 'bebeplay', 'self')];
    expect(badgeCounts(leads, 'me')).toEqual({ leads: 1, bebeplay: 1, hosttail: 2 });
  });
});
