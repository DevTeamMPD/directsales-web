'use client';

import { useCallback } from 'react';
import { useJst } from '@/components/leads/useJst';
import { mapChannel } from '@/lib/api/map';
import { claimCustomer, getCustomerChannels } from '@/lib/api/rpc';
import type { Channel, PoolRow } from '@/lib/api/types';
import { FIXTURE_NO_WRITE, type Brand } from '@/lib/constants';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * จองลูกค้าจากถัง (poolClaimLive L961-970): dsales_claim_customer → ลีดใหม่เข้า state, ปิด popup, ถังโหลดใหม่, toast
 * แล้วดึงช่องทางแชต (dsales_customer_channels) เก็บลงลีด และเปิดแชตแรกใน JST อัตโนมัติ; error → toast + ถังโหลดใหม่
 * seq = popup E ที่กดจอง (ปิดเฉพาะ popup นั้น); กันกดซ้ำต่อเบอร์
 */
export function useCustomerClaim(): (r: PoolRow, brand: Brand, seq?: number, msg?: string) => Promise<void> {
  const { live } = useAppState();
  const { once, upsertLead, patchLead, dispatch, toast, toastError, closeModal } = useActions();
  const openJst = useJst();
  return useCallback(
    async (r, brand, seq, msg = 'จองแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ') => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      await once(`claim-customer:${r.phone}`, async () => {
        try {
          const lj = await claimCustomer(r.phone, brand);
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
