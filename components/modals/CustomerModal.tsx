'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AI_STATUS_TEXT } from '@/lib/domain/aiStatus';
import { CallButton, ChannelRow, ContactBar } from '@/components/leads/ContactBar';
import { RoomChips, RoomIcons } from '@/components/leads/RoomIcons';
import { useLeadRooms } from '@/components/leads/useLeadRooms';
import { useJst } from '@/components/leads/useJst';
import { CloseButton } from '@/components/ui/CloseButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { mapPurchase } from '@/lib/api/map';
import { getCustomerPurchases } from '@/lib/api/rpc';
import type { Lead } from '@/lib/api/types';
import { BRAND, PATHS } from '@/lib/constants';
import { repName, total } from '@/lib/domain/leads';
import { baht, fmtDate, fmtDT } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { ChatCheckBody } from './ChatCheckBody';
import { LogModal } from './LogModal';

type Tab = 'buy' | 'talk';

export function CustomerModal({ id }: { id: string }) {
  const { leads } = useAppState();
  const l = leads.find((x) => x.id === id);
  return l ? <CustomerDetail lead={l} /> : null;
}

function CustomerDetail({ lead: l }: { lead: Lead }) {
  const { live, reps } = useAppState();
  const { openModal, patchLead, toast } = useActions();
  const openJst = useJst();
  const [tab, setTab] = useState<Tab>('buy');
  // นับทุกครั้งที่คลิกแท็บ (รวมแท็บที่ active อยู่แล้ว) = prototype เปิด popup ใหม่ทุกครั้ง (L515)
  const [tabSeq, setTabSeq] = useState(0);
  const [checks, setChecks] = useState(0);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const loading = useRef(false);

  // ล็อกอินจริง: โหลดประวัติซื้อครั้งแรกที่เปิด แล้ว popup วาดใหม่เอง (L483)
  useEffect(() => {
    if (!live || l._pl || loading.current) return;
    loading.current = true;
    patchLead(l.id, { _pl: 'loading' });
    getCustomerPurchases(l.phone).then(
      (rows) => patchLead(l.id, { purchases: (rows || []).map(mapPurchase), _pl: 'done' }),
      () => patchLead(l.id, { _pl: 'done' }),
    );
  }, [live, l.id, l.phone, l._pl, patchLead]);

  const chans = channelsOf(l);
  const leadRooms = useLeadRooms(useMemo(() => [l], [l]));
  const rooms = leadRooms.get(l.phone) ?? [];
  const who = { phone: l.phone, name: l.name, chat: l.chatName, brand: l.brand };
  const lastBuy = l.lastBuy || l.purchases[0]?.date;
  // ประวัติการติดต่อ + บันทึกจากระบบ (คืนลีดอัตโนมัติ) เรียงใหม่→เก่า
  const hist = [
    ...l.interactions.map((i) => ({ sys: false as const, i, date: i.date })),
    ...(l.systemLog ?? []).map((s) => ({ sys: true as const, s, date: s.date })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const logType = l.noCall ? 'chat' : 'call';
  const plDone = l._pl === 'done';
  // prototype สลับแท็บ / โหลดประวัติซื้อเสร็จ ด้วยการเปิด popup ใหม่ (L515, L483): popup ใหม่เริ่มบนสุด, #chk-body ยังว่าง
  // แล้วโฟกัสปุ่มแรก (#chk-refresh) ซึ่งเลื่อน popup ตามตำแหน่งปุ่มและความสูงเนื้อหาขณะนั้น → ทำใน layout effect หลังวาดแท็บใหม่
  // (ChatCheckBody ล้าง #chk-body ให้ว่างตอน blankKey เปลี่ยน) ตำแหน่งเลื่อนบนมือถือจึงเท่า prototype
  useLayoutEffect(() => {
    refreshRef.current?.closest('.modal')?.scrollTo(0, 0);
    refreshRef.current?.focus();
  }, [tabSeq, plDone]);
  const switchTab = (t: Tab) => {
    setTab(t);
    setTabSeq((n) => n + 1);
  };
  const copyPhone = () => {
    navigator.clipboard?.writeText(l.phone).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(l.phone));
  };

  return (
    <>
      <div className="modal-h">
        <h3>{l.name}</h3>
        <StatusBadge status={l.status} />
        <span className={`tag ${l.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[l.brand]}</span>
        {rooms.length ? (
          <span className="ch-bar"><CallButton phone={l.phone} /><RoomIcons who={who} rooms={rooms} openJst={openJst} /></span>
        ) : (
          <ContactBar x={l} chans={chans} openJst={openJst} />
        )}
        <CloseButton />
      </div>
      <div className="modal-b">
        <dl className="info-grid" style={{ margin: 0 }}>
          <div><dt>ชื่อ</dt><dd>{l.name}</dd></div>
          <div>
            <dt>เบอร์</dt>
            <dd className="mono">{l.phone}{' '}<button className="copy" data-copy={l.phone} onClick={copyPhone}>คัดลอก</button></dd>
          </div>
          <div className="wide"><dt>ที่อยู่</dt><dd>{l.address}</dd></div>
          <div><dt>วันที่ซื้อล่าสุด</dt><dd>{fmtDate(lastBuy)}</dd></div>
          <div><dt>ยอดซื้อรวม</dt><dd className="num">{baht(total(l))}</dd></div>
          <div><dt>ร้านค้า</dt><dd>{l.shop}</dd></div>
          <div><dt>ผู้ดูแล</dt><dd>{repName(reps, l.owner) || '—'}</dd></div>
          <div><dt>สินค้าที่สนใจ</dt><dd>{l.interest || '—'}</dd></div>
          <div><dt>เลขบิลที่ปิดได้</dt><dd className="mono">{l.closedBills.length ? l.closedBills.join(', ') : '—'}</dd></div>
          <div><dt>วันที่ปิดการขาย</dt><dd>{l.closedAt ? fmtDate(l.closedAt) : '—'}</dd></div>
          <div className="wide"><dt>ช่องทางแชต (แยกตามร้าน)</dt><dd>{rooms.length ? <RoomChips who={who} rooms={rooms} openJst={openJst} /> : <ChannelRow x={l} chans={chans} openJst={openJst} />}</dd></div>
        </dl>
        <div className="chk">
          <div className="chk-h">
            <b>การทักแชท (ตรวจจาก JST)</b>
            <button type="button" className="btn sm" id="chk-refresh" ref={refreshRef} onClick={() => setChecks((n) => n + 1)}>ตรวจอีกครั้ง</button>
          </div>
          <ChatCheckBody lead={l} blankKey={`${tabSeq}|${plDone}`} runKey={`${tabSeq}|${plDone}|${checks}`} />
        </div>
        <div className="tabs" role="tablist">
          <button className={`tab ${tab === 'buy' ? 'active' : ''}`} data-tab="buy" onClick={() => switchTab('buy')}>
            ประวัติการซื้อ ({l.purchases.length || l.orders || 0})
          </button>
          <button className={`tab ${tab === 'talk' ? 'active' : ''}`} data-tab="talk" onClick={() => switchTab('talk')}>
            ประวัติการโทร/แชต ({l.interactions.length})
          </button>
        </div>
        {tab === 'buy' ? (
          <div className="mini-table table-wrap">
            <table>
              <thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th className="r">ยอดซื้อ</th></tr></thead>
              <tbody>
                {l.purchases.map((p, i) => (
                  <tr key={`${p.bill}-${i}`}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="mono">{p.sku}</td>
                    <td>{p.product}<div className="sub">บิล {p.bill} · ขายโดย {repName(reps, p.seller) || '—'}</div></td>
                    <td className="r num">{baht(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hist.length ? (
          <ul className="timeline">
            {hist.map((h) => h.sys ? (
              <li key={h.s.id} className={h.s.kind === 'ai' ? 'tl-ai' : 'tl-system'}>
                {h.s.kind === 'ai' ? <span className="feed-ic ai">AI</span>
                  : <span className="feed-ic system"><svg viewBox="0 0 24 24"><path d={PATHS.clock} /></svg></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-head">
                    <b>{h.s.kind === 'ai' ? 'AI วิเคราะห์สถานะ' : 'ระบบ'}</b>
                    <span className="sub">{fmtDT(h.s.date)}{h.s.rep ? ' · ' + (repName(reps, h.s.rep) || '') : ''}</span>
                    {h.s.kind === 'ai' && h.s.result ? <span className="tag">{AI_STATUS_TEXT[h.s.result] ?? h.s.result}</span> : null}
                  </div>
                  <div className="tl-note">{h.s.note}</div>
                </div>
              </li>
            ) : (
              <li key={h.i.id}>
                <span className={`feed-ic ${h.i.type}`}><svg viewBox="0 0 24 24"><path d={h.i.type === 'call' ? PATHS.phone : PATHS.chat} /></svg></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-head">
                    <b>{h.i.type === 'call' ? 'โทร' : 'แชต'}</b>
                    <span className="sub">{fmtDT(h.i.date)} · {repName(reps, h.i.rep) || ''}</span>
                    <span className="tag">{h.i.result}</span>
                    {h.i.due ? <span className="tag s-callback">นัดติดต่อ {fmtDate(h.i.due)}</span> : null}
                  </div>
                  <div className="tl-note">{h.i.note}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">ยังไม่เคยติดต่อลูกค้ารายนี้</div>
        )}
      </div>
      <div className="modal-f">
        <button className="btn primary" data-log={logType} onClick={() => openModal(<LogModal id={l.id} type={logType} />, 'sm')}>
          {l.noCall ? 'บันทึกแชต' : 'บันทึก'}
        </button>
      </div>
    </>
  );
}
