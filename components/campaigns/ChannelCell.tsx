'use client';

import { CallButton, type OpenJst } from '@/components/leads/ContactBar';
import { ChIcon } from '@/components/ui/ChIcon';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { roomTitle } from '@/lib/domain/baseFilters';
import { jstTarget, platLabel } from '@/lib/jst';

/** ปุ่มโทร + ไอคอนห้องแชตของลูกค้า (chat_rooms) — ห้องที่ worker ส่งไม่ได้แสดงจาง แต่ยังกดเปิดแชตใน JST ได้ */
export function ChannelCell({ r, brand, openJst }: { r: PoolRow; brand: Brand; openJst: OpenJst }) {
  return (
    <span className="ch-bar mini" style={{ margin: 0, width: 116 }}>
      <CallButton phone={r.phone} />
      {r.chatRooms.map((room) => {
        const t = jstTarget(
          { phone: r.phone, name: r.name, brand: room.brand ?? brand, chatName: r.chat },
          { shop: room.page, chat: r.chat || r.name, platform: room.provider, ms_id: room.msId },
        );
        return (
          <button
            key={room.msId} type="button" className="ch-btn" data-act="jst" data-room={room.msId} data-sendable={room.sendable ? '1' : '0'}
            data-t={JSON.stringify(t)} title={roomTitle(room)} aria-label={`เปิดแชต ${platLabel(room.provider)} ${room.page} ใน JST`}
            style={room.sendable ? undefined : { opacity: 0.4 }} onClick={() => openJst(t)}
          >
            <ChIcon p={room.provider} size={16} />
          </button>
        );
      })}
    </span>
  );
}
