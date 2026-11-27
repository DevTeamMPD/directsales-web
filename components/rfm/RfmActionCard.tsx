'use client';

import { rfmRuleText, rfmSlug, type RfmSeg } from '@/lib/domain/rfm';
import { rfmPercent } from '@/lib/domain/rfmPage';

const num = (n: number | null): string => (n === null ? '—' : n.toLocaleString('th-TH'));

/** การ์ดแนวทางของกลุ่มที่เลือก (Action Context): เงื่อนไข, พฤติกรรมลูกค้า, แคมเปญแนะนำ · n / contactable = null ระหว่างโหลด */
export function RfmActionCard({ seg, n, contactable, scored }: { seg: RfmSeg | null; n: number | null; contactable: number | null; scored: number | null }) {
  if (!seg) {
    return (
      <section className="card rfm-card" id="rfm-action">
        <h2>แนวทางของกลุ่ม</h2>
        <div className="sub">แตะกลุ่มในแผนที่เพื่อดูพฤติกรรมลูกค้า แคมเปญแนะนำ และรายชื่อลูกค้าของกลุ่มนั้น</div>
      </section>
    );
  }
  return (
    <section className="card rfm-card" id="rfm-action" data-seg={seg.key}>
      <div className="rfm-title">
        <h2><span className={`rfm-dot rfm-seg-${rfmSlug(seg.key)}`} aria-hidden="true" />{seg.key}</h2>
        {seg.tone ? <span className="tag">{seg.tone}</span> : null}
      </div>
      <div className="rfm-stats">
        <div><b id="rfm-n">{num(n)}</b><span className="sub">ราย</span></div>
        <div><b>{n !== null && scored !== null ? rfmPercent(n, scored) : '—'}</b><span className="sub">ของลูกค้าที่จัดกลุ่มแล้ว</span></div>
        <div><b id="rfm-contactable">{num(contactable)}</b><span className="sub">ติดต่อได้ตอนนี้</span></div>
      </div>
      <div><div className="sub">เงื่อนไขของกลุ่ม</div><div>{rfmRuleText(seg)}</div></div>
      {seg.behavior ? <div><div className="sub">พฤติกรรมลูกค้า</div><div>{seg.behavior}</div></div> : null}
      {seg.action ? <div className="rfm-advice"><div className="h">แคมเปญแนะนำ</div><div>{seg.action}</div></div> : null}
      {seg.noOutreach ? <div className="rfm-warn">กลุ่มนี้ตั้งค่าไว้ว่า &quot;ไม่ส่งข้อความเป็นชุด&quot;</div> : null}
      <div className="rfm-actions">
        <a className="btn primary" href="#rfm-list">ดูรายชื่อที่ติดต่อได้ {num(contactable)} ราย</a>
      </div>
    </section>
  );
}
