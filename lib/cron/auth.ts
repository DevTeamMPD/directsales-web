import { timingSafeEqual } from 'node:crypto';

/** header `Authorization: Bearer <secret>` ตรงกับ secret หรือไม่ (เทียบแบบเวลาคงที่) · ไม่มี secret = ปฏิเสธเสมอ */
export function bearerMatches(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const m = /^Bearer (.+)$/.exec(header ?? '');
  if (!m) return false;
  const got = Buffer.from(m[1]);
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}
