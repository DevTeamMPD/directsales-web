'use client';

import { useMemo } from 'react';
import { TopbarActions } from '@/components/shell/TopbarActions';
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
  const { leads, meId, isAdmin, ui, today, brand } = useAppState();
  const { openModal } = useActions();
  const base = useMemo(() => leads.filter((l) => mineOrAll(l, { meId, isAdmin }) && inBrand(brand, l.brand)), [leads, meId, isAdmin, brand]);
  const list = useMemo(() => filtered(base, { ...ui, today }), [base, ui, today]);
  useVerifyMine();
  return (
    <>
      <TopbarActions>
        <button className="btn primary" id="add-lead" onClick={() => openModal(<PickFromBucketModal />, 'sm')}>
          <span className="lbl-long">+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด</span><span className="lbl-short">+ เพิ่มจากถัง</span>
        </button>
      </TopbarActions>
      <PeriodCard />
      <LeadToolbar base={base} withCampSelect />
      <LeadTable list={list} opts={{ selectable: true }} />
    </>
  );
}
