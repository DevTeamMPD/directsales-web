'use client';

import type { Campaign, Lead } from '@/lib/api/types';
import { BRAND, type Brand } from '@/lib/constants';
import { campaignBadge, campStats, emptyCampaignsText, SEL_ALL, SEL_CAMPS, type CampStats } from '@/lib/domain/campaigns';
import { fmtDate } from '@/lib/format';

const Bar = ({ pct }: { pct: number }) => (
  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
);
const Stats = ({ s }: { s: CampStats }) => (
  <div className="camp-stats"><span>ติดต่อแล้ว {s.done}/{s.n}</span><span>ปิดการขาย {s.won}</span></div>
);
const Count = ({ n }: { n: string | number }) => (
  <div className="kpi-value num" style={{ fontSize: 22 }}>{n} <span className="sub" style={{ fontSize: 13, fontWeight: 400 }}>ราย</span></div>
);

export interface CardsProps {
  brand: Brand; sel: string; live: boolean; isAdmin: boolean; today: string;
  /** จำนวนลูกค้าทั้งแบรนด์ (null = ยังไม่โหลด → "…") */
  grand: number | null;
  /** บรรทัดใต้ตัวเลขของการ์ดถัง: ล็อกอินจริง "ทั้งที่เข้าและยังไม่เข้าแคมเปญ", fixture = inCampLine */
  poolLine: string;
  campaigns: Campaign[];
  /** ลีดที่เห็นได้ (visible) ของทุกแคมเปญของแบรนด์ — แยกต่อแคมเปญในการ์ด */
  campLeads: Lead[];
  onSelect: (sel: string) => void;
}

/** .camp-grid ของหน้าแคมเปญ: การ์ดถัง (poolCard L664), ลูกค้าทุกแคมเปญ (campsCard L654), การ์ดแต่ละแคมเปญ (L274-286) */
export function CampaignCards({ brand, sel, live, isAdmin, today, grand, poolLine, campaigns, campLeads, onSelect }: CardsProps) {
  const all = campStats(campLeads);
  return (
    <div className="camp-grid">
      <button className={`camp all ${sel === SEL_ALL ? 'active' : ''}`} data-camp={SEL_ALL} onClick={() => onSelect(SEL_ALL)}>
        <div className="camp-top">
          <span className="camp-name">ลูกค้าทั้งหมด</span>
          <span className={`badge ${live ? 's-won' : 's-new'}`}>{live ? 'ข้อมูลจริง' : 'ตัวอย่าง'}</span>
        </div>
        <div className="camp-meta">ลูกค้าทั้งหมดของ {BRAND[brand]}</div>
        <Count n={grand == null ? '…' : grand.toLocaleString('th-TH')} />
        <div className="camp-stats"><span>{poolLine}</span></div>
      </button>
      <button className={`camp ${sel === SEL_CAMPS ? 'active' : ''}`} data-camp={SEL_CAMPS} onClick={() => onSelect(SEL_CAMPS)}>
        <div className="camp-top">
          <span className="camp-name">ลูกค้าทุกแคมเปญ</span>
          <span className="badge s-following plain">{campaigns.length} แคมเปญ</span>
        </div>
        <div className="camp-meta">ลูกค้าที่อยู่ในแคมเปญต่างๆ ของ {BRAND[brand]} รวมกัน</div>
        <Count n={all.n} />
        <Bar pct={all.pct} />
        <Stats s={all} />
      </button>
      {campaigns.length ? (
        campaigns.map((c) => {
          const s = campStats(campLeads.filter((l) => l.campaignId === c.id));
          const b = campaignBadge(c, today);
          return (
            <button key={c.id} className={`camp ${c.id === sel ? 'active' : ''}`} data-camp={c.id} onClick={() => onSelect(c.id)}>
              <div className="camp-top">
                <span className="camp-name">{c.name}</span>
                <span className={`badge ${b.cls}`}>{b.text}</span>
              </div>
              <div className="camp-meta">{fmtDate(c.start)} – {fmtDate(c.end)}</div>
              <div className="camp-meta">{c.note}</div>
              <Bar pct={s.pct} />
              <Stats s={s} />
            </button>
          );
        })
      ) : (
        <div className="empty">{emptyCampaignsText(isAdmin)}</div>
      )}
    </div>
  );
}
