'use client';

import { CallButton, type OpenJst } from '@/components/leads/ContactBar';
import { RoomIcons } from '@/components/leads/RoomIcons';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';

/** ปุ่มโทร + ไอคอนห้องแชตของลูกค้า (chat_rooms) — กดแล้วคัดลอกชื่อห้อง + เปิด JST หรือ Meta Inbox (RoomIcons) */
export function ChannelCell({ r, brand, openJst }: { r: PoolRow; brand: Brand; openJst: OpenJst }) {
  return (
    <span className="ch-bar mini ch-cell">
      <CallButton phone={r.phone} />
      <RoomIcons who={{ phone: r.phone, name: r.name, chat: r.chat, brand }} rooms={r.chatRooms} openJst={openJst} />
    </span>
  );
}
