'use client';

import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { searchProducts } from '@/lib/api/rpc';
import type { CampaignCriterion, DemoCustomer, ProductItem, ProductRow } from '@/lib/api/types';
import { demoProducts, productSummary, selectAllItems, toggleItem } from '@/lib/domain/campaigns';
import { useActions } from '@/lib/state/AppProvider';

/** ค้นหลังหยุดพิมพ์ */
const DEBOUNCE_MS = 300;

/**
 * เงื่อนไข "เคยซื้อสินค้า" ของตัวสร้างแคมเปญ: พิมพ์ชื่อสินค้า/SKU (≥ 2 ตัว) → รายการ SKU + ชื่อ + จำนวนผู้ซื้อ (dsales_product_search)
 * ติ๊กทีละตัว หรือ "เลือกทั้งหมด" ของผลค้นหา · ค้นคำใหม่ได้โดย SKU ที่เลือกไว้ไม่หาย (ชิปด้านล่าง)
 * ไม่ติ๊กเลยแต่มีคำค้น = ทุก SKU ที่มีคำนั้น (kw) · โหมด fixture ค้นจากประวัติซื้อของลูกค้าตัวอย่าง
 */
export function ProductPicker({ crit, live, customers, onChange }: {
  crit: CampaignCriterion; live: boolean; customers: ReadonlyArray<DemoCustomer>; onChange: (patch: Partial<CampaignCriterion>) => void;
}) {
  const { handleAuthError } = useActions();
  const items = useMemo(() => crit.items ?? [], [crit.items]);
  const q = crit.kw ?? '';
  const [qKey, setQKey] = useState(q.trim());
  const [res, setRes] = useState<{ key: string; rows: ProductRow[]; err: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQKey(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!live || qKey.length < 2) return;
    let alive = true;
    searchProducts(qKey).then(
      (rows) => {
        if (alive) setRes({ key: qKey, rows: rows || [], err: '' });
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setRes({ key: qKey, rows: [], err: 'ค้นสินค้าไม่สำเร็จ: ' + errorMessage(e) });
      },
    );
    return () => {
      alive = false;
    };
  }, [live, qKey, handleAuthError]);

  const rows = useMemo<ProductRow[] | null>(() => {
    if (qKey.length < 2) return null;
    if (!live) return demoProducts(customers, qKey);
    return res?.key === qKey ? res.rows : null;
  }, [live, customers, qKey, res]);
  const found: ProductItem[] = useMemo(() => (rows ?? []).map((r) => ({ sku: r.sku, name: r.product_name || r.sku })), [rows]);
  const picked = (sku: string) => items.some((x) => x.sku === sku);
  const allOn = found.length > 0 && found.every((x) => picked(x.sku));

  return (
    <div className="sku-pick">
      <input className="input" type="search" value={q} placeholder="พิมพ์ชื่อสินค้าหรือ SKU เช่น เตียง, BBP-BED" aria-label="ค้นหาสินค้า"
        data-sku-q onChange={(e) => onChange({ kw: e.target.value })} />
      {res?.err && res.key === qKey ? <div className="login-err">{res.err}</div> : null}
      {qKey.length >= 2 ? (
        rows === null ? (
          <div className="sub">กำลังค้นสินค้า…</div>
        ) : rows.length ? (
          <div className="sku-list" role="group" aria-label="ผลค้นหาสินค้า">
            <label className="sku-row head">
              <input type="checkbox" checked={allOn} data-sku-all onChange={(e) => onChange({ items: selectAllItems(items, found, e.target.checked) })} />
              <span>เลือกทั้งหมด ({rows.length.toLocaleString('th-TH')} SKU{rows.length >= 100 ? ' แรก' : ''})</span>
            </label>
            {rows.map((r) => (
              <label key={r.sku} className="sku-row">
                <input type="checkbox" checked={picked(r.sku)} data-sku={r.sku}
                  onChange={() => onChange({ items: toggleItem(items, { sku: r.sku, name: r.product_name || r.sku }) })} />
                <span className="sku-name">{r.product_name || r.sku}<span className="sub mono"> {r.sku}</span></span>
                <span className="sub num">{Number(r.buyers).toLocaleString('th-TH')} คน</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="sub">ไม่พบสินค้าที่มีคำว่า &quot;{qKey}&quot;</div>
        )
      ) : (
        <div className="sub">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</div>
      )}
      <div className="sku-picked">
        <span className="sub" data-sku-summary>{productSummary(crit)}</span>
        {items.map((x) => (
          <button key={x.sku} type="button" className="chip active" title={x.sku} onClick={() => onChange({ items: toggleItem(items, x) })}>
            {x.name} ✕
          </button>
        ))}
        {items.length ? <button type="button" className="btn sm" onClick={() => onChange({ items: [] })}>ล้างที่เลือก</button> : null}
      </div>
    </div>
  );
}
