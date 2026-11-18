'use client';

import { ConfirmUnclaimModal } from '@/components/modals/ConfirmUnclaimModal';
import { CustomerModal } from '@/components/modals/CustomerModal';
import { LogModal } from '@/components/modals/LogModal';
import { assignLead, claimLead, setNoCall } from '@/lib/api/rpc';
import type { ContactType } from '@/lib/api/types';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import { canUnclaimAny, claimBlock } from '@/lib/domain/leads';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { useJst } from './useJst';

/** ปุ่มดำเนินการของแถวลีด — เขียนข้อมูลแล้ว upsertLead + invalidatePool (= route() ของ prototype) + toast; error → toast */
export function useLeadActions() {
  const { leads, meId, reps, campaigns, live } = useAppState();
  const { openModal, toast, toastError, upsertLead, dispatch } = useActions();
  const openJst = useJst();
  const done = (msg: string) => {
    dispatch({ type: 'invalidatePool' });
    toast(msg);
  };
  return {
    // legacy customerModal/logModal: ไม่พบลีดใน state → ไม่เปิด popup
    openCustomer: (id: string) => {
      if (leads.some((x) => x.id === id)) openModal(<CustomerModal id={id} />);
    },
    openLog: (id: string, type: ContactType) => {
      if (leads.some((x) => x.id === id)) openModal(<LogModal id={id} type={type} />, 'sm');
    },
    confirmUnclaim: (id: string) => {
      const l = leads.find((x) => x.id === id);
      if (!l || !canUnclaimAny(l, meId)) {
        toast('ยกเลิกจองรายการนี้ไม่ได้');
        return;
      }
      openModal(<ConfirmUnclaimModal id={id} />, 'sm');
    },
    restoreNoCall: async (id: string) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        upsertLead(await setNoCall(id, false));
        done('ยกเลิกห้ามโทรแล้ว');
      } catch (e) {
        toastError(e);
      }
    },
    claim: async (id: string) => {
      const l = leads.find((x) => x.id === id);
      if (!l) return;
      const block = claimBlock(l, campaigns.find((c) => c.id === l.campaignId), leads, meId);
      if (block) {
        toast(block);
        return;
      }
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        const nl = await claimLead(id);
        upsertLead(nl);
        done('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
        // จองแล้วเด้งไปแชตของลูกค้าใน JST (L888)
        const c0 = channelsOf(nl)[0];
        if (c0) openJst(jstTarget(nl, c0), { auto: true });
      } catch (e) {
        toastError(e);
      }
    },
    assign: async (id: string, userId: string) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        upsertLead(await assignLead(id, userId));
        done('มอบหมายแล้ว: ' + (reps.find((r) => r.id === userId)?.name || ''));
      } catch (e) {
        toastError(e);
      }
    },
  };
}

export type LeadActions = ReturnType<typeof useLeadActions>;
