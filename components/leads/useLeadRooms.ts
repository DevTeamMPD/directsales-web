'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mapChatRoom } from '@/lib/api/map';
import { getRoomsForPhones } from '@/lib/api/rpc';
import type { ChatRoom, Lead } from '@/lib/api/types';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ห้องแชตของลีด (dsales_rooms_for_phones) — เฉพาะลีดที่มีเจ้าของ: ของฉัน (หัวหน้า: ทุกคน) ตรงกับสิทธิ์ของ RPC
 * เก็บไว้ข้ามการกรอง/ค้นหา โหลดเฉพาะเบอร์ที่ยังไม่เคยขอ · โหลดไม่สำเร็จ = toast ครั้งเดียว แล้วใช้ช่องทางแบบเดิม (map ว่าง)
 * โหมด fixture: ไม่โหลด (คืน map ว่าง → ตารางใช้ ContactBar แบบเดิม)
 */
export function useLeadRooms(leads: ReadonlyArray<Pick<Lead, 'phone' | 'owner'>>): ReadonlyMap<string, ChatRoom[]> {
  const { live, meId, isAdmin } = useAppState();
  const { toast, handleAuthError } = useActions();
  const [rooms, setRooms] = useState<ReadonlyMap<string, ChatRoom[]>>(() => new Map());
  const asked = useRef(new Set<string>());
  const warned = useRef(false);
  const want = useMemo(
    () => leads.filter((l) => l.owner && (isAdmin || l.owner === meId)).map((l) => l.phone),
    [leads, isAdmin, meId],
  );

  useEffect(() => {
    if (!live) return;
    const missing = want.filter((p) => !asked.current.has(p));
    if (!missing.length) return;
    for (const p of missing) asked.current.add(p);
    getRoomsForPhones(missing).then(
      (rows) => {
        setRooms((prev) => {
          const next = new Map(prev);
          for (const p of missing) next.set(p, []);
          for (const r of rows) next.set(r.phone, (r.rooms ?? []).map(mapChatRoom));
          return next;
        });
      },
      (e: unknown) => {
        for (const p of missing) asked.current.delete(p);
        if (handleAuthError(e) || warned.current) return;
        warned.current = true;
        toast('โหลดห้องแชตไม่สำเร็จ ใช้ช่องทางแชตแบบเดิมไปก่อน');
      },
    );
  }, [live, want, toast, handleAuthError]);

  return rooms;
}
