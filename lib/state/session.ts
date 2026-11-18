/**
 * ตัดสินผลตรวจ session ตอนเปิดแอป (CLAUDE.md งานค้างแผน B)
 * redirect ไป /login เฉพาะเมื่อไม่มี session จริง — ถ้าเน็ตล้มแล้ว redirect จะวนกับ middleware (มี session → ส่งกลับ /leads)
 * จึงให้แสดงการ์ด "โหลดข้อมูลจาก Supabase ไม่สำเร็จ" ที่มีปุ่มลองใหม่/ออกจากระบบแทน
 */
export interface AuthErrorLike { name?: string; message: string; status?: number }

export interface SessionProbe {
  hasSession: boolean;
  sessionError: AuthErrorLike | null;
  user: { id: string; email?: string | null } | null;
  userError: AuthErrorLike | null;
}

export type SessionCheck = { kind: 'user'; email: string } | { kind: 'login' } | { kind: 'error'; message: string };

const SESSION_MISSING = 'AuthSessionMissingError';

export function classifySession(p: SessionProbe): SessionCheck {
  if (p.user) return { kind: 'user', email: p.user.email ?? '' };
  const err = p.sessionError ?? p.userError;
  if (!err) return p.hasSession ? { kind: 'error', message: 'ไม่พบข้อมูลผู้ใช้' } : { kind: 'login' };
  if (err.name === SESSION_MISSING) return { kind: 'login' };
  return { kind: 'error', message: err.message || 'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ' };
}
