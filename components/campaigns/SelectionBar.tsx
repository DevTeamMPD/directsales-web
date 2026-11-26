'use client';

import type { ReactNode } from 'react';
import { selectionBar } from '@/lib/domain/outreach';

/** แถบลอยด้านล่าง "เลือก N คน" + ล้าง + ปุ่มเพิ่ม (extra) + ส่งข้อความ — ซ่อนเมื่อไม่ได้เลือก (id เดิมของ /mine: #sel-bar #sel-clear #sel-send) */
export function SelectionBar({ count, max, onClear, onSend, extra }: {
  count: number; max: number; onClear: () => void; onSend: () => void; extra?: ReactNode;
}) {
  if (!count) return null;
  const bar = selectionBar(count, max);
  return (
    <div className="panel" id="sel-bar" style={{ position: 'sticky', bottom: 12, zIndex: 4, boxShadow: 'var(--shadow)' }}>
      <div className="panel-b toolbar">
        <b className="num">{bar.text}</b>
        {bar.over ? <span className="sub" style={{ color: 'var(--bad)' }}>{bar.over}</span> : <span className="sub">สูงสุด {max} คนต่อชุด</span>}
        <span style={{ flex: 1 }} />
        <button className="btn" id="sel-clear" onClick={onClear}>ล้าง</button>
        {extra}
        <button className="btn primary" id="sel-send" disabled={!bar.canSend} onClick={onSend}>{bar.text} · ส่งข้อความ</button>
      </div>
    </div>
  );
}
