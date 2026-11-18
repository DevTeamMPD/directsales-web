import { describe, expect, it } from 'vitest';
import { buildReps, mapCampaign, mapChannel, mapLead, mapPoolRow, mapPurchase, rowsTotal, upsertLead } from './map';
import { leadJson } from './test-helpers';
import type { CampaignRow, MeRow, PoolRowJson, TeamRow } from './types';

describe('mapLead', () => {
  it('fills prototype defaults and starts with no purchases', () => {
    const l = mapLead(leadJson({ address: null, shop: null, chatName: null, channels: null, interest: null, closedBills: null, releasedBy: null, bills: null, interactions: null }));
    expect(l).toMatchObject({ address: '', shop: '', chatName: '', channels: [], interest: '', closedBills: [], releasedBy: [], bills: [], purchases: [], interactions: [] });
  });
  it('converts claimedAt and interaction dates to Bangkok stamps and keeps the raw claim time', () => {
    const l = mapLead(leadJson());
    expect(l.claimedAt).toBe('2026-11-04T09:05');
    expect(l.claimedAtIso).toBe('2026-11-04T02:05:00.123456+00:00');
    expect(l.interactions[0]).toMatchObject({ date: '2026-11-04T10:00', note: '', result: '' });
  });
});

describe('upsertLead', () => {
  it('adds a new lead at the top', () => {
    const next = upsertLead([mapLead(leadJson({ id: 'L0' }))], leadJson({ id: 'L1' }));
    expect(next.map((l) => l.id)).toEqual(['L1', 'L0']);
  });
  it('replaces an existing lead but keeps purchases, _pl and chatCheck', () => {
    const old = {
      ...mapLead(leadJson()),
      purchases: [{ date: '2026-10-01', bill: '310001', sku: 'BBP-BED-03', product: 'เตียงนอนไม้', amount: 3290, seller: null }],
      _pl: 'done' as const,
      chatCheck: { at: '2026-11-04T09:10', sent: true, count: 2 },
    };
    const [l] = upsertLead([old], leadJson({ status: 'won' }));
    expect(l.status).toBe('won');
    expect(l.purchases).toBe(old.purchases);
    expect(l._pl).toBe('done');
    expect(l.chatCheck).toEqual({ at: '2026-11-04T09:10', sent: true, count: 2 });
  });
  it('does not mutate the input array', () => {
    const list = [mapLead(leadJson())];
    const copy = [...list];
    upsertLead(list, leadJson({ status: 'lost' }));
    expect(list).toEqual(copy);
    expect(list[0].status).toBe('following');
  });
});

describe('mapCampaign', () => {
  const row: CampaignRow = {
    id: 'c1', brand: 'hosttail', name: 'Hosttail Q4', description: 'โปรห้องน้ำแมว', start_date: '2026-11-01', end_date: '2026-11-30',
    claim_mode: 'auto', max_per_rep: 20, active: true, criteria: [{ type: 'times', min: '2' }], created_at: '2026-11-01T00:00:00+00:00',
  };
  it('maps columns and turns auto into self (live behaviour of the prototype)', () => {
    expect(mapCampaign(row)).toEqual({
      id: 'c1', brand: 'hosttail', name: 'Hosttail Q4', note: 'โปรห้องน้ำแมว', start: '2026-11-01', end: '2026-11-30',
      claimMode: 'self', maxPerRep: 20, active: true, criteria: [{ type: 'times', min: '2' }],
    });
  });
  it('fills empty optional columns', () => {
    expect(mapCampaign({ ...row, description: null, start_date: null, end_date: null, claim_mode: 'assign', max_per_rep: null, active: null, criteria: null }))
      .toMatchObject({ note: '', start: '', end: '', claimMode: 'assign', maxPerRep: null, active: true, criteria: [] });
  });
});

describe('mapPoolRow', () => {
  const pr = (over: Partial<PoolRowJson> = {}): PoolRowJson => ({
    identity_id: 'id-1', name: 'สุภาพร', phone: '0812345678', chat_name: null, segment: 'Loyal', rfm_segment: null, ltv: '12345.50',
    order_count: 3, last_order_date: '2026-09-01', brands: ['bebeplay'], total_count: '120', lead_id: null, taken: false, mine: false,
    no_call: false, reserved_by: null, ...over,
  });
  it('maps taken to me / other / null like the prototype', () => {
    expect(mapPoolRow(pr({ taken: true, mine: true }), 'u1').taken).toBe('u1');
    expect(mapPoolRow(pr({ taken: true, mine: false, reserved_by: 'กมลชนก' }), 'u1')).toMatchObject({ taken: 'other', takenName: 'กมลชนก' });
    expect(mapPoolRow(pr(), 'u1').taken).toBeNull();
  });
  it('normalizes numbers, segment and missing values', () => {
    expect(mapPoolRow(pr({ rfm_segment: 'Champions', dormant_days: 45, owner_tag: 'Admin_Ploy' }), 'u1')).toMatchObject({
      id: 'id-1', segment: 'Champions', ltv: 12345.5, orders: 3, chat: '', brands: ['bebeplay'], noCall: false, dormantDays: 45, ownerTag: 'Admin_Ploy',
    });
    expect(mapPoolRow(pr({ identity_id: null, segment: null, ltv: null, order_count: null, brands: null }), 'u1')).toMatchObject({
      id: '0812345678', segment: '', ltv: 0, orders: 0, brands: [], dormantDays: null, ownerTag: null,
    });
  });
  it('rowsTotal reads total_count from the first row', () => {
    expect(rowsTotal([pr(), pr()])).toBe(120);
    expect(rowsTotal([])).toBe(0);
  });
});

describe('buildReps', () => {
  const team: TeamRow[] = [
    { user_id: 'u1', display_name: 'หัวหน้าเอ', role: 'admin', active: true, email: 'a@example.com' },
    { user_id: 'u2', display_name: null, role: 'sales', active: true, email: 'sale.b@example.com' },
  ];
  const me: MeRow = { user_id: 'u1', email: 'a@example.com', display_name: 'Dev MPD', is_admin: true, is_member: true, active: true };
  it('maps team rows (name falls back to the email prefix, initials uppercase)', () => {
    expect(buildReps(team, me)[1]).toEqual({ id: 'u2', name: 'sale.b', initials: 'SA', role: 'sales', email: 'sale.b@example.com', active: true });
  });
  it('uses dsales_me for my own name, initials and role, adding me if missing', () => {
    expect(buildReps(team, me)[0]).toMatchObject({ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' });
    const reps = buildReps([team[1]], { ...me, user_id: 'u9', is_admin: false });
    expect(reps).toHaveLength(2);
    expect(reps[1]).toMatchObject({ id: 'u9', name: 'Dev MPD', role: 'sales' });
  });
});

describe('mapPurchase / mapChannel', () => {
  it('maps purchase and channel rows like the prototype', () => {
    expect(mapPurchase({ txn_date: '2026-10-01', bill_no: null, order_no: 'SO-1', sku: 'BBP-BED-03', product_name: 'เตียงนอนไม้', quantity: 1, amount: 3290 }))
      .toEqual({ date: '2026-10-01', bill: 'SO-1', sku: 'BBP-BED-03', product: 'เตียงนอนไม้', amount: 3290, seller: null });
    expect(mapChannel({ platform: 'line', shop: 'LOA_bebeplay', orders: 2, last_order: null, chat_name: null }))
      .toEqual({ platform: 'line', shop: 'LOA_bebeplay', chat: '' });
  });
});
