'use client';

import { useEffect } from 'react';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, runVerify, verifyTodo, type ChatCheckResult } from '@/lib/jst';
import type { Lead } from '@/lib/api/types';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** เว้นระยะขั้นต่ำระหว่างรอบตรวจ (กันยิง RPC ถี่บนฐานข้อมูล production ที่ใช้ร่วมกับระบบอื่น) */
export const VERIFY_MIN_INTERVAL_MS = 30_000;

// ระดับโมดูล (เหมือนตัวแปร verifying ของ prototype): กันรันซ้อนแม้ออกแล้วกลับเข้าหน้า /leads
let verifying = false;
let lastRunAt = 0;
let lastKey = '';

/**
 * ล็อกอินจริงเท่านั้น: ตรวจลีดของฉันที่จองแล้วแต่ยังไม่พบว่าทักแชท (≤10 ราย ทีละราย)
 * ต่างจาก prototype (ตรวจทุกครั้งที่วาดหน้า รวมทุกตัวอักษรที่พิมพ์ค้นหา): ตรวจเมื่อเข้าหน้าหรือเมื่อชุดลีดที่ต้องตรวจเปลี่ยน
 * และไม่ถี่กว่า VERIFY_MIN_INTERVAL_MS — หยุดตรวจรายถัดไปเมื่อออกจากหน้า
 * วาดตารางใหม่ (patchLead) เฉพาะรายที่เปลี่ยนเป็น "ทักแชทแล้ว"
 */
export function useVerifyMine(): void {
  const { live, leads, meId, today } = useAppState();
  const { patchLead } = useActions();
  const todo = live ? verifyTodo(leads, meId) : [];
  const key = todo.map((l) => l.id).join(',');

  useEffect(() => {
    if (!live || !key || verifying) return;
    const now = Date.now();
    if (key === lastKey && now - lastRunAt < VERIFY_MIN_INTERVAL_MS) return;
    let cancelled = false;
    verifying = true;
    lastKey = key;
    lastRunAt = now;
    const check = (l: Lead): Promise<ChatCheckResult> =>
      cancelled ? Promise.resolve({ err: 'cancelled' }) : chatCheckFor(l);
    void (async () => {
      let changed: Awaited<ReturnType<typeof runVerify>> = [];
      try {
        changed = await runVerify(verifyTodo(leads, meId), check, () => nowStamp(new Date(), today));
      } finally {
        verifying = false;
      }
      changed.forEach((c) => patchLead(c.id, { chatCheck: c.chatCheck }));
    })();
    return () => { cancelled = true; };
    // key แทน leads/ui: เปลี่ยนตัวกรอง/พิมพ์ค้นหาไม่ทำให้ตรวจใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key, meId, today, patchLead]);
}
