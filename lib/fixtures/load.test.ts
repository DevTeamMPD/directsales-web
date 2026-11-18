import { describe, expect, it } from 'vitest';
import { fixturePayload } from './load';

describe('fixturePayload', () => {
  it('starts as the prototype demo user (Dev MPD, admin) on 2026-11-04', () => {
    const p = fixturePayload();
    expect(p).toMatchObject({ meId: 'r4', isAdmin: true, today: '2026-11-04' });
    expect(p.reps.find((r) => r.id === 'r4')?.name).toBe('Dev MPD');
    expect(p.leads).toHaveLength(28);
    expect(p.campaigns.map((c) => c.id)).toEqual(['c-bebe-nov', 'c-host-nov', 'c-bebe-oct']);
    expect(p.campaigns.every((c) => c.active && c.maxPerRep === null && c.criteria.length === 0)).toBe(true);
  });

  it('?claim=<leadId> claims that lead as Dev MPD (popup ยกเลิกจอง ใน e2e)', () => {
    expect(fixturePayload().leads.filter((l) => l.claimedBy)).toEqual([]);
    const l = fixturePayload('?claim=L1002').leads.find((x) => x.id === 'L1002');
    expect(l).toMatchObject({ owner: 'r4', claimedBy: 'r4', claimedAt: '2026-11-04T10:00' });
  });
});
