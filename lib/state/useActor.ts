'use client';

import { useMemo } from 'react';
import { actorOf } from '@/lib/domain/viewAs';
import { useAppState } from './AppProvider';

/**
 * ผู้ที่กำลังทำงานอยู่: actorId = ตัวเอง หรือเซลล์ที่หัวหน้าเลือกดูแทน · forUser = ส่งเป็น p_for ให้ RPC จอง/ส่งข้อความ
 * viewName = ชื่อเซลล์ที่ดูแทน ('' = มุมมองของตัวเอง/ทั้งทีม)
 */
export function useActor(): { actorId: string; forUser: string | null; viewName: string } {
  const { meId, viewAs, reps } = useAppState();
  return useMemo(() => ({ ...actorOf(meId, viewAs), viewName: viewAs ? (reps.find((r) => r.id === viewAs)?.name ?? '') : '' }), [meId, viewAs, reps]);
}
