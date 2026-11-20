import type {
  BatchItem, Brand, ChatRoom, DemoCustomer, EnqueueSkipReason, OutreachCounts, OutreachStatus, PreviewRow, Template, WorkerRoom, WorkerRow, WorkerState,
  WorkerStatus,
} from '@/lib/api/types';
import { BRAND, PLAT } from '@/lib/constants';
import { fmtDT, localStamp } from '@/lib/format';

// ส่งข้อความผ่าน JST worker (spec 2026-11-20-jst-outreach-worker-design.md ข้อ 6) — ฟังก์ชันล้วน

/** จำนวนสูงสุดต่อชุดเมื่อยังไม่รู้ค่าจาก dsales_worker_status_get (outreach_max_batch เริ่มต้น 50) */
export const DEFAULT_MAX_BATCH = 50;
/** หน้า /outreach โหลดใหม่ทุก 10 วินาที (เฉพาะตอนหน้าเปิดอยู่และมีรายการรอ) */
export const OUTREACH_POLL_MS = 10_000;
/** worker ออนไลน์ = heartbeat ไม่เกิน 3 นาที */
export const WORKER_ONLINE_MS = 3 * 60_000;
export const TEST_MODE_TEXT = 'โหมดทดสอบ: ข้อความทั้งหมดจะถูกส่งไปห้องทดสอบ';

export const maxBatch = (s: { max_batch?: number | null } | null | undefined): number => {
  const n = Number(s?.max_batch);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_BATCH;
};

/* ---------- เลือกลูกค้าใน /mine /pool (จำข้ามหน้า/คำค้น key = เบอร์) ---------- */
/** ภาพของแถวตอนติ๊กเลือก (คงไว้ข้ามหน้า/ตัวกรอง) — chatBrands = แบรนด์ที่มีห้องแชตส่งได้, chatRooms ใช้กับ preview ของโหมด fixture */
export interface SelRow {
  phone: string; name: string; brands: string[]; chat: string; taken: string | null; mine: boolean; chatBrands: string[]; chatRooms?: ChatRoom[];
}
export type Selection = ReadonlyMap<string, SelRow>;

export const toSelRow = (r: SelRow): SelRow => ({
  phone: r.phone, name: r.name, brands: r.brands, chat: r.chat, taken: r.taken, mine: r.mine, chatBrands: [...(r.chatBrands ?? [])],
  ...(r.chatRooms ? { chatRooms: r.chatRooms } : {}),
});

export function toggleSelect(sel: Selection, row: SelRow): Map<string, SelRow> {
  const next = new Map(sel);
  if (next.has(row.phone)) next.delete(row.phone);
  else next.set(row.phone, toSelRow(row));
  return next;
}

/** ช่องติ๊กหัวตาราง: เลือก/เอาออกทุกแถวที่เห็นในหน้านี้ (แถวหน้าอื่นที่เลือกไว้คงเดิม) */
export function setPageSelected(sel: Selection, rows: ReadonlyArray<SelRow>, on: boolean): Map<string, SelRow> {
  const next = new Map(sel);
  for (const r of rows) {
    if (on) next.set(r.phone, toSelRow(r));
    else next.delete(r.phone);
  }
  return next;
}

export function pageCheckState(sel: Selection, rows: ReadonlyArray<Pick<SelRow, 'phone'>>): 'all' | 'some' | 'none' {
  const n = rows.filter((r) => sel.has(r.phone)).length;
  return n === 0 ? 'none' : n === rows.length ? 'all' : 'some';
}

/** แถบลอยด้านล่าง: ส่งได้เมื่อเลือก 1..max คน */
export function selectionBar(count: number, max: number): { text: string; canSend: boolean; over: string | null } {
  return {
    text: `เลือก ${count.toLocaleString('th-TH')} คน`,
    canSend: count > 0 && count <= max,
    over: count > max ? `เลือกได้สูงสุด ${max} คนต่อชุด` : null,
  };
}

/* ---------- แบรนด์ของชุดที่ส่ง (ลูกค้าที่มีห้องแชตของแบรนด์ไหน) ---------- */
const BRANDS = Object.keys(BRAND) as Brand[];

/** จำนวนคนที่เลือกที่มีห้องแชตส่งได้ของแต่ละแบรนด์ */
export function brandRoomCounts(rows: ReadonlyArray<Pick<SelRow, 'chatBrands'>>): Record<Brand, number> {
  const out = Object.fromEntries(BRANDS.map((b) => [b, 0])) as Record<Brand, number>;
  for (const r of rows) for (const b of BRANDS) if (r.chatBrands?.includes(b)) out[b] += 1;
  return out;
}

/** แบรนด์เริ่มต้นของ popup ส่งข้อความ: แบรนด์ที่มีห้องในคนที่เลือกมากที่สุด → เท่ากัน = แบรนด์ที่กรองในหน้า → bebeplay */
export function defaultOutreachBrand(rows: ReadonlyArray<Pick<SelRow, 'chatBrands'>>, pageBrand: '' | Brand | null | undefined): Brand {
  const c = brandRoomCounts(rows);
  const top = Math.max(...BRANDS.map((b) => c[b]));
  const best = BRANDS.filter((b) => c[b] === top);
  if (best.length === 1) return best[0];
  if (pageBrand && best.includes(pageBrand)) return pageBrand;
  return best.includes('bebeplay') ? 'bebeplay' : best[0];
}

/** "X คนมีห้องของ Bebeplay · Y คนมีห้องของ Hosttail" */
export const brandRoomHint = (c: Record<Brand, number>): string =>
  BRANDS.map((b) => `${c[b].toLocaleString('th-TH')} คนมีห้องของ ${BRAND[b]}`).join(' · ');

/** เหตุผลที่ข้าม: ไม่มีห้อง/หมดช่วงของแบรนด์นี้ แต่มีห้องส่งได้ของอีกแบรนด์ → บอกให้เปลี่ยนแบรนด์ */
export function skipReasonText(skip: string | null | undefined, row: Pick<SelRow, 'chatBrands'> | undefined, brand: Brand): string {
  if ((skip === 'no_chat_room' || skip === 'window_closed') && row) {
    const other = BRANDS.find((b) => b !== brand && row.chatBrands?.includes(b));
    if (other) return `มีห้องแชตของ ${BRAND[other]} — เปลี่ยนแบรนด์ด้านบน`;
  }
  return skipLabel(skip);
}

/* ---------- ข้อความไทย ---------- */
export const SKIP_TEXT: Readonly<Record<EnqueueSkipReason, string>> = {
  customer_not_found: 'ไม่พบลูกค้า',
  taken: 'เป็นลูกค้าของเซลล์คนอื่น',
  already_queued: 'อยู่ในคิวส่งข้อความแล้ว',
  no_chat_room: 'ไม่พบห้องแชตของแบรนด์นี้',
  window_closed: 'หมดช่วงส่งข้อความ (ลูกค้าไม่ได้ทักมาเกิน 24 ชม.)',
  no_call: 'ลูกค้าไม่สะดวกให้ติดต่อ',
  claim_failed: 'จองลูกค้าไม่สำเร็จ',
};
export const skipLabel = (reason: string | null | undefined): string =>
  (reason && (SKIP_TEXT as Readonly<Record<string, string>>)[reason]) || reason || '—';

export const STATUS_TEXT: Readonly<Record<OutreachStatus, string>> = {
  queued: 'รอส่ง', sending: 'กำลังส่ง', sent: 'ส่งแล้ว', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิกแล้ว',
};
/** class ของ .badge ใน styles/app.css */
export const STATUS_BADGE: Readonly<Record<OutreachStatus, string>> = {
  queued: 's-callback', sending: 's-following', sent: 's-won', failed: 's-lost', cancelled: 's-new',
};
export const statusLabel = (s: string): string => (STATUS_TEXT as Readonly<Record<string, string>>)[s] || s;
export const statusBadge = (s: string): string => (STATUS_BADGE as Readonly<Record<string, string>>)[s] || 's-new';

export const WORKER_STATE_TEXT: Readonly<Record<WorkerState, string>> = {
  running: 'กำลังทำงาน', paused: 'พักชั่วคราว', needs_login: 'ต้องล็อกอิน JST ใหม่', stopped: 'หยุดทำงาน',
};
export const workerStateLabel = (s: string): string => (WORKER_STATE_TEXT as Readonly<Record<string, string>>)[s] || s;
export const workerStateBadge = (s: string): string =>
  s === 'running' ? 's-won' : s === 'paused' ? 's-callback' : s === 'needs_login' ? 's-unreachable' : 's-lost';

/** error ของรายการในคิว (worker: room_mismatch, window_closed, jst_error: <ข้อความ>, stale_sending) */
export function itemErrorText(error: string | null | undefined): string {
  const e = (error ?? '').trim();
  if (!e) return '';
  if (e === 'room_mismatch') return 'ห้องแชตไม่ตรงกับที่บันทึกไว้ (ไม่ได้ส่ง)';
  if (e === 'window_closed') return 'หมดช่วงส่งข้อความ (ลูกค้าไม่ได้ทักมาเกิน 24 ชม.) — โทรหาแทน';
  if (e === 'stale_sending') return 'ส่งค้างนานเกินไป ระบบคืนเข้าคิว';
  const jst = /^jst_error:\s*([\s\S]*)$/.exec(e);
  if (jst) return `JST ส่งไม่สำเร็จ${jst[1] ? ': ' + jst[1] : ''}`;
  return e;
}

/** ช่องทาง · เพจ ของห้องที่ส่ง (provider จาก iim_sessions เช่น Line / Shopee / Facebook) */
export function channelLabel(provider: string | null | undefined, page: string | null | undefined): string {
  const p = (provider ?? '').trim();
  const key = p.toLowerCase().replace(/\s+/g, '');
  const known = (Object.keys(PLAT) as (keyof typeof PLAT)[]).find((k) => key.startsWith(k));
  const label = known ? PLAT[known] : key.startsWith('lineoa') ? PLAT.line : p;
  return [label, (page ?? '').trim()].filter(Boolean).join(' · ') || '—';
}

export const roomLabel = (r: Pick<WorkerRoom, 'ms_id' | 'customer' | 'channel' | 'page'>): string =>
  `${[r.customer || '—', channelLabel(r.channel, null), r.page || '—'].join(' · ')} (${r.ms_id})`;

export const toggleRoom = (ids: ReadonlyArray<number>, id: number): number[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** เวลาจาก server (timestamptz) → d/m/yyyy HH:MM เวลาไทย */
export const stamp = (iso: string | null | undefined): string => (iso ? fmtDT(localStamp(iso)) : '—');

/* ---------- ความคืบหน้า ---------- */
export interface BatchProgress { total: number; pending: number; done: number; sent: number; failed: number; cancelled: number }
export function batchProgress(c: Partial<OutreachCounts> | null | undefined): BatchProgress {
  const n = (k: keyof OutreachCounts) => Number(c?.[k] ?? 0) || 0;
  const pending = n('queued') + n('sending');
  const done = n('sent') + n('failed') + n('cancelled');
  return { total: pending + done, pending, done, sent: n('sent'), failed: n('failed'), cancelled: n('cancelled') };
}
export const hasPending = (c: Partial<OutreachCounts> | null | undefined): boolean => batchProgress(c).pending > 0;
export const itemsPending = (items: ReadonlyArray<Pick<BatchItem, 'status'>>): boolean => items.some((i) => i.status === 'queued' || i.status === 'sending');
/** โหลดใหม่เฉพาะตอนหน้าแสดงอยู่ และยังมีรายการรอ/กำลังส่ง */
export const shouldPoll = (live: boolean, visible: boolean, pending: boolean): boolean => live && visible && pending;

/** badge ของจำนวนแต่ละสถานะ (แสดงเฉพาะที่มากกว่า 0) */
export function countBadges(c: Partial<OutreachCounts> | null | undefined, skipped = 0): { cls: string; text: string }[] {
  const out: { cls: string; text: string }[] = [];
  for (const s of ['sent', 'queued', 'sending', 'failed', 'cancelled'] as const) {
    const v = Number(c?.[s] ?? 0);
    if (v > 0) out.push({ cls: STATUS_BADGE[s], text: `${STATUS_TEXT[s]} ${v.toLocaleString('th-TH')}` });
  }
  if (skipped > 0) out.push({ cls: 's-new', text: `ข้าม ${skipped.toLocaleString('th-TH')}` });
  return out;
}

/* ---------- worker ---------- */
/** ออนไลน์ตามค่าจาก server (online) ถ้าไม่มีคิดจาก heartbeat ไม่เกิน 3 นาที */
export function isWorkerOnline(w: Pick<WorkerRow, 'heartbeat_at'> & { online?: boolean | null }, now: number = Date.now()): boolean {
  if (typeof w.online === 'boolean') return w.online;
  const t = w.heartbeat_at ? Date.parse(w.heartbeat_at) : NaN;
  return Number.isFinite(t) && now - t <= WORKER_ONLINE_MS;
}

export interface Banner { kind: 'warn' | 'note'; text: string }
/** แถบเตือนด้านบนของหน้า /outreach */
export function workerBanners(s: WorkerStatus | null | undefined, now: number = Date.now()): Banner[] {
  if (!s) return [];
  const out: Banner[] = [];
  const online = (s.workers ?? []).filter((w) => isWorkerOnline(w, now));
  if (!online.length) out.push({ kind: 'warn', text: 'Worker ออฟไลน์: ข้อความจะรอในคิวจนกว่า worker จะกลับมาทำงาน' });
  else if (online.every((w) => w.state === 'needs_login')) out.push({ kind: 'warn', text: 'Worker ต้องล็อกอิน JST ใหม่: ยังไม่ส่งข้อความจนกว่าจะล็อกอิน (คิวไม่หาย)' });
  else if (online.every((w) => w.state === 'stopped')) out.push({ kind: 'warn', text: 'Worker หยุดทำงาน: รอ dev ตรวจสอบ (คิวไม่หาย)' });
  else if (online.every((w) => w.state !== 'running')) out.push({ kind: 'warn', text: 'Worker พักชั่วคราว: จะกลับมาส่งเองภายใน 15 นาที' });
  if (s.settings?.test_mode) {
    out.push(
      s.settings.test_ms_ids?.length
        ? { kind: 'note', text: TEST_MODE_TEXT }
        : { kind: 'warn', text: 'โหมดทดสอบแต่ยังไม่ได้เลือกห้องทดสอบ: ยังไม่ส่งข้อความใด ๆ (หัวหน้าเลือกห้องได้ที่ ตั้งค่า)' },
    );
  }
  return out;
}

export interface SettingsForm { interval: string; lineCap: string }
/** ตรวจค่าก่อนบันทึก (DB: invalid_setting เมื่อ interval นอก 5–3600 หรือ cap < 0) */
export function validateSettings(f: SettingsForm): string | null {
  const iv = Number(f.interval);
  if (!/^\d+$/.test(f.interval.trim()) || iv < 5 || iv > 3600) return 'ระยะห่างระหว่างข้อความต้องเป็น 5–3600 วินาที';
  if (!/^\d+$/.test(f.lineCap.trim())) return 'เพดาน LINE ต่อเดือนต้องเป็นจำนวนเต็มตั้งแต่ 0 (0 = ไม่จำกัด)';
  return null;
}

/* ---------- template ---------- */
export const TEMPLATE_VARS = [
  { key: '{ชื่อ}', label: 'ชื่อลูกค้า', sample: 'คุณสมใจ' },
  { key: '{สินค้าล่าสุด}', label: 'สินค้าในบิลล่าสุดของแบรนด์นั้น', sample: 'เตียงนอนเด็กรุ่นคลาสสิก' },
  { key: '{ร้าน}', label: 'ชื่อเพจของห้องแชตที่ส่ง', sample: 'Bebeplayofficial' },
] as const;
export interface TemplateValues { name?: string | null; product?: string | null; shop?: string | null }
export const SAMPLE_VALUES: TemplateValues = { name: TEMPLATE_VARS[0].sample, product: TEMPLATE_VARS[1].sample, shop: TEMPLATE_VARS[2].sample };

/** แทนตัวแปร: ค่าว่าง = ข้อความว่าง + บอกว่าตัวไหนว่าง (preview เตือน), unknown = {…} ที่ไม่รู้จัก (คงไว้ตามเดิม) */
export function renderTemplate(body: string, v: TemplateValues): { text: string; missing: string[]; unknown: string[] } {
  const vals: Record<string, string> = { '{ชื่อ}': v.name?.trim() || '', '{สินค้าล่าสุด}': v.product?.trim() || '', '{ร้าน}': v.shop?.trim() || '' };
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const text = body.replace(/\{[^{}\n]*\}/g, (m) => {
    if (!(m in vals)) {
      unknown.add(m);
      return m;
    }
    if (!vals[m]) missing.add(m);
    return vals[m];
  });
  return { text, missing: [...missing], unknown: [...unknown] };
}

export function validateTemplate(name: string, body: string): string | null {
  if (!name.trim()) return 'ใส่ชื่อ template';
  if (!body.trim()) return 'ใส่ข้อความของ template';
  return null;
}

export const activeTemplates = (ts: ReadonlyArray<Template>, brand: Brand): Template[] => ts.filter((t) => t.brand === brand && t.active);

/** แทน/เพิ่ม template ในรายการ (ผลของ dsales_template_save) */
export function upsertTemplate(ts: ReadonlyArray<Template>, t: Template): Template[] {
  return ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t];
}

/* ---------- โหมด fixture: preview จากลูกค้าตัวอย่าง (เลียนกติกาของ dsales_outreach_preview ข้อ 4.4) ---------- */
// รหัสร้านเหมือน lib/jst.ts platformOf (ไม่ import lib/jst เพราะดึง supabase client มาด้วย)
const SHOP_PLAT: Readonly<Record<string, string>> = { SH: 'shopee', LOA: 'line', LA: 'lazada', TT: 'tiktok', FB: 'facebook', IG: 'instagram' };
const shopPlatform = (shop: string | null | undefined): string => SHOP_PLAT[String(shop || '').split('_')[0].toUpperCase()] || 'other';
const ROOM_ORDER: Readonly<Record<string, number>> = { line: 0, shopee: 1, lazada: 1, facebook: 2, instagram: 2 };
const PROVIDER: Readonly<Record<string, string>> = {
  line: 'Line', shopee: 'Shopee', lazada: 'Lazada', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
};

export function demoPreview(rows: ReadonlyArray<SelRow>, t: Pick<Template, 'body' | 'brand'>, customers: ReadonlyArray<DemoCustomer>, meId: string): PreviewRow[] {
  return rows.map((r): PreviewRow => {
    const base = { phone: r.phone, name: r.name, ms_id: null, page: null, provider: null, chat_name: null, message: null };
    const c = customers.find((x) => x.phone === r.phone);
    if (!c) return { ...base, skip: 'customer_not_found' };
    if (r.taken && r.taken !== meId) return { ...base, skip: 'taken' };
    const product = c.purchases[0]?.product ?? '';
    if (r.chatRooms) {
      // ห้องของแถว (chat_rooms ของ dsales_base_customers): ห้องที่ส่งได้ของแบรนด์นี้ก่อน
      const own = r.chatRooms.filter((x) => x.brand === t.brand);
      const ok = own.find((x) => x.sendable);
      if (!ok) return { ...base, skip: own.length ? 'window_closed' : 'no_chat_room' };
      const msg = renderTemplate(t.body, { name: c.name, product, shop: ok.page });
      return {
        ...base, ms_id: ok.msId, page: ok.page, provider: PROVIDER[ok.provider] ?? ok.provider, chat_name: r.chat || c.chatName || null,
        message: msg.text, skip: null,
      };
    }
    const rooms = (c.channels.length ? c.channels : [{ shop: c.shop, chat: c.chatName }])
      .map((ch) => ({ shop: ch.shop || '', chat: ch.chat || ch.chat_name || '', plat: ch.platform || shopPlatform(ch.shop) }))
      .filter((x) => x.plat in ROOM_ORDER && x.chat && (!x.shop || x.shop.toLowerCase().endsWith(t.brand)))
      .sort((a, b) => ROOM_ORDER[a.plat] - ROOM_ORDER[b.plat]);
    if (!rooms.length) return { ...base, skip: 'no_chat_room' };
    const room = rooms[0];
    // ลูกค้าเก่าส่วนมากเงียบเกิน 24 ชม. → ห้อง Facebook/Instagram ปิดช่วงส่ง (ข้อ 4.4)
    if (ROOM_ORDER[room.plat] === 2) return { ...base, skip: 'window_closed' };
    const msg = renderTemplate(t.body, { name: c.name, product, shop: room.shop });
    return { ...base, ms_id: null, page: room.shop, provider: PROVIDER[room.plat], chat_name: room.chat, message: msg.text, skip: null };
  });
}

/** แยกแถว preview เป็นที่จะส่ง / ที่ถูกข้าม */
export function splitPreview(rows: ReadonlyArray<PreviewRow>): { send: PreviewRow[]; skip: PreviewRow[] } {
  return { send: rows.filter((r) => !r.skip), skip: rows.filter((r) => !!r.skip) };
}
