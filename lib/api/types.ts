import type { Brand, ClaimMode, CritType, LeadStatus, Role } from '@/lib/constants';

export type { Brand, ClaimMode, LeadStatus, Role } from '@/lib/constants';
export type LeadSource = 'self' | 'campaign';
export type ContactType = 'call' | 'chat';

export interface Channel { shop?: string; chat?: string; chat_name?: string; platform?: string; ms_id?: number | string | null }

/** รายการใน interactions ของ dsales_lead_json (ล่าสุด 30 รายการ เรียงเก่า→ใหม่) */
/** 'system' = บันทึกจากระบบ (เช่น คืนลีดอัตโนมัติเมื่อครบ 30 วัน) — mapLead แยกไปไว้ที่ Lead.systemLog ไม่ปนกับประวัติการติดต่อ */
export interface InteractionJson {
  id: string; type: ContactType | 'system' | 'ai'; date: string; rep: string | null;
  result: string | null; note: string | null; due: string | null; bills: string[] | null;
}
export interface Interaction {
  id: string; type: ContactType; date: string; rep: string | null;
  result: string; note: string; due?: string | null; bills?: string[] | null;
}

/** kind 'ai' = ผลวิเคราะห์สถานะด้วย AI (result = สถานะที่ตั้ง / keep / undo) */
export interface SystemNote { id: string; date: string; rep: string | null; note: string; kind?: 'ai'; result?: string }
/** dsales_leads.ai — ผลวิเคราะห์สถานะด้วย AI ครั้งล่าสุด (20261125130000) */
export interface LeadAi {
  at: string; status: string; applied: boolean; confidence: number; prevStatus: string; prevCallback: string | null; callback: string | null;
  interest: string; reason: string; flags: string[]; nextAction: string; undoneAt?: string;
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
  /** เวลาที่เข้า Direct Sale ของเจ้าของปัจจุบัน (null = ไม่มีเจ้าของ) — ครบ 30 วันยังไม่ won ระบบคืนอัตโนมัติ */
  dsSince?: string | null;
  ai?: LeadAi | null;
  bills: string[] | null; total: number | null; lastBuy: string | null; orders: number | null;
  /** กลุ่มลูกค้า RFM + วันที่ไม่ได้ซื้อ จาก dsales_customer_base (ค่าเดียวกับ /mine) — null = เบอร์ไม่อยู่ในฐานลูกค้า (20261126140000) */
  rfm?: string | null; dormantDays?: number | null;
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
  /** จาก server เท่านั้น (fixture ไม่มี — leadRfm คำนวณจากประวัติซื้อแทน) */
  rfm?: string | null; dormantDays?: number | null;
  interactions: Interaction[]; purchases: Purchase[];
  dsSince?: string | null; systemLog?: SystemNote[]; ai?: LeadAi | null;
  _pl?: 'loading' | 'done'; chatCheck?: ChatCheck | null;
}

/** SKU ที่ติ๊กในเงื่อนไข "เคยซื้อสินค้า" (เก็บชื่อไว้แสดงชิป) */
export interface ProductItem { sku: string; name: string }
export interface CampaignCriterion { type: CritType; kw?: string; min?: string; max?: string; from?: string; to?: string; items?: ProductItem[] }
/** แถวของ dsales_product_search */
export interface ProductRow { sku: string; product_name: string | null; buyers: number; last_bought: string | null }
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

/**
 * ห้องแชตที่ผูกกับลูกค้า (dsales_base_customers.chat_rooms เรียงห้องที่ส่งได้ก่อน)
 * brand null = เพจนอก 2 แบรนด์; sendable false = brand null หรือ Facebook/Instagram ที่ลูกค้าไม่ได้ทักมาใน 7 วัน
 */
export interface ChatRoomJson { ms_id: number; provider: string | null; page: string | null; brand: string | null; sendable: boolean; name?: string | null;
  /** ห้อง Facebook / Instagram เท่านั้น */ outer_user_id?: string | null; meta_page_id?: string | null; meta_business_id?: string | null }
/** name = ชื่อของห้องนี้ใน JST (ใช้ค้นหา/คัดลอก) · metaInbox = ลิงก์ Inbox ของเพจใน Meta Business Suite (FB/IG ที่รู้ page id) */
export interface ChatRoom { msId: number; provider: string; page: string; brand: Brand | null; sendable: boolean; name?: string; metaInbox?: string }
/** แถวของ dsales_rooms_for_phones */
export interface RoomsForPhoneRow { phone: string; rooms: ChatRoomJson[] | null }

/** p_filters ของ dsales_base_customers (สร้างจาก UI ด้วย lib/domain/baseFilters.ts buildFilterJson) — ไม่มีตัวกรอง = {} */
export type BaseFilterJson = Partial<{
  rfm: string[]; dormant_min: number; dormant_max: number; ltv_min: number; ltv_max: number; orders_min: number; tag: string; has_chat: boolean; provider: string;
  /** แคมเปญ (20261125090000): เคยซื้อ — ทุกกลุ่มต้องเจอ (SKU ใดในกลุ่ม หรือคำค้น kw) · ช่วงวันที่ซื้อ · บิลขั้นต่ำ · ยอดรวมไม่เกิน (รวมค่าขอบ) */
  products: Array<{ skus?: string[]; kw?: string }>; bought_from: string; bought_to: string; bill_min: number; ltv_to: number;
  /** หัวหน้าดูในมุมมองเซลล์ (scope mine = ลูกค้าของเซลล์คนนี้) — 20261125150000 */
  as: string;
  sort: 'ltv' | 'dormant_asc' | 'dormant_desc' | 'last_desc' | 'orders_desc';
}>;

/** แถวของ dsales_customer_pool_v3/_v4 และ dsales_base_customers (คอลัมน์ dormant_days ถึง chat_brands มีเฉพาะ base_customers) */
export interface PoolRowJson {
  identity_id: string | null; name: string; phone: string; chat_name: string | null; segment: string | null; rfm_segment: string | null;
  ltv: number | string | null; order_count: number | null; last_order_date: string | null; brands: string[] | null;
  total_count: number | string; lead_id?: string | null; taken?: boolean; mine?: boolean; no_call?: boolean; reserved_by?: string | null;
  dormant_days?: number | null; owner_tag?: string | null; chat_rooms?: ChatRoomJson[] | null; chat_brands?: string[] | null;
}
export interface PoolRow {
  id: string; name: string; phone: string; segment: string; ltv: number | null; orders: number | null; last: string | null; brands: string[];
  chat: string; leadId: string | null; mine: boolean; noCall: boolean; takenName: string; taken: string | null;
  dormantDays: number | null; ownerTag: string | null;
  /** ห้องแชต (ส่งได้ก่อน) และแบรนด์ที่มีห้องส่งได้อย่างน้อย 1 ห้อง — ถังลูกค้าของหน้าแคมเปญ = [] */
  chatRooms: ChatRoom[]; chatBrands: Brand[];
  /** โหมด fixture (prototype โหมดตัวอย่าง L640): เซลล์คนนี้เคยคัดออก / ลีดที่จองไว้ยกเลิกได้ */
  releasedByMe?: boolean; mineReserved?: boolean;
}

/** ลูกค้าในถังของโหมดตัวอย่าง (window.DS_DATA.customers) — ล็อกอินจริงเป็น [] เสมอ (prototype loadLive L980) */
export interface DemoCustomer {
  id: string; name: string; phone: string; address: string; brand: Brand; shop: string; chatName: string; channels: Channel[]; purchases: Purchase[];
  /** โหมด fixture ของ /mine /pool (withBaseExtras ของ fixture): ห้องแชต, กลุ่ม RFM, tag เจ้าของใน JST */
  chatRooms?: ChatRoom[]; rfm?: string | null; ownerTag?: string | null;
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

/* ---------- ส่งข้อความผ่าน JST worker (docs/superpowers/plans/2026-11-20-outreach-contract.md) ---------- */
/** เหตุผลที่ preview ข้ามลูกค้า (dsales_outreach_preview.skip) */
export type OutreachSkip = 'customer_not_found' | 'taken' | 'already_queued' | 'no_chat_room' | 'window_closed' | 'cs_customer';
/** เหตุผลที่ enqueue ข้าม (preview + no_call / claim_failed) */
export type EnqueueSkipReason = OutreachSkip | 'no_call' | 'claim_failed';
export type OutreachStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type WorkerState = 'running' | 'paused' | 'needs_login' | 'stopped';

export interface Template { id: string; brand: Brand; name: string; body: string; active: boolean; updated_at: string | null }
export interface TemplateInput { id: string | null; brand: Brand; name: string; body: string; active: boolean }
export interface PreviewRow {
  phone: string; name: string | null; ms_id: number | null; page: string | null; provider: string | null; chat_name: string | null;
  message: string | null; skip: OutreachSkip | null;
}
export interface SkippedPhone { phone: string; reason: string }
export interface EnqueueResult { batch_id: string | null; queued: number; skipped: SkippedPhone[] }
export interface OutreachCounts { queued: number; sending: number; sent: number; failed: number; cancelled: number }
export interface BatchRow {
  id: string; created_at: string; brand: Brand; requested_by: string | null; template_name: string | null; total: number;
  /** จำนวนที่ถูกข้ามตอน enqueue */
  skipped: number; counts: OutreachCounts;
}
export interface BatchItem {
  id: string; phone: string; lead_id: string | null; ms_id: number | null; page: string | null; provider: string | null; chat_name: string | null;
  message: string | null; status: OutreachStatus; attempts: number; error: string | null; enqueued_at: string | null; sent_at: string | null;
}
export interface BatchDetail {
  batch: { id: string; created_at: string; brand: Brand; template_name: string | null; total: number; skipped: SkippedPhone[]; requested_by: string | null };
  items: BatchItem[];
}
export interface WorkerRow {
  worker_id: string; state: WorkerState; jst_session_ok: boolean | null; heartbeat_at: string | null; online: boolean;
  sent_last_hour: number; queue_waiting: number; last_error: string | null;
  /** ตัวหลักตามค่า worker_primary (ไม่มี = server ยังไม่ส่ง) */
  is_primary?: boolean;
}
export interface WorkerSettings { interval_seconds: number; line_monthly_cap: number; test_mode: boolean; test_ms_ids: number[]; max_batch: number }
export interface WorkerStatus {
  workers: WorkerRow[];
  /** worker_id ของตัวหลัก · null/ไม่มี = ไม่ได้ตั้ง (ทุกตัวรับงานได้) */
  primary?: string | null;
  queue: { queued: number; sending: number; sent_last_hour: number; line_sent_this_month: number };
  settings: WorkerSettings;
}
export interface WorkerSettingsInput { interval: number; lineCap: number; testMode: boolean; testMsIds: number[] }
export interface WorkerRoom { ms_id: number; customer: string | null; channel: string | null; page: string | null; last_time: string | null }

/** ข้อมูลตัวอย่างของหน้าส่งข้อความในโหมด fixture (ล็อกอินจริง = ไม่มี) */
export interface OutreachDemo {
  templates: Template[]; batches: BatchRow[]; details: Record<string, BatchDetail>; worker: WorkerStatus; rooms: WorkerRoom[];
}
