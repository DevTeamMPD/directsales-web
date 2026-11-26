import { PAGE, type Brand, type ClaimMode, type Role } from '@/lib/constants';
import { normalizeSearchPhone } from '@/lib/phone';
import { db } from '@/lib/supabase/client';
import { RpcError } from './errors';
import { rowsTotal } from './map';
import type {
  ProductRow,
  BaseFilterJson, BatchDetail, BatchRow, CampaignRow, ChannelRowJson, ChatSessionJson, ContactType, EnqueueResult, JstTagRow, LeadJson, LeadStatus, MeRow,
  MemberJson, MemberTagsRow, NewCampaign, PoolRowJson, PreviewRow, PurchaseRowJson, RoomsForPhoneRow, TeamRow, Template, TemplateInput, WorkerRoom,
  WorkerSettingsInput, WorkerStatus,
} from './types';

type Result<T> = { data: T | null; error: { message: string; code?: string } | null; status?: number };

function unwrap<T>({ data, error, status }: Result<T>): T {
  if (error) throw new RpcError(error.message, { status, code: error.code });
  return data as T;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await db().rpc(fn, args));
}

/* ---------- ตัวตน / ทีม ---------- */
export async function getMe(): Promise<MeRow | null> {
  const rows = await call<MeRow[]>('dsales_me');
  return rows?.[0] ?? null;
}
export const getTeam = () => call<TeamRow[]>('dsales_team');
export const addMember = (email: string, role: Role) => call<MemberJson>('dsales_add_member', { p_email: email.trim(), p_role: role });
export async function setMemberActive(userId: string, active: boolean): Promise<void> {
  await call<null>('dsales_set_member_active', { p_user: userId, p_active: active });
}
export const getJstAdminTags = () => call<JstTagRow[]>('dsales_jst_admin_tags');
export const getMemberTags = () => call<MemberTagsRow[]>('dsales_member_tags');
export const setMemberTags = (userId: string, tags: string[]) => call<string[]>('dsales_set_member_tags', { p_user: userId, p_tags: tags });

/* ---------- ลีด ---------- */
export const getMyLeads = (limit = 1000, offset = 0) => call<LeadJson[]>('dsales_my_leads', { p_limit: limit, p_offset: offset });
/** ห้องแชตของหลายเบอร์ (ลีดของฉัน; หัวหน้า = ทุกเบอร์) — ตัดซ้ำ/ว่าง แล้วส่งทีละ 100 เบอร์ (ขีดจำกัดของ RPC) */
export async function getRoomsForPhones(phones: ReadonlyArray<string>): Promise<RoomsForPhoneRow[]> {
  const uniq = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  const out: RoomsForPhoneRow[] = [];
  for (let i = 0; i < uniq.length; i += 100) {
    out.push(...((await call<RoomsForPhoneRow[] | null>('dsales_rooms_for_phones', { p_phones: uniq.slice(i, i + 100) })) ?? []));
  }
  return out;
}
export const claimLead = (leadId: string) => call<LeadJson>('dsales_claim_lead', { p_lead: leadId });
export const unclaimLead = (leadId: string) => call<LeadJson>('dsales_unclaim_lead', { p_lead: leadId });
export const assignLead = (leadId: string, userId: string) => call<LeadJson>('dsales_assign_lead', { p_lead: leadId, p_user: userId });
export const setNoCall = (leadId: string, on: boolean) => call<LeadJson>('dsales_set_nocall', { p_lead: leadId, p_on: on });
export interface LogInput {
  leadId: string; type: ContactType; result: string; note: string; status: LeadStatus;
  callback: string | null; interest: string; bills: string[]; amount: number | null;
}
export const logContact = (x: LogInput) =>
  call<LeadJson>('dsales_log', {
    p_lead: x.leadId, p_type: x.type, p_result: x.result, p_note: x.note, p_status: x.status,
    p_callback: x.callback, p_interest: x.interest, p_bills: x.bills, p_amount: x.amount,
  });

/* ---------- ลูกค้า / ถัง ---------- */
/** campaignId = จองจากการ์ดแคมเปญ (ลีดผูกแคมเปญ · campaign_closed / campaign_quota) */
/** campaignId = จองเข้าแคมเปญ · forUser = หัวหน้าจองให้เซลล์คนนั้น (โหมดดูในมุมมองเซลล์) */
export const claimCustomer = (phone: string, brand: Brand, campaignId?: string | null, forUser?: string | null) =>
  call<LeadJson>('dsales_claim_customer', {
    p_phone: phone, p_brand: brand, ...(campaignId ? { p_campaign: campaignId } : {}), ...(forUser ? { p_for: forUser } : {}),
  });
/** ย้อนสถานะที่ AI เปลี่ยน (หัวหน้าเท่านั้น) */
export const undoAiStatus = (leadId: string) => call<LeadJson>('dsales_ai_status_undo', { p_lead: leadId });
export const searchProducts = (q: string) => call<ProductRow[]>('dsales_product_search', { p_q: q.trim(), p_limit: 100 });
export async function getPoolGrandTotal(brand: Brand | null): Promise<number> {
  return rowsTotal(await call<PoolRowJson[]>('dsales_customer_pool_v3', { p_limit: 1, p_offset: 0, p_brand: brand || null }));
}
export interface PoolQuery { search?: string | null; limit?: number; offset?: number; brand?: Brand | null; from?: string | null; to?: string | null }
export const getCustomerPool = (q: PoolQuery) =>
  call<PoolRowJson[]>('dsales_customer_pool_v4', {
    p_search: q.search?.trim() || null, p_limit: q.limit ?? PAGE, p_offset: q.offset ?? 0, p_brand: q.brand || null,
    ...(q.from || q.to ? { p_from: q.from || null, p_to: q.to || null } : {}),
  });
export type BaseScope = 'mine' | 'pool' | 'team';
export const getBaseCustomers = (scope: BaseScope, q: Omit<PoolQuery, 'from' | 'to'> & { filters?: BaseFilterJson | null }) =>
  call<PoolRowJson[]>('dsales_base_customers', {
    p_scope: scope, p_search: normalizeSearchPhone(q.search ?? '') || null, p_limit: q.limit ?? PAGE, p_offset: q.offset ?? 0, p_brand: q.brand || null,
    p_filters: q.filters ?? {},
  });
/** จำนวนลูกค้าต่อกลุ่ม RFM ตามขอบเขต + แบรนด์ ('' = ยังไม่จัดกลุ่ม) */
export const getBaseSegmentCounts = (scope: BaseScope, brand: Brand | null, asUser?: string | null) =>
  call<Array<{ segment: string; n: number | string }>>('dsales_base_segment_counts', { p_scope: scope, p_brand: brand || null, ...(asUser ? { p_as: asUser } : {}) });
export const getCustomerPurchases = (phone: string) => call<PurchaseRowJson[]>('dsales_customer_purchases', { p_phone: phone });
export const getCustomerChannels = (phone: string) => call<ChannelRowJson[]>('dsales_customer_channels', { p_phone: phone });
export const getCustomerChats = (phone: string, sinceIso: string | null) =>
  call<ChatSessionJson[]>('dsales_customer_chats', { p_phone: phone, p_since: sinceIso });

/* ---------- แคมเปญ (ตาราง) ---------- */
export async function listCampaigns(): Promise<CampaignRow[]> {
  return unwrap<CampaignRow[]>(await db().from('dsales_campaigns').select('*').order('created_at'));
}
export async function createCampaign(input: NewCampaign): Promise<CampaignRow> {
  return unwrap<CampaignRow>(await db().from('dsales_campaigns').insert(input).select().single());
}
export async function setCampaignClaimMode(id: string, mode: ClaimMode): Promise<void> {
  // RLS กรอง update ที่ไม่มีสิทธิ์เหลือ 0 แถวโดยไม่มี error (เช่น ถูกถอดจากหัวหน้าระหว่างใช้งาน) → ต้องตรวจจำนวนแถวเอง
  const rows = unwrap<{ id: string }[]>(await db().from('dsales_campaigns').update({ claim_mode: mode }).eq('id', id).select('id'));
  if (!rows?.length) throw new RpcError('forbidden');
}

/* ---------- ส่งข้อความผ่าน JST worker (outreach contract ข้อ 2) ---------- */
export const getTemplates = (brand: Brand | null) => call<Template[]>('dsales_templates_list', { p_brand: brand || null });
export const saveTemplate = (t: TemplateInput) =>
  call<Template>('dsales_template_save', { p_id: t.id, p_brand: t.brand, p_name: t.name.trim(), p_body: t.body, p_active: t.active });
/** forUser = หัวหน้าส่งในนามเซลล์คนนั้น (กติกาเหมือนเซลล์ส่งเอง, จองลูกค้าในถังให้เซลล์) */
export const previewOutreach = (phones: string[], templateId: string, forUser?: string | null) =>
  call<PreviewRow[]>('dsales_outreach_preview', { p_phones: phones, p_template: templateId, ...(forUser ? { p_for: forUser } : {}) });
export const enqueueOutreach = (phones: string[], templateId: string, forUser?: string | null) =>
  call<EnqueueResult>('dsales_enqueue_outreach', { p_phones: phones, p_template: templateId, ...(forUser ? { p_for: forUser } : {}) });
export const getOutreachBatches = (limit = PAGE, offset = 0) => call<BatchRow[]>('dsales_outreach_batches_mine', { p_limit: limit, p_offset: offset });
export const getOutreachBatch = (batchId: string) => call<BatchDetail>('dsales_outreach_batch', { p_batch: batchId });
export const cancelOutreach = (ids: string[]) => call<number>('dsales_outreach_cancel', { p_ids: ids });
export const getWorkerStatus = () => call<WorkerStatus>('dsales_worker_status_get', {});
export const setWorkerSettings = (x: WorkerSettingsInput) =>
  call<WorkerStatus>('dsales_worker_settings_set', { p_interval: x.interval, p_line_cap: x.lineCap, p_test_mode: x.testMode, p_test_ms_ids: x.testMsIds });
export const findWorkerRooms = (query: string) => call<WorkerRoom[]>('dsales_worker_find_rooms', { p_query: query.trim() });
/** หัวหน้า: ตั้ง worker ตัวหลัก (ตัวอื่นเป็นตัวสำรอง) */
export const setWorkerPrimary = (workerId: string) => call<WorkerStatus>('dsales_worker_primary_set', { p_worker: workerId });
/** หัวหน้า: ล้างสถานะของ worker บน Vercel ที่หยุด (แทนการรีสตาร์ท) */
export const resetWorkerState = (workerId: string) => call<WorkerStatus>('dsales_worker_state_reset', { p_worker: workerId });
