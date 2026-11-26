import type { RfmMapRow } from '@/lib/api/types';
import type { BaseScopeKey } from './pool';
import type { RfmSeg } from './rfm';

// สถานะและข้อความของหน้า /rfm — ฟังก์ชันล้วน

export const RFM_SCOPE_LABEL: Record<BaseScopeKey, string> = { team: 'ทั้งทีม', mine: 'ลูกค้าของฉัน', pool: 'ถังกลาง' };

/** หัวหน้า (ไม่ได้ดูในมุมมองเซลล์) เห็น "ทั้งทีม" และเริ่มที่นั่น · เซลล์ / หัวหน้าในมุมมองเซลล์ = ลูกค้าของฉัน, ถังกลาง */
export const rfmScopes = (teamView: boolean): BaseScopeKey[] => (teamView ? ['team', 'mine', 'pool'] : ['mine', 'pool']);

export interface RfmPageState { seg: string; scope: BaseScopeKey }

/** /rfm?seg=<กลุ่ม>&scope=<ขอบเขต> — ค่าที่ไม่รู้จักถูกทิ้ง (ไม่เลือกกลุ่ม / ขอบเขตแรกของผู้ใช้) */
export function rfmPageFromQuery(search: string, scopes: ReadonlyArray<BaseScopeKey>, config: ReadonlyArray<Pick<RfmSeg, 'key'>>): RfmPageState {
  const q = new URLSearchParams(search);
  const seg = q.get('seg') ?? '';
  const scope = scopes.find((s) => s === q.get('scope')) ?? scopes[0];
  return { seg: config.some((s) => s.key === seg) ? seg : '', scope };
}

export function rfmPageToQuery(st: RfmPageState, defaultScope: BaseScopeKey): string {
  const q = new URLSearchParams();
  if (st.seg) q.set('seg', st.seg);
  if (st.scope !== defaultScope) q.set('scope', st.scope);
  return q.toString();
}

export interface RfmMapStats { n: Record<string, number>; contactable: Record<string, number>; scored: number; unscored: number }

/** แถวของ dsales_rfm_map → จำนวนต่อกลุ่ม + ยอดที่จัดกลุ่มแล้ว / ยังไม่มีกลุ่ม ('') */
export function rfmMapStats(rows: ReadonlyArray<RfmMapRow>): RfmMapStats {
  const n: Record<string, number> = {};
  const contactable: Record<string, number> = {};
  for (const r of rows) {
    n[r.segment] = (n[r.segment] ?? 0) + Number(r.n);
    contactable[r.segment] = (contactable[r.segment] ?? 0) + Number(r.contactable);
  }
  const unscored = n[''] ?? 0;
  const scored = Object.values(n).reduce((a, b) => a + b, 0) - unscored;
  return { n, contactable, scored, unscored };
}

export const rfmPercent = (n: number, total: number): string => (total > 0 ? `${(Math.round((n / total) * 1000) / 10).toLocaleString('th-TH')}%` : '—');

export const rfmSummaryText = (scored: number, unscored: number): string =>
  `จัดกลุ่มแล้ว ${scored.toLocaleString('th-TH')} ราย · ยังไม่มีข้อมูลการซื้อ ${unscored.toLocaleString('th-TH')} ราย`;
