import { describe, expect, it } from 'vitest';
import type { ChatRoom, DemoCustomer, WorkerStatus } from '@/lib/api/types';
import {
  batchProgress, brandRoomCounts, brandRoomHint, channelLabel, countBadges, DEFAULT_MAX_BATCH, defaultOutreachBrand, demoPreview, hasPending, isWorkerOnline, itemErrorText, itemsPending, maxBatch,
  leadSelectable, leadSelRow, pageCheckState, phoneCheckState, pruneSelection, renderTemplate, roomLabel, selectionBar, setPageSelected, setPhones, shouldPoll, skipLabel, splitPreview, statusBadge, statusLabel,
  skipReasonText, TEST_MODE_TEXT, togglePhone, toggleRoom, toggleSelect, toSelRow, upsertTemplate, validateSettings, validateTemplate, workerBanners, workerStateLabel, type SelRow,
} from './outreach';

const row = (phone: string, over: Partial<SelRow> = {}): SelRow => ({ phone, name: `ลูกค้า ${phone}`, brands: ['bebeplay'], chat: 'c', taken: null, mine: false, chatBrands: [], ...over });

describe('selection', () => {
  it('toggles one row and keeps rows of other pages when the header box toggles the visible page', () => {
    let sel = toggleSelect(new Map(), row('01'));
    expect([...sel.keys()]).toEqual(['01']);
    sel = setPageSelected(sel, [row('02'), row('03')], true);
    expect([...sel.keys()].sort()).toEqual(['01', '02', '03']);
    expect(pageCheckState(sel, [row('02'), row('03')])).toBe('all');
    expect(pageCheckState(sel, [row('03'), row('04')])).toBe('some');
    expect(pageCheckState(sel, [row('05')])).toBe('none');
    sel = setPageSelected(sel, [row('02'), row('03')], false);
    expect([...sel.keys()]).toEqual(['01']);
    sel = toggleSelect(sel, row('01'));
    expect(sel.size).toBe(0);
  });
  it('does not mutate the previous selection', () => {
    const a = new Map<string, SelRow>();
    const b = toggleSelect(a, row('01'));
    expect(a.size).toBe(0);
    expect(b.size).toBe(1);
  });
  it('max batch comes from settings (default 50) and the bar disables above it', () => {
    expect(maxBatch(null)).toBe(DEFAULT_MAX_BATCH);
    expect(maxBatch({ max_batch: 0 })).toBe(50);
    expect(maxBatch({ max_batch: 20 })).toBe(20);
    expect(selectionBar(0, 50)).toEqual({ text: 'เลือก 0 คน', canSend: false, over: null });
    expect(selectionBar(50, 50).canSend).toBe(true);
    expect(selectionBar(51, 50)).toEqual({ text: 'เลือก 51 คน', canSend: false, over: 'เลือกได้สูงสุด 50 คนต่อชุด' });
  });
});

describe('labels', () => {
  it('skip reasons, statuses and worker states in Thai', () => {
    expect(skipLabel('no_chat_room')).toBe('ไม่พบห้องแชตของแบรนด์นี้');
    expect(skipLabel('window_closed')).toBe('หมดช่วงส่งข้อความ (ลูกค้าไม่ได้ทักมาเกิน 7 วัน)');
    expect(skipLabel('claim_failed')).toBe('จองลูกค้าไม่สำเร็จ');
    expect(skipLabel('something_new')).toBe('something_new');
    expect(statusLabel('queued')).toBe('รอส่ง');
    expect(statusBadge('sent')).toBe('s-won');
    expect(statusBadge('failed')).toBe('s-lost');
    expect(workerStateLabel('needs_login')).toBe('ต้องล็อกอิน JST ใหม่');
  });
  it('worker item errors', () => {
    expect(itemErrorText(null)).toBe('');
    expect(itemErrorText('room_mismatch')).toBe('ห้องแชตไม่ตรงกับที่บันทึกไว้ (ไม่ได้ส่ง)');
    expect(itemErrorText('window_closed')).toContain('โทรหาแทน');
    expect(itemErrorText('jst_error: ห้องถูกปิด')).toBe('JST ส่งไม่สำเร็จ: ห้องถูกปิด');
    expect(itemErrorText('stale_sending')).toBe('ส่งค้างนานเกินไป ระบบคืนเข้าคิว');
  });
  it('channel · page and test-room labels', () => {
    expect(channelLabel('Line', 'bebeplayspace')).toBe('LINE · bebeplayspace');
    expect(channelLabel('shopee', 'SH_bebeplay')).toBe('Shopee · SH_bebeplay');
    expect(channelLabel(null, null)).toBe('—');
    expect(roomLabel({ ms_id: 77, customer: 'สมใจ', channel: 'Facebook', page: 'Bebeplay' })).toBe('สมใจ · Facebook · Bebeplay (77)');
    expect(toggleRoom([1, 2], 2)).toEqual([1]);
    expect(toggleRoom([1], 3)).toEqual([1, 3]);
  });
});

describe('progress', () => {
  it('summarizes batch counts', () => {
    expect(batchProgress({ queued: 2, sending: 1, sent: 5, failed: 1, cancelled: 1 })).toEqual({ total: 10, pending: 3, done: 7, sent: 5, failed: 1, cancelled: 1 });
    expect(batchProgress(null).total).toBe(0);
    expect(hasPending({ queued: 0, sending: 1 })).toBe(true);
    expect(hasPending({ sent: 3 })).toBe(false);
    expect(itemsPending([{ status: 'sent' }, { status: 'queued' }])).toBe(true);
    expect(countBadges({ sent: 2, queued: 1, failed: 0 }, 3).map((b) => b.text)).toEqual(['ส่งแล้ว 2', 'รอส่ง 1', 'ข้าม 3']);
  });
  it('polls only when live, visible and something is pending', () => {
    expect(shouldPoll(true, true, true)).toBe(true);
    expect(shouldPoll(true, false, true)).toBe(false);
    expect(shouldPoll(true, true, false)).toBe(false);
    expect(shouldPoll(false, true, true)).toBe(false);
  });
});

const status = (over: Partial<WorkerStatus['settings']> = {}, workers: WorkerStatus['workers'] = []): WorkerStatus => ({
  workers, queue: { queued: 0, sending: 0, sent_last_hour: 0, line_sent_this_month: 0 },
  settings: { interval_seconds: 60, line_monthly_cap: 0, test_mode: false, test_ms_ids: [], max_batch: 50, ...over },
});
const worker = (over: Partial<WorkerStatus['workers'][number]> = {}): WorkerStatus['workers'][number] => ({
  worker_id: 'w1', state: 'running', jst_session_ok: true, heartbeat_at: null, online: true, sent_last_hour: 0, queue_waiting: 0, last_error: null, ...over,
});

describe('worker', () => {
  it('online uses the server flag, else a heartbeat within 3 minutes', () => {
    const now = Date.parse('2026-11-20T10:00:00Z');
    expect(isWorkerOnline({ heartbeat_at: null, online: true }, now)).toBe(true);
    expect(isWorkerOnline({ heartbeat_at: '2026-11-20T09:58:00Z' }, now)).toBe(true);
    expect(isWorkerOnline({ heartbeat_at: '2026-11-20T09:56:00Z' }, now)).toBe(false);
    expect(isWorkerOnline({ heartbeat_at: null }, now)).toBe(false);
  });
  it('banners: offline, needs_login, test mode (with and without rooms)', () => {
    expect(workerBanners(null)).toEqual([]);
    expect(workerBanners(status())[0].text).toMatch(/^Worker ออฟไลน์/);
    expect(workerBanners(status({}, [worker({ state: 'needs_login' })]))[0].text).toMatch(/^Worker ต้องล็อกอิน JST ใหม่/);
    expect(workerBanners(status({}, [worker()]))).toEqual([]);
    expect(workerBanners(status({ test_mode: true, test_ms_ids: [1] }, [worker()]))).toEqual([{ kind: 'note', text: TEST_MODE_TEXT }]);
    expect(workerBanners(status({ test_mode: true }, [worker()]))[0]).toMatchObject({ kind: 'warn' });
  });
  it('validates settings like the DB (interval 5–3600, cap ≥ 0)', () => {
    expect(validateSettings({ interval: '60', lineCap: '0' })).toBeNull();
    expect(validateSettings({ interval: '4', lineCap: '0' })).toMatch(/5–3600/);
    expect(validateSettings({ interval: '3601', lineCap: '0' })).toMatch(/5–3600/);
    expect(validateSettings({ interval: '1.5', lineCap: '0' })).toMatch(/5–3600/);
    expect(validateSettings({ interval: '60', lineCap: '-1' })).toMatch(/เพดาน LINE/);
  });
});

describe('templates', () => {
  it('replaces {ชื่อ} {สินค้าล่าสุด} {ร้าน}, empty values become empty and are reported', () => {
    expect(renderTemplate('สวัสดี {ชื่อ} จาก {ร้าน} สนใจ {สินค้าล่าสุด} ไหม', { name: 'สมใจ', product: 'เตียง', shop: 'Bebeplay' })).toEqual({
      text: 'สวัสดี สมใจ จาก Bebeplay สนใจ เตียง ไหม', missing: [], unknown: [],
    });
    expect(renderTemplate('{ชื่อ} {ชื่อ} {สินค้าล่าสุด}', { name: 'ก', product: '' })).toEqual({ text: 'ก ก ', missing: ['{สินค้าล่าสุด}'], unknown: [] });
    expect(renderTemplate('ลด {ส่วนลด}', {})).toEqual({ text: 'ลด {ส่วนลด}', missing: [], unknown: ['{ส่วนลด}'] });
  });
  it('validates name/body and upserts by id', () => {
    expect(validateTemplate(' ', 'x')).toBe('ใส่ชื่อ template');
    expect(validateTemplate('a', ' ')).toBe('ใส่ข้อความของ template');
    expect(validateTemplate('a', 'b')).toBeNull();
    const t = { id: 'T1', brand: 'bebeplay' as const, name: 'a', body: 'b', active: true, updated_at: null };
    expect(upsertTemplate([t], { ...t, name: 'z' })).toEqual([{ ...t, name: 'z' }]);
    expect(upsertTemplate([t], { ...t, id: 'T2' })).toHaveLength(2);
  });
});

describe('demoPreview (fixture mode)', () => {
  const cust = (phone: string, shops: string[]): DemoCustomer => ({
    id: phone, name: `คุณ ${phone}`, phone, address: '', brand: 'bebeplay', shop: shops[0] ?? '', chatName: 'chat',
    channels: shops.map((s) => ({ shop: s, chat: `chat_${s}` })), purchases: [{ date: '2026-10-01', bill: '1', sku: 's', product: 'เตียงเด็ก', amount: 1, seller: null }],
  });
  const customers = [cust('01', ['SH_bebeplay', 'LOA_bebeplay']), cust('02', ['FB_bebeplay']), cust('03', ['Web_bebeplay']), cust('04', ['SH_bebeplay'])];
  it('picks LINE first, skips taken / FB-only (window closed) / no room / unknown', () => {
    const rows = demoPreview(
      [row('01'), row('02'), row('03'), row('04', { taken: 'other' }), row('99')],
      { body: 'สวัสดี {ชื่อ} {สินค้าล่าสุด} {ร้าน}', brand: 'bebeplay' }, customers, 'me',
    );
    expect(rows.map((r) => r.skip)).toEqual([null, 'window_closed', 'no_chat_room', 'taken', 'customer_not_found']);
    expect(rows[0]).toMatchObject({ page: 'LOA_bebeplay', provider: 'Line', message: 'สวัสดี คุณ 01 เตียงเด็ก LOA_bebeplay' });
    const { send, skip } = splitPreview(rows);
    expect(send).toHaveLength(1);
    expect(skip).toHaveLength(4);
  });
});

describe('brand of the batch (chatBrands of the selected rows)', () => {
  const sel = (...brands: string[][]) => brands.map((b, i) => row(String(i), { chatBrands: b }));
  it('counts the rows with a sendable room of each brand', () => {
    const c = brandRoomCounts(sel(['bebeplay'], ['hosttail'], ['bebeplay', 'hosttail'], []));
    expect(c).toEqual({ bebeplay: 2, hosttail: 2 });
    expect(brandRoomHint(c)).toBe('2 คนมีห้องของ Bebeplay · 2 คนมีห้องของ Hosttail');
  });
  it('defaults to the brand most rows can be messaged on, tie → page brand → bebeplay', () => {
    expect(defaultOutreachBrand(sel(['hosttail'], ['hosttail'], ['bebeplay']), 'bebeplay')).toBe('hosttail');
    expect(defaultOutreachBrand(sel(['hosttail'], ['bebeplay']), 'hosttail')).toBe('hosttail');
    expect(defaultOutreachBrand(sel(['hosttail'], ['bebeplay']), '')).toBe('bebeplay');
    expect(defaultOutreachBrand(sel([], []), 'hosttail')).toBe('hosttail');
    expect(defaultOutreachBrand([], null)).toBe('bebeplay');
  });
  it('tells the rep to switch brand when the row has a room of the other brand', () => {
    const r = row('1', { chatBrands: ['hosttail'] });
    expect(skipReasonText('no_chat_room', r, 'bebeplay')).toBe('มีห้องแชตของ Hosttail — เปลี่ยนแบรนด์ด้านบน');
    expect(skipReasonText('window_closed', r, 'bebeplay')).toBe('มีห้องแชตของ Hosttail — เปลี่ยนแบรนด์ด้านบน');
    expect(skipReasonText('no_chat_room', r, 'hosttail')).toBe('ไม่พบห้องแชตของแบรนด์นี้');
    expect(skipReasonText('taken', r, 'bebeplay')).toBe('เป็นลูกค้าของเซลล์คนอื่น');
    expect(skipReasonText('no_chat_room', undefined, 'bebeplay')).toBe('ไม่พบห้องแชตของแบรนด์นี้');
  });
  it('the selection keeps a snapshot of chatBrands (and the rooms for the fixture preview)', () => {
    const room = { msId: 7, provider: 'line', page: 'p', brand: 'bebeplay' as const, sendable: true };
    const s = toggleSelect(new Map(), { ...row('1', { chatBrands: ['bebeplay'], chatRooms: [room] }), extra: 1 } as SelRow);
    expect(s.get('1')).toEqual({ ...row('1'), chatBrands: ['bebeplay'], chatRooms: [room] });
    expect(toSelRow(row('2'))).not.toHaveProperty('chatRooms');
  });
});

describe('demoPreview with the chat rooms of the row', () => {
  const cust: DemoCustomer = {
    id: 'c', name: 'คุณเอ', phone: '05', address: '', brand: 'bebeplay', shop: 'SH_bebeplay', chatName: 'a_chat', channels: [],
    purchases: [{ date: '2026-10-01', bill: '1', sku: 's', product: 'เตียงเด็ก', amount: 1, seller: null }],
  };
  const t = { body: '{ชื่อ} {ร้าน}', brand: 'bebeplay' as const };
  it('sends to the first sendable room of the brand, else window_closed / no_chat_room', () => {
    const line = { msId: 11, provider: 'line', page: 'LOA_bebeplay', brand: 'bebeplay' as const, sendable: true };
    const fb = { msId: 12, provider: 'facebook', page: 'FB_bebeplay', brand: 'bebeplay' as const, sendable: false };
    const host = { msId: 13, provider: 'shopee', page: 'SH_hosttail', brand: 'hosttail' as const, sendable: true };
    const [a, b, c] = demoPreview(
      [row('05', { chat: 'a_chat', chatRooms: [line, fb] }), row('05', { chatRooms: [fb, host] }), row('05', { chatRooms: [host] })], t, [cust], 'me',
    );
    expect(a).toMatchObject({ skip: null, ms_id: 11, page: 'LOA_bebeplay', provider: 'Line', chat_name: 'a_chat', message: 'คุณเอ LOA_bebeplay' });
    expect(b.skip).toBe('window_closed');
    expect(c.skip).toBe('no_chat_room');
  });
});

describe('Direct Sale: tick leads to send a message', () => {
  const room = (over: Partial<ChatRoom>): ChatRoom => ({ msId: 1, provider: 'line', page: 'Bebeplayofficial', brand: 'bebeplay', sendable: true, ...over });
  const lead = { phone: '0811111111', name: 'คุณเอ', brand: 'hosttail' as const, chatName: 'เอ แชต', owner: 'u1' };
  it('only leads I own can be ticked', () => {
    expect(leadSelectable(lead, 'u1')).toBe(true);
    expect(leadSelectable(lead, 'u2')).toBe(false);
    expect(leadSelectable({ owner: null }, 'u1')).toBe(false);
    expect(leadSelectable(lead, '')).toBe(false);
  });
  it('builds the selection row from the lead and its rooms (sendable brands only)', () => {
    const rooms = [room({ msId: 1 }), room({ msId: 2, brand: 'hosttail', sendable: false }), room({ msId: 3, brand: null, sendable: false })];
    expect(leadSelRow(lead, rooms)).toEqual({
      phone: '0811111111', name: 'คุณเอ', brands: ['hosttail'], chat: 'เอ แชต', taken: null, mine: true, chatBrands: ['bebeplay'], chatRooms: rooms,
    });
    expect(leadSelRow(lead, undefined)).toEqual({
      phone: '0811111111', name: 'คุณเอ', brands: ['hosttail'], chat: 'เอ แชต', taken: null, mine: true, chatBrands: [],
    });
  });
});

describe('Direct Sale selection by phone', () => {
  it('pruneSelection drops phones that are no longer allowed and keeps the same instance when nothing changes', () => {
    const sel = new Set(['01', '02', '03']);
    expect([...pruneSelection(sel, new Set(['01', '03', '09']))]).toEqual(['01', '03']);
    expect(pruneSelection(sel, new Set(['01', '02', '03', '04']))).toBe(sel);
    expect(pruneSelection(new Set<string>(), new Set(['01']))).toEqual(new Set());
  });
  it('phoneCheckState for the header checkbox', () => {
    expect(phoneCheckState(new Set(['01']), [])).toBe('none');
    expect(phoneCheckState(new Set<string>(), ['01', '02'])).toBe('none');
    expect(phoneCheckState(new Set(['01']), ['01', '02'])).toBe('some');
    expect(phoneCheckState(new Set(['01', '02', '09']), ['01', '02'])).toBe('all');
  });
  it('togglePhone / setPhones', () => {
    expect([...togglePhone(new Set(['01']), '02')]).toEqual(['01', '02']);
    expect([...togglePhone(new Set(['01', '02']), '01')]).toEqual(['02']);
    expect([...setPhones(new Set(['09']), ['01', '02'], true)].sort()).toEqual(['01', '02', '09']);
    expect([...setPhones(new Set(['01', '02', '09']), ['01', '02'], false)]).toEqual(['09']);
  });
});
