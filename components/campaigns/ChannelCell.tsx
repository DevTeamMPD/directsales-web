'use client';

import { CallButton, type OpenJst } from '@/components/leads/ContactBar';
import { ChIcon } from '@/components/ui/ChIcon';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { roomOpensMeta, roomSearchName, roomTitle } from '@/lib/domain/baseFilters';
import { browserJstDeps, jstTarget, metaOpen, platLabel } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';

/** ปุ่มโทร + ไอคอนห้องแชตของลูกค้า (chat_rooms) — ห้องที่ worker ส่งไม่ได้แสดงจาง แต่ยังกดเปิดแชตใน JST ได้ · กดแล้วคัดลอกชื่อของห้องนั้น */
export function ChannelCell({ r, brand, openJst }: { r: PoolRow; brand: Brand; openJst: OpenJst }) {
  const { toast } = useActions();
  return (
    <span className="ch-bar mini ch-cell">
      <CallButton phone={r.phone} />
      {r.chatRooms.map((room) => {
        const t = jstTarget(
          { phone: r.phone, name: r.name, brand: room.brand ?? brand, chatName: r.chat },
          { shop: room.page, chat: roomSearchName(room, r), platform: room.provider, ms_id: room.msId },
        );
        // FB/IG เกิน 24 ชม. ส่งผ่าน JST ไม่ได้ → เปิด Inbox ของเพจแบรนด์ใน Meta Business Suite (ถ้ารู้ page id)
        const meta = roomOpensMeta(room) ? room.metaInbox : undefined;
        return (
          <button
            key={room.msId} type="button" className="ch-btn" data-act={meta ? 'meta' : 'jst'} data-room={room.msId} data-sendable={room.sendable ? '1' : '0'}
            data-t={JSON.stringify(t)} title={roomTitle(room)}
            aria-label={meta ? `เปิด Inbox เพจ ${room.page} ใน Meta Business Suite` : `เปิดแชต ${platLabel(room.provider)} ${room.page} ใน JST`}
            style={room.sendable ? undefined : { opacity: 0.4 }}
            onClick={() => (meta ? void metaOpen(meta, t.chat, room.page, browserJstDeps(toast)) : openJst(t))}
          >
            <ChIcon p={room.provider} size={16} />
          </button>
        );
      })}
    </span>
  );
}
