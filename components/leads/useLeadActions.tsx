'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
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

export interface LeadActions {
  openCustomer: (id: string) => void;
  openLog: (id: string, type: ContactType) => void;
  confirmUnclaim: (id: string) => void;
  restoreNoCall: (id: string) => Promise<void>;
  claim: (id: string) => Promise<void>;
  assign: (id: string, userId: string) => Promise<void>;
}

/**
 * ปุ่มดำเนินการของแถวลีด — เขียนข้อมูลแล้ว upsertLead + invalidatePool (= route() ของ prototype) + toast; error → toast
 * object คงที่ตลอดอายุ component (อ่าน state ล่าสุดผ่าน ref) ให้ memo(LeadRow) ไม่ต้องวาดทุกแถวใหม่
 * ปุ่มที่เรียก RPC กันกดซ้ำด้วย once(key) — คลิกซ้ำระหว่างรอไม่ส่งซ้ำ
 */
export function useLeadActions(): LeadActions {
  const state = useAppState();
  const actions = useActions();
  const openJst = useJst();
  const latest = useRef({ state, openJst });
  useLayoutEffect(() => {
    latest.current = { state, openJst };
  });

  return useMemo<LeadActions>(() => {
    const { openModal, toast, toastError, upsertLead, dispatch, once } = actions;
    const done = (msg: string) => {
      dispatch({ type: 'invalidatePool' });
      toast(msg);
    };
    const leads = () => latest.current.state.leads;
    return {
      // legacy customerModal/logModal: ไม่พบลีดใน state → ไม่เปิด popup
      openCustomer: (id) => {
        if (leads().some((x) => x.id === id)) openModal(<CustomerModal id={id} />);
      },
      openLog: (id, type) => {
        if (leads().some((x) => x.id === id)) openModal(<LogModal id={id} type={type} />, 'sm');
      },
      confirmUnclaim: (id) => {
        const l = leads().find((x) => x.id === id);
        if (!l || !canUnclaimAny(l, latest.current.state.meId)) {
          toast('ยกเลิกจองรายการนี้ไม่ได้');
          return;
        }
        openModal(<ConfirmUnclaimModal id={id} />, 'sm');
      },
      restoreNoCall: async (id) => {
        if (!latest.current.state.live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`dnc-restore:${id}`, async () => {
          try {
            upsertLead(await setNoCall(id, false));
            done('ยกเลิกห้ามโทรแล้ว');
          } catch (e) {
            toastError(e);
          }
        });
      },
      claim: async (id) => {
        const { leads: all, campaigns, meId, live } = latest.current.state;
        const l = all.find((x) => x.id === id);
        if (!l) return;
        const block = claimBlock(l, campaigns.find((c) => c.id === l.campaignId), all, meId);
        if (block) {
          toast(block);
          return;
        }
        if (!live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`claim:${id}`, async () => {
          try {
            const nl = await claimLead(id);
            upsertLead(nl);
            done('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
            // จองแล้วเด้งไปแชตของลูกค้าใน JST (L888)
            const c0 = channelsOf(nl)[0];
            if (c0) latest.current.openJst(jstTarget(nl, c0), { auto: true });
          } catch (e) {
            toastError(e);
            dispatch({ type: 'invalidatePool' }); // prototype: toast แล้ว route() (L888)
          }
        });
      },
      assign: async (id, userId) => {
        if (!latest.current.state.live) {
          toast(FIXTURE_NO_WRITE);
          return;
        }
        await once(`assign:${id}`, async () => {
          try {
            upsertLead(await assignLead(id, userId));
            done('มอบหมายแล้ว: ' + (latest.current.state.reps.find((r) => r.id === userId)?.name || ''));
          } catch (e) {
            toastError(e);
          }
        });
      },
    };
  }, [actions]);
}
