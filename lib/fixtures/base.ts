import type { Brand, ChatRoom, DemoCustomer } from '@/lib/api/types';

// โหมด fixture ของ /mine /pool: เติมห้องแชต (chat_rooms), กลุ่ม RFM และ tag เจ้าของให้ลูกค้าตัวอย่างแบบคงที่ (ไม่สุ่ม)
// เลียนข้อมูลจริงของ dsales_base_customers: ห้องตามร้านที่ลูกค้าเคยซื้อ, บางคนมีห้องของอีกแบรนด์,
// บางคนมีเพจนอกแบรนด์ (brand null), Facebook/Instagram ส่วนใหญ่เกิน 24 ชม. (ส่งไม่ได้), rfm_segment ส่วนใหญ่เป็น null

const PREFIX: Readonly<Record<string, string>> = { LOA: 'line', SH: 'shopee', LA: 'lazada', TT: 'tiktok', FB: 'facebook', IG: 'instagram' };
const RFM = ['Loyal', 'Potential', 'Promising', 'At Risk', 'Hibernating', 'Unscored'] as const;
const TAGS = ['Admin_Pop', 'Admin_Taew', 'Admin_Sao', 'Admin_Beau', 'Admin_Ann'] as const;
const OTHER: Readonly<Record<Brand, Brand>> = { bebeplay: 'hosttail', hosttail: 'bebeplay' };
const ORDER: Readonly<Record<string, number>> = { line: 0, shopee: 1, lazada: 1, tiktok: 1, facebook: 2, instagram: 2 };

const brandOf = (shop: string): Brand | null => {
  const s = shop.toLowerCase();
  return s.endsWith('bebeplay') ? 'bebeplay' : s.endsWith('hosttail') ? 'hosttail' : null;
};

export function fixtureRooms(c: DemoCustomer, i: number): ChatRoom[] {
  const shops = (c.channels.length ? c.channels.map((ch) => ch.shop || '') : [c.shop]).filter(Boolean);
  if (i % 3 === 1) shops.push(`LOA_${OTHER[c.brand]}`); // มีห้อง LINE ของอีกแบรนด์ด้วย
  if (i % 5 === 2) shops.push(`FB_${c.brand}`); // ห้อง Facebook ที่ลูกค้าเงียบเกิน 24 ชม.
  if (i % 7 === 3) shops.push('FB_MPDOutlet'); // เพจนอกแบรนด์
  const rooms: ChatRoom[] = [];
  for (const shop of [...new Set(shops)]) {
    const provider = PREFIX[shop.split('_')[0].toUpperCase()];
    if (!provider) continue; // เว็บไซต์ไม่มีห้องแชต
    const brand = brandOf(shop);
    // Facebook ของลูกค้าบางคนยังอยู่ในช่วง 24 ชม. (ทักมาเมื่อวาน)
    const open = provider === 'facebook' || provider === 'instagram' ? i % 10 === 0 : true;
    rooms.push({ msId: 800000 + i * 10 + rooms.length, provider, page: shop, brand, sendable: !!brand && open });
  }
  return rooms.sort((a, b) => Number(b.sendable) - Number(a.sendable) || ORDER[a.provider] - ORDER[b.provider]);
}

export function withBaseExtras(customers: ReadonlyArray<DemoCustomer>): DemoCustomer[] {
  return customers.map((c, i) => ({
    ...c,
    chatRooms: fixtureRooms(c, i),
    rfm: i % 3 === 0 ? RFM[(i / 3) % RFM.length] : null,
    ownerTag: i % 4 === 2 ? TAGS[(i >> 2) % TAGS.length] : null,
  }));
}
