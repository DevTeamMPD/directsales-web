// ค่าคงที่จาก prototype (legacy/app.js) — ข้อความต้องตรงตัวอักษร
export const BRAND = { bebeplay: 'Bebeplay', hosttail: 'Hosttail' } as const;
export type Brand = keyof typeof BRAND;

export const STATUS = {
  new: 'ยังไม่ติดต่อ',
  following: 'กำลังติดตาม',
  callback: 'รอติดต่อ',
  won: 'ปิดการขายแล้ว',
  lost: 'ไม่สนใจ',
  unreachable: 'ติดต่อไม่ได้',
} as const;
export type LeadStatus = keyof typeof STATUS;

export const MODES = { self: 'เซลล์จองเอง', assign: 'หัวหน้ามอบหมาย', auto: 'เด้งเข้าเซลล์ที่ขายล่าสุด' } as const;
export type ClaimMode = keyof typeof MODES;

export type Role = 'admin' | 'sales';

export const PLAT = {
  shopee: 'Shopee', line: 'LINE', facebook: 'Facebook', lazada: 'Lazada',
  tiktok: 'TikTok', instagram: 'Instagram', website: 'เว็บไซต์', other: 'อื่นๆ',
} as const;
export type Platform = keyof typeof PLAT;

export const PAGE = 50;

export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;

export type CritType = 'product' | 'total' | 'dates' | 'order' | 'times';
export type CritField = readonly ['text' | 'number' | 'date', string, string];
export const CRIT: Record<CritType, { label: string; fields: readonly CritField[] }> = {
  product: { label: 'เคยซื้อสินค้า (ชื่อ / SKU)', fields: [['text', 'kw', 'เช่น เตียงนอน หรือ BBP-BED']] },
  total: { label: 'ยอดซื้อรวม (บาท)', fields: [['number', 'min', 'ตั้งแต่'], ['number', 'max', 'ถึง']] },
  dates: { label: 'ซื้อเมื่อ (ช่วงวันที่)', fields: [['date', 'from', 'ตั้งแต่วันที่'], ['date', 'to', 'ถึงวันที่']] },
  order: { label: 'ยอดสั่งซื้อต่อบิลตั้งแต่ (บาท)', fields: [['number', 'min', 'ตั้งแต่ขึ้นไป']] },
  times: { label: 'ซื้อมากกว่า (ครั้ง)', fields: [['number', 'min', 'มากกว่ากี่ครั้ง']] },
};

export const JST_HELPER_URL = process.env.NEXT_PUBLIC_JST_HELPER_URL || 'http://127.0.0.1:47321';
export const JST_URL_TEMPLATE = process.env.NEXT_PUBLIC_JST_URL_TEMPLATE || '';

/** โหมด fixture (next dev เท่านั้น): ปุ่มที่เขียนข้อมูลไม่เรียก RPC เพื่อไม่ให้ id ตัวอย่างวิ่งไป Supabase จริง */
export const FIXTURE_NO_WRITE = 'โหมด fixture: ไม่ได้บันทึกลง Supabase';

/** path ของ SVG 24x24 ที่ prototype ใช้ (index.html และ app.js) + เมนูใหม่ 2 รายการ */
export const PATHS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  grid: 'M3 3h8v10H3zm10 0h8v6h-8zM3 15h8v6H3zm10-4h8v10h-8z',
  gear: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  person: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z',
  list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
  logout: 'M10 17l1.4-1.4L8.8 13H20v-2H8.8l2.6-2.6L10 7l-5 5zM4 4h8V2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8v-2H4z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  chat: 'M4 4h16v12H7l-3 3z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
} as const;
