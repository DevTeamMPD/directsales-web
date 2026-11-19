'use client';

import { useEffect, useState } from 'react';
import { BrandTags } from '@/components/campaigns/BrandTags';
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
import { useJst } from '@/components/leads/useJst';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { CloseButton } from '@/components/ui/CloseButton';
import { mapChannel } from '@/lib/api/map';
import { getCustomerChannels, getCustomerPurchases } from '@/lib/api/rpc';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { repName } from '@/lib/domain/leads';
import { takenBadge, type RowAction } from '@/lib/domain/pool';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf, type NormChannel } from '@/lib/jst';
import { useActions, useAppState, useModalSeq } from '@/lib/state/AppProvider';

interface Line { date: string | null; bill: string; sku: string; product: string; amount: number | null; seller: string }

/**
 * popup E รายละเอียดลูกค้าในถัง (poolDetail L719-753)
 * ล็อกอินจริง: แสดงทันที ("กำลังโหลดประวัติการซื้อ…") แล้วดึง dsales_customer_purchases + dsales_customer_channels (LINE ก่อน) แล้ววาดใหม่ครั้งเดียว
 * โหมด fixture: ประวัติซื้อ/ช่องทาง/ที่อยู่จากลูกค้าตัวอย่าง (ขายโดย = ชื่อเซลล์)
 * footer คำนวณโดยผู้เปิด (ถังลูกค้า: poolDetailFooter, /mine /pool: baseAction)
 */
export function PoolDetailModal({ row: r, footer, onClaim }: { row: PoolRow; footer: RowAction | null; onClaim: (seq: number | undefined) => void }) {
  const { live, customers, reps, isAdmin } = useAppState();
  const { toast, handleAuthError } = useActions();
  const openJst = useJst();
  const act = useLeadActions();
  const seq = useModalSeq();
  const cu = live ? undefined : customers.find((c) => c.id === r.id);
  const [detail, setDetail] = useState<{ lines: Line[] | null; err: string; chans: NormChannel[] }>(() => ({
    lines: cu ? cu.purchases.map((p) => ({ ...p, seller: repName(reps, p.seller) || '' })) : null,
    err: '',
    chans: cu ? channelsOf(cu) : channelsOf({ channels: r.chat ? [{ shop: '', platform: 'other', chat: r.chat }] : [] }),
  }));

  useEffect(() => {
    if (!live) return;
    let alive = true;
    (async () => {
      let lines: Line[] = [];
      let err = '';
      try {
        lines = ((await getCustomerPurchases(r.phone)) || []).map((x) => ({
          date: x.txn_date, bill: x.bill_no || x.order_no || '', sku: x.sku || '', product: x.product_name || '',
          amount: x.amount == null ? null : Number(x.amount), seller: '',
        }));
      } catch (e) {
        if (handleAuthError(e)) return;
        err = 'โหลดประวัติการซื้อไม่สำเร็จ';
      }
      let chans: NormChannel[] | null = null;
      try {
        const rows = await getCustomerChannels(r.phone);
        if (rows?.length) chans = channelsOf({ channels: rows.map(mapChannel) });
      } catch {
        // ใช้ช่องทางจากชื่อแชตเหมือนเดิม
      }
      if (alive) setDetail((d) => ({ lines, err, chans: chans ?? d.chans }));
    })();
    return () => {
      alive = false;
    };
  }, [live, r.phone, handleAuthError]);

  const tx = { phone: r.phone, name: r.name, brand: (r.brands[0] || '') as Brand, chatName: r.chat };
  const badge = takenBadge(r, { isAdmin, reps });
  const { lines, err, chans } = detail;
  const copyPhone = () => {
    navigator.clipboard?.writeText(r.phone).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(r.phone));
  };

  return (
    <>
      <div className="modal-h">
        <h3>{r.name}</h3>
        <BrandTags brands={r.brands} />
        {badge ? <span className="badge s-new plain">{badge}</span> : null}
        <ContactBar x={tx} chans={chans} openJst={openJst} />
        <CloseButton />
      </div>
      <div className="modal-b">
        <dl className="info-grid" style={{ margin: 0 }}>
          <div><dt>เบอร์</dt><dd className="mono">{r.phone}{' '}<button className="copy" data-copy={r.phone} onClick={copyPhone}>คัดลอก</button></dd></div>
          <div><dt>กลุ่มลูกค้า</dt><dd>{r.segment || '—'}</dd></div>
          <div><dt>ยอดซื้อสะสม</dt><dd className="num">{baht(Math.round(r.ltv))}</dd></div>
          <div><dt>จำนวนออเดอร์</dt><dd className="num">{r.orders}</dd></div>
          <div><dt>ซื้อล่าสุด</dt><dd>{r.last ? fmtDate(r.last) : '—'}</dd></div>
          <div><dt>ชื่อแชต</dt><dd>{r.chat || '—'}</dd></div>
          <div><dt>ที่อยู่</dt><dd>{cu?.address || '—'}</dd></div>
          <div className="wide"><dt>ช่องทางแชต (แยกตามร้าน)</dt><dd><ChannelRow x={tx} chans={chans} openJst={openJst} /></dd></div>
        </dl>
        <div className="sub"><b>ประวัติการซื้อ</b></div>
        {lines === null ? (
          <div className="empty">กำลังโหลดประวัติการซื้อ…</div>
        ) : err ? (
          <div className="login-err">{err}</div>
        ) : lines.length ? (
          <div className="mini-table table-wrap">
            <table>
              <thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th className="r">ยอดซื้อ</th></tr></thead>
              <tbody>
                {lines.map((p, i) => (
                  <tr key={`${p.bill}-${i}`}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="mono">{p.sku || '—'}</td>
                    <td>{p.product || '—'}<div className="sub">บิล {p.bill || '—'}{p.seller ? ' · ขายโดย ' + p.seller : ''}</div></td>
                    <td className="r num">{p.amount == null ? '—' : baht(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ไม่พบประวัติการซื้อรายรายการ</div>
        )}
      </div>
      {footer?.kind === 'claim' ? (
        <div className="modal-f"><button className="btn primary" data-pool-claim={r.id} onClick={() => onClaim(seq)}>{footer.text}</button></div>
      ) : null}
      {footer?.kind === 'unclaim' ? (
        <div className="modal-f"><button className="btn danger" data-act="unclaim" data-id={footer.leadId} onClick={() => act.confirmUnclaim(footer.leadId)}>ยกเลิกจอง</button></div>
      ) : null}
    </>
  );
}
