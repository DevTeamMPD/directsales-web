'use client';

import { useCallback } from 'react';
import { useJst } from '@/components/leads/useJst';
import { errorMessage } from '@/lib/api/errors';
import { mapChannel } from '@/lib/api/map';
import { claimCustomer, getCustomerChannels } from '@/lib/api/rpc';
import type { Channel, PoolRow } from '@/lib/api/types';
import { FIXTURE_NO_WRITE, type Brand } from '@/lib/constants';
import type { SelRow } from '@/lib/domain/outreach';
import { bulkFollowPlan, bulkFollowSummary } from '@/lib/domain/pool';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * จองลูกค้าจากถัง (poolClaimLive L961-970): dsales_claim_customer → ลีดใหม่เข้า state, ปิด popup, ถังโหลดใหม่, toast
 * แล้วดึงช่องทางแชต (dsales_customer_channels) เก็บลงลีด และเปิดแชตแรกใน JST อัตโนมัติ; error → toast + ถังโหลดใหม่
 * seq = popup E ที่กดจอง (ปิดเฉพาะ popup นั้น); กันกดซ้ำต่อเบอร์ · campaignId = จองจากการ์ดแคมเปญ (ลีดผูกแคมเปญ)
 */
export function useCustomerClaim(): (r: PoolRow, brand: Brand, seq?: number, msg?: string, campaignId?: string | null) => Promise<void> {
  const { live } = useAppState();
  const { once, upsertLead, patchLead, dispatch, toast, toastError, closeModal } = useActions();
  const openJst = useJst();
  return useCallback(
    async (r, brand, seq, msg = 'จองแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ', campaignId = null) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      await once(`claim-customer:${r.phone}`, async () => {
        try {
          const lj = await claimCustomer(r.phone, brand, campaignId);
          upsertLead(lj);
          closeModal(seq);
          dispatch({ type: 'invalidatePool' });
          toast(msg);
          let chans: Channel[] | null = null;
          try {
            chans = ((await getCustomerChannels(r.phone)) || []).map(mapChannel);
          } catch {
            // ดึงช่องทางไม่ได้: ใช้ช่องทางที่ server ส่งมากับลีด
          }
          const chatName = r.chat || '';
          if (chans) patchLead(lj.id, { channels: chans, chatName });
          const c1 = channelsOf(chans ? { channels: chans, shop: lj.shop, chatName } : lj)[0];
          if (c1) openJst(jstTarget({ phone: lj.phone, name: lj.name, brand: lj.brand, chatName: chans ? chatName : lj.chatName }, c1), { auto: true });
        } catch (e) {
          toastError(e);
          dispatch({ type: 'invalidatePool' });
        }
      });
    },
    [live, once, upsertLead, patchLead, dispatch, toast, toastError, closeModal, openJst],
  );
}

/**
 * /mine: ส่งลูกค้าที่ติ๊กไว้เข้า Direct Sale (dsales_claim_customer ทีละคน — ลีดเดิมของฉันก็ผ่าน) ไม่เปิดแชต JST อัตโนมัติ
 * toast สรุปครั้งเดียว · กันกดซ้ำทั้งชุด · onDone เรียกเมื่อจบ (ล้างที่เลือก)
 */
export function useBulkFollow(): (rows: ReadonlyArray<SelRow>, pageBrand: string, onDone: () => void) => Promise<void> {
  const { live } = useAppState();
  const { once, upsertLead, dispatch, toast } = useActions();
  return useCallback(
    async (rows, pageBrand, onDone) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      await once('bulk-follow', async () => {
        const { todo, skipped } = bulkFollowPlan(rows, pageBrand);
        const reasons = skipped.map((s) => s.reason);
        let done = 0;
        for (const t of todo) {
          try {
            upsertLead(await claimCustomer(t.phone, t.brand));
            done++;
          } catch (e) {
            reasons.push(errorMessage(e));
          }
        }
        dispatch({ type: 'invalidatePool' });
        toast(bulkFollowSummary(done, reasons));
        onDone();
      });
    },
    [live, once, upsertLead, dispatch, toast],
  );
}
