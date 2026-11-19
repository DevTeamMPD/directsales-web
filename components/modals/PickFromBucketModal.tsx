'use client';

import { useRouter } from 'next/navigation';
import { CloseButton } from '@/components/ui/CloseButton';
import type { Brand } from '@/lib/constants';
import { useActions } from '@/lib/state/AppProvider';

/** ไม่ให้พิมพ์ข้อมูลเอง: เลือกลูกค้าจากถัง "ลูกค้าทั้งหมด" ของแบรนด์แล้วกด จอง (prototype L602-610: ล้างคำค้นถัง + โฟกัสช่องค้นหา) */
export function PickFromBucketModal() {
  const router = useRouter();
  const { setUi, setPool, dispatch, closeModal } = useActions();
  const open = (brand: Brand) => {
    setUi({ selCamp: 'ALL', focusSearch: true });
    setPool({ q: '', page: 0 });
    dispatch({ type: 'invalidatePool' });
    closeModal();
    router.push(`/campaigns/${brand}`);
  };
  return (
    <>
      <div className="modal-h"><h3>เพิ่มลูกค้า</h3><CloseButton /></div>
      <div className="modal-b">
        <p style={{ margin: 0 }}>เลือกลูกค้าจากถัง <b>ลูกค้าทั้งหมด</b> ของแบรนด์ แล้วกด <b>จอง</b> (ไม่ต้องพิมพ์ข้อมูลเอง)</p>
        <p className="help">ค้นหาได้จาก เบอร์โทร, เลขบิลเดิมที่เคยซื้อ, ชื่อแชต หรือชื่อลูกค้า</p>
        <div className="form-grid">
          <button className="btn primary" data-open-bucket="bebeplay" onClick={() => open('bebeplay')}>ถังลูกค้าทั้งหมด Bebeplay</button>
          <button className="btn primary" data-open-bucket="hosttail" onClick={() => open('hosttail')}>ถังลูกค้าทั้งหมด Hosttail</button>
        </div>
      </div>
    </>
  );
}
