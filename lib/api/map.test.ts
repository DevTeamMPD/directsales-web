import { describe, expect, it } from 'vitest';
import { buildReps, mapCampaign, mapChannel, mapChatRoom, mapLead, mapPoolRow, mapPurchase, metaInboxUrl, normProvider, rowsTotal, upsertLead } from './map';
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
  it('drops chatCheck when the lead is unclaimed or claimed by someone else, keeps it for same owner', () => {
    const cc = { at: '2026-11-04T09:10', sent: true, count: 2 };
    const old = { ...mapLead(leadJson({ owner: 'u1' })), chatCheck: cc };
    expect(upsertLead([old], leadJson({ owner: null }))[0].chatCheck).toBeUndefined();
    expect(upsertLead([old], leadJson({ owner: 'u2' }))[0].chatCheck).toBeUndefined();
    expect(upsertLead([old], leadJson({ owner: 'u1', claimedAt: '2026-11-05T02:00:00+00:00' }))[0].chatCheck).toBeUndefined();
    expect(upsertLead([old], leadJson({ owner: 'u1', status: 'won' }))[0].chatCheck).toEqual(cc);
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
      id: '0812345678', segment: '', ltv: null, orders: null, brands: [], dormantDays: null, ownerTag: null,
    });
  });
  it('maps chat_rooms / chat_brands of dsales_base_customers (missing = [])', () => {
    const r = mapPoolRow(pr({
      chat_rooms: [
        { ms_id: 101, provider: 'line', page: 'bebeplayspace', brand: 'bebeplay', sendable: true },
        { ms_id: 102, provider: 'Facebook', page: 'Hosttail', brand: 'hosttail', sendable: false },
        { ms_id: 103, provider: 'facebook', page: 'MPD Outlet', brand: null, sendable: false },
      ],
      chat_brands: ['bebeplay', 'other'],
    }), 'u1');
    expect(r.chatRooms).toEqual([
      { msId: 101, provider: 'line', page: 'bebeplayspace', brand: 'bebeplay', sendable: true },
      { msId: 102, provider: 'facebook', page: 'Hosttail', brand: 'hosttail', sendable: false },
      { msId: 103, provider: 'facebook', page: 'MPD Outlet', brand: null, sendable: false },
    ]);
    expect(r.chatBrands).toEqual(['bebeplay']);
    expect(mapPoolRow(pr(), 'u1')).toMatchObject({ chatRooms: [], chatBrands: [] });
    expect(mapPoolRow(pr({ chat_rooms: null, chat_brands: null }), 'u1')).toMatchObject({ chatRooms: [], chatBrands: [] });
  });
  it('normalizes providers and never marks a room outside the brands as sendable', () => {
    expect([normProvider('Line'), normProvider('LineOA'), normProvider('TikTok'), normProvider('Zalo'), normProvider(null)]).toEqual(['line', 'line', 'tiktok', 'zalo', 'other']);
    expect(mapChatRoom({ ms_id: 5, provider: 'shopee', page: null, brand: 'x', sendable: true })).toEqual({ msId: 5, provider: 'shopee', page: '', brand: null, sendable: false });
  });
  it('keeps the room own chat name (JST name of that room) when the server sends it', () => {
    expect(mapChatRoom({ ms_id: 6, provider: 'Facebook', page: 'Bebeplay', brand: 'bebeplay', sendable: false, name: ' Kampan N ' }))
      .toEqual({ msId: 6, provider: 'facebook', page: 'Bebeplay', brand: 'bebeplay', sendable: false, name: 'Kampan N' });
    expect(mapChatRoom({ ms_id: 7, provider: 'line', page: 'x', brand: null, sendable: false, name: '  ' })).not.toHaveProperty('name');
  });
  it('Facebook / Instagram rooms with a known Meta page id get the page inbox link of Meta Business Suite', () => {
    expect(metaInboxUrl('347147266044826', '543119309449766')).toBe(
      'https://business.facebook.com/latest/inbox/all/?business_id=543119309449766&asset_id=347147266044826&mailbox_id=347147266044826',
    );
    expect(metaInboxUrl('347147266044826', null)).toBe(
      'https://business.facebook.com/latest/inbox/all/?asset_id=347147266044826&mailbox_id=347147266044826',
    );
    expect(metaInboxUrl('', '5')).toBeNull();
    expect(metaInboxUrl('12a', '5')).toBeNull();
    const fb = mapChatRoom({ ms_id: 8, provider: 'Facebook', page: 'Bebeplay', brand: 'bebeplay', sendable: false, meta_page_id: '347147266044826', meta_business_id: '543119309449766' });
    expect(fb.metaInbox).toBe(metaInboxUrl('347147266044826', '543119309449766'));
    expect(mapChatRoom({ ms_id: 9, provider: 'Facebook', page: 'HostTail', brand: 'hosttail', sendable: false, meta_page_id: null })).not.toHaveProperty('metaInbox');
    expect(mapChatRoom({ ms_id: 10, provider: 'line', page: 'x', brand: 'bebeplay', sendable: true, meta_page_id: '1' })).not.toHaveProperty('metaInbox');
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
