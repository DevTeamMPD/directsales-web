'use client';

import { useEffect, useRef, useState } from 'react';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, runVerify, shouldStartVerify, verifyTodo, type ChatCheckResult } from '@/lib/jst';
import type { Lead } from '@/lib/api/types';
import { useActions, useAppState } from '@/lib/state/AppProvider';

// ระดับโมดูล (เหมือนตัวแปร verifying ของ prototype): กันรันซ้อนแม้ออกแล้วกลับเข้าหน้า /leads
let verifying = false;
let lastRunAt = 0;
let lastKey = '';

/**
 * ล็อกอินจริงเท่านั้น: ตรวจลีดของฉันที่จองแล้วแต่ยังไม่พบว่าทักแชท (≤10 ราย ทีละราย)
 * ต่างจาก prototype (ตรวจทุกครั้งที่วาดหน้า รวมทุกตัวอักษรที่พิมพ์ค้นหา): ตรวจเมื่อเข้าหน้าหรือเมื่อชุดลีดที่ต้องตรวจเปลี่ยน
 * ชุดเดิมไม่ตรวจถี่กว่า VERIFY_MIN_INTERVAL_MS; ชุดที่เปลี่ยนรันทันที (ถ้ากำลังรันอยู่ รอรอบนั้นจบแล้วรันต่อ)
 * หยุดตรวจรายถัดไปเฉพาะเมื่อออกจากหน้า (unmount) — เปลี่ยนชุดลีดกลางรอบไม่ยกเลิก
 * วาดตารางใหม่ (patchLead) เฉพาะรายที่เปลี่ยนเป็น "ทักแชทแล้ว"
 */
export function useVerifyMine(): void {
  const { live, leads, meId, today } = useAppState();
  const { patchLead } = useActions();
  const [tick, setTick] = useState(0);
  // true ระหว่างที่ mount อยู่ (StrictMode: mount → unmount → mount ตั้งกลับเป็น true เสมอ)
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const todo = live ? verifyTodo(leads, meId) : [];
  const key = todo.map((l) => l.id).join(',');

  useEffect(() => {
    const now = Date.now();
    if (!shouldStartVerify({ live, key, lastKey, lastRunAt, now, verifying })) return;
    verifying = true;
    lastKey = key;
    lastRunAt = now;
    const check = (l: Lead): Promise<ChatCheckResult> =>
      mounted.current ? chatCheckFor(l) : Promise.resolve({ err: 'cancelled' });
    void (async () => {
      let changed: Awaited<ReturnType<typeof runVerify>> = [];
      try {
        changed = await runVerify(verifyTodo(leads, meId), check, () => nowStamp(new Date(), today));
      } finally {
        verifying = false;
      }
      changed.forEach((c) => patchLead(c.id, { chatCheck: c.chatCheck }));
      // ชุดลีดอาจเปลี่ยนระหว่างรอบ (effect ตอนนั้นข้ามเพราะ verifying) → ประเมินใหม่
      if (mounted.current) setTick((t) => t + 1);
    })();
    // key แทน leads/ui: เปลี่ยนตัวกรอง/พิมพ์ค้นหาไม่ทำให้ตรวจใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key, meId, today, patchLead, tick]);
}
