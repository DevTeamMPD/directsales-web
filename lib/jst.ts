import { errorMessage } from '@/lib/api/errors';
import { getCustomerChats } from '@/lib/api/rpc';
import type { Channel, ChatCheck, ChatSessionJson, Lead, Rep } from '@/lib/api/types';
import { JST_CHAT_URL, JST_HELPER_URL, JST_URL_TEMPLATE, PLAT, type Brand, type Platform } from '@/lib/constants';
import { fmtDT, localStamp } from '@/lib/format';

// การเชื่อม JST ของ prototype (legacy/app.js L397-479): ช่องทางแชต, เปิดแชต, ตรวจว่าเซลล์ทักแชทแล้วหรือยัง

/* ---------- ช่องทางแชต ---------- */
// รหัสร้านตาม cdp.shops: SH_=Shopee, LOA_=LINE OA, LA_=Lazada, TT_=TikTok, FB_=Facebook, Web_=เว็บไซต์, IG_=Instagram
const SHOP_PREFIX: Readonly<Record<string, Platform>> = {
  SH: 'shopee', LOA: 'line', LA: 'lazada', TT: 'tiktok', FB: 'facebook', WEB: 'website', IG: 'instagram',
};
export const platformOf = (shop: string | null | undefined): Platform => SHOP_PREFIX[String(shop || '').split('_')[0].toUpperCase()] || 'other';
export const platLabel = (p: string): string => (PLAT as Readonly<Record<string, string>>)[p] || p;

export interface NormChannel { shop: string; chat: string; platform: string; ms_id: number | string | null }
export interface ChannelSource { channels?: Channel[] | null; shop?: string | null; chatName?: string | null }

/** ช่องทางของลูกค้า (L401-402): channels หรือร้านหลัก + ชื่อแชต, LINE ขึ้นก่อน */
export function channelsOf(x: ChannelSource): NormChannel[] {
  const raw: Channel[] = x.channels && x.channels.length ? x.channels : x.shop ? [{ shop: x.shop, chat: x.chatName ?? '' }] : [];
  return raw
    .map((c) => ({ shop: c.shop || '', chat: c.chat || c.chat_name || '', platform: c.platform || platformOf(c.shop), ms_id: c.ms_id || null }))
    .sort((a, b) => Number(b.platform === 'line') - Number(a.platform === 'line'));
}

export interface JstSource { phone: string; name: string; brand: Brand; chatName?: string | null }
export interface JstTarget { phone: string; name: string; brand: Brand; platform: string; shop: string; chat: string; ms_id: number | string | null }

export const jstTarget = (x: JstSource, c: NormChannel): JstTarget => ({
  phone: x.phone, name: x.name, brand: x.brand, platform: c.platform, shop: c.shop, chat: c.chat || x.chatName || x.name, ms_id: c.ms_id || null,
});
export const chatTitle = (c: NormChannel): string => `${platLabel(c.platform)}${c.shop ? ' · ' + c.shop : ''} — เปิดแชตใน JST`;
export const chatAria = (c: NormChannel): string => `เปิดแชต ${platLabel(c.platform)} ${c.shop} ใน JST`;

/* ---------- เปิดแชตใน JST ---------- */
export const JST_TIMEOUT_MS = 2500;

export interface JstDeps {
  helperUrl: string;
  urlTemplate: string;
  /** หน้าแชต JST (ว่าง = ไม่ใช้ แล้วใช้ตัวช่วย/urlTemplate/คัดลอกแบบเดิม) */
  chatUrl: string;
  fetch: (url: string, init: RequestInit) => Promise<{ ok: boolean }>;
  open: (url: string) => void;
  /** เปิดหน้าแชต JST ในแท็บชื่อเดิม (ใช้แท็บซ้ำ) — false = เบราว์เซอร์บล็อกป๊อปอัป */
  openJst: (url: string) => boolean;
  clipboard: { writeText: (text: string) => Promise<void> } | undefined;
  toast: (msg: string) => void;
  now: () => number;
}

/** ลิงก์หน้าแชต JST + hash ที่สคริปต์ Tampermonkey อ่าน: คำค้น, ms_id (ถ้ารู้) และ nonce ให้คลิกชื่อเดิมซ้ำแล้ว hash ยังเปลี่ยน */
export function jstChatUrl(chatUrl: string, t: JstTarget, now: number): string {
  const q = new URLSearchParams({ 'dsales-chat': t.chat || t.phone || '', 'dsales-ms': t.ms_id == null ? '' : String(t.ms_id), 'dsales-t': String(now) });
  return chatUrl + '#' + q.toString().replace(/\+/g, '%20');
}

/**
 * เปิดหน้าแชต JST: เริ่มคัดลอกก่อน (ตอนเอกสารยังโฟกัส) แล้วเปิดแท็บในจังหวะเดียวกัน (ยังอยู่ใน user activation ของการคลิก)
 * สคริปต์ Tampermonkey บนหน้า JST ค้นหาแล้วเปิดห้องให้ ถ้าไม่ได้ติดตั้งสคริปต์ เซลล์กด Ctrl+V ในช่องค้นหาเอง
 */
async function openChatPage(t: JstTarget, deps: JstDeps, auto: boolean): Promise<boolean> {
  const txt = t.chat || t.phone || '';
  const copy = deps.clipboard ? deps.clipboard.writeText(txt).then(() => true, () => false) : Promise.resolve(false);
  const opened = deps.openJst(jstChatUrl(deps.chatUrl, t, deps.now()));
  const copied = await copy;
  if (!auto) {
    if (!opened) deps.toast(copied ? `เบราว์เซอร์บล็อกการเปิดแท็บ JST · คัดลอก "${txt}" แล้ว นำไปค้นหาใน JST` : 'เบราว์เซอร์บล็อกการเปิดแท็บ JST · ค้นหาใน JST ด้วย: ' + txt);
    else deps.toast(copied ? `เปิดแชตใน JST แล้ว · คัดลอก "${txt}" แล้ว ถ้าแชตไม่เปิดเอง กด Ctrl+V ในช่องค้นหา` : 'เปิดแชตใน JST แล้ว · ถ้าแชตไม่เปิดเอง ค้นหาด้วย: ' + txt);
  }
  return opened;
}

/**
 * ห้อง Facebook / Instagram ที่เกิน 24 ชม. (ส่งผ่าน JST ไม่ได้): คัดลอกชื่อห้อง แล้วเปิด Inbox ของเพจใน Meta Business Suite
 * (Business Suite เปิดแชตของลูกค้าตรง ๆ จาก PSID ไม่ได้ — เซลล์วางชื่อในช่องค้นหาของ Meta)
 */
export async function metaOpen(url: string, name: string, page: string, deps: JstDeps): Promise<void> {
  const copy = deps.clipboard && name ? deps.clipboard.writeText(name).then(() => true, () => false) : Promise.resolve(false);
  deps.open(url);
  const copied = await copy;
  const where = `เปิด Inbox เพจ ${page || 'Facebook'} ใน Meta แล้ว`;
  deps.toast(copied ? `${where} · คัดลอก "${name}" แล้ว กด Ctrl+V ในช่องค้นหาของ Meta` : `${where} · ค้นหาด้วย: ${name}`);
}

/**
 * L415-435: 1) ตัวช่วยบนเครื่องเซลล์ POST {helper}/open (ยกเลิกหลัง 2500 ms) 2) ลิงก์ตาม urlTemplate 3) คัดลอกชื่อแชต
 * auto = เปิดเองหลังจอง: ไม่ toast ตอนสำเร็จ และไม่คัดลอก
 */
export async function jstOpen(t: JstTarget, rep: string, deps: JstDeps, { auto = false }: { auto?: boolean } = {}): Promise<boolean> {
  if (deps.chatUrl) return openChatPage(t, deps, auto);
  const payload: Record<string, unknown> = { ...t, rep };
  if (deps.helperUrl) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), JST_TIMEOUT_MS);
    try {
      const r = await deps.fetch(deps.helperUrl + '/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        if (!auto) deps.toast('เปิดแชตใน JST แล้ว');
        return true;
      }
    } catch {
      clearTimeout(timer);
    }
  }
  if (deps.urlTemplate) {
    deps.open(deps.urlTemplate.replace(/\{(\w+)\}/g, (_m, k: string) => encodeURIComponent(String(payload[k] ?? ''))));
    return true;
  }
  if (!auto && deps.clipboard) {
    const txt = t.chat || t.phone || '';
    try {
      await deps.clipboard.writeText(txt);
      deps.toast('ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST');
    } catch {
      deps.toast('ยังไม่ได้รันตัวช่วย JST · ค้นหาใน JST ด้วย: ' + txt);
    }
  }
  return false;
}

/** deps จริงในเบราว์เซอร์ (เรียกจาก client component เท่านั้น) */
export function browserJstDeps(toast: (msg: string) => void): JstDeps {
  return {
    helperUrl: JST_HELPER_URL,
    urlTemplate: JST_URL_TEMPLATE,
    chatUrl: JST_CHAT_URL,
    fetch: (url, init) => window.fetch(url, init),
    open: (url) => {
      window.open(url, '_blank', 'noopener');
    },
    openJst: (url) => {
      // ชื่อแท็บคงที่ = คลิกครั้งต่อไปใช้แท็บ JST เดิม (เปลี่ยนแค่ hash ไม่โหลดหน้าใหม่) · ตัด opener ทันทีตอนยังเป็น about:blank
      const w = window.open(url, 'dsales-jst');
      if (!w) return false;
      try {
        w.opener = null;
      } catch {
        /* แท็บเดิมเป็นโดเมน JST แล้ว ตั้ง opener ไม่ได้ (ไม่จำเป็น) */
      }
      try {
        w.focus();
      } catch {
        /* บางเบราว์เซอร์ไม่ยอมให้โฟกัสแท็บอื่น */
      }
      return true;
    },
    clipboard: typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    toast,
    now: () => Date.now(),
  };
}

/* ---------- ตรวจทักแชท ---------- */
export interface ChatCheckOk {
  live: boolean; sessions: ChatSessionJson[]; found: number; count: number; sent: boolean; last: string | null; by: string | null;
}
export type ChatCheckResult = { err: string } | ChatCheckOk;

/** รวมผล dsales_customer_chats (L444-446): นับข้อความฝั่งเซลล์ และหาครั้งล่าสุดที่เซลล์ตอบ */
export function summarizeChats(sessions: ChatSessionJson[]): ChatCheckOk {
  const count = sessions.reduce((s, x) => s + Number(x.admin_msgs || 0), 0);
  const lastS = sessions
    .filter((x) => x.last_admin_time)
    .sort((a, b) => String(b.last_admin_time).localeCompare(String(a.last_admin_time)))[0];
  return { live: true, sessions, found: sessions.length, count, sent: count > 0, last: lastS?.last_admin_time ?? null, by: lastS?.last_admin_sender ?? null };
}

/** L438-447 (ล็อกอินจริง): p_since = เวลาจองดิบจาก server (claimedAtIso) ไม่ใช่เวลาท้องถิ่นที่ตัดเขตเวลาแล้ว */
export async function chatCheckFor(l: Pick<Lead, 'phone' | 'claimedAtIso'>): Promise<ChatCheckResult> {
  try {
    return summarizeChats((await getCustomerChats(l.phone, l.claimedAtIso ?? null)) || []);
  } catch (e) {
    return { err: 'ตรวจไม่สำเร็จ: ' + errorMessage(e) };
  }
}

/** L449-451 (โหมด fixture = โหมดตัวอย่างของ prototype): นับบันทึกแชตในแอปหลังเวลาจอง */
export function localChatCheck(l: Pick<Lead, 'interactions' | 'claimedAt'>, reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>): ChatCheckOk {
  const since = l.claimedAt || null;
  const chats = l.interactions.filter((i) => i.type === 'chat' && (!since || i.date >= since));
  const last = chats[chats.length - 1];
  return {
    live: false, sessions: [], found: 1, count: chats.length, sent: chats.length > 0,
    last: last?.date ?? null, by: (last && reps.find((r) => r.id === last.rep)?.name) || null,
  };
}

/** ไอคอนของ session (L463): line → line, webchat → other */
export const sessionIcon = (channel: string | null): string =>
  (channel || '').toLowerCase() === 'line' ? 'line' : (channel || 'other').toLowerCase().replace('webchat', 'other');

export interface ChatCheckView {
  badge: { cls: string; text: string };
  detail: string;
  sessions: Array<{ key: string; icon: string; page: string; meta: string }>;
}

const HAS_OFFSET = /(Z|[+-]\d{2}(:?\d{2})?)$/i;
/** timestamptz (มี offset) → เวลาไทย; ข้อความไม่มี offset (fixture) คงเดิม */
const bkk = (s: string | null | undefined): string | null | undefined => (s && s.length > 10 && HAS_OFFSET.test(s) ? localStamp(s) : s);

/** เนื้อหา #chk-body (renderChatCheck L459-463) */
export function chatCheckView(res: ChatCheckResult, claimedAt: string | null | undefined): ChatCheckView {
  if ('err' in res) return { badge: { cls: 's-lost plain', text: 'ตรวจไม่ได้' }, detail: res.err, sessions: [] };
  const since = claimedAt ? ` หลังจอง (${fmtDT(claimedAt)})` : '';
  const badge = res.sent
    ? { cls: 's-won', text: 'ทักแชทแล้ว' }
    : res.found ? { cls: 's-callback plain', text: 'ยังไม่พบข้อความที่ส่ง' } : { cls: 's-new plain', text: 'ไม่พบแชตใน JST' };
  const detail = res.sent
    ? `เซลล์ส่ง ${res.count} ข้อความ${since} · ล่าสุด ${fmtDT(bkk(res.last))}${res.by ? ' โดย ' + res.by : ''}`
    : res.found ? `เซลล์ยังไม่ได้ส่งข้อความ${since}` : 'จับคู่แชตของลูกค้ารายนี้ไม่พบ (จับคู่ด้วยชื่อแชต/ชื่อผู้ซื้อ) ลองตรวจใน JST เอง';
  const sessions = res.sessions.map((x, i) => ({
    key: `${x.ms_id}-${i}`,
    icon: sessionIcon(x.channel),
    page: x.page || x.channel || '',
    // last_time มาจาก iim_sessions.last_time ซึ่งใน DB เป็นเวลาไทยจริงที่ถูกเก็บเป็น UTC (เร็วกว่าจริง 7 ชม.) จึงแสดงตามที่เก็บ (ตัดข้อความ) ไม่แปลงเขตเวลาซ้ำ
    meta: `ล่าสุด ${x.last_admin_time ? 'เซลล์ ' + fmtDT(bkk(x.last_admin_time)) : x.last_time ? fmtDT(x.last_time) : '—'}${x.last_admin_sender ? ' · ' + x.last_admin_sender : ''} · ส่ง ${x.admin_msgs ?? 0}`,
  }));
  return { badge, detail, sessions };
}

/** L458: เก็บผลตรวจลงลีด; dirty = ป้าย "ทักแชทแล้ว" ในตารางต้องเปลี่ยน (ui.dirtyRows) */
export function nextChatCheck(prev: ChatCheck | null | undefined, res: ChatCheckResult, at: string): { chatCheck: ChatCheck; dirty: boolean } | null {
  if ('err' in res) return null;
  return { chatCheck: { at, sent: res.sent, count: res.count }, dirty: !!prev?.sent !== res.sent };
}

/** L470: ลีดของฉันที่จองแล้ว ยังไม่พบว่าทักแชท และไม่ใช่ห้ามโทร สูงสุด 10 ราย */
export const verifyTodo = (leads: ReadonlyArray<Lead>, meId: string): Lead[] =>
  leads.filter((l) => l.owner === meId && l.claimedAt && !l.chatCheck?.sent && !l.noCall).slice(0, 10);

/** เว้นระยะขั้นต่ำระหว่างรอบตรวจชุดลีดเดิม (กันยิง RPC ถี่บนฐานข้อมูล production ที่ใช้ร่วมกับระบบอื่น) */
export const VERIFY_MIN_INTERVAL_MS = 30_000;

/** ควรเริ่มรอบตรวจใหม่หรือไม่: ล็อกอินจริง + มีรายต้องตรวจ + ไม่มีรอบที่กำลังรัน; ชุดลีดเปลี่ยน = รันทันที, ชุดเดิม = ต้องห่างอย่างน้อย 30 วินาที */
export function shouldStartVerify(a: { live: boolean; key: string; lastKey: string; lastRunAt: number; now: number; verifying: boolean }): boolean {
  if (!a.live || !a.key || a.verifying) return false;
  return a.key !== a.lastKey || a.now - a.lastRunAt >= VERIFY_MIN_INTERVAL_MS;
}

/** L472-478: ตรวจทีละรายตามลำดับ ข้ามรายที่ error คืนเฉพาะรายที่เปลี่ยนจากยังไม่ทักเป็นทักแล้ว */
export async function runVerify(
  todo: ReadonlyArray<Lead>, check: (l: Lead) => Promise<ChatCheckResult>, at: () => string,
): Promise<Array<{ id: string; chatCheck: ChatCheck }>> {
  const changed: Array<{ id: string; chatCheck: ChatCheck }> = [];
  for (const l of todo) {
    const next = nextChatCheck(l.chatCheck, await check(l), at());
    if (next && !l.chatCheck?.sent && next.chatCheck.sent) changed.push({ id: l.id, chatCheck: next.chatCheck });
  }
  return changed;
}
