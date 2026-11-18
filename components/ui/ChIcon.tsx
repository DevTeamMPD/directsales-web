import { iconSrc } from '@/lib/icons';
import { platLabel } from '@/lib/jst';

/** ไอคอนช่องทางแชต (data URI จาก lib/icons.ts) */
export function ChIcon({ p, size }: { p: string; size: number }) {
  // data URI ขนาดเล็กแบบเดียวกับ prototype ไม่ต้องผ่าน next/image
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ch-ico" width={size} height={size} alt={platLabel(p)} src={iconSrc(p)} />;
}
