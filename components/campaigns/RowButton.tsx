'use client';

import type { RowAction } from '@/lib/domain/pool';

/** ปุ่มท้ายแถวของถังลูกค้า / ลูกค้าของฉัน / ถังกลาง (poolAction L694-704) */
export function RowButton({ a, rowId, onClaim, onUnclaim }: { a: RowAction; rowId: string; onClaim: () => void; onUnclaim: (leadId: string) => void }) {
  if (a.kind === 'claim') return <button className="btn sm outline" data-pool-claim={rowId} onClick={onClaim}>{a.text}</button>;
  if (a.kind === 'unclaim') {
    const leadId = a.leadId;
    return <button className="btn sm danger" data-act="unclaim" data-id={leadId} onClick={() => onUnclaim(leadId)}>{a.text}</button>;
  }
  return <button className="btn sm" disabled>{a.text}</button>;
}
