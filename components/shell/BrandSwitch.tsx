'use client';

import { BRAND } from '@/lib/constants';
import type { BrandScope } from '@/lib/domain/brand';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** ตัวสลับแบรนด์ใหญ่ — จอกว้าง = ปุ่มแบ่งช่อง, จอ ≤ 760px = dropdown (CSS สลับการแสดง) · "ทั้งหมด" เฉพาะหัวหน้า */
export function BrandSwitch() {
  const { brand, isAdmin } = useAppState();
  const { setBrand } = useActions();
  const opts: { value: BrandScope; label: string }[] = [
    { value: 'bebeplay', label: BRAND.bebeplay },
    { value: 'hosttail', label: BRAND.hosttail },
    ...(isAdmin ? [{ value: 'all' as const, label: 'ทั้งหมด' }] : []),
  ];
  return (
    <div className="brand-switch" data-scope={brand}>
      <div className="seg brand-seg" role="group" aria-label="แบรนด์">
        {opts.map((o) => (
          <button key={o.value} type="button" className={`seg-btn${brand === o.value ? ' on' : ''}`} data-brand-pick={o.value}
            aria-pressed={brand === o.value} onClick={() => setBrand(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <select className="select brand-select" id="brand-switch" aria-label="แบรนด์" value={brand} onChange={(e) => setBrand(e.target.value as BrandScope)}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
