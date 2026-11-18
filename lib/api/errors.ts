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

export function toThaiError(message: string | null | undefined): string {
  const msg = (message ?? '').trim();
  const tag = /tag_taken:\s*(.+)$/.exec(msg);
  if (tag) return `tag ${tag[1]} เป็นของเซลล์คนอื่นแล้ว`;
  for (const token of msg.match(/[a-z_]+/g) ?? []) {
    if (Object.prototype.hasOwnProperty.call(ERROR_TEXT, token)) return ERROR_TEXT[token];
  }
  return msg || 'ทำรายการไม่สำเร็จ';
}

/** ข้อความของ error ที่ catch ได้ (rpc.ts โยน Error ข้อความไทยแล้ว) สำหรับ toast */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : e == null ? '' : String(e);
  return msg || 'ทำรายการไม่สำเร็จ';
}
