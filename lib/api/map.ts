import { PLAT, type Brand } from '@/lib/constants';
import { localStamp } from '@/lib/format';
import { DEFAULT_RFM_CONFIG, type RfmSeg } from '@/lib/domain/rfm';
import type {
  Campaign, CampaignRow, Channel, ChannelRowJson, ChatRoom, ChatRoomJson, Lead, LeadJson, MeRow, PoolRow, PoolRowJson, Purchase, PurchaseRowJson,
  Rep, RfmSegJson, TeamRow,
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
    interactions: (j.interactions || []).flatMap((i) =>
      i.type === 'system' || i.type === 'ai' ? [] : [{ ...i, type: i.type, date: localStamp(i.date) || i.date, note: i.note || '', result: i.result || '' }]),
    systemLog: (j.interactions || []).filter((i) => i.type === 'system' || i.type === 'ai')
      .map((i) => ({
        id: i.id, date: localStamp(i.date) || i.date, rep: i.rep, note: i.note || '',
        ...(i.type === 'ai' ? { kind: 'ai' as const, result: i.result || '' } : {}),
      })),
  };
}

/** แทนลีดเดิม (คง purchases/_pl/chatCheck ที่โหลดฝั่ง client) หรือเพิ่มไว้บนสุด — คืน array ใหม่ */
export function upsertLead(leads: Lead[], j: LeadJson): Lead[] {
  const m = mapLead(j);
  const i = leads.findIndex((x) => x.id === m.id);
  if (i < 0) return [m, ...leads];
  const o = leads[i];
  const next = leads.slice();
  // ผลตรวจแชตผูกกับการจอง: เปลี่ยนเจ้าของ/จองใหม่/ยกเลิกจอง → ทิ้ง (prototype ล้าง chatCheck ตอน claim/unclaim L102, L713)
  const sameClaim = m.owner === o.owner && m.claimedAtIso === o.claimedAtIso;
  next[i] = { ...m, purchases: o.purchases, _pl: o._pl, chatCheck: sameClaim ? o.chatCheck : undefined };
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
    ltv: r.ltv == null ? null : Number(r.ltv),
    orders: r.order_count == null ? null : Number(r.order_count),
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
    chatRooms: (r.chat_rooms || []).map(mapChatRoom),
    chatBrands: (r.chat_brands || []).filter(isBrand),
  };
}

const isBrand = (b: string | null | undefined): b is Brand => b === 'bebeplay' || b === 'hosttail';

/** provider ของ iim_sessions (Line / LineOA / Shopee …) → key ของ PLAT (ใช้กับไอคอน); ไม่รู้จัก = ตัวพิมพ์เล็กเดิม */
export function normProvider(p: string | null | undefined): string {
  const key = String(p ?? '').toLowerCase().replace(/\s+/g, '');
  return (Object.keys(PLAT) as string[]).find((k) => key.startsWith(k)) || key || 'other';
}

/**
 * Inbox ของเพจใน Meta Business Suite — Business Suite ไม่รับ PSID ของ JST เป็น selected_item_id (ทดสอบ 2026-11-20)
 * จึงเปิดได้แค่ Inbox ของเพจ แล้วให้เซลล์ค้นชื่อเอง
 */
export function metaInboxUrl(pageId: string | null | undefined, businessId: string | null | undefined): string | null {
  const p = String(pageId ?? '').trim();
  if (!/^\d+$/.test(p)) return null;
  const b = String(businessId ?? '').trim();
  return `https://business.facebook.com/latest/inbox/all/?${/^\d+$/.test(b) ? `business_id=${b}&` : ''}asset_id=${p}&mailbox_id=${p}`;
}

export function mapChatRoom(r: ChatRoomJson): ChatRoom {
  const brand = isBrand(r.brand) ? r.brand : null;
  const provider = normProvider(r.provider);
  const name = (r.name ?? '').trim();
  const meta = provider === 'facebook' || provider === 'instagram' ? metaInboxUrl(r.meta_page_id, r.meta_business_id) : null;
  return {
    msId: Number(r.ms_id), provider, page: r.page || '', brand, sendable: !!r.sendable && brand !== null,
    ...(name ? { name } : {}), ...(meta ? { metaInbox: meta } : {}),
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

/** dsales_rfm_config_get → RfmSeg เรียงตามลำดับกติกา · server ไม่มีกติกา (หรือโหลดไม่ได้ = null) → กติกาเริ่มต้นในโค้ด */
export function mapRfmConfig(rows: ReadonlyArray<RfmSegJson> | null | undefined): RfmSeg[] {
  if (!rows?.length) return [...DEFAULT_RFM_CONFIG];
  return [...rows]
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({
      key: r.key, sort: r.sort, fMin: r.f_min, fMax: r.f_max, rMin: r.r_min, rMax: r.r_max, fallback: !!r.fallback,
      tone: r.tone || '', behavior: r.behavior || '', action: r.action || '',
      templateBebeplay: r.template_bebeplay ?? null, templateHosttail: r.template_hosttail ?? null, noOutreach: !!r.no_outreach,
    }));
}
