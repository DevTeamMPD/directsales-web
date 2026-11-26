import { createHash, timingSafeEqual } from 'node:crypto';

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/** header `Authorization: Bearer <secret>` ตรงกับ secret หรือไม่ (เทียบ SHA-256 ของทั้งสองฝั่งแบบเวลาคงที่ ไม่เปิดเผยความยาว) · ไม่มี secret = ปฏิเสธเสมอ */
export function bearerMatches(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const m = /^Bearer (.+)$/.exec(header ?? '');
  if (!m) return false;
  return timingSafeEqual(sha256(m[1]), sha256(secret));
}
