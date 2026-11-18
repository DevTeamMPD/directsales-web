'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
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
  const [tab, setTab] = useState<Tab>('buy');
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
  const lastBuy = l.lastBuy || l.purchases[0]?.date;
  const hist = [...l.interactions].sort((a, b) => b.date.localeCompare(a.date));
  const logType = l.noCall ? 'chat' : 'call';
  const plDone = l._pl === 'done';
  // prototype สลับแท็บ / โหลดประวัติซื้อเสร็จ ด้วยการเปิด popup ใหม่ (L515, L483): popup ใหม่เริ่มบนสุด, #chk-body ยังว่าง
  // แล้วโฟกัสปุ่มแรก (#chk-refresh) ซึ่งเลื่อน popup ตามตำแหน่งปุ่มและความสูงเนื้อหาขณะนั้น → ทำใน layout effect หลังวาดแท็บใหม่
  // (ChatCheckBody ล้าง #chk-body ให้ว่างตอน blankKey เปลี่ยน) ตำแหน่งเลื่อนบนมือถือจึงเท่า prototype
  useLayoutEffect(() => {
    refreshRef.current?.closest('.modal')?.scrollTo(0, 0);
    refreshRef.current?.focus();
  }, [tab, plDone]);
  const switchTab = (t: Tab) => setTab(t);
  const copyPhone = () => {
    navigator.clipboard?.writeText(l.phone).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(l.phone));
  };

  return (
    <>
      <div className="modal-h">
        <h3>{l.name}</h3>
        <StatusBadge status={l.status} />
        <span className={`tag ${l.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[l.brand]}</span>
        <ContactBar x={l} chans={chans} />
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
          <div className="wide"><dt>ช่องทางแชต (แยกตามร้าน)</dt><dd><ChannelRow x={l} chans={chans} /></dd></div>
        </dl>
        <div className="chk">
          <div className="chk-h">
            <b>การทักแชท (ตรวจจาก JST)</b>
            <button type="button" className="btn sm" id="chk-refresh" ref={refreshRef} onClick={() => setChecks((n) => n + 1)}>ตรวจอีกครั้ง</button>
          </div>
          <ChatCheckBody lead={l} blankKey={`${tab}|${plDone}`} runKey={`${tab}|${plDone}|${checks}`} />
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
            {hist.map((i) => (
              <li key={i.id}>
                <span className={`feed-ic ${i.type}`}><svg viewBox="0 0 24 24"><path d={i.type === 'call' ? PATHS.phone : PATHS.chat} /></svg></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-head">
                    <b>{i.type === 'call' ? 'โทร' : 'แชต'}</b>
                    <span className="sub">{fmtDT(i.date)} · {repName(reps, i.rep) || ''}</span>
                    <span className="tag">{i.result}</span>
                    {i.due ? <span className="tag s-callback">นัดติดต่อ {fmtDate(i.due)}</span> : null}
                  </div>
                  <div className="tl-note">{i.note}</div>
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
