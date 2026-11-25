'use client';

import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { rowsTotal } from '@/lib/api/map';
import { getBaseCustomers } from '@/lib/api/rpc';
import type { BaseFilterJson, CampaignCriterion, PoolRowJson } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { audienceBrand, criteriaFilters, stepFilters } from '@/lib/domain/campaigns';
import { useActions } from '@/lib/state/AppProvider';

/** รอหยุดแก้เงื่อนไขก่อนนับ (แต่ละขั้น = 1 คำขอ) */
const DEBOUNCE_MS = 400;
export const SAMPLE_ROWS = 8;

export interface AudienceCounts {
  filterBrand: Brand | null;
  /** [ทั้งหมด, หลังเงื่อนไข 1, …] — null = กำลังนับ */
  counts: Array<number | null>;
  /** ลูกค้าที่ตรงทุกเงื่อนไขและยังไม่มีเจ้าของ (เซลล์จองได้) */
  claimable: number | null;
  sample: PoolRowJson[] | null;
  err: string;
}

/**
 * funnel ล็อกอินจริงของตัวสร้างแคมเปญ (หัวหน้าเท่านั้น): dsales_base_customers('team') ต่อขั้น ด้วยตัวกรองสะสมจาก criteria
 * + จำนวนที่ยังไม่มีเจ้าของ ('pool') · แถวตัวอย่าง 8 แถวจากขั้นสุดท้าย · enabled = false ไม่เรียกอะไร
 */
export function useAudienceCounts(brand: Brand, crits: ReadonlyArray<CampaignCriterion>, enabled: boolean): AudienceCounts {
  const { handleAuthError } = useActions();
  const filterBrand = audienceBrand(brand, crits);
  const steps = useMemo<BaseFilterJson[]>(() => [{}, ...stepFilters(crits)], [crits]);
  const key = JSON.stringify({ b: filterBrand, s: steps });
  const [res, setRes] = useState<{ key: string; counts: number[]; claimable: number; sample: PoolRowJson[]; err: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const t = setTimeout(() => {
      const last = steps.length - 1;
      Promise.all([
        ...steps.map((filters, i) => getBaseCustomers('team', { brand: filterBrand, limit: i === last ? SAMPLE_ROWS : 1, filters })),
        getBaseCustomers('pool', { brand: filterBrand, limit: 1, filters: criteriaFilters(crits) }),
      ]).then(
        (all) => {
          if (!alive) return;
          const pool = all.pop() ?? [];
          setRes({ key, counts: all.map(rowsTotal), claimable: rowsTotal(pool), sample: all[last] ?? [], err: '' });
        },
        (e: unknown) => {
          if (alive && !handleAuthError(e)) setRes({ key, counts: [], claimable: 0, sample: [], err: 'นับลูกค้าไม่สำเร็จ: ' + errorMessage(e) });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // key ครอบ filterBrand + steps แล้ว (crits ใช้ผ่าน criteriaFilters ซึ่งเท่ากับขั้นสุดท้าย)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, handleAuthError]);

  const fresh = res?.key === key ? res : null;
  return {
    filterBrand,
    counts: steps.map((_, i) => (fresh && !fresh.err ? (fresh.counts[i] ?? null) : null)),
    claimable: fresh && !fresh.err ? fresh.claimable : null,
    sample: fresh ? fresh.sample : null,
    err: fresh?.err ?? '',
  };
}
