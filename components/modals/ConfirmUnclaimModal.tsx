'use client';

import { useRef } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { unclaimLead } from '@/lib/api/rpc';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import { useActions, useAppState } from '@/lib/state/AppProvider';

export function ConfirmUnclaimModal({ id }: { id: string }) {
  const { leads, isAdmin, live } = useAppState();
  const { closeModal, toast, toastError, upsertLead, dispatch } = useActions();
  const busy = useRef(false);
  const l = leads.find((x) => x.id === id);
  if (!l) return null;

  async function onConfirm() {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    try {
      const nl = await unclaimLead(id);
      // ลีดที่เซลล์ขุดเอง (ไม่มีแคมเปญ) หายจากรายการของเซลล์ (L99)
      if (!nl.campaignId && !isAdmin) dispatch({ type: 'removeLead', id });
      else upsertLead(nl);
      closeModal();
      dispatch({ type: 'invalidatePool' });
      toast('ยกเลิกจองแล้ว');
    } catch (e) {
      toastError(e);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <div className="modal-h"><h3>ยกเลิกจอง?</h3><CloseButton /></div>
      <div className="modal-b">
        <p style={{ margin: 0 }}>ยืนยันยกเลิกการจอง <b>{l.name}</b> ใช่หรือไม่</p>
        <p className="help">ลูกค้าจะกลับเข้าถังให้เซลล์คนอื่นจองได้ ประวัติที่บันทึกไว้ยังอยู่</p>
      </div>
      <div className="modal-f">
        <button className="btn" data-close>ไม่ยกเลิก</button>
        <button className="btn danger solid" id="unclaim-ok" onClick={() => void onConfirm()}>ยืนยันยกเลิกจอง</button>
      </div>
    </>
  );
}
