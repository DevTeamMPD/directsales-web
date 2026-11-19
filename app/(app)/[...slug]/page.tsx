import { redirect } from 'next/navigation';

/** URL ที่ไม่รู้จัก → Direct Sale (prototype: hash ที่ไม่รู้จักแสดงหน้า leads) */
export default function UnknownPage() {
  redirect('/leads');
}
