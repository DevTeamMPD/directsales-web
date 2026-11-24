/** ข้อความไทยของ error จาก RPC ใน schema dsales (เทียบทั้ง token จึงไม่มี key ไหนทับกัน ต่างจาก prototype ที่เทียบ substring) */
export const ERROR_TEXT: Readonly<Record<string, string>> = {
  taken: 'ลูกค้ารายนี้มีคนจองไปแล้ว',
  release_cooldown: 'ลูกค้ารายนี้เพิ่งถูกคืนจาก Direct Sale ของคุณ (ครบ 30 วันยังไม่ปิดการขาย) จองซ้ำได้เมื่อพ้น 30 วัน',
  no_call: 'ลูกค้ารายนี้ไม่สะดวกให้โทร',
  forbidden: 'ไม่มีสิทธิ์ทำรายการนี้',
  bill_required: 'ใส่เลขบิลก่อนปิดการขาย',
  not_found: 'ไม่พบข้อมูลรายการนี้',
  invalid_phone: 'เบอร์โทรของลูกค้าไม่ถูกต้อง',
  customer_not_found: 'ไม่พบลูกค้ารายนี้',
  invalid_user: 'ผู้ใช้ไม่ถูกต้อง',
  invalid_brand: 'ไม่ทราบแบรนด์ของการจอง',
  member_not_found: 'ไม่พบเซลล์รายนี้ในทีม',
  not_authenticated: 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
  not_member: 'บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า',
  user_not_found: 'ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ',
  invalid_role: 'บทบาทไม่ถูกต้อง',
  cannot_deactivate_self: 'ปิดใช้งานบัญชีของตัวเองไม่ได้',
  last_admin: 'ต้องมีหัวหน้าอย่างน้อย 1 คน',
  statement_timeout: 'ระบบฐานข้อมูลตอบช้า กรุณาลองใหม่อีกครั้ง',
  // ส่งข้อความผ่าน JST worker (outreach contract)
  template_not_found: 'ไม่พบ template นี้ หรือถูกปิดใช้งานแล้ว',
  batch_too_large: 'เลือกลูกค้าเกินจำนวนสูงสุดต่อชุด',
  too_many_phones: 'ส่งเบอร์เกินจำนวนสูงสุดต่อครั้ง',
  invalid_template: 'template ไม่ถูกต้อง ต้องมีชื่อและข้อความ',
  invalid_setting: 'ค่าตั้งค่าไม่ถูกต้อง (ระยะห่าง 5–3600 วินาที, เพดาน LINE ตั้งแต่ 0)',
  not_worker: 'บัญชีนี้ไม่ใช่บัญชีของ worker',
  already_queued: 'ลูกค้ารายนี้อยู่ในคิวส่งข้อความแล้ว',
  no_chat_room: 'ไม่พบห้องแชตของลูกค้าในแบรนด์นี้',
  window_closed: 'หมดช่วงที่ร้านส่งข้อความได้ (ลูกค้าไม่ได้ทักมาเกิน 7 วัน)',
  claim_failed: 'จองลูกค้าไม่สำเร็จ',
  invalid_state: 'สถานะของรายการเปลี่ยนไปแล้ว',
  invalid_status: 'สถานะไม่ถูกต้อง',
};

/** fetch ล้ม / offline: Chrome "Failed to fetch", Firefox "NetworkError when attempting…", Safari "Load failed", Node "fetch failed" */
export const NETWORK_TEXT = 'เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
const NETWORK = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i;
// PostgREST: "JWT expired" / "invalid JWT" (PGRST301–303, HTTP 401) และ dsales_uid(): not_authenticated
const AUTH = /\bjwt\b|not_authenticated/i; // รหัส PGRST301-303 ตรวจที่ field code ใน errorKind

export function toThaiError(message: string | null | undefined): string {
  const msg = (message ?? '').trim();
  if (NETWORK.test(msg)) return NETWORK_TEXT;
  if (AUTH.test(msg)) return ERROR_TEXT.not_authenticated;
  if (/statement timeout/i.test(msg)) return ERROR_TEXT.statement_timeout; // Postgres 57014 (authenticated มี statement_timeout 8 วินาที)
  const tag = /tag_taken:\s*(.+)$/.exec(msg);
  if (tag) return `tag ${tag[1]} เป็นของเซลล์คนอื่นแล้ว`;
  for (const token of msg.match(/[a-z_]+/g) ?? []) {
    if (Object.prototype.hasOwnProperty.call(ERROR_TEXT, token)) return ERROR_TEXT[token];
  }
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ประเภทของ error ดิบ: auth = session หมดอายุ (ต้องล็อกอินใหม่), member = ไม่ใช่สมาชิก active แล้ว, network = เน็ตล้ม */
export type ErrorKind = 'auth' | 'member' | 'network' | 'other';
/** status/code จาก PostgREST (ถ้ามี) */
export interface ErrorMeta { status?: number | null; code?: string | null }
export function errorKind(message: string | null | undefined, meta: ErrorMeta = {}): ErrorKind {
  const msg = message ?? '';
  if (/\bnot_member\b/.test(msg)) return 'member';
  if (AUTH.test(msg)) return 'auth';
  // refresh token ตาย → supabase-js ส่ง anon key → HTTP 401 "permission denied for function dsales_…" (42501) เพราะ revoke จาก anon
  // (ผู้ใช้ที่ล็อกอินแล้วขาด grant ได้ 403 จึงใช้ 401 เป็นสัญญาณ auth ได้)
  if (meta.status === 401 || (meta.code != null && /^PGRST30[0-3]$/.test(meta.code))) return 'auth';
  if (NETWORK.test(msg)) return 'network';
  return 'other';
}

/** error ที่ rpc.ts โยน: message = ข้อความไทย, kind = ประเภทจากข้อความดิบของ server */
export class RpcError extends Error {
  readonly kind: ErrorKind;
  constructor(raw: string | null | undefined, meta: ErrorMeta = {}) {
    super(toThaiError(raw));
    this.name = 'RpcError';
    this.kind = errorKind(raw, meta);
  }
}

/** ข้อความของ error ที่ catch ได้ (rpc.ts โยนข้อความไทยแล้ว) สำหรับ toast — error เครือข่ายดิบ (fetch ตรง) แปลงเป็นไทย */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : e == null ? '' : String(e);
  if (NETWORK.test(msg)) return NETWORK_TEXT;
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ประเภทของ error ที่ catch ได้: RpcError ใช้ kind จากข้อความดิบ, error อื่นคำนวณจาก message */
export const kindOf = (e: unknown): ErrorKind =>
  e instanceof RpcError ? e.kind : errorKind(e instanceof Error ? e.message : e == null ? '' : String(e));
