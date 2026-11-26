/**
 * กลุ่มลูกค้า RFM แบบระบบเก่า — กติกาเดียวกับ dsales.dsales_rfm (20261125140000) ใช้กับโหมด fixture และป้ายอธิบาย
 * F = จำนวนออเดอร์, R = วันที่ไม่ได้ซื้อ · เช็กตามลำดับ ข้อแรกที่ตรง = กลุ่มนั้น
 * (ฐานลูกค้าเก่าเริ่มที่ไม่ซื้อ 30 วัน จึงรวม Hot New Member เดิมไว้ใน Warm)
 */
export function rfmSegment(orders: number | null | undefined, days: number | null | undefined): string | null {
  if (orders == null || orders < 1 || days == null) return null;
  if (orders >= 6 && days <= 30) return 'Champion';
  if (orders >= 6 && days > 90) return "Shouldn't Lose";
  if (orders >= 4 && days <= 90) return 'Loyal';
  if (orders >= 3 && days > 90) return 'Sleepers';
  if (orders >= 2 && days <= 60) return 'Promising';
  if (orders >= 2 && days <= 90) return 'Need Attention';
  if (orders === 1 && days <= 60) return 'Warm';
  if (orders === 1 && days <= 90) return 'Cold';
  return 'Lost';
}

export interface RfmSegmentDef { key: string; label: string; rule: string }
/** ลำดับชิป: กลุ่มที่ยังซื้ออยู่ → ซื้อครั้งเดียว → หายไปนาน */
export const RFM_SEGMENTS: ReadonlyArray<RfmSegmentDef> = [
  { key: 'Champion', label: 'Champion', rule: 'ซื้อ 6 ครั้งขึ้นไป · ซื้อล่าสุดไม่เกิน 30 วัน' },
  { key: 'Loyal', label: 'Loyal', rule: 'ซื้อ 4 ครั้งขึ้นไป · ซื้อล่าสุดไม่เกิน 90 วัน' },
  { key: 'Promising', label: 'Promising', rule: 'ซื้อ 2–3 ครั้ง · ซื้อล่าสุดไม่เกิน 60 วัน' },
  { key: 'Need Attention', label: 'Need Attention', rule: 'ซื้อ 2–3 ครั้ง · ซื้อล่าสุด 61–90 วัน' },
  { key: 'Warm', label: 'Warm', rule: 'ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 60 วัน' },
  { key: 'Cold', label: 'Cold', rule: 'ซื้อครั้งเดียว · ซื้อล่าสุด 61–90 วัน' },
  { key: "Shouldn't Lose", label: "Shouldn't Lose", rule: 'ซื้อ 6 ครั้งขึ้นไป · หายไปเกิน 90 วัน' },
  { key: 'Sleepers', label: 'Sleepers', rule: 'ซื้อ 3–5 ครั้ง · หายไปเกิน 90 วัน' },
  { key: 'Lost', label: 'Lost', rule: 'ซื้อ 1–2 ครั้ง · หายไปเกิน 90 วัน' },
];

export const rfmRule = (key: string): string => RFM_SEGMENTS.find((s) => s.key === key)?.rule ?? '';

/** แถวของ dsales_base_segment_counts ('' = ยังไม่จัดกลุ่ม) → { กลุ่ม: จำนวน } */
export function rfmCountMap(rows: ReadonlyArray<{ segment: string; n: number | string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.segment] = (out[r.segment] ?? 0) + Number(r.n);
  return out;
}
