import { localStamp } from '@/lib/format';
import type {
  Campaign, CampaignRow, Channel, ChannelRowJson, Lead, LeadJson, MeRow, PoolRow, PoolRowJson, Purchase, PurchaseRowJson, Rep, TeamRow,
} from './types';

/** dsales_lead_json → Lead (prototype mapLead L943-946) + claimedAtIso สำหรับส่งกลับ server */
export function mapLead(j: LeadJson): Lead {
  return {
    ...j,
    address: j.address || '',
    shop: j.shop || '',
    chatName: j.chatName || '',
    channels: j.channels || [],
    interest: j.interest || '',
    closedBills: j.closedBills || [],
    releasedBy: j.releasedBy || [],
    bills: j.bills || [],
    purchases: [],
    claimedAt: localStamp(j.claimedAt),
    claimedAtIso: j.claimedAt,
    interactions: (j.interactions || []).map((i) => ({ ...i, date: localStamp(i.date) || i.date, note: i.note || '', result: i.result || '' })),
  };
}

/** แทนลีดเดิม (คง purchases/_pl/chatCheck ที่โหลดฝั่ง client) หรือเพิ่มไว้บนสุด — คืน array ใหม่ */
export function upsertLead(leads: Lead[], j: LeadJson): Lead[] {
  const m = mapLead(j);
  const i = leads.findIndex((x) => x.id === m.id);
  if (i < 0) return [m, ...leads];
  const o = leads[i];
  const next = leads.slice();
  next[i] = { ...m, purchases: o.purchases, _pl: o._pl, chatCheck: o.chatCheck };
  return next;
}

/** แถว dsales_campaigns → Campaign (โหมด auto ใช้เป็น self ตาม prototype ตอนใช้งานจริง) */
export function mapCampaign(c: CampaignRow): Campaign {
  return {
    id: c.id, brand: c.brand, name: c.name, note: c.description || '', start: c.start_date || '', end: c.end_date || '',
    claimMode: c.claim_mode === 'auto' ? 'self' : c.claim_mode, maxPerRep: c.max_per_rep ?? null,
    active: c.active !== false, criteria: c.criteria || [],
  };
}

/** แถวถังลูกค้า (pool_v4 / base_customers) → PoolRow (prototype poolLoad L631-633) */
export function mapPoolRow(r: PoolRowJson, meId: string): PoolRow {
  return {
    id: r.identity_id || r.phone,
    name: r.name,
    phone: r.phone,
    segment: r.rfm_segment || r.segment || '',
    ltv: Number(r.ltv ?? 0),
    orders: Number(r.order_count ?? 0),
    last: r.last_order_date,
    brands: r.brands || [],
    chat: r.chat_name || '',
    leadId: r.lead_id ?? null,
    mine: !!r.mine,
    noCall: !!r.no_call,
    takenName: r.reserved_by || '',
    taken: r.taken ? (r.mine ? meId : 'other') : null,
    dormantDays: r.dormant_days ?? null,
    ownerTag: r.owner_tag ?? null,
  };
}

/** total_count ของผลค้นหา (มีเฉพาะเมื่อหน้านั้นมีแถว) */
export const rowsTotal = (rows: ReadonlyArray<{ total_count: number | string }>): number => (rows.length ? Number(rows[0].total_count) : 0);

export function mapTeamRow(r: TeamRow): Rep {
  return {
    id: r.user_id,
    name: r.display_name || (r.email || '').split('@')[0],
    initials: (r.display_name || r.email || '?').slice(0, 2).toUpperCase(),
    role: r.role === 'admin' ? 'admin' : 'sales',
    email: r.email ?? undefined,
    active: r.active,
  };
}

/** ทีมจาก dsales_team + ตัวเราจาก dsales_me (prototype loadLive L974-977) */
export function buildReps(team: TeamRow[], me: MeRow): Rep[] {
  const name = me.display_name || me.email.split('@')[0];
  const self: Rep = { id: me.user_id, name, initials: name.slice(0, 2).toUpperCase(), role: me.is_admin ? 'admin' : 'sales', email: me.email, active: me.active };
  const reps = team.map(mapTeamRow);
  return reps.some((r) => r.id === me.user_id) ? reps.map((r) => (r.id === me.user_id ? { ...r, ...self } : r)) : [...reps, self];
}

export function mapPurchase(x: PurchaseRowJson): Purchase {
  return { date: x.txn_date ?? '', bill: x.bill_no || x.order_no || '', sku: x.sku || '', product: x.product_name || '', amount: Number(x.amount || 0), seller: null };
}

export function mapChannel(x: ChannelRowJson): Channel {
  return { platform: x.platform, shop: x.shop ?? '', chat: x.chat_name || '' };
}
