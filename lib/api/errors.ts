/** ข้อความไทยของ error จาก RPC ใน schema dsales (เทียบทั้ง token จึงไม่มี key ไหนทับกัน ต่างจาก prototype ที่เทียบ substring) */
export const ERROR_TEXT: Readonly<Record<string, string>> = {
  taken: 'ลูกค้ารายนี้มีคนจองไปแล้ว',
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
};

/** fetch ล้ม / offline: Chrome "Failed to fetch", Firefox "NetworkError when attempting…", Safari "Load failed", Node "fetch failed" */
export const NETWORK_TEXT = 'เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
const NETWORK = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i;
// PostgREST: "JWT expired" / "invalid JWT" (PGRST301–303, HTTP 401) และ dsales_uid(): not_authenticated
const AUTH = /\bjwt\b|not_authenticated|PGRST30[0-3]/i;

export function toThaiError(message: string | null | undefined): string {
  const msg = (message ?? '').trim();
  if (NETWORK.test(msg)) return NETWORK_TEXT;
  if (AUTH.test(msg)) return ERROR_TEXT.not_authenticated;
  const tag = /tag_taken:\s*(.+)$/.exec(msg);
  if (tag) return `tag ${tag[1]} เป็นของเซลล์คนอื่นแล้ว`;
  for (const token of msg.match(/[a-z_]+/g) ?? []) {
    if (Object.prototype.hasOwnProperty.call(ERROR_TEXT, token)) return ERROR_TEXT[token];
  }
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ประเภทของ error ดิบ: auth = session หมดอายุ (ต้องล็อกอินใหม่), member = ไม่ใช่สมาชิก active แล้ว, network = เน็ตล้ม */
export type ErrorKind = 'auth' | 'member' | 'network' | 'other';
export function errorKind(message: string | null | undefined): ErrorKind {
  const msg = message ?? '';
  if (/\bnot_member\b/.test(msg)) return 'member';
  if (AUTH.test(msg)) return 'auth';
  if (NETWORK.test(msg)) return 'network';
  return 'other';
}

/** error ที่ rpc.ts โยน: message = ข้อความไทย, kind = ประเภทจากข้อความดิบของ server */
export class RpcError extends Error {
  readonly kind: ErrorKind;
  constructor(raw: string | null | undefined) {
    super(toThaiError(raw));
    this.name = 'RpcError';
    this.kind = errorKind(raw);
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
