'use client';

import type { CSSProperties } from 'react';
import { rfmSlug } from '@/lib/domain/rfm';
import type { RfmGrid } from '@/lib/domain/rfmGrid';

/**
 * แผนที่กลุ่มลูกค้า: แกนตั้ง F (ความถี่) แกนนอน R (ซื้อล่าสุด) — ผังมาจาก rfmGrid(config)
 * ทุกสี่เหลี่ยมเป็นปุ่ม กด = เลือกกลุ่ม (กดซ้ำกลุ่มเดิม = เลิกเลือก ทำที่ผู้เรียก) · counts null = ยังโหลดไม่เสร็จ (ไม่แสดงตัวเลข)
 */
export function RfmMap({ grid, counts, selected, onSelect }: {
  grid: RfmGrid; counts: Readonly<Record<string, number>> | null; selected: string; onSelect: (key: string) => void;
}) {
  const cols = grid.rBands.map((_, j) => (j === 0 ? 'minmax(0, 1.6fr)' : 'minmax(0, 1fr)')).join(' ');
  const style: CSSProperties = { gridTemplateColumns: `var(--rfm-axis) ${cols}`, gridTemplateRows: `repeat(${grid.fBands.length}, var(--rfm-row)) auto` };
  return (
    <div className="rfm-map" id="rfm-map" style={style}>
      {grid.fBands.map((b, i) => (
        <div key={`f${b.min}`} className="rfm-axis" style={{ gridColumn: 1, gridRow: i + 1 }}>
          <span className="lbl-long">{b.label}</span><span className="lbl-short">{b.short}</span>
        </div>
      ))}
      {grid.rects.map((x) => {
        const on = selected === x.key;
        const n = counts ? (counts[x.key] ?? 0) : null;
        return (
          <button
            key={`${x.key}-${x.row}-${x.col}`} type="button" className={`rfm-cell rfm-seg-${rfmSlug(x.key)}${on ? ' on' : ''}`}
            data-seg={x.key} aria-pressed={on} aria-label={x.primary ? undefined : x.key}
            style={{ gridColumn: `${x.col + 2} / span ${x.colSpan}`, gridRow: `${x.row + 1} / span ${x.rowSpan}` }}
            onClick={() => onSelect(x.key)}
          >
            {x.primary ? (
              <>
                <span className="nm">{x.key}</span>
                <span className="n">{n === null ? '' : n.toLocaleString('th-TH')}</span>
              </>
            ) : null}
          </button>
        );
      })}
      {grid.rBands.map((b, j) => (
        <div key={`r${b.min}`} className="rfm-axis x" style={{ gridColumn: j + 2, gridRow: grid.fBands.length + 1 }}>
          <span className="lbl-long">{b.label}</span><span className="lbl-short">{b.short}</span>
        </div>
      ))}
    </div>
  );
}
