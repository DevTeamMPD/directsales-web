import { Fragment } from 'react';
import { BRAND } from '@/lib/constants';

const label = (b: string): string => (BRAND as Readonly<Record<string, string>>)[b] || b;

/** tag แบรนด์ของลูกค้าในถัง (L679, L729) คั่นด้วยช่องว่าง; ไม่มีแบรนด์ = "—" เมื่อ dash */
export function BrandTags({ brands, dash = false }: { brands: ReadonlyArray<string>; dash?: boolean }) {
  if (!brands.length) return dash ? <span className="sub">—</span> : null;
  return (
    <>
      {brands.map((b, i) => (
        <Fragment key={`${b}-${i}`}>
          {i ? ' ' : ''}
          <span className={`tag ${b === 'bebeplay' ? 'bebe' : b === 'hosttail' ? 'host' : ''}`}>{label(b)}</span>
        </Fragment>
      ))}
    </>
  );
}
