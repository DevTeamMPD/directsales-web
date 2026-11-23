'use client';

import type { OpenJst } from '@/components/leads/ContactBar';
import { ChIcon } from '@/components/ui/ChIcon';
import type { ChatRoom } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { roomOpensMeta, roomSearchName, roomTitle } from '@/lib/domain/baseFilters';
import { browserJstDeps, jstTarget, metaOpen, platLabel, type JstTarget } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';

/** เจ้าของห้อง: ลูกค้า (เบอร์/ชื่อ/ชื่อแชตของลูกค้า/แบรนด์เริ่มต้นเมื่อห้องไม่มีแบรนด์) */
export interface RoomOwner { phone: string; name: string; chat: string; brand: Brand }

/** เป้าหมายเปิดแชต JST ของห้อง — คำค้น = ชื่อของห้องนั้น → ชื่อแชตลูกค้า → ชื่อลูกค้า */
export const roomTarget = (who: RoomOwner, room: ChatRoom): JstTarget =>
  jstTarget(
    { phone: who.phone, name: who.name, brand: room.brand ?? who.brand, chatName: who.chat },
    { shop: room.page, chat: roomSearchName(room, who), platform: room.provider, ms_id: room.msId },
  );

/** FB/IG เกิน 24 ชม. ที่รู้ page id → Inbox ของเพจใน Meta */
const opensMeta = (room: ChatRoom): boolean => Boolean(roomOpensMeta(room) && room.metaInbox);

/** กดห้อง: FB/IG เกิน 24 ชม. ที่รู้ page id → Inbox ของเพจใน Meta (คัดลอกชื่อห้อง) · ห้องอื่น → แชตใน JST */
function useOpenRoom(openJst: OpenJst): (who: RoomOwner, room: ChatRoom) => void {
  const { toast } = useActions();
  return (who, room) => {
    const t = roomTarget(who, room);
    if (roomOpensMeta(room) && room.metaInbox) void metaOpen(room.metaInbox, t.chat, room.page, browserJstDeps(toast));
    else openJst(t);
  };
}

function roomProps(who: RoomOwner, room: ChatRoom) {
  const meta = opensMeta(room);
  return {
    'data-act': meta ? 'meta' : 'jst',
    'data-room': room.msId,
    'data-sendable': room.sendable ? '1' : '0',
    'data-t': JSON.stringify(roomTarget(who, room)),
    title: roomTitle(room),
    'aria-label': meta ? `เปิด Inbox เพจ ${room.page} ใน Meta Business Suite` : `เปิดแชต ${platLabel(room.provider)} ${room.page} ใน JST`,
    style: room.sendable ? undefined : { opacity: 0.4 },
  };
}

/** ไอคอนห้องรายห้อง 16px (ในตาราง) — ห้องที่ worker ส่งไม่ได้แสดงจาง */
export function RoomIcons({ who, rooms, openJst }: { who: RoomOwner; rooms: ReadonlyArray<ChatRoom>; openJst: OpenJst }) {
  const open = useOpenRoom(openJst);
  return (
    <>
      {rooms.map((room) => (
        <button key={room.msId} type="button" className="ch-btn" {...roomProps(who, room)} onClick={() => open(who, room)}>
          <ChIcon p={room.provider} size={16} />
        </button>
      ))}
    </>
  );
}

/** ชิปห้องรายห้อง (ใน popup ลูกค้า): ไอคอน + เพจ + ชื่อห้อง */
export function RoomChips({ who, rooms, openJst }: { who: RoomOwner; rooms: ReadonlyArray<ChatRoom>; openJst: OpenJst }) {
  const open = useOpenRoom(openJst);
  if (!rooms.length) return <span className="sub">ไม่พบช่องทางแชต</span>;
  return (
    <div className="ch-chips">
      {rooms.map((room) => (
        <button key={room.msId} type="button" className="ch-chip" {...roomProps(who, room)} onClick={() => open(who, room)}>
          <ChIcon p={room.provider} size={18} />
          <span>{room.page || platLabel(room.provider)}{room.name ? ` · ${room.name}` : ''}</span>
        </button>
      ))}
    </div>
  );
}
