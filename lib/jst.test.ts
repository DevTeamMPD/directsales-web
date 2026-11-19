import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc }) }));

import type { ChatSessionJson, Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import {
  chatAria, chatCheckFor, chatCheckView, channelsOf, chatTitle, jstChatUrl, jstOpen, jstTarget, JST_TIMEOUT_MS, localChatCheck, nextChatCheck, platformOf, shouldStartVerify,
  runVerify, summarizeChats, verifyTodo, type ChatCheckResult, type JstDeps, type JstTarget,
} from './jst';

const F = fixturePayload();
const byId = (id: string): Lead => {
  const l = F.leads.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};

const T: JstTarget = {
  phone: '0869684532', name: 'วีรวัฒน์ พงษ์ไทย', brand: 'hosttail', platform: 'shopee', shop: 'SH_hosttail', chat: 'mom_ploy114_sh', ms_id: null,
};
const mocks = () => ({
  fetch: vi.fn<JstDeps['fetch']>(),
  open: vi.fn<JstDeps['open']>(),
  openJst: vi.fn<JstDeps['openJst']>(),
  writeText: vi.fn<(text: string) => Promise<void>>(),
  toast: vi.fn<(msg: string) => void>(),
});
type Mocks = ReturnType<typeof mocks>;
const depsOf = (m: Mocks, over: Partial<JstDeps> = {}): JstDeps => ({
  helperUrl: 'http://127.0.0.1:47321', urlTemplate: '', chatUrl: '', fetch: m.fetch, open: m.open, openJst: m.openJst,
  clipboard: { writeText: m.writeText }, toast: m.toast, now: () => 1700000000000, ...over,
});

const S = (o: Partial<ChatSessionJson>): ChatSessionJson => ({
  ms_id: 1, channel: 'LINE', page: 'Bebeplay OA', chat_name: 'x', last_time: null, msg_count: 3, admin_msgs: 0,
  last_admin_time: null, last_admin_sender: null, last_customer_time: null, ...o,
});
const SESSIONS = [
  S({ ms_id: 1, admin_msgs: 2, last_admin_time: '2026-11-04T10:05:00', last_admin_sender: 'Ploy' }),
  S({ ms_id: 2, channel: 'Facebook', page: 'Hosttail FB', admin_msgs: 1, last_admin_time: '2026-11-04T11:30:00', last_admin_sender: 'Mint' }),
  S({ ms_id: 3 }),
];

beforeEach(() => rpc.mockReset());

describe('channels (prototype L397-411)', () => {
  it('platformOf reads the shop-code prefix', () => {
    expect(['SH_bebeplay', 'LOA_hosttail', 'LA_x', 'TT_x', 'FB_x', 'Web_bebeplay', 'IG_x', 'XX_x', '', null].map((s) => platformOf(s)))
      .toEqual(['shopee', 'line', 'lazada', 'tiktok', 'facebook', 'website', 'instagram', 'other', 'other', 'other']);
  });
  it('channelsOf normalises, puts LINE first and falls back to shop/chatName', () => {
    expect(channelsOf(byId('L1011'))).toEqual([
      { shop: 'SH_hosttail', chat: 'cat_lover111_sh', platform: 'shopee', ms_id: null },
      { shop: 'LA_hosttail', chat: 'happy_mom111_la', platform: 'lazada', ms_id: null },
      { shop: 'TT_hosttail', chat: 'mom_ploy111_tt', platform: 'tiktok', ms_id: null },
    ]);
    expect(channelsOf(byId('L1003')).map((c) => c.shop)).toEqual(['LOA_bebeplay', 'SH_bebeplay', 'Web_bebeplay']);
    expect(channelsOf({ channels: [], shop: 'SH_x', chatName: 'buyer1' })).toEqual([{ shop: 'SH_x', chat: 'buyer1', platform: 'shopee', ms_id: null }]);
    expect(channelsOf({ channels: [{ platform: 'facebook', shop: 'FB_x', chat_name: 'fb1', ms_id: 7 }] }))
      .toEqual([{ shop: 'FB_x', chat: 'fb1', platform: 'facebook', ms_id: 7 }]);
    expect(channelsOf({ channels: null, shop: '', chatName: '' })).toEqual([]);
  });
  it('jstTarget and the chat button labels', () => {
    const l = byId('L1014');
    expect(jstTarget(l, channelsOf(l)[0])).toEqual(T);
    const noChat = { shop: 'SH_x', chat: '', platform: 'shopee', ms_id: null };
    expect(jstTarget({ ...l, chatName: '' }, noChat).chat).toBe('วีรวัฒน์ พงษ์ไทย');
    expect(jstTarget({ ...l, chatName: 'buyer' }, noChat).chat).toBe('buyer');
    expect(chatTitle({ shop: 'SH_hosttail', chat: '', platform: 'shopee', ms_id: null })).toBe('Shopee · SH_hosttail — เปิดแชตใน JST');
    expect(chatTitle({ shop: '', chat: '', platform: 'line', ms_id: null })).toBe('LINE — เปิดแชตใน JST');
    expect(chatAria({ shop: 'SH_hosttail', chat: '', platform: 'shopee', ms_id: null })).toBe('เปิดแชต Shopee SH_hosttail ใน JST');
  });
});

describe('jstOpen (prototype L415-435)', () => {
  it('helper OK → toast (silent in auto mode) and true', async () => {
    const m = mocks();
    m.fetch.mockResolvedValue({ ok: true });
    await expect(jstOpen(T, 'Dev MPD', depsOf(m))).resolves.toBe(true);
    const [url, init] = m.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:47321/open');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init.body))).toEqual({ ...T, rep: 'Dev MPD' });
    expect(m.toast).toHaveBeenCalledWith('เปิดแชตใน JST แล้ว');
    await expect(jstOpen(T, 'Dev MPD', depsOf(m), { auto: true })).resolves.toBe(true);
    expect(m.toast).toHaveBeenCalledTimes(1);
  });
  it('a helper that never answers is aborted after 2500 ms, then the chat name is copied', async () => {
    vi.useFakeTimers();
    try {
      const m = mocks();
      m.fetch.mockImplementation((_url, init) => new Promise<{ ok: boolean }>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      m.writeText.mockResolvedValue();
      const p = jstOpen(T, 'Dev MPD', depsOf(m));
      await vi.advanceTimersByTimeAsync(JST_TIMEOUT_MS - 1);
      expect(m.writeText).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(p).resolves.toBe(false);
      expect(m.writeText).toHaveBeenCalledWith('mom_ploy114_sh');
      expect(m.toast).toHaveBeenCalledWith('ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST');
    } finally {
      vi.useRealTimers();
    }
  });
  it('falls back to the URL template with encoded payload values', async () => {
    const m = mocks();
    m.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const deps = depsOf(m, { urlTemplate: 'https://jst.example/chat?q={chat}&p={phone}&r={rep}&x={ms_id}' });
    await expect(jstOpen(T, 'Dev MPD', deps)).resolves.toBe(true);
    expect(m.open).toHaveBeenCalledWith('https://jst.example/chat?q=mom_ploy114_sh&p=0869684532&r=Dev%20MPD&x=');
    expect(m.writeText).not.toHaveBeenCalled();
  });
  it('clipboard failure shows the search text; auto mode never copies or toasts', async () => {
    const m = mocks();
    m.fetch.mockResolvedValue({ ok: false });
    m.writeText.mockRejectedValue(new Error('denied'));
    await expect(jstOpen({ ...T, chat: '' }, 'Dev MPD', depsOf(m))).resolves.toBe(false);
    expect(m.writeText).toHaveBeenCalledWith('0869684532');
    expect(m.toast).toHaveBeenCalledWith('ยังไม่ได้รันตัวช่วย JST · ค้นหาใน JST ด้วย: 0869684532');
    m.toast.mockClear();
    m.writeText.mockClear();
    await expect(jstOpen(T, 'Dev MPD', depsOf(m), { auto: true })).resolves.toBe(false);
    expect(m.writeText).not.toHaveBeenCalled();
    expect(m.toast).not.toHaveBeenCalled();
  });
});

describe('jstOpen with the JST chat page (Tampermonkey script opens the chat)', () => {
  const CHAT = 'https://asia-web.jsterp.com/iim/index';
  it('jstChatUrl puts the search text, ms_id and a nonce in the hash', () => {
    expect(jstChatUrl(CHAT, { ...T, chat: '😊😊A o m 😊😊', ms_id: 130427 }, 5)).toBe(
      CHAT + '#dsales-chat=' + encodeURIComponent('😊😊A o m 😊😊') + '&dsales-ms=130427&dsales-t=5',
    );
    expect(jstChatUrl(CHAT, { ...T, chat: '', ms_id: null }, 6)).toBe(CHAT + '#dsales-chat=0869684532&dsales-ms=&dsales-t=6');
  });
  it('opens the JST tab before anything async, copies the chat name and skips the helper', async () => {
    const m = mocks();
    const order: string[] = [];
    m.writeText.mockImplementation(async () => { order.push('copy'); });
    m.openJst.mockImplementation(() => { order.push('open'); return true; });
    await expect(jstOpen(T, 'Dev MPD', depsOf(m, { chatUrl: CHAT }))).resolves.toBe(true);
    expect(m.openJst).toHaveBeenCalledWith(CHAT + '#dsales-chat=mom_ploy114_sh&dsales-ms=&dsales-t=1700000000000');
    expect(order).toEqual(['copy', 'open']); // writeText เริ่มก่อน (เอกสารยังโฟกัสอยู่) แล้วเปิดแท็บทันทีในจังหวะเดียวกัน
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenCalledWith('เปิดแชตใน JST แล้ว · ถ้าแชตไม่เปิดเอง กด Ctrl+V ในช่องค้นหา');
  });
  it('auto mode (after a claim) opens and copies without a toast', async () => {
    const m = mocks();
    m.writeText.mockResolvedValue();
    m.openJst.mockReturnValue(true);
    await expect(jstOpen(T, 'Dev MPD', depsOf(m, { chatUrl: CHAT }), { auto: true })).resolves.toBe(true);
    expect(m.openJst).toHaveBeenCalledTimes(1);
    expect(m.toast).not.toHaveBeenCalled();
  });
  it('clipboard failure shows the search text; a blocked tab says so', async () => {
    const m = mocks();
    m.writeText.mockRejectedValue(new Error('denied'));
    m.openJst.mockReturnValue(true);
    await jstOpen(T, 'Dev MPD', depsOf(m, { chatUrl: CHAT }));
    expect(m.toast).toHaveBeenLastCalledWith('เปิดแชตใน JST แล้ว · ถ้าแชตไม่เปิดเอง ค้นหาด้วย: mom_ploy114_sh');
    m.openJst.mockReturnValue(false);
    m.writeText.mockResolvedValue();
    await expect(jstOpen(T, 'Dev MPD', depsOf(m, { chatUrl: CHAT }))).resolves.toBe(false);
    expect(m.toast).toHaveBeenLastCalledWith('เบราว์เซอร์บล็อกการเปิดแท็บ JST · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST');
  });
});

describe('chat check (prototype L438-479)', () => {
  it('summarizeChats sums admin messages and takes the latest admin reply', () => {
    expect(summarizeChats(SESSIONS)).toEqual({ live: true, sessions: SESSIONS, found: 3, count: 3, sent: true, last: '2026-11-04T11:30:00', by: 'Mint' });
    expect(summarizeChats([])).toEqual({ live: true, sessions: [], found: 0, count: 0, sent: false, last: null, by: null });
  });
  it('chatCheckFor sends the raw claimed time as p_since; errors become a Thai message', async () => {
    rpc.mockResolvedValueOnce({ data: SESSIONS, error: null });
    const res = await chatCheckFor({ phone: '0812345678', claimedAtIso: '2026-11-04T02:05:00.123456+00:00' });
    expect(rpc).toHaveBeenCalledWith('dsales_customer_chats', { p_phone: '0812345678', p_since: '2026-11-04T02:05:00.123456+00:00' });
    expect(res).toMatchObject({ count: 3, sent: true });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_member' } });
    await expect(chatCheckFor({ phone: '0812345678', claimedAtIso: null })).resolves.toEqual({ err: 'ตรวจไม่สำเร็จ: บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า' });
    expect(rpc).toHaveBeenLastCalledWith('dsales_customer_chats', { p_phone: '0812345678', p_since: null });
  });
  it('localChatCheck (fixture mode) counts in-app chat logs since the claim', () => {
    expect(localChatCheck(byId('L1011'), F.reps)).toEqual({ live: false, sessions: [], found: 1, count: 1, sent: true, last: '2026-10-03T11:20', by: 'กมลชนก ใจดี' });
    expect(localChatCheck({ ...byId('L1011'), claimedAt: '2026-10-04T00:00' }, F.reps)).toMatchObject({ count: 0, sent: false, found: 1, last: null, by: null });
    expect(localChatCheck(byId('L1014'), F.reps)).toMatchObject({ count: 0, sent: false });
  });
  it('chatCheckView: badge, detail and one line per session', () => {
    expect(chatCheckView({ err: 'ตรวจไม่สำเร็จ: x' }, null)).toEqual({ badge: { cls: 's-lost plain', text: 'ตรวจไม่ได้' }, detail: 'ตรวจไม่สำเร็จ: x', sessions: [] });
    const sent = chatCheckView(summarizeChats(SESSIONS), '2026-11-04T09:05');
    expect(sent.badge).toEqual({ cls: 's-won', text: 'ทักแชทแล้ว' });
    expect(sent.detail).toBe('เซลล์ส่ง 3 ข้อความ หลังจอง (4/11/2026 09:05) · ล่าสุด 4/11/2026 11:30 โดย Mint');
    expect(sent.sessions).toEqual([
      { key: '1-0', icon: 'line', page: 'Bebeplay OA', meta: 'ล่าสุด เซลล์ 4/11/2026 10:05 · Ploy · ส่ง 2' },
      { key: '2-1', icon: 'facebook', page: 'Hosttail FB', meta: 'ล่าสุด เซลล์ 4/11/2026 11:30 · Mint · ส่ง 1' },
      { key: '3-2', icon: 'line', page: 'Bebeplay OA', meta: 'ล่าสุด — · ส่ง 0' },
    ]);
    expect(chatCheckView(summarizeChats([S({ channel: 'WebChat', page: null, last_time: '2026-11-03T08:00:00' })]), null)).toEqual({
      badge: { cls: 's-callback plain', text: 'ยังไม่พบข้อความที่ส่ง' }, detail: 'เซลล์ยังไม่ได้ส่งข้อความ',
      sessions: [{ key: '1-0', icon: 'other', page: 'WebChat', meta: 'ล่าสุด 3/11/2026 08:00 · ส่ง 0' }],
    });
    expect(chatCheckView(summarizeChats([]), null)).toEqual({
      badge: { cls: 's-new plain', text: 'ไม่พบแชตใน JST' },
      detail: 'จับคู่แชตของลูกค้ารายนี้ไม่พบ (จับคู่ด้วยชื่อแชต/ชื่อผู้ซื้อ) ลองตรวจใน JST เอง', sessions: [],
    });
  });
  it('chatCheckView shows timestamptz values in Bangkok time, but last_time as stored (already Thai wall-clock)', () => {
    const v = chatCheckView(
      { live: true, sessions: [S({ last_admin_time: '2026-11-17T08:00:00+00:00', last_time: '2026-11-17T08:00:00+00:00' }), S({ last_admin_time: null, last_time: '2026-11-17T08:00:00+00:00' })], found: 2, count: 1, sent: true, last: '2026-11-17T08:00:00+00:00', by: 'Mint' },
      null,
    );
    expect(v.detail).toContain('ล่าสุด 17/11/2026 15:00');
    expect(v.sessions[0].meta).toContain('ล่าสุด เซลล์ 17/11/2026 15:00');
    expect(v.sessions[1].meta).toContain('ล่าสุด 17/11/2026 08:00');
  });
  it('shouldStartVerify: live only, never overlapping, 30 s gap only for an unchanged set', () => {
    const base = { live: true, key: 'a,b', lastKey: '', lastRunAt: 0, now: 1_000_000, verifying: false };
    expect(shouldStartVerify(base)).toBe(true);
    expect(shouldStartVerify({ ...base, live: false })).toBe(false);
    expect(shouldStartVerify({ ...base, key: '' })).toBe(false);
    expect(shouldStartVerify({ ...base, verifying: true })).toBe(false);
    expect(shouldStartVerify({ ...base, lastKey: 'a,b', lastRunAt: base.now - 29_999 })).toBe(false);
    expect(shouldStartVerify({ ...base, lastKey: 'a,b', lastRunAt: base.now - 30_000 })).toBe(true);
    expect(shouldStartVerify({ ...base, lastKey: 'a', lastRunAt: base.now - 1 })).toBe(true);
  });
  it('nextChatCheck marks the table dirty only when "sent" changes (ui.dirtyRows)', () => {
    const res = summarizeChats(SESSIONS);
    expect(nextChatCheck(null, res, '2026-11-04T12:00')).toEqual({ chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 }, dirty: true });
    expect(nextChatCheck({ at: 'x', sent: true, count: 1 }, res, 't')).toEqual({ chatCheck: { at: 't', sent: true, count: 3 }, dirty: false });
    expect(nextChatCheck({ at: 'x', sent: true, count: 1 }, summarizeChats([]), 't')?.dirty).toBe(true);
    expect(nextChatCheck(null, { err: 'x' }, 't')).toBeNull();
  });
});

describe('verifyMine (prototype L467-479)', () => {
  const mk = (i: number, over: Partial<Lead> = {}): Lead => ({
    ...byId('L1000'), id: `T${i}`, owner: 'r1', claimedAt: '2026-11-04T09:00', chatCheck: null, noCall: false, ...over,
  });
  it('verifyTodo: my claimed, not-yet-sent, callable leads — at most 10', () => {
    const others = [mk(20, { owner: 'r2' }), mk(21, { claimedAt: null }), mk(22, { chatCheck: { at: 'x', sent: true, count: 1 } }), mk(23, { noCall: true })];
    const leads = [...Array.from({ length: 12 }, (_, i) => mk(i)), ...others];
    expect(verifyTodo(leads, 'r1').map((l) => l.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']);
    expect(verifyTodo(others, 'r1')).toEqual([]);
  });
  it('runVerify checks one lead at a time, skips errors and returns only leads that became "sent"', async () => {
    const order: string[] = [];
    const check = vi.fn(async (l: Lead): Promise<ChatCheckResult> => {
      order.push(`start ${l.id}`);
      await Promise.resolve();
      order.push(`end ${l.id}`);
      if (l.id === 'T1') return { err: 'ตรวจไม่สำเร็จ: x' };
      return l.id === 'T2' ? summarizeChats([]) : summarizeChats(SESSIONS);
    });
    const todo = [mk(0), mk(1), mk(2), mk(3, { chatCheck: { at: 'x', sent: false, count: 0 } })];
    const changed = await runVerify(todo, check, () => '2026-11-04T12:00');
    expect(order).toEqual(['start T0', 'end T0', 'start T1', 'end T1', 'start T2', 'end T2', 'start T3', 'end T3']);
    expect(changed).toEqual([
      { id: 'T0', chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 } },
      { id: 'T3', chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 } },
    ]);
  });
});
