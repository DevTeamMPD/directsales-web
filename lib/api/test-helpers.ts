import type { LeadJson } from './types';

export function leadJson(over: Partial<LeadJson> = {}): LeadJson {
  return {
    id: 'L1', name: 'สุภาพร ใจดี', phone: '0812345678', address: 'เขตบางนา', shop: 'SH_bebeplay', chatName: 'baby_love101_sh',
    channels: [{ shop: 'SH_bebeplay', chat: 'baby_love101_sh' }], brand: 'bebeplay', source: 'self', campaignId: null, owner: 'u1',
    status: 'following', callback: null, interest: 'เตียงนอนเด็ก', closedBills: [], closedAmount: null, closedAt: null,
    claimedBy: 'u1', claimedAt: '2026-11-04T02:05:00.123456+00:00', noCall: false, noCallBy: null, noCallAt: null, releasedBy: [],
    autoSkip: false, identityId: null, bills: ['310001'], total: 2490, lastBuy: '2026-10-01', orders: 1,
    interactions: [{ id: 'i1', type: 'call', date: '2026-11-04T03:00:00+00:00', rep: 'u1', result: null, note: null, due: null, bills: null }],
    ...over,
  };
}
