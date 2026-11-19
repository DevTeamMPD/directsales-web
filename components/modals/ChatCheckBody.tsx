'use client';

import { useEffect, useRef, useState } from 'react';
import { ChIcon } from '@/components/ui/ChIcon';
import type { ChatCheck, Lead } from '@/lib/api/types';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, chatCheckView, localChatCheck, nextChatCheck, type ChatCheckView } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * เนื้อหา #chk-body: ตรวจใหม่ทุกครั้งที่ runKey เปลี่ยน (prototype ตรวจใหม่ทุกครั้งที่วาด popup: เปิด, สลับแท็บ, ประวัติซื้อโหลดเสร็จ, กดตรวจอีกครั้ง)
 * ผลตรวจเก็บไว้ใน ref แล้ว patchLead ตอน popup ปิด เฉพาะเมื่อ "ทักแชทแล้ว" เปลี่ยน = ui.dirtyRows (ตารางวาดใหม่ตอนปิด popup)
 * blankKey เปลี่ยน (= prototype เปิด popup ใหม่) → วาด #chk-body ว่างก่อน แล้วค่อย "กำลังตรวจ…" ใน effect เหมือน openModal → renderChatCheck
 */
export function ChatCheckBody({ lead, runKey, blankKey }: { lead: Lead; runKey: string; blankKey: string }) {
  const { live, reps, today } = useAppState();
  const { patchLead } = useActions();
  // undefined = ว่าง (popup เพิ่งวาด), null = กำลังตรวจ
  const [view, setView] = useState<ChatCheckView | null | undefined>(undefined);
  const [blank, setBlank] = useState(blankKey);
  if (blank !== blankKey) {
    setBlank(blankKey);
    setView(undefined);
  }
  const box = useRef<{ dirty: boolean; pending: ChatCheck | null }>({ dirty: false, pending: null });

  useEffect(() => {
    let alive = true;
    setView(null);
    const run = live ? chatCheckFor(lead) : Promise.resolve(localChatCheck(lead, reps));
    void run.then((res) => {
      if (!alive) return;
      const b = box.current;
      const next = nextChatCheck(b.pending ?? lead.chatCheck, res, nowStamp(new Date(), today));
      if (next) {
        b.pending = next.chatCheck;
        if (next.dirty) b.dirty = true;
      }
      setView(chatCheckView(res, lead.claimedAt));
    });
    return () => {
      alive = false;
    };
    // ตรวจตาม runKey เท่านั้น (ไม่ตรวจซ้ำทุกครั้งที่ลีดใน state เปลี่ยน)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    const b = box.current;
    const id = lead.id;
    return () => {
      if (b.dirty && b.pending) patchLead(id, { chatCheck: b.pending });
    };
  }, [lead.id, patchLead]);

  return (
    <div id="chk-body">
      {view ? (
        <>
          <span className={`badge ${view.badge.cls}`}>{view.badge.text}</span>{' '}
          <span>{view.detail}</span>
          {view.sessions.length ? (
            <ul className="chk-list">
              {view.sessions.map((s) => (
                <li key={s.key}>
                  <ChIcon p={s.icon} size={16} /> <b>{s.page}</b> <span className="sub">{s.meta}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : view === null ? (
        <span className="sub">กำลังตรวจจาก JST…</span>
      ) : null}
    </div>
  );
}
