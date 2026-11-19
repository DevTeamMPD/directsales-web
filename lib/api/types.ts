import type { Brand, ClaimMode, CritType, LeadStatus, Role } from '@/lib/constants';

export type { Brand, ClaimMode, LeadStatus, Role } from '@/lib/constants';
export type LeadSource = 'self' | 'campaign';
export type ContactType = 'call' | 'chat';

export interface Channel { shop?: string; chat?: string; chat_name?: string; platform?: string; ms_id?: number | string | null }

/** รายการใน interactions ของ dsales_lead_json (ล่าสุด 30 รายการ เรียงเก่า→ใหม่) */
export interface InteractionJson {
  id: string; type: ContactType; date: string; rep: string | null;
  result: string | null; note: string | null; due: string | null; bills: string[] | null;
}
export interface Interaction {
  id: string; type: ContactType; date: string; rep: string | null;
  result: string; note: string; due?: string | null; bills?: string[] | null;
}

export interface Purchase { date: string; bill: string; sku: string; product: string; amount: number; seller: string | null }
export interface ChatCheck { at: string; sent: boolean; count: number }

/** ผลของ dsales.dsales_lead_json (supabase/migrations/20261117090100_dsales_schema_move.sql) */
export interface LeadJson {
  id: string; name: string; phone: string; address: string | null; shop: string | null; chatName: string | null; channels: Channel[] | null;
  brand: Brand; source: LeadSource; campaignId: string | null; owner: string | null; status: LeadStatus; callback: string | null;
  interest: string | null; closedBills: string[] | null; closedAmount: number | null; closedAt: string | null;
  claimedBy: string | null; claimedAt: string | null; noCall: boolean; noCallBy: string | null; noCallAt: string | null;
  releasedBy: string[] | null; autoSkip: boolean; identityId: string | null;
  bills: string[] | null; total: number | null; lastBuy: string | null; orders: number | null;
  interactions: InteractionJson[] | null;
}

/** ลีดใน state ฝั่ง client (หลัง mapLead หรือจาก fixture) */
export interface Lead {
  id: string; name: string; phone: string; address: string; shop: string; chatName: string; channels: Channel[];
  brand: Brand; source: LeadSource; campaignId: string | null; owner: string | null; status: LeadStatus; callback: string | null;
  interest: string; closedBills: string[]; closedAmount: number | null; closedAt: string | null;
  claimedBy?: string | null; claimedAt?: string | null; claimedAtIso?: string | null;
  noCall?: boolean; noCallBy?: string | null; noCallAt?: string | null; releasedBy?: string[]; autoSkip?: boolean; identityId?: string | null;
  bills?: string[]; total?: number | null; lastBuy?: string | null; orders?: number | null;
  interactions: Interaction[]; purchases: Purchase[];
  _pl?: 'loading' | 'done'; chatCheck?: ChatCheck | null;
}

export interface CampaignCriterion { type: CritType; kw?: string; min?: string; max?: string; from?: string; to?: string }
export interface CampaignRow {
  id: string; brand: Brand; name: string; description: string | null; start_date: string | null; end_date: string | null;
  claim_mode: ClaimMode; max_per_rep: number | null; active: boolean | null; criteria: CampaignCriterion[] | null; created_at?: string;
}
export type NewCampaign = Omit<CampaignRow, 'id' | 'created_at'>;
export interface Campaign {
  id: string; brand: Brand; name: string; note: string; start: string; end: string;
  claimMode: ClaimMode; maxPerRep: number | null; active: boolean; criteria: CampaignCriterion[];
}

export interface MeRow { user_id: string; email: string; display_name: string; is_admin: boolean; is_member: boolean; active: boolean }
export interface TeamRow { user_id: string; display_name: string | null; role: string; active: boolean; email: string | null }
export interface Rep { id: string; name: string; initials: string; role: Role; email?: string; active?: boolean }
export interface MemberJson { user_id: string; email: string; display_name: string; role: Role; active: boolean }

/** แถวของ dsales_customer_pool_v3/_v4 และ dsales_base_customers (2 คอลัมน์ท้ายมีเฉพาะ base_customers) */
export interface PoolRowJson {
  identity_id: string | null; name: string; phone: string; chat_name: string | null; segment: string | null; rfm_segment: string | null;
  ltv: number | string | null; order_count: number | null; last_order_date: string | null; brands: string[] | null;
  total_count: number | string; lead_id?: string | null; taken?: boolean; mine?: boolean; no_call?: boolean; reserved_by?: string | null;
  dormant_days?: number | null; owner_tag?: string | null;
}
export interface PoolRow {
  id: string; name: string; phone: string; segment: string; ltv: number; orders: number; last: string | null; brands: string[];
  chat: string; leadId: string | null; mine: boolean; noCall: boolean; takenName: string; taken: string | null;
  dormantDays: number | null; ownerTag: string | null;
  /** โหมด fixture (prototype โหมดตัวอย่าง L640): เซลล์คนนี้เคยคัดออก / ลีดที่จองไว้ยกเลิกได้ */
  releasedByMe?: boolean; mineReserved?: boolean;
}

/** ลูกค้าในถังของโหมดตัวอย่าง (window.DS_DATA.customers) — ล็อกอินจริงเป็น [] เสมอ (prototype loadLive L980) */
export interface DemoCustomer {
  id: string; name: string; phone: string; address: string; brand: Brand; shop: string; chatName: string; channels: Channel[]; purchases: Purchase[];
}

export interface PurchaseRowJson {
  txn_date: string | null; bill_no: string | null; order_no: string | null; sku: string | null;
  product_name: string | null; quantity: number | null; amount: number | null;
}
export interface ChannelRowJson { platform: string; shop: string | null; orders: number; last_order: string | null; chat_name: string | null }
export interface ChatSessionJson {
  ms_id: number; channel: string | null; page: string | null; chat_name: string | null; last_time: string | null; msg_count: number | null;
  admin_msgs: number; last_admin_time: string | null; last_admin_sender: string | null; last_customer_time: string | null;
}
export interface JstTagRow { tag: string; sessions: number }
export interface MemberTagsRow { user_id: string; jst_tags: string[] }
