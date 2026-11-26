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

  it('carries the demo customers of the pool and the campaign builder (prototype state.customers)', () => {
    const p = fixturePayload();
    expect(p.customers).toHaveLength(90);
    expect(p.customers.filter((c) => c.brand === 'bebeplay')).toHaveLength(60);
    expect(p.customers[0]).toMatchObject({ id: 'C5000', name: 'ธนากร รุ่งเรือง', phone: '0864355692', brand: 'bebeplay' });
  });

  it('adds chat rooms, RFM segments and owner tags for /mine /pool (deterministic)', () => {
    const c = fixturePayload().customers;
    expect(c[0].chatRooms).toEqual([{ msId: 800000, provider: 'line', page: 'LOA_bebeplay', brand: 'bebeplay', sendable: true }]);
    // ลูกค้าคนที่ 2 มีห้อง LINE ของอีกแบรนด์ด้วย
    expect(c[1].chatRooms?.map((r) => r.page)).toEqual(['LOA_hosttail', 'SH_bebeplay']);
    expect(c.some((x) => x.chatRooms?.some((r) => r.brand === null && !r.sendable))).toBe(true);
    expect(c.some((x) => x.chatRooms?.some((r) => r.provider === 'facebook' && r.brand && !r.sendable))).toBe(true);
    expect(c.filter((x) => x.rfm).length).toBe(30);
    expect(new Set(c.map((x) => x.ownerTag).filter(Boolean)).size).toBe(5);
    expect(fixturePayload().customers).toEqual(c);
  });

  it('carries sample outreach templates, batches and worker status', () => {
    const o = fixturePayload().outreachDemo;
    expect(o?.templates.filter((t) => t.active).map((t) => t.brand)).toEqual(['bebeplay', 'hosttail']);
    expect(o?.batches.map((b) => b.id)).toEqual(['ob-demo-1', 'ob-demo-2']);
    expect(Object.keys(o?.details ?? {})).toEqual(['ob-demo-1', 'ob-demo-2']);
    expect(o?.worker.settings).toMatchObject({ test_mode: true, max_batch: 50 });
  });

  it('?claim=<leadId> claims that lead as Dev MPD (popup ยกเลิกจอง ใน e2e)', () => {
    expect(fixturePayload().leads.filter((l) => l.claimedBy)).toEqual([]);
    const l = fixturePayload('?claim=L1002').leads.find((x) => x.id === 'L1002');
    expect(l).toMatchObject({ owner: 'r4', claimedBy: 'r4', claimedAt: '2026-11-04T10:00' });
  });

  it('carries the built-in RFM rules', () => {
    expect(fixturePayload().rfmConfig.map((s) => s.key)).toHaveLength(10);
  });
});
