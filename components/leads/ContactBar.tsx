'use client';

import { ChIcon } from '@/components/ui/ChIcon';
import { PATHS } from '@/lib/constants';
import { chatAria, chatTitle, jstTarget, platLabel, type JstSource, type NormChannel } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';
import { useJst } from './useJst';

/** ปุ่มโทร: เปิดแอปโทร (tel:) พร้อมคัดลอกเบอร์ เผื่อเครื่องคอมไม่มีแอปโทร */
export function CallButton({ phone }: { phone: string }) {
  const { toast } = useActions();
  return (
    <a
      className="ch-btn call"
      href={`tel:${phone}`}
      data-call={phone}
      title={`โทร ${phone}`}
      aria-label={`โทร ${phone}`}
      onClick={() => {
        navigator.clipboard?.writeText(phone).catch(() => {});
        toast(`โทร ${phone} · คัดลอกเบอร์แล้ว`);
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={PATHS.phone} /></svg>
    </a>
  );
}

function ChatButton({ x, c, size }: { x: JstSource; c: NormChannel; size: number }) {
  const openJst = useJst();
  return (
    <button type="button" className="ch-btn" data-act="jst" data-t={JSON.stringify(jstTarget(x, c))} title={chatTitle(c)} aria-label={chatAria(c)} onClick={() => openJst(jstTarget(x, c))}>
      <ChIcon p={c.platform} size={size} />
    </button>
  );
}

/** ปุ่มโทร + ปุ่มแชต: ในตาราง (mini) 4 ช่องทาง 16px, ใน popup 8 ช่องทาง 22px */
export function ContactBar({ x, chans, mini = false }: { x: JstSource; chans: NormChannel[]; mini?: boolean }) {
  return (
    <span className={`ch-bar ${mini ? 'mini' : ''}`}>
      <CallButton phone={x.phone} />
      {chans.slice(0, mini ? 4 : 8).map((c, i) => (
        <ChatButton key={`${c.shop}-${i}`} x={x} c={c} size={mini ? 16 : 22} />
      ))}
    </span>
  );
}

/** ช่องทางแชต (แยกตามร้าน) ใน popup รายละเอียดลูกค้า */
export function ChannelRow({ x, chans }: { x: JstSource; chans: NormChannel[] }) {
  const openJst = useJst();
  if (!chans.length) return <span className="sub">ไม่พบช่องทางแชต</span>;
  return (
    <div className="ch-chips">
      {chans.map((c, i) => (
        <button key={`${c.shop}-${i}`} type="button" className="ch-chip" data-act="jst" data-t={JSON.stringify(jstTarget(x, c))} title="เปิดแชตใน JST" onClick={() => openJst(jstTarget(x, c))}>
          <ChIcon p={c.platform} size={18} />
          <span>{c.shop || platLabel(c.platform)}</span>
        </button>
      ))}
    </div>
  );
}
