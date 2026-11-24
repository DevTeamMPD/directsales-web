'use client';

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SelectionBar } from '@/components/campaigns/SelectionBar';
import { useOutreachMax } from '@/components/campaigns/useOutreachMax';
import { CallButton, ContactBar, type OpenJst } from '@/components/leads/ContactBar';
import { SendOutreachModal } from '@/components/modals/SendOutreachModal';
import { DueTag, ReleaseTag, StatusBadge } from '@/components/ui/StatusBadge';
import type { Campaign, ChatRoom, ClaimMode, Lead, Rep } from '@/lib/api/types';
import { pageBrand } from '@/lib/domain/brand';
import { bills, canUnclaim, lastSeller, repName, total } from '@/lib/domain/leads';
import {
  defaultOutreachBrand, leadSelectable, leadSelRow, phoneCheckState, pruneSelection, selectionBar, setPhones, togglePhone,
} from '@/lib/domain/outreach';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { RoomIcons } from './RoomIcons';
import { useJst } from './useJst';
import { useLeadActions, type LeadActions } from './useLeadActions';
import { useLeadRooms } from './useLeadRooms';

/** mode = วิธีจองของแคมเปญที่เลือก (หน้าแคมเปญ); perCamp = มุม "ลูกค้าทุกแคมเปญ" ใช้วิธีจองของแคมเปญของแต่ละลีด;
 *  selectable = คอลัมน์ติ๊กลีดของฉันเพื่อส่งข้อความ (หน้า Direct Sale เท่านั้น) */
export interface TableOpts { mode?: ClaimMode; perCamp?: boolean; selectable?: boolean }

interface RowCtx {
  reps: Rep[]; campaigns: Campaign[]; meId: string; isAdmin: boolean; today: string; act: LeadActions; openJst: OpenJst;
  rooms: ReadonlyMap<string, ChatRoom[]>; selectable: boolean; toggle: (phone: string) => void;
}

export function LeadTable({ list, opts = {} }: { list: Lead[]; opts?: TableOpts }) {
  const { reps, campaigns, meId, isAdmin, today, leads, brand } = useAppState();
  const { openModal } = useActions();
  const act = useLeadActions();
  const openJst = useJst();
  const rooms = useLeadRooms(list);
  const selectable = !!opts.selectable;
  // เก็บแค่เบอร์ — สร้างแถวส่งตอนกดส่งจากลีด/ห้องล่าสุด (ห้องโหลดเสร็จทีหลังก็ได้แบรนด์ถูก)
  const [sel, setSel] = useState<ReadonlySet<string>>(() => new Set());
  const max = useOutreachMax(sel.size > 0);
  const headBox = useRef<HTMLInputElement>(null);
  // ลีดของฉันทั้งหมด (ไม่ใช่เฉพาะที่กรองอยู่) → ติ๊กคงอยู่ข้ามตัวกรอง/คำค้น แต่ลีดที่ยกเลิกจอง/ถูกโอนออกถูกตัดทิ้ง
  const minePhones = useMemo(() => new Set(leads.filter((l) => leadSelectable(l, meId)).map((l) => l.phone)), [leads, meId]);
  useEffect(() => {
    setSel((s) => pruneSelection(s, minePhones));
  }, [minePhones]);
  const pickable = useMemo(
    () => (selectable ? list.filter((l) => leadSelectable(l, meId)).map((l) => l.phone) : []),
    [selectable, list, meId],
  );
  const pageState = phoneCheckState(sel, pickable);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = pageState === 'some';
  }, [pageState]);
  const toggle = useCallback((phone: string) => setSel((s) => togglePhone(s, phone)), []);
  // ctx คงที่จนกว่าทีม/แคมเปญ/วันนี้/ห้องเปลี่ยน → พิมพ์ค้นหา/ติ๊กแล้วแถวอื่นไม่ต้องวาดใหม่ (memo; ติ๊กส่งเป็น prop checked แยก)
  const ctx = useMemo<RowCtx>(
    () => ({ reps, campaigns, meId, isAdmin, today, act, openJst, rooms, selectable, toggle }),
    [reps, campaigns, meId, isAdmin, today, act, openJst, rooms, selectable, toggle],
  );
  const openSend = () => {
    if (!selectionBar(sel.size, max).canSend) return;
    const byPhone = new Map(leads.map((l) => [l.phone, l] as const));
    const picked = [...sel].flatMap((p) => {
      const l = byPhone.get(p);
      return l ? [leadSelRow(l, rooms.get(p))] : [];
    });
    if (!picked.length) return;
    openModal(<SendOutreachModal rows={picked} defaultBrand={defaultOutreachBrand(picked, pageBrand(brand) || null)} onSent={() => setSel(new Set())} />);
  };
  return (
    <>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {selectable ? (
                <th className="sel-col" style={{ width: 1 }}>
                  <input
                    ref={headBox} type="checkbox" id="lead-sel-page" aria-label="เลือกลีดของฉันทุกแถวที่แสดง" disabled={!pickable.length}
                    checked={pageState === 'all' && pickable.length > 0}
                    onChange={(e) => setSel((s) => setPhones(s, pickable, e.target.checked))}
                  />
                </th>
              ) : null}
              <th>ชื่อ / เบอร์</th><th>เลขบิลที่เคยซื้อ</th><th>ร้านค้า</th><th>แคมเปญ</th><th>พนักงานขาย</th>
              <th className="r">ยอดซื้อรวม</th><th>สถานะ</th><th>บันทึกล่าสุด</th><th>ปุ่มดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((l) => {
                const mode = opts.perCamp ? campaigns.find((c) => c.id === l.campaignId)?.claimMode || 'self' : opts.mode;
                return <LeadRow key={l.id} l={l} mode={mode} ctx={ctx} checked={sel.has(l.phone)} />;
              })
            ) : (
              <tr><td colSpan={selectable ? 10 : 9} className="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selectable ? <SelectionBar count={sel.size} max={max} onClear={() => setSel(new Set())} onSend={openSend} /> : null}
    </>
  );
}

const LeadRow = memo(function LeadRow({ l, mode, ctx, checked }: { l: Lead; mode?: ClaimMode; ctx: RowCtx; checked: boolean }) {
  const { reps, campaigns, meId, isAdmin, today, act, openJst, rooms, selectable, toggle } = ctx;
  const owner = repName(reps, l.owner);
  const seller = lastSeller(l, reps);
  const lastNote = l.interactions[l.interactions.length - 1]?.note;
  const logType = l.noCall ? 'chat' : 'call';
  const myRooms = rooms.get(l.phone);
  return (
    <tr className={checked ? 'sel' : undefined}>
      {selectable ? (
        <td className="sel-col">
          {leadSelectable(l, meId) ? (
            <input type="checkbox" data-lead-sel={l.phone} aria-label={`เลือก ${l.name}`} checked={checked} onChange={() => toggle(l.phone)} />
          ) : null}
        </td>
      ) : null}
      <td>
        <button className="cust-name" data-act="open" data-id={l.id} onClick={() => act.openCustomer(l.id)}>{l.name}</button>
        <div className="sub mono">{l.phone}</div>
        {myRooms?.length ? (
          <span className="ch-bar mini">
            <CallButton phone={l.phone} />
            <RoomIcons who={{ phone: l.phone, name: l.name, chat: l.chatName, brand: l.brand }} rooms={myRooms} openJst={openJst} />
          </span>
        ) : (
          <ContactBar x={l} chans={channelsOf(l)} mini openJst={openJst} />
        )}
      </td>
      <td>
        <div className="bills">{bills(l).map((b, i) => <span key={`${b}-${i}`} className="bill">{b}</span>)}</div>
      </td>
      <td>{l.shop}</td>
      <td>
        {l.source === 'self'
          ? <span className="tag self">เซลล์ขุดเอง</span>
          : <span className="camp-cell">{campaigns.find((c) => c.id === l.campaignId)?.name || '—'}</span>}
      </td>
      <td>
        {owner ? <span className="rep-name">{owner}</span> : <span className="sub">ยังไม่มีผู้ดูแล</span>}
        {seller ? <div className="sub">ขายล่าสุด: {repName(reps, seller) || ''}</div> : null}
      </td>
      <td className="r num">{baht(total(l))}</td>
      <td>
        <StatusBadge status={l.status} />
        <DueTag callback={l.callback} today={today} />
        {l.owner ? <ReleaseTag dsSince={l.dsSince} status={l.status} today={today} /> : null}
        {l.chatCheck?.sent ? <div><span className="tag chat-ok">ทักแชทแล้ว ✓</span></div> : null}
        {l.noCall ? (
          <>
            <div><span className="tag nocall">ห้ามโทร · แชตเท่านั้น</span></div>
            {isAdmin ? <div className="sub">แจ้งโดย {repName(reps, l.noCallBy) || '—'}{l.noCallAt ? ' · ' + fmtDate(l.noCallAt) : ''}</div> : null}
          </>
        ) : null}
        {isAdmin && l.releasedBy?.length && !l.owner ? (
          <div className="sub">คัดออกโดย {l.releasedBy.map((id) => repName(reps, id) || '').join(', ')}</div>
        ) : null}
      </td>
      <td className="note-cell">
        {l.interest ? <div><span className="sub">สนใจ:</span> {l.interest}</div> : null}
        {l.status === 'won' && l.closedBills.length ? (
          <div>
            <span className="sub">บิลที่ปิด:</span>{' '}
            {l.closedBills.map((b, i) => (
              <Fragment key={`${b}-${i}`}>{i ? ' ' : ''}<span className="bill">{b}</span></Fragment>
            ))}
          </div>
        ) : null}
        <div>{lastNote || '—'}</div>
      </td>
      <td>
        <div className="actions">
          <button className="btn sm primary" data-act="log" data-type={logType} data-id={l.id} onClick={() => act.openLog(l.id, logType)}>
            {l.noCall ? 'บันทึกแชต' : 'บันทึก'}
          </button>
          <ClaimCell l={l} mode={mode} ctx={ctx} />
          {canUnclaim(l, meId) ? (
            <button className="btn sm danger" data-act="unclaim" data-id={l.id} onClick={() => act.confirmUnclaim(l.id)}>ยกเลิกจอง</button>
          ) : null}
          {isAdmin && l.noCall ? (
            <button className="btn sm" data-act="dnc-restore" data-id={l.id} onClick={() => void act.restoreNoCall(l.id)}>ยกเลิกห้ามโทร</button>
          ) : null}
        </div>
      </td>
    </tr>
  );
});

/** L106-113: ไม่มีวิธีจองหรือมีเจ้าของแล้ว → ว่าง; หัวหน้าได้ select มอบหมาย */
function ClaimCell({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  if (!mode || l.owner) return null;
  const assign = ctx.isAdmin ? (
    <select
      className="select"
      data-assign={l.id}
      aria-label="มอบหมายให้"
      defaultValue=""
      onChange={(e) => {
        const sel = e.currentTarget;
        // มอบหมายไม่สำเร็จ/โหมด fixture: คืนช่องเลือกเป็นค่าว่างเหมือน prototype ที่วาดตารางใหม่ (route())
        if (sel.value) void ctx.act.assign(l.id, sel.value).finally(() => { if (sel.isConnected) sel.value = ''; });
      }}
    >
      <option value="">มอบหมายให้…</option>
      {ctx.reps.filter((r) => r.active !== false).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  ) : null;
  if (mode === 'self') {
    return (
      <>
        <button className="btn sm outline" data-act="claim" data-id={l.id} onClick={() => void ctx.act.claim(l.id)}>จอง</button>
        {assign}
      </>
    );
  }
  return assign ?? <span className="sub">{mode === 'assign' ? 'รอหัวหน้ามอบหมาย' : 'ไม่มียอดขายเดิมให้อ้างอิง'}</span>;
}
