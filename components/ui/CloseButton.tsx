import { PATHS } from '@/lib/constants';

/** ปุ่ม X ของ popup — ModalRoot ปิด popup เมื่อคลิก [data-close] */
export function CloseButton() {
  return (
    <button className="icon-btn" data-close aria-label="ปิด">
      <svg viewBox="0 0 24 24"><path d={PATHS.close} /></svg>
    </button>
  );
}
