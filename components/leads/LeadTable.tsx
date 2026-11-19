'use client';

import { Fragment, memo, useMemo } from 'react';
import { ContactBar, type OpenJst } from '@/components/leads/ContactBar';
import { DueTag, StatusBadge } from '@/components/ui/StatusBadge';
import type { Campaign, ClaimMode, Lead, Rep } from '@/lib/api/types';
import { bills, canUnclaim, lastSeller, repName, total } from '@/lib/domain/leads';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useAppState } from '@/lib/state/AppProvider';
import { useJst } from './useJst';
import { useLeadActions, type LeadActions } from './useLeadActions';

/** mode = วิธีจองของแคมเปญที่เลือก (หน้าแคมเปญ); perCamp = มุม "ลูกค้าทุกแคมเปญ" ใช้วิธีจองของแคมเปญของแต่ละลีด */
export interface TableOpts { mode?: ClaimMode; perCamp?: boolean }

interface RowCtx { reps: Rep[]; campaigns: Campaign[]; meId: string; isAdmin: boolean; today: string; act: LeadActions; openJst: OpenJst }

export function LeadTable({ list, opts = {} }: { list: Lead[]; opts?: TableOpts }) {
  const { reps, campaigns, meId, isAdmin, today } = useAppState();
  const act = useLeadActions();
  const openJst = useJst();
  // ctx คงที่จนกว่าทีม/แคมเปญ/วันนี้เปลี่ยน → พิมพ์ค้นหาแล้วแถวที่ลีดไม่เปลี่ยนไม่ต้องวาดใหม่ (memo)
  const ctx = useMemo<RowCtx>(() => ({ reps, campaigns, meId, isAdmin, today, act, openJst }), [reps, campaigns, meId, isAdmin, today, act, openJst]);
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>ชื่อ / เบอร์</th><th>เลขบิลที่เคยซื้อ</th><th>ร้านค้า</th><th>แคมเปญ</th><th>พนักงานขาย</th>
            <th className="r">ยอดซื้อรวม</th><th>สถานะ</th><th>บันทึกล่าสุด</th><th>ปุ่มดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {list.length ? (
            list.map((l) => {
              const mode = opts.perCamp ? campaigns.find((c) => c.id === l.campaignId)?.claimMode || 'self' : opts.mode;
              return <LeadRow key={l.id} l={l} mode={mode} ctx={ctx} />;
            })
          ) : (
            <tr><td colSpan={9} className="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const LeadRow = memo(function LeadRow({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  const { reps, campaigns, meId, isAdmin, today, act, openJst } = ctx;
  const owner = repName(reps, l.owner);
  const seller = lastSeller(l, reps);
  const lastNote = l.interactions[l.interactions.length - 1]?.note;
  const logType = l.noCall ? 'chat' : 'call';
  return (
    <tr>
      <td>
        <button className="cust-name" data-act="open" data-id={l.id} onClick={() => act.openCustomer(l.id)}>{l.name}</button>
        <div className="sub mono">{l.phone}</div>
        <ContactBar x={l} chans={channelsOf(l)} mini openJst={openJst} />
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
