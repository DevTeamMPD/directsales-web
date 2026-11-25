'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PoolDetailModal } from '@/components/modals/PoolDetailModal';
import { SendOutreachModal } from '@/components/modals/SendOutreachModal';
import { useJst } from '@/components/leads/useJst';
import { useLeadActions } from '@/components/leads/useLeadActions';
import { errorMessage } from '@/lib/api/errors';
import { mapPoolRow, rowsTotal } from '@/lib/api/map';
import { getBaseCustomers, getBaseSegmentCounts, getJstAdminTags } from '@/lib/api/rpc';
import { rfmCountMap, rfmRule } from '@/lib/domain/rfm';
import type { PoolRow } from '@/lib/api/types';
import { PAGE, PATHS, type Brand } from '@/lib/constants';
import { pageBrand } from '@/lib/domain/brand';
import {
  ANY_LABEL, buildFilterJson, DORMANT_PRESETS, EMPTY_FILTERS, filtersFromQuery, filtersToQuery, hasFilters, LTV_PRESETS, NO_TAG, NO_TAG_LABEL,
  ORDERS_PRESETS, PROVIDER_OPTIONS, resultCountText, RFM_OPTIONS, SORT_OPTIONS, tagOptions, toggleRfm, type BaseFilters, type BaseSort,
} from '@/lib/domain/baseFilters';
import {
  baseAction, canNext, clampPage, claimBrand, demoBase, dormantText, keepTotal, NO_BRAND_TEXT, pageRange, type BaseScopeKey, type RowAction,
} from '@/lib/domain/pool';
import { defaultOutreachBrand, pageCheckState, selectionBar, setPageSelected, toggleSelect, type SelRow } from '@/lib/domain/outreach';
import { baht, fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { BrandTags } from './BrandTags';
import { ChannelCell } from './ChannelCell';
import { POOL_DEBOUNCE_MS } from './PoolPanel';
import { RowButton } from './RowButton';
import { SelectionBar } from './SelectionBar';
import { useBulkFollow, useCustomerClaim } from './useCustomerClaim';
import { useOutreachMax } from './useOutreachMax';

/** ตัวกรองของหน้า /mine, /pool (คงค่าระหว่างอยู่ในหน้าเดียวกัน; ตัวกรองเก็บใน URL ด้วย) · แบรนด์ = แบรนด์ใหญ่ใน topbar */
interface BaseFilter { q: string; page: number; filters: BaseFilters }
type SelectKey = 'dormant' | 'ltv' | 'orders' | 'provider' | 'tag';

// BasePage แสดงหลังโหลดข้อมูลฝั่ง client เท่านั้น (ตอน SSR Shell แสดงการ์ดกำลังโหลด) จึงอ่าน URL ตอนเริ่มได้
const urlState = (): { brand: '' | Brand; filters: BaseFilters } =>
  typeof window === 'undefined' ? { brand: '', filters: EMPTY_FILTERS } : filtersFromQuery(window.location.search);

function initialFilter(): BaseFilter {
  return { q: '', page: 0, filters: urlState().filters };
}

/**
 * ลูกค้าของฉัน (/mine) และถังกลาง (/pool) — หน้าใหม่ของเฟส 1 (spec ข้อ 3) ไม่มีใน prototype ใช้ markup ของถังลูกค้า (poolPanel L672-688)
 * - dsales_base_customers(scope) 50 แถว/หน้า, ค้นหา debounce 300 ms (เบอร์ +66/66/ขีด แปลงใน rpc.ts)
 * - แบรนด์ = แบรนด์ใหญ่ใน topbar (ทั้งหมด = ทุกแบรนด์) · ลิงก์เดิมที่มี ?brand= ตั้งแบรนด์ใหญ่ครั้งเดียวตอนเปิด · เปลี่ยนแบรนด์ = กลับหน้าแรกแล้วโหลดใหม่
 * - แถวตัวกรอง (p_filters): กลุ่มลูกค้า, ส่งแชตได้, ไม่ได้ซื้อมา, ยอดซื้อสะสม, ออเดอร์, ช่องทาง, Tag (หัวหน้าเท่านั้น), เรียงตาม
 *   เปลี่ยนตัวกรอง = กลับหน้าแรกแล้วโหลดใหม่ (ที่ติ๊กเลือกไว้คงเดิม) + จำนวนผลลัพธ์
 * - คอลัมน์ "ช่องทาง": ปุ่มโทร + ไอคอนห้องแชต (chat_rooms) กดเปิดแชตใน JST, ห้องที่ worker ส่งไม่ได้แสดงจาง
 * - คอลัมน์ "ไม่ซื้อมา N วัน" + tag เจ้าของ (owner_tag)
 * - total ใช้จากหน้าที่มีแถว (หน้าเกินท้ายไม่มี total_count)
 * - ไม่มีการ์ดช่วงวันที่: RPC นี้ไม่กรองตามช่วงวันที่
 * - ช่องติ๊กหน้าแถว (ส่งข้อความผ่าน JST worker): จำที่เลือกข้ามหน้า/คำค้น/ตัวกรอง (key = เบอร์ เก็บภาพของแถวรวม chatBrands),
 *   หัวตารางติ๊กทุกแถวของหน้านี้, แถบลอยด้านล่าง "เลือก N คน · ส่งข้อความ" ส่งได้ไม่เกิน outreach_max_batch
 *   popup เริ่มที่แบรนด์ที่คนที่เลือกมีห้องแชตมากที่สุด แล้ว preview แสดงรายการที่ถูกข้าม
 */
export function BasePage({ scope }: { scope: BaseScopeKey }) {
  const { live, customers, leads, meId, today, poolVersion, isAdmin, brand: scopeBrand } = useAppState();
  const { openModal, toast, handleAuthError, setBrand } = useActions();
  const b = pageBrand(scopeBrand);
  const act = useLeadActions();
  const openJst = useJst();
  const claimRow = useCustomerClaim();
  const bulkFollow = useBulkFollow();
  const [f, setF] = useState<BaseFilter>(initialFilter);
  const [qKey, setQKey] = useState('');
  const [data, setData] = useState<{ rows: PoolRow[]; total: number | null; err: string }>({ rows: [], total: null, err: '' });
  const [loading, setLoading] = useState(live);
  const [sel, setSel] = useState<ReadonlyMap<string, SelRow>>(() => new Map());
  const [liveTags, setLiveTags] = useState<string[]>([]);
  const headBox = useRef<HTMLInputElement>(null);
  const max = useOutreachMax(sel.size > 0);
  // ?brand= ของลิงก์เดิม → ตั้งแบรนด์ใหญ่ครั้งเดียว (ยังไม่โหลดจนกว่าแบรนด์ใหญ่จะตามลิงก์ — กันโหลดแบรนด์เก่าทิ้ง 1 รอบ)
  const [linkBrand] = useState(() => urlState().brand);
  const urlBrand = useRef<'' | Brand>(linkBrand);
  useEffect(() => {
    if (urlBrand.current) setBrand(urlBrand.current);
  }, [setBrand]);
  // เปลี่ยนแบรนด์ใหญ่ = กลับหน้าแรก (ปรับระหว่าง render จึงโหลดครั้งเดียว) ที่ติ๊กเลือกไว้คงเดิม
  const [prevBrand, setPrevBrand] = useState(b);
  if (prevBrand !== b) {
    setPrevBrand(b);
    setF((x) => (x.page ? { ...x, page: 0 } : x));
  }

  // รายชื่อ tag ของ JST สำหรับตัวกรอง Tag (หัวหน้าเท่านั้น; โหลดไม่ได้ = มีแค่ "ไม่มี tag")
  useEffect(() => {
    if (!live || !isAdmin) return;
    let alive = true;
    getJstAdminTags().then(
      (rows) => {
        if (alive) setLiveTags(tagOptions((rows || []).map((r) => r.tag)));
      },
      (e: unknown) => {
        if (alive) handleAuthError(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, isAdmin, handleAuthError]);
  const tags = useMemo(() => (live ? liveTags : tagOptions(customers.map((c) => c.ownerTag))), [live, liveTags, customers]);

  // จำนวนลูกค้าต่อกลุ่ม RFM บนชิป (ตามขอบเขตหน้า + แบรนด์ใหญ่ ไม่ขึ้นกับตัวกรองอื่น) — โหลดไม่ได้ = ไม่แสดงตัวเลข
  const [liveCounts, setLiveCounts] = useState<{ key: string; map: Record<string, number> } | null>(null);
  const countKey = `${scope}|${b}|${poolVersion}`;
  useEffect(() => {
    if (!live) return;
    let alive = true;
    getBaseSegmentCounts(scope, b || null).then(
      (rows) => {
        if (alive) setLiveCounts({ key: countKey, map: rfmCountMap(rows || []) });
      },
      (e: unknown) => {
        if (alive) handleAuthError(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, scope, b, countKey, handleAuthError]);
  const demoCounts = useMemo(() => {
    if (live) return null;
    const map: Record<string, number> = {};
    for (const o of RFM_OPTIONS) {
      map[o.value] = demoBase(customers, leads, scope, { brand: b || null, q: '', page: 0, today, meId, filters: { ...EMPTY_FILTERS, rfm: [o.value] } }).total;
    }
    return map;
  }, [live, customers, leads, scope, b, today, meId]);
  const counts = live ? (liveCounts?.key === countKey ? liveCounts.map : null) : demoCounts;

  // ตัวกรองใน URL (รีเฟรช/ส่งลิงก์แล้วยังอยู่)
  useEffect(() => {
    const qs = filtersToQuery(f.filters);
    if (qs === window.location.search.replace(/^\?/, '')) return;
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
  }, [f.filters]);

  useEffect(() => {
    if (f.q === qKey) return;
    const t = setTimeout(() => {
      setF((x) => ({ ...x, page: 0 }));
      setQKey(f.q);
    }, POOL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [f.q, qKey]);

  useEffect(() => {
    if (!live) return;
    if (urlBrand.current) {
      if (urlBrand.current !== b) return; // รอแบรนด์ใหญ่ตาม ?brand= ก่อน
      urlBrand.current = '';
    }
    let alive = true;
    setLoading(true);
    setData((d) => ({ ...d, err: '' }));
    getBaseCustomers(scope, { search: qKey, offset: f.page * PAGE, brand: b || null, filters: buildFilterJson(f.filters) })
      .then((rows) => {
        if (alive && clampPage(f.page, rows.length) !== f.page) {
          setF((x) => (x.page === f.page ? { ...x, page: clampPage(x.page, 0) } : x)); // หน้าท้ายว่าง → ถอยหนึ่งหน้า (โหลดซ้ำเอง)
          return;
        }
        if (alive) setData((d) => ({ rows: rows.map((r) => mapPoolRow(r, meId)), total: keepTotal(rowsTotal(rows), rows.length, f.page, d.total), err: '' }));
      })
      .catch((e: unknown) => {
        if (alive && !handleAuthError(e)) setData((d) => ({ ...d, err: 'โหลดลูกค้าไม่สำเร็จ: ' + errorMessage(e) }));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [live, scope, qKey, f.page, b, f.filters, poolVersion, meId, handleAuthError]);

  const demo = useMemo(
    () => (live ? null : demoBase(customers, leads, scope, { brand: b || null, q: qKey, page: f.page, today, meId, filters: f.filters })),
    [live, customers, leads, scope, b, qKey, f.page, f.filters, today, meId],
  );
  const rows = demo ? demo.rows : data.rows;
  const total = demo ? demo.total : data.total;
  const busy = !demo && loading;
  const pageState = pageCheckState(sel, rows);
  const bar = selectionBar(sel.size, max);
  const filtered = hasFilters(f.filters);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = pageState === 'some';
  }, [pageState]);
  const openSend = () => {
    if (!bar.canSend) return;
    const picked = [...sel.values()];
    openModal(<SendOutreachModal rows={picked} defaultBrand={defaultOutreachBrand(picked, b)} onSent={() => setSel(new Map())} />);
  };
  const setFilters = (fn: (x: BaseFilters) => BaseFilters) => setF((x) => ({ ...x, filters: fn(x.filters), page: 0 }));
  const selectProps = (key: SelectKey) => ({
    value: f.filters[key],
    onChange: (e: { target: { value: string } }) => setFilters((x) => ({ ...x, [key]: e.target.value })),
  });

  const claim = (r: PoolRow, a: RowAction, seq?: number) => {
    const brand = claimBrand(b, r.brands);
    if (!brand) {
      toast(NO_BRAND_TEXT);
      return;
    }
    void claimRow(r, brand, seq, a.text === 'เริ่มติดตาม' ? 'เริ่มติดตามแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ' : undefined);
  };
  const openDetail = (r: PoolRow) => {
    const a = baseAction(r, { meId, leads });
    openModal(<PoolDetailModal row={r} footer={a.kind === 'disabled' ? null : a} onClaim={(seq) => claim(r, a, seq)} />);
  };

  return (
    <>
      <div className="toolbar">
        <label className="search" htmlFor="base-q" style={{ flexBasis: 480 }}>
          <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
          <input id="base-q" type="search" placeholder="ค้นหา เบอร์ / ชื่อแชต / ชื่อลูกค้า" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
        </label>
        {busy ? <span className="sub">กำลังโหลด…</span> : null}
      </div>
      <div id="base-filters" style={{ display: 'grid', gap: 8 }}>
        <div className="toolbar">
          <span className="sub">กลุ่มลูกค้า</span>
          {RFM_OPTIONS.map((o) => {
            const on = f.filters.rfm.includes(o.value);
            const n = counts ? (counts[o.value] ?? 0) : null;
            if (!o.value && !on && !n) return null; // ยังไม่จัดกลุ่ม: แสดงเฉพาะเมื่อมีลูกค้า
            return (
              <button key={o.value || 'none'} type="button" className={`chip ${on ? 'active' : ''}`} data-rfm={o.value} aria-pressed={on}
                title={rfmRule(o.value) || 'ไม่มีจำนวนออเดอร์หรือวันซื้อล่าสุด'} onClick={() => setFilters((x) => toggleRfm(x, o.value))}>
                <span className="lbl">{o.label}</span>{n !== null ? <span className="count num">{n.toLocaleString('th-TH')}</span> : null}
              </button>
            );
          })}
          <button
            type="button" id="base-chat" className={`chip ${f.filters.hasChat ? 'active' : ''}`} aria-pressed={f.filters.hasChat}
            title="เฉพาะลูกค้าที่ worker ส่งข้อความได้ (ของแบรนด์ที่เลือก)" onClick={() => setFilters((x) => ({ ...x, hasChat: !x.hasChat }))}
          >
            ส่งแชตได้
          </button>
        </div>
        <div className="toolbar">
          <select id="base-dormant" className="select" aria-label="ไม่ได้ซื้อมา" {...selectProps('dormant')}>
            <option value="">{ANY_LABEL.dormant}</option>
            {DORMANT_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select id="base-ltv" className="select" aria-label="ยอดซื้อสะสม" {...selectProps('ltv')}>
            <option value="">{ANY_LABEL.ltv}</option>
            {LTV_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select id="base-orders" className="select" aria-label="จำนวนออเดอร์" {...selectProps('orders')}>
            <option value="">{ANY_LABEL.orders}</option>
            {ORDERS_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select id="base-provider" className="select" aria-label="ช่องทาง" {...selectProps('provider')}>
            <option value="">{ANY_LABEL.provider}</option>
            {PROVIDER_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {isAdmin ? (
            <select id="base-tag" className="select" aria-label="Tag" {...selectProps('tag')}>
              <option value="">{ANY_LABEL.tag}</option>
              <option value={NO_TAG}>{NO_TAG_LABEL}</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              {f.filters.tag && f.filters.tag !== NO_TAG && !tags.includes(f.filters.tag) ? <option value={f.filters.tag}>{f.filters.tag}</option> : null}
            </select>
          ) : null}
          <label className="sub" htmlFor="base-sort">เรียงตาม</label>
          <select id="base-sort" className="select" value={f.filters.sort} onChange={(e) => setFilters((x) => ({ ...x, sort: e.target.value as BaseSort }))}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" className="btn sm" id="base-clear" disabled={!filtered} onClick={() => setFilters(() => EMPTY_FILTERS)}>ล้างตัวกรอง</button>
          <span className="sub num" id="base-count">{busy ? '' : resultCountText(total)}</span>
        </div>
      </div>
      {data.err ? <div className="login-err">{data.err}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 1 }}>
                <input
                  ref={headBox} type="checkbox" id="base-sel-page" aria-label="เลือกทุกแถวในหน้านี้" disabled={!rows.length}
                  checked={pageState === 'all' && rows.length > 0} onChange={(e) => setSel((m) => setPageSelected(m, rows, e.target.checked))}
                />
              </th>
              <th>ชื่อ / เบอร์</th><th>ช่องทาง</th><th>ไม่ซื้อมา / tag</th><th>กลุ่มลูกค้า</th><th className="r">ยอดซื้อสะสม</th><th className="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const a = baseAction(r, { meId, leads });
                return (
                  <tr key={r.id} className={sel.has(r.phone) ? 'sel' : undefined}>
                    <td>
                      <input type="checkbox" data-sel={r.phone} aria-label={`เลือก ${r.name}`} checked={sel.has(r.phone)} onChange={() => setSel((m) => toggleSelect(m, r))} />
                    </td>
                    <td>
                      <button className="cust-name" data-pool-open={r.id} onClick={() => openDetail(r)}>{r.name}</button>
                      <div className="sub mono">{r.phone}</div>
                      {r.chat ? <div className="sub">แชต: {r.chat}</div> : null}
                    </td>
                    <td><ChannelCell r={r} brand={claimBrand(b, r.brands) ?? 'bebeplay'} openJst={openJst} /></td>
                    <td>
                      <div>{dormantText(r.dormantDays)}</div>
                      {r.ownerTag ? <span className="tag">{r.ownerTag}</span> : null}
                    </td>
                    <td>{r.segment ? <span className="tag" title={rfmRule(r.segment)}>{r.segment}</span> : <span className="sub">—</span>}</td>
                    <td className="r num">{r.ltv == null ? '—' : baht(Math.round(r.ltv))}</td>
                    <td className="r num">{r.orders ?? '—'}</td>
                    <td>{r.last ? fmtDate(r.last) : '—'}</td>
                    <td><BrandTags brands={r.brands} dash /></td>
                    <td><RowButton a={a} rowId={r.id} onClaim={() => claim(r, a)} onUnclaim={act.confirmUnclaim} /></td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={10} className="empty">{busy ? 'กำลังโหลด…' : filtered ? 'ไม่พบลูกค้าที่ตรงกับตัวกรอง' : 'ไม่พบลูกค้าที่ตรงกับคำค้น'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn sm" data-pool="prev" disabled={f.page === 0} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>← ก่อนหน้า</button>
        <span className="sub num">{pageRange(f.page, rows.length, total)}</span>
        <button className="btn sm" data-pool="next" disabled={!canNext(f.page, rows.length, total)} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>ถัดไป →</button>
      </div>
      <SelectionBar
        count={sel.size} max={max} onClear={() => setSel(new Map())} onSend={openSend}
        extra={scope === 'mine' ? (
          <button
            className="btn" id="sel-follow" disabled={!bar.canSend} title="ส่งลูกค้าที่เลือกเข้าหน้า Direct Sale เพื่อติดตามใกล้ชิด"
            onClick={() => void bulkFollow([...sel.values()], b, () => setSel(new Map()))}
          >
            เข้า Direct Sale
          </button>
        ) : null}
      />
    </>
  );
}
