'use client';

import { useEffect, useMemo } from 'react';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadToolbar } from '@/components/leads/LeadToolbar';
import { PeriodCard } from '@/components/leads/PeriodCard';
import { CampaignFormModal } from '@/components/modals/CampaignFormModal';
import { TopbarActions } from '@/components/shell/TopbarActions';
import { getPoolGrandTotal } from '@/lib/api/rpc';
import type { Brand } from '@/lib/constants';
import { campaignBase, inCampLine, leadsInCampaigns, modeOf, normalizeSelCamp, quota, SEL_ALL, SEL_CAMPS } from '@/lib/domain/campaigns';
import { filtered } from '@/lib/domain/leads';
import { demoGrand } from '@/lib/domain/pool';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { CampaignCards } from './CampaignCards';
import { PoolPanel } from './PoolPanel';

/**
 * หน้าแคมเปญของแบรนด์ (renderCampaign L259-298): การ์ด → การ์ดช่วงวันที่ → ถังลูกค้าทั้งหมด (ALL) หรือแถบ quota + toolbar + ตารางลีด
 * ปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" ทำแบบ prototype ตอนล็อกอินจริง (applyAuto คืน 0 เสมอ → toast "ไม่มีลีดที่ต้องจัดสรร")
 */
export function CampaignPage({ brand }: { brand: Brand }) {
  const { campaigns, leads, customers, meId, isAdmin, live, ui, today, pool } = useAppState();
  const { setUi, setPool, openModal, toast } = useActions();
  const viewer = useMemo(() => ({ meId, isAdmin }), [meId, isAdmin]);
  const cs = useMemo(() => campaigns.filter((c) => c.brand === brand), [campaigns, brand]);
  const sel = normalizeSelCamp(ui.selCamp, campaigns, brand);
  const isAll = sel === SEL_ALL;
  const isCamps = sel === SEL_CAMPS;

  // หน้านี้ไม่มี select แคมเปญใน toolbar: ล้างตัวกรองแคมเปญที่ค้างมาจาก /leads ไม่ให้ซ่อนลีดเงียบ ๆ (ตัวกรองอื่นคงไว้)
  useEffect(() => {
    setUi({ camp: 'all' });
  }, [brand, setUi]);

  useEffect(() => {
    if (sel !== ui.selCamp) setUi({ selCamp: sel });
  }, [sel, ui.selCamp, setUi]);

  // ถังเป็นของแบรนด์ที่เปิดอยู่เท่านั้น: เปลี่ยนแบรนด์ → ล้างคำค้น/หน้า/จำนวนรวม (L264)
  useEffect(() => {
    if (pool.brand !== brand) setPool({ brand, page: 0, q: '', grand: null, grandFor: null });
  }, [pool.brand, brand, setPool]);

  // จำนวนลูกค้าทั้งแบรนด์: dsales_customer_pool_v3 ครั้งเดียวต่อแบรนด์ (L626-629) ไม่ขึ้นกับคำค้น/ช่วงวันที่
  useEffect(() => {
    if (!live || pool.brand !== brand || pool.grandFor === brand) return;
    let alive = true;
    getPoolGrandTotal(brand).then(
      (grand) => {
        if (alive) setPool({ grand, grandFor: brand });
      },
      () => {
        // prototype ไม่แจ้ง error ของตัวเลขนี้ (การ์ดแสดง "…")
      },
    );
    return () => {
      alive = false;
    };
  }, [live, brand, pool.brand, pool.grandFor, setPool]);

  const campLeads = useMemo(() => leadsInCampaigns(leads, new Set(cs.map((c) => c.id)), viewer), [leads, cs, viewer]);
  const base = useMemo(() => (isAll ? [] : campaignBase(leads, sel, cs, viewer)), [isAll, leads, sel, cs, viewer]);
  const list = useMemo(() => filtered(base, { ...ui, today }), [base, ui, today]);
  const grand = live ? (pool.grandFor === brand ? pool.grand : null) : demoGrand(customers, leads, brand);
  const q = quota(base, meId, sel, campaigns);

  return (
    <>
      {isAdmin ? (
        <TopbarActions>
          <button className="btn" id="auto-run" onClick={() => toast('ไม่มีลีดที่ต้องจัดสรร')}>
            <span className="lbl-long">จัดสรรให้เซลล์ที่ขายล่าสุด</span><span className="lbl-short">จัดสรร</span>
          </button>
          <button className="btn primary" id="new-camp" onClick={() => openModal(<CampaignFormModal brand={brand} />)}>
            <span className="lbl-long">+ สร้างแคมเปญ</span><span className="lbl-short">+ แคมเปญ</span>
          </button>
        </TopbarActions>
      ) : null}
      <CampaignCards
        brand={brand} sel={sel} live={live} isAdmin={isAdmin} today={today} grand={grand}
        poolLine={live ? 'ทั้งที่เข้าและยังไม่เข้าแคมเปญ' : inCampLine(customers, leads, campaigns, brand)}
        campaigns={cs} campLeads={campLeads}
        onSelect={(id) => setUi({ selCamp: id, status: 'all' })}
      />
      <PeriodCard />
      {isAll ? (
        pool.brand === brand ? <PoolPanel brand={brand} /> : null
      ) : (
        <>
          <div className="quota card" style={{ padding: '10px 14px' }}>
            ลีดในแคมเปญนี้ <b>{q.n}</b> รายการ · ที่ฉันดูแล <b>{q.mine}</b> · ยังไม่มีผู้ดูแล <b>{q.free}</b> · วิธีจอง: <b>{q.mode}</b>
          </div>
          <LeadToolbar base={base} withCampSelect={false} />
          <LeadTable list={list} opts={{ mode: modeOf(sel, campaigns), perCamp: isCamps }} />
        </>
      )}
    </>
  );
}
