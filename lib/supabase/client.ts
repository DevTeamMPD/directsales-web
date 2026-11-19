import { createBrowserClient } from '@supabase/ssr';

/** client ฝั่งเบราว์เซอร์ (session เก็บใน cookie ผ่าน @supabase/ssr ใช้ร่วมกับ middleware; ในเบราว์เซอร์เป็น singleton) */
export function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** ข้อมูล Direct Sale ทั้งหมดอยู่ใน schema dsales (supabase() ใช้เฉพาะ auth) */
export function db() {
  return supabase().schema('dsales');
}
