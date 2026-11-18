'use client';

import { useEffect, useRef } from 'react';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, runVerify, verifyTodo } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ล็อกอินจริงเท่านั้น: ตรวจลีดของฉันที่จองแล้วแต่ยังไม่พบว่าทักแชท (≤10 ราย ทีละราย กันรันซ้อน)
 * วาดตารางใหม่ (patchLead) เฉพาะรายที่เปลี่ยนเป็น "ทักแชทแล้ว" — รอบถัดไปจึงไม่ตรวจรายนั้นซ้ำ
 */
export function useVerifyMine(): void {
  const { live, leads, meId, today, ui } = useAppState();
  const { patchLead } = useActions();
  const running = useRef(false);

  useEffect(() => {
    if (!live || running.current) return;
    const todo = verifyTodo(leads, meId);
    if (!todo.length) return;
    running.current = true;
    void (async () => {
      let changed: Awaited<ReturnType<typeof runVerify>> = [];
      try {
        changed = await runVerify(todo, chatCheckFor, () => nowStamp(new Date(), today));
      } finally {
        running.current = false;
      }
      changed.forEach((c) => patchLead(c.id, { chatCheck: c.chatCheck }));
    })();
    // ui อยู่ใน deps เพื่อให้ตรวจทุกครั้งที่หน้าวาดใหม่เพราะตัวกรองเปลี่ยน (prototype เรียก verifyMine ทุก draw)
  }, [live, leads, meId, today, ui, patchLead]);
}
