/**
 * กลุ่มลูกค้า RFM — กติกาอ่านจาก config (dsales.dsales_rfm_segments ผ่าน dsales_rfm_config_get)
 * F = จำนวนออเดอร์, R = วันที่ไม่ได้ซื้อ · เช็กตามลำดับ (sort) ข้อแรกที่ตรง = กลุ่มนั้น · กลุ่ม fallback (Lost) รับที่เหลือ
 * DEFAULT_RFM_CONFIG ต้องตรงกับ seed ใน supabase/migrations/20261126150000_dsales_rfm_config.sql
 * (ใช้กับโหมด fixture และเมื่อโหลด config จาก server ไม่ได้)
 */
export interface RfmSeg {
  key: string; sort: number;
  /** ช่วงรวมขอบ · max null = ไม่จำกัด · กลุ่ม fallback ไม่มีช่วง (null ทั้งหมด) */
  fMin: number | null; fMax: number | null; rMin: number | null; rMax: number | null; fallback: boolean;
  tone: string; behavior: string; action: string;
  templateBebeplay: string | null; templateHosttail: string | null; noOutreach: boolean;
}

const seg = (
  sort: number, key: string, f: [number, number | null] | null, r: [number, number | null] | null, tone: string, behavior: string, action: string,
): RfmSeg => ({
  key, sort, fMin: f ? f[0] : null, fMax: f ? f[1] : null, rMin: r ? r[0] : null, rMax: r ? r[1] : null, fallback: !f,
  tone, behavior, action, templateBebeplay: null, templateHosttail: null, noOutreach: false,
});

export const DEFAULT_RFM_CONFIG: ReadonlyArray<RfmSeg> = [
  seg(1, 'Champion', [6, null], [0, 30], 'ดูแลพิเศษ', 'ลูกค้าแชมป์เปี้ยน มาบ่อย ซื้อเยอะ',
    'บริการพิเศษ ขอรีวิว ส่งสินค้าใหม่ให้ลองฟรี ของขวัญวันเกิด ต้องดูแลรักษาไว้ให้ดีที่สุด'),
  seg(2, "Shouldn't Lose", [6, null], [91, null], 'Hard winback', 'ลูกค้ายอดสูงที่หายจากเราไปนานแล้ว อาจไปซื้อคู่แข่ง',
    'Hard winback: จัดโปรแรงในสินค้าที่เคยซื้อ แนะนำสินค้าใหม่ที่น่าถูกใจ'),
  seg(3, 'Loyal', [4, null], [0, 90], 'กระตุ้นซื้อซ้ำ', 'ลูกค้าประจำ มาบ่อย ซื้อเยอะ แต่ห่างไปช่วงสั้น ๆ แล้ว',
    'สะสมแต้มทุกสัปดาห์/เดือน ของขวัญวันเกิด เพื่อเพิ่ม Recency'),
  seg(4, 'Sleepers', [3, 5], [91, null], 'Soft winback', 'ลูกค้าที่ซื้อยอดกลาง ๆ ที่หายไปสักพักแล้ว',
    'Soft winback: จัดโปรเบา ๆ ให้ลูกค้ากลับมาซื้อ แนะนำสินค้าที่น่าถูกใจ'),
  seg(5, 'Promising', [2, 3], [0, 60], 'Up-sell', 'ลูกค้ามาบ่อยพอสมควร ซื้อขนาดกลาง ๆ',
    'Up-sell: แนะนำสินค้าที่ลูกค้าน่าจะถูกใจ อัปเกรดเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  seg(6, 'Need Attention', [2, 3], [61, 90], 'Up-sell / Cross-sell', 'ลูกค้าที่ซื้อมาสักระยะ มีศักยภาพที่จะขายได้เพิ่ม',
    'Up-sell, Cross-sell: แนะนำสินค้าที่ถูกใจ โปรพิเศษตามเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  seg(7, 'Hot', [1, 1], [0, 30], 'ต้อนรับ', 'ลูกค้าหน้าใหม่ เพิ่งมาซื้อครั้งแรก',
    'สร้างความสัมพันธ์ ต้อนรับสมาชิกใหม่ ชวนรับข่าวสารจากแบรนด์ สะสมแต้ม'),
  seg(8, 'Warm', [1, 1], [31, 60], 'Hard conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ยังตามกลับมาได้ทัน',
    'Hard conversation: ติดต่อกลับให้เร็วที่สุด ผ่านช่องทางที่ลูกค้าต้องการให้ติดต่อ สร้างความมั่นใจ'),
  seg(9, 'Cold', [1, 1], [61, 90], 'Soft conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ตามกลับมาไม่ทันแล้ว',
    'Soft conversation: สร้างความมั่นใจ ไม่ปล่อยให้ห่างเหิน แต่ไม่รบกวนเกินไป ติดต่อด้วยสื่อที่ไม่รบกวนมาก'),
  seg(10, 'Lost', null, null, 'หยุดส่ง', 'ลูกค้าที่ซื้อน้อย ไม่บ่อย และหายไปนานแล้ว',
    'หยุดส่งแคมเปญ เอางบและเวลาไปลงกับกลุ่มอื่นดีกว่า'),
];

const matches = (s: RfmSeg, orders: number, days: number): boolean =>
  s.fallback || (s.fMin != null && s.rMin != null && orders >= s.fMin && (s.fMax == null || orders <= s.fMax) && days >= s.rMin && (s.rMax == null || days <= s.rMax));

/** config ต้องเรียงตาม sort แล้ว (mapRfmConfig / DEFAULT_RFM_CONFIG เรียงให้) */
export function rfmSegment(orders: number | null | undefined, days: number | null | undefined, config: ReadonlyArray<RfmSeg> = DEFAULT_RFM_CONFIG): string | null {
  if (orders == null || orders < 1 || days == null) return null;
  const d = Math.max(days, 0); // วันซื้อล่าสุดอยู่หลังวันนี้ (ข้อมูลผิด) = นับเป็นซื้อวันนี้ เหมือนกติกาเดิม
  return config.find((s) => matches(s, orders, d))?.key ?? null;
}

/** ข้อความเงื่อนไขของกลุ่มจากตัวเลขกติกา (tooltip ของป้ายกลุ่ม, การ์ดแนวทางในหน้า /rfm) */
export function rfmRuleText(s: RfmSeg): string {
  if (s.fallback || s.fMin == null || s.rMin == null) return 'ลูกค้าที่เหลือทั้งหมดที่ไม่เข้ากลุ่มอื่น';
  const f = s.fMax == null ? `ซื้อ ${s.fMin} ครั้งขึ้นไป` : s.fMax === s.fMin ? (s.fMin === 1 ? 'ซื้อครั้งเดียว' : `ซื้อ ${s.fMin} ครั้ง`) : `ซื้อ ${s.fMin}–${s.fMax} ครั้ง`;
  const r = s.rMax == null ? (s.rMin === 0 ? 'ซื้อล่าสุดเมื่อไรก็ได้' : `หายไปเกิน ${s.rMin - 1} วัน`) : s.rMin === 0 ? `ซื้อล่าสุดไม่เกิน ${s.rMax} วัน` : `ซื้อล่าสุด ${s.rMin}–${s.rMax} วัน`;
  return `${f} · ${r}`;
}

export const rfmRule = (key: string, config: ReadonlyArray<RfmSeg> = DEFAULT_RFM_CONFIG): string => {
  const s = config.find((x) => x.key === key);
  return s ? rfmRuleText(s) : '';
};

/** ชื่อกลุ่ม → ชื่อใน CSS (.rfm-seg-<slug>, --rfm-<slug>) */
export const rfmSlug = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export interface RfmSegmentDef { key: string; label: string }
/** ลำดับชิปของ /mine /pool: กลุ่มที่ยังซื้ออยู่ → ซื้อครั้งเดียว → หายไปนาน */
export const RFM_SEGMENTS: ReadonlyArray<RfmSegmentDef> =
  ['Champion', 'Loyal', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost'].map((key) => ({ key, label: key }));

/** แถวของ dsales_base_segment_counts ('' = ยังไม่จัดกลุ่ม) → { กลุ่ม: จำนวน } */
export function rfmCountMap(rows: ReadonlyArray<{ segment: string; n: number | string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.segment] = (out[r.segment] ?? 0) + Number(r.n);
  return out;
}
