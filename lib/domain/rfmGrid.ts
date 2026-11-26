import { rfmSegment, type RfmSeg } from './rfm';

/**
 * ผังของแผนที่กลุ่มลูกค้า (หน้า /rfm) สร้างจากกติกา ไม่วางตำแหน่งตายตัว
 * - แถบ F / R ตัดที่ทุกค่าขอบที่มีในกติกา → ทุกจุดในช่องเดียวกันได้กลุ่มเดียวกัน
 * - แถวบนสุด = ซื้อบ่อยสุด, คอลัมน์ซ้ายสุด = หายไปนานสุด (เหมือนกราฟ RFM เดิมของทีม)
 * - ช่องติดกันที่เป็นกลุ่มเดียวกันรวมเป็นสี่เหลี่ยม · กลุ่มหนึ่งมีได้หลายสี่เหลี่ยม: ชื่อ + จำนวนแสดงที่ primary (พื้นที่มากสุด)
 */
export interface RfmBand { min: number; max: number | null; label: string; short: string }
export interface RfmRect { key: string; row: number; col: number; rowSpan: number; colSpan: number; primary: boolean }
export interface RfmGrid { fBands: RfmBand[]; rBands: RfmBand[]; rects: RfmRect[] }

type Range = { min: number; max: number | null };

function ranges(config: ReadonlyArray<RfmSeg>, lo: 'fMin' | 'rMin', hi: 'fMax' | 'rMax', floor: number): Range[] {
  const starts = new Set<number>([floor]);
  for (const s of config) {
    if (s.fallback) continue;
    const a = s[lo];
    const b = s[hi];
    if (a != null && a > floor) starts.add(a);
    if (b != null) starts.add(b + 1);
  }
  const st = [...starts].sort((x, y) => x - y);
  return st.map((min, i) => ({ min, max: i + 1 < st.length ? st[i + 1] - 1 : null }));
}

const span = (b: Range): string => (b.max === b.min ? String(b.min) : `${b.min}–${b.max}`);
const fBand = (b: Range): RfmBand => {
  const short = b.max == null ? `${b.min}+` : span(b);
  return { ...b, short, label: `${short} ครั้ง` };
};
const rBand = (b: Range): RfmBand => {
  const short = b.max == null ? (b.min > 0 ? `เกิน ${b.min - 1}` : 'ทุกช่วง') : span(b);
  return { ...b, short, label: b.max == null && b.min === 0 ? short : `${short} วัน` };
};

export function rfmGrid(config: ReadonlyArray<RfmSeg>): RfmGrid {
  const f = ranges(config, 'fMin', 'fMax', 1).reverse();
  const r = ranges(config, 'rMin', 'rMax', 0).reverse();
  const cell = f.map((fb) => r.map((rb) => rfmSegment(fb.min, rb.min, config) ?? ''));
  const used = f.map(() => r.map(() => false));
  const rects: RfmRect[] = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < r.length; j++) {
      const key = cell[i][j];
      if (used[i][j] || !key) continue;
      let w = 1;
      while (j + w < r.length && !used[i][j + w] && cell[i][j + w] === key) w++;
      let h = 1;
      const rowFits = (row: number): boolean => {
        for (let c = j; c < j + w; c++) if (used[row][c] || cell[row][c] !== key) return false;
        return true;
      };
      while (i + h < f.length && rowFits(i + h)) h++;
      for (let a = i; a < i + h; a++) for (let c = j; c < j + w; c++) used[a][c] = true;
      rects.push({ key, row: i, col: j, rowSpan: h, colSpan: w, primary: false });
    }
  }
  const best = new Map<string, RfmRect>();
  for (const x of rects) {
    const cur = best.get(x.key);
    if (!cur || x.rowSpan * x.colSpan > cur.rowSpan * cur.colSpan) best.set(x.key, x);
  }
  for (const x of best.values()) x.primary = true;
  return { fBands: f.map(fBand), rBands: r.map(rBand), rects };
}
