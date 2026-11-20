import type { BaseFilterJson, Brand, ChatRoom, PoolRow } from '@/lib/api/types';
import { PLAT } from '@/lib/constants';

// ตัวกรองของ /mine และ /pool (dsales_base_customers.p_filters) — ฟังก์ชันล้วน

export type BaseSort = NonNullable<BaseFilterJson['sort']>;

/** สถานะตัวกรองใน UI: ช่วงต่าง ๆ เก็บเป็น key ของ preset ('' = ทั้งหมด) */
export interface BaseFilters {
  rfm: string[]; dormant: string; ltv: string; orders: string; provider: string; tag: string; hasChat: boolean; sort: BaseSort;
}
export const EMPTY_FILTERS: BaseFilters = { rfm: [], dormant: '', ltv: '', orders: '', provider: '', tag: '', hasChat: false, sort: 'ltv' };

export interface Option { value: string; label: string }

/** กลุ่มลูกค้า (rfm_segment) — '' = ยังไม่จัดกลุ่ม (rfm_segment เป็น null ซึ่งเป็นแถวส่วนใหญ่) */
export const RFM_OPTIONS: ReadonlyArray<Option> = [
  { value: 'Loyal', label: 'Loyal' },
  { value: 'Potential', label: 'Potential' },
  { value: 'Promising', label: 'Promising' },
  { value: 'At Risk', label: 'At Risk' },
  { value: 'Hibernating', label: 'Hibernating' },
  { value: 'Unscored', label: 'Unscored' },
  { value: '', label: 'ยังไม่จัดกลุ่ม' },
];

export interface RangePreset { key: string; label: string; min: number; max: number | null }
export const DORMANT_PRESETS: ReadonlyArray<RangePreset> = [
  { key: '30-60', label: 'ไม่ได้ซื้อมา 30–60 วัน', min: 30, max: 60 },
  { key: '61-90', label: 'ไม่ได้ซื้อมา 61–90 วัน', min: 61, max: 90 },
  { key: '91-180', label: 'ไม่ได้ซื้อมา 91–180 วัน', min: 91, max: 180 },
  { key: '181-365', label: 'ไม่ได้ซื้อมา 181–365 วัน', min: 181, max: 365 },
  { key: '366-', label: 'ไม่ได้ซื้อมาเกิน 365 วัน', min: 366, max: null },
];
export const LTV_PRESETS: ReadonlyArray<RangePreset> = [1000, 5000, 10000, 50000].map((n) => ({
  key: String(n), label: `ยอดซื้อสะสม ≥ ${n.toLocaleString('en-US')}`, min: n, max: null,
}));
export const ORDERS_PRESETS: ReadonlyArray<RangePreset> = [2, 3, 5].map((n) => ({ key: String(n), label: `ออเดอร์ ≥ ${n}`, min: n, max: null }));

export const PROVIDERS = ['line', 'shopee', 'lazada', 'facebook', 'instagram', 'tiktok'] as const;
export const PROVIDER_OPTIONS: ReadonlyArray<Option> = PROVIDERS.map((p) => ({ value: p, label: `ช่องทาง ${PLAT[p]}` }));

export const SORT_OPTIONS: ReadonlyArray<{ value: BaseSort; label: string }> = [
  { value: 'ltv', label: 'มูลค่าสูงสุด' },
  { value: 'dormant_desc', label: 'หายนานสุด' },
  { value: 'dormant_asc', label: 'เพิ่งหายไป' },
  { value: 'last_desc', label: 'ซื้อล่าสุด' },
  { value: 'orders_desc', label: 'ซื้อบ่อยสุด' },
];

/** ตัวเลือกแรกของแต่ละ select (= ไม่กรอง) */
export const ANY_LABEL = {
  dormant: 'ไม่ได้ซื้อมา: ทั้งหมด', ltv: 'ยอดซื้อสะสม: ทั้งหมด', orders: 'จำนวนออเดอร์: ทั้งหมด', provider: 'ช่องทาง: ทั้งหมด', tag: 'Tag: ทั้งหมด',
} as const;
export const NO_TAG = 'none';
export const NO_TAG_LABEL = 'ไม่มี tag';

const preset = (list: ReadonlyArray<RangePreset>, key: string): RangePreset | undefined => list.find((p) => p.key === key);
const SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value));

/** UI → p_filters (ส่งเฉพาะที่เลือก; ไม่มีตัวกรองและเรียงตามมูลค่า = {}) */
export function buildFilterJson(f: BaseFilters): BaseFilterJson {
  const out: BaseFilterJson = {};
  if (f.rfm.length) out.rfm = [...f.rfm];
  const d = preset(DORMANT_PRESETS, f.dormant);
  if (d) {
    out.dormant_min = d.min;
    if (d.max != null) out.dormant_max = d.max;
  }
  const l = preset(LTV_PRESETS, f.ltv);
  if (l) out.ltv_min = l.min;
  const o = preset(ORDERS_PRESETS, f.orders);
  if (o) out.orders_min = o.min;
  if (f.tag.trim()) out.tag = f.tag.trim();
  if (f.hasChat) out.has_chat = true;
  if ((PROVIDERS as ReadonlyArray<string>).includes(f.provider)) out.provider = f.provider;
  if (f.sort !== 'ltv' && SORTS.has(f.sort)) out.sort = f.sort;
  return out;
}

export const hasFilters = (f: BaseFilters): boolean => Object.keys(buildFilterJson(f)).length > 0;

export function toggleRfm(f: BaseFilters, value: string): BaseFilters {
  return { ...f, rfm: f.rfm.includes(value) ? f.rfm.filter((v) => v !== value) : [...f.rfm, value] };
}

/** รายชื่อ tag สำหรับ select (ไม่ซ้ำแบบไม่สนตัวพิมพ์ เรียงตามตัวอักษร) */
export function tagOptions(tags: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const t of tags) {
    const v = (t ?? '').trim();
    if (v && v.toLowerCase() !== NO_TAG && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/* ---------- เก็บตัวกรองใน URL (?brand=&rfm=&dormant=&ltv=&orders=&provider=&tag=&chat=1&sort=) ---------- */
export function filtersToQuery(f: BaseFilters, brand: string): string {
  const q = new URLSearchParams();
  if (brand) q.set('brand', brand);
  for (const v of f.rfm) q.append('rfm', v);
  if (f.dormant) q.set('dormant', f.dormant);
  if (f.ltv) q.set('ltv', f.ltv);
  if (f.orders) q.set('orders', f.orders);
  if (f.provider) q.set('provider', f.provider);
  if (f.tag) q.set('tag', f.tag);
  if (f.hasChat) q.set('chat', '1');
  if (f.sort !== 'ltv') q.set('sort', f.sort);
  return q.toString();
}

/** ค่าที่ไม่รู้จักใน URL ถูกทิ้ง (กลับเป็นค่าเริ่มต้น) */
export function filtersFromQuery(search: string): { filters: BaseFilters; brand: '' | Brand } {
  const q = new URLSearchParams(search);
  const pick = (k: string, ok: (v: string) => boolean): string => {
    const v = q.get(k) ?? '';
    return ok(v) ? v : '';
  };
  const rfmOk = new Set(RFM_OPTIONS.map((o) => o.value));
  const brand = q.get('brand');
  const sort = q.get('sort') ?? '';
  return {
    brand: brand === 'bebeplay' || brand === 'hosttail' ? brand : '',
    filters: {
      rfm: [...new Set(q.getAll('rfm').filter((v) => rfmOk.has(v)))],
      dormant: pick('dormant', (v) => !!preset(DORMANT_PRESETS, v)),
      ltv: pick('ltv', (v) => !!preset(LTV_PRESETS, v)),
      orders: pick('orders', (v) => !!preset(ORDERS_PRESETS, v)),
      provider: pick('provider', (v) => (PROVIDERS as ReadonlyArray<string>).includes(v)),
      tag: (q.get('tag') ?? '').trim(),
      hasChat: q.get('chat') === '1',
      sort: SORTS.has(sort) ? (sort as BaseSort) : 'ltv',
    },
  };
}

/* ---------- โหมด fixture: กรอง/เรียงฝั่ง client ตามกติกาเดียวกับ dsales_base_customers ---------- */
export function matchesFilters(r: PoolRow, f: BaseFilters, brand: Brand | null): boolean {
  const j = buildFilterJson(f);
  if (j.rfm && !j.rfm.includes(r.segment || '')) return false;
  if (j.dormant_min != null && (r.dormantDays == null || r.dormantDays < j.dormant_min)) return false;
  if (j.dormant_max != null && (r.dormantDays == null || r.dormantDays > j.dormant_max)) return false;
  if (j.ltv_min != null && (r.ltv ?? 0) < j.ltv_min) return false;
  if (j.orders_min != null && (r.orders ?? 0) < j.orders_min) return false;
  if (j.tag) {
    const tag = (r.ownerTag ?? '').toLowerCase();
    if (j.tag.toLowerCase() === NO_TAG ? !!tag : tag !== j.tag.toLowerCase()) return false;
  }
  if (j.has_chat && !(brand ? r.chatBrands.includes(brand) : r.chatBrands.length > 0)) return false;
  if (j.provider && !r.chatRooms.some((x) => x.provider === j.provider)) return false;
  return true;
}

/** null ไปท้ายเสมอ; เท่ากันเรียงตามยอดซื้อมากสุด */
export function sortBaseRows<T extends Pick<PoolRow, 'ltv' | 'dormantDays' | 'last' | 'orders'>>(rows: ReadonlyArray<T>, sort: BaseSort): T[] {
  const num = (r: T): number | null => {
    switch (sort) {
      case 'dormant_asc': return r.dormantDays == null ? null : -r.dormantDays;
      case 'dormant_desc': return r.dormantDays;
      case 'last_desc': return r.last ? Date.parse(r.last.slice(0, 10)) : null;
      case 'orders_desc': return r.orders;
      default: return r.ltv;
    }
  };
  return [...rows].sort((a, b) => {
    const x = num(a);
    const y = num(b);
    if (x !== y) {
      if (x == null) return 1;
      if (y == null) return -1;
      return y - x;
    }
    return (b.ltv ?? 0) - (a.ltv ?? 0);
  });
}

/* ---------- ไอคอนห้องแชตในตาราง ---------- */
const platName = (p: string): string => (PLAT as Readonly<Record<string, string>>)[p] || p;

/** ห้องที่ worker ส่งไม่ได้: เพจนอก 2 แบรนด์ / Facebook-Instagram ที่ลูกค้าเงียบเกิน 24 ชม. */
export function roomNote(r: Pick<ChatRoom, 'brand' | 'sendable'>): string | null {
  if (r.sendable) return null;
  return r.brand ? 'เกิน 24 ชม. ส่งผ่าน worker ไม่ได้' : 'เพจนอกแบรนด์';
}

export function roomTitle(r: ChatRoom): string {
  const note = roomNote(r);
  return `${platName(r.provider)}${r.page ? ' · ' + r.page : ''} — ${note ? note + ' (กดเพื่อเปิดแชตใน JST)' : 'เปิดแชตใน JST'}`;
}

/** จำนวนผลลัพธ์ใต้ตัวกรอง */
export const resultCountText = (total: number | null): string => (total == null ? '' : `พบ ${total.toLocaleString('th-TH')} คน`);
