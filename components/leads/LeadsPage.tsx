'use client';

import { useMemo } from 'react';
import { TopbarActions } from '@/components/shell/TopbarActions';
import { AiStatusModal } from '@/components/modals/AiStatusModal';
import { PickFromBucketModal } from '@/components/modals/PickFromBucketModal';
import { inBrand } from '@/lib/domain/brand';
import { filtered, mineOrAll } from '@/lib/domain/leads';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { LeadTable } from './LeadTable';
import { LeadToolbar } from './LeadToolbar';
import { PeriodCard } from './PeriodCard';
import { useVerifyMine } from './useVerifyMine';

/** หน้า Direct Sale: หัวหน้าเห็นทุกลีด เซลล์เห็นเฉพาะของตัวเอง (mineOrAll) · เฉพาะแบรนด์ใหญ่ที่เลือกใน topbar */
export function LeadsPage() {
  const { leads, meId, isAdmin, ui, today, brand, live, viewAs } = useAppState();
  const { openModal } = useActions();
  // หัวหน้าดูในมุมมองเซลล์ = เฉพาะลีดของเซลล์คนนั้น
  const base = useMemo(
    () => leads.filter((l) => (viewAs ? l.owner === viewAs : mineOrAll(l, { meId, isAdmin })) && inBrand(brand, l.brand)),
    [leads, meId, isAdmin, brand, viewAs],
  );
  const list = useMemo(() => filtered(base, { ...ui, today }), [base, ui, today]);
  useVerifyMine();
  return (
    <>
      <TopbarActions>
        {isAdmin && live ? (
          <button className="btn" id="ai-run" onClick={() => openModal(<AiStatusModal leads={list} scopeText="ลีดตามตัวกรองที่เลือกอยู่" />)}>
            <span className="lbl-long">วิเคราะห์สถานะ (AI)</span><span className="lbl-short">AI</span>
          </button>
        ) : null}
        <button className="btn primary" id="add-lead" onClick={() => openModal(<PickFromBucketModal />, 'sm')}>
          <span className="lbl-long">+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด</span><span className="lbl-short">+ จากถัง</span>
        </button>
      </TopbarActions>
      <PeriodCard />
      <LeadToolbar base={base} withCampSelect />
      <LeadTable list={list} opts={{ selectable: true }} />
    </>
  );
}
