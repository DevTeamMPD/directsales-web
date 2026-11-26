import type { Lead, Rep } from '@/lib/api/types';
import { canUnclaim } from './leads';

/**
 * โหมดหัวหน้า "ดูในมุมมองเซลล์" (20261125150000): หัวหน้าเลือกเซลล์ 1 คน → ทุกหน้าแสดงงานของเซลล์คนนั้น
 * และการจอง / ส่งข้อความ ทำในนามเซลล์ (RPC p_for) · บันทึก/ปิดการขายบนลีดของเซลล์ นับผลงานให้เจ้าของลีดเสมอ (dsales_log)
 */
export const VIEW_AS_STORAGE_KEY = 'dsales.viewAs';
interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function readStoredViewAs(s: KV | undefined): string | null {
  try {
    return s?.getItem(VIEW_AS_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}
export function writeStoredViewAs(s: KV | undefined, id: string | null): void {
  try {
    s?.setItem(VIEW_AS_STORAGE_KEY, id ?? '');
  } catch {
    /* เขียนไม่ได้ (โหมดส่วนตัว) — ใช้ได้เฉพาะรอบนี้ */
  }
}

/** ใช้ได้เฉพาะหัวหน้า และต้องเป็นสมาชิก active คนอื่น (ไม่ใช่ตัวเอง) ไม่งั้น = มุมมองทั้งทีม (null) */
export function effectiveViewAs(id: string | null, isAdmin: boolean, reps: ReadonlyArray<Pick<Rep, 'id' | 'active'>>, meId: string): string | null {
  if (!id || !isAdmin || id === meId) return null;
  const r = reps.find((x) => x.id === id);
  return r && r.active !== false ? id : null;
}

export const viewAsOptions = (reps: ReadonlyArray<Rep>, meId: string): Array<{ value: string; label: string }> =>
  reps.filter((r) => r.id !== meId && r.active !== false).map((r) => ({ value: r.id, label: r.name }));

/** actorId = เจ้าของงานที่กำลังดู (ตัวเอง หรือเซลล์ที่เลือก) · forUser = ส่งเป็น p_for ให้ RPC (null = ทำในนามตัวเอง) */
export const actorOf = (meId: string, viewAs: string | null): { actorId: string; forUser: string | null } =>
  ({ actorId: viewAs ?? meId, forUser: viewAs });

/** ปุ่มยกเลิกจอง: เซลล์ = เฉพาะที่จองเอง (canUnclaim) · หัวหน้า = ลีดที่มีเจ้าของ ยังไม่ปิดการขาย และไม่ใช่ห้ามโทร (DB อนุญาตอยู่แล้ว) */
export function canUnclaimAs(l: Pick<Lead, 'owner' | 'claimedBy' | 'noCall' | 'status'>, meId: string, isAdmin: boolean): boolean {
  if (isAdmin) return !!l.owner && !l.noCall && l.status !== 'won';
  return canUnclaim(l, meId);
}
