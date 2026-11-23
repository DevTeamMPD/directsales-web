'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PeriodCard } from '@/components/leads/PeriodCard';
import { PATHS } from '@/lib/constants';
import {
  activityFeed, brandChips, byBrand, commissionTable, commissionTsv, dashStat, monthLabel, parseRate, pct, repBars, scopeLabel, type DashStat,
} from '@/lib/domain/dashboard';
import { mineOrAll } from '@/lib/domain/leads';
import { baht, fmtDT } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';

function Kpi({ label, value, foot }: { label: string; value: ReactNode; foot: string }) {
  return (
    <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-foot">{foot}</div></div>
  );
}

function StatCells({ x }: { x: DashStat }) {
  return (
    <>
      <td className="r num">{x.n}</td>
      <td className="r num">{x.c} <span className="sub">({pct(x.c, x.n)}%)</span></td>
      <td className="r num">{x.wait}</td>
      <td className="r num">{x.due}</td>
      <td className="r num">{x.w} <span className="sub">({pct(x.w, x.c)}%)</span></td>
      <td className="r num">{baht(x.val)}</td>
    </>
  );
}

/**
 * Dashboard (renderDashboard L301-366): KPI 5 ใบ, เปรียบเทียบแยกแบรนด์, ยอดที่ปิดได้รายเดือนต่อเซลล์ (ค่าคอม + คัดลอก TSV),
 * ผลงานรายเซลล์, กิจกรรมล่าสุด — คิดจากลีดใน state (หัวหน้า = ทุกลีด, เซลล์ = ของตัวเอง) และช่วงวันที่
 * อัตราค่าคอมเก็บใน ui.commissionRate (คงค่าข้ามหน้า แต่หายเมื่อโหลดใหม่ เหมือน prototype ตอนล็อกอินจริง)
 * แบรนด์ = แบรนด์ใหญ่ใน topbar (ชิปแบรนด์สลับแบรนด์ใหญ่; "ทุกแบรนด์" เฉพาะหัวหน้า) · ตารางเปรียบเทียบแสดงทั้งสองแบรนด์เสมอ
 */
export function DashboardPage() {
  const { leads, reps, meId, isAdmin, ui, today, brand } = useAppState();
  const { setUi, toast, setBrand } = useActions();
  const [rateText, setRateText] = useState(ui.commissionRate ? String(ui.commissionRate) : '');
  const period = ui.period;
  const A = useMemo(() => leads.filter((l) => mineOrAll(l, { meId, isAdmin })), [leads, meId, isAdmin]);
  const L = useMemo(() => byBrand(A, brand), [A, brand]);
  const s = dashStat(L, period, today);
  const all = dashStat(A, period, today);
  const scope = scopeLabel(brand);
  const rate = ui.commissionRate;
  const comm = commissionTable(L, reps, period, rate);
  const copy = () => {
    navigator.clipboard?.writeText(commissionTsv(comm)).then(() => toast('คัดลอกตารางแล้ว วางใน Excel ได้เลย'), () => toast('คัดลอกไม่สำเร็จ'));
  };
  const feed = activityFeed(L, reps, period);

  return (
    <>
      <PeriodCard />
      <div className="toolbar">
        {brandChips(A, isAdmin).map((c) => (
          <button key={c.key} className={`chip ${brand === c.key ? 'active' : ''}`} data-brand={c.key} onClick={() => setBrand(c.key)}>
            {c.dot ? <i className="dot" style={{ background: c.dot }} /> : null}
            {c.label} ({c.n})
          </button>
        ))}
      </div>
      <div className="kpis">
        <Kpi label="ลีดทั้งหมด" value={s.n} foot={scope} />
        <Kpi label="ติดต่อแล้ว" value={<>{s.c} <span className="sub">/ {s.n}</span></>} foot={`${pct(s.c, s.n)}% ของลีด · ${scope}`} />
        <Kpi label="ปิดการขาย" value={s.w} foot={`อัตราปิด ${pct(s.w, s.c)}% ของที่ติดต่อแล้ว`} />
        <Kpi label="ยอดที่ปิดได้" value={baht(s.val)} foot="จากยอดที่เซลล์บันทึกตอนปิดการขาย" />
        <Kpi label="นัดติดต่อเลยกำหนด" value={s.due} foot={s.due ? 'ควรติดตามวันนี้' : 'ไม่มีค้าง'} />
      </div>
      <div className="panel">
        <div className="panel-h"><h2>เปรียบเทียบแยกแบรนด์</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>แบรนด์</th><th className="r">ลีด</th><th className="r">ติดต่อแล้ว</th><th className="r">รอติดต่อ</th>
                <th className="r">เลยนัด</th><th className="r">ปิดการขาย</th><th className="r">ยอดที่ปิดได้</th>
              </tr>
            </thead>
            <tbody>
              {(['bebeplay', 'hosttail'] as const).map((k) => (
                <tr key={k} className={brand === k ? 'sel' : ''}>
                  <td><span className={`tag ${k === 'bebeplay' ? 'bebe' : 'host'}`}>{k === 'bebeplay' ? 'Bebeplay' : 'Hosttail'}</span></td>
                  <StatCells x={dashStat(byBrand(A, k), period, today)} />
                </tr>
              ))}
              <tr className="total"><td><b>รวม</b></td><StatCells x={all} /></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-h">
          <h2>ยอดที่ปิดได้รายเดือนต่อเซลล์ (สำหรับคิดค่าคอม) · {scope}</h2>
          <div className="toolbar">
            <label className="sub" htmlFor="comm-rate">อัตราค่าคอม (%)</label>
            <input
              className="input pin" id="comm-rate" type="number" min="0" step="0.1" placeholder="เช่น 3" style={{ width: 90 }}
              value={rateText}
              onChange={(e) => {
                setRateText(e.target.value);
                setUi({ commissionRate: parseRate(e.target.value) });
              }}
            />
            <button className="btn sm" id="comm-copy" onClick={copy}>คัดลอกตาราง</button>
          </div>
        </div>
        {comm.rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เซลล์</th>
                  {comm.months.map((m) => <th key={m} className="r">{monthLabel(m)}</th>)}
                  <th className="r">ยอดรวม</th><th className="r">จำนวนบิล</th><th className="r">ค่าคอม{rate ? ` (${rate}%)` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {comm.rows.map((r, ri) => (
                  <tr key={`${r.name}-${ri}`}>
                    <td>{r.name}</td>
                    {r.byM.map((v, i) => <td key={comm.months[i]} className="r num">{v ? baht(v) : '—'}</td>)}
                    <td className="r num"><b>{baht(r.sum)}</b></td>
                    <td className="r num">{r.bills}</td>
                    <td className="r num">{rate ? baht(Math.round(r.comm)) : '—'}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td><b>รวม</b></td>
                  {comm.colSum.map((v, i) => <td key={comm.months[i]} className="r num">{baht(v)}</td>)}
                  <td className="r num"><b>{baht(comm.grand)}</b></td>
                  <td className="r num">{comm.bills}</td>
                  <td className="r num">{rate ? baht(Math.round((comm.grand * rate) / 100)) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ไม่มียอดที่ปิดได้ในช่วงนี้</div>
        )}
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-h">
            <h2>ผลงานรายเซลล์ · {scope}</h2>
            <div className="legend">
              <span><i style={{ background: 'var(--accent)' }} />ลีดที่ดูแล</span>
              <span><i style={{ background: 'var(--ok)' }} />ปิดการขาย</span>
            </div>
          </div>
          <div className="panel-b">
            {repBars(L, reps, { meId, isAdmin }, period).map((r) => (
              <div key={r.id} className="rep-row">
                <div>{r.name}</div>
                <div className="rep-bars">
                  <div className="bar"><i style={{ width: r.ownedWidth }} /></div>
                  <div className="bar won"><i style={{ width: r.wonWidth }} /></div>
                </div>
                <div className="sub num" style={{ textAlign: 'right' }}>{r.c}/{r.owned} · ปิด {r.w}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>กิจกรรมล่าสุด · {scope}</h2></div>
          <div className="panel-b">
            <ul className="feed">
              {feed.length ? (
                feed.map((i) => (
                  <li key={i.key}>
                    <span className={`feed-ic ${i.type}`}><svg viewBox="0 0 24 24"><path d={i.type === 'call' ? PATHS.phone : PATHS.chat} /></svg></span>
                    <div className="feed-body">
                      <b>{i.lead}</b> <span className="sub">· {i.rep} · {fmtDT(i.date)}</span>
                      <div>{i.note}</div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty">ยังไม่มีการบันทึก</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
