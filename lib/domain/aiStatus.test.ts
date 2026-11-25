import { describe, expect, it } from 'vitest';
import {
  AI_STATUS_TEXT, aiSkipText, aiTag, guardResult, maskDigits, buildLeadPrompt, mergeFlags, planAnalysis, summaryText, type AiContext,
} from './aiStatus';

const ctx = (over: Partial<AiContext> = {}): AiContext => ({
  id: 'L1', name: 'คุณ V.', brand: 'hosttail', status: 'callback', callback: '2026-11-25', owner: 'kanittha.c',
  dsSince: '2026-11-24 16:02', today: '2026-11-25', lastAiAt: null,
  logs: [{ at: '2026-11-24 16:03', type: 'chat', result: 'ส่งโปรโมชันแล้ว', note: '', due: '2026-11-25', rep: 'kanittha.c' }],
  buys: [{ date: '2026-10-09', product: 'Hosttail แผ่นรองกันลื่น Safespace', amount: 1961.4 }],
  newBills: [],
  chat: [
    { at: '2026-11-07 11:09', who: 'ลูกค้า', text: 'มีส่วนลดอีกไหมคะ' },
    { at: '2026-11-07 11:10', who: 'แอดมิน', text: 'มีส่วนลด10% นะคะ' },
  ],
  lastActivity: '2026-11-24T09:03:18+00:00',
  ...over,
});

describe('AI status analysis', () => {
  it('buildLeadPrompt lists lead facts, logs (with who set the appointment), purchases, new bills and chat', () => {
    const p = buildLeadPrompt(ctx());
    expect(p).toContain('วันนี้: 2026-11-25');
    expect(p).toContain('แบรนด์ Hosttail · จองเข้า Direct Sale 2026-11-24 16:02 · สถานะตอนนี้ callback · วันนัด 2026-11-25 (เซลล์ตั้ง)');
    expect(p).toContain('- 2026-11-24 16:03 แชต โดย kanittha.c · ผล: ส่งโปรโมชันแล้ว · นัด 2026-11-25');
    expect(p).toContain('2026-10-09 Hosttail แผ่นรองกันลื่น Safespace 1,961 บาท');
    expect(p).toContain('บิลใหม่หลังวันที่จอง: ไม่มี');
    expect(p).toContain('2026-11-07 11:09 ลูกค้า: มีส่วนลดอีกไหมคะ');
    expect(buildLeadPrompt(ctx({ chat: [], logs: [], buys: [], newBills: ['B-9'], callback: null })))
      .toMatch(/วันนัด -[\s\S]*บันทึกของเซลล์: ไม่มี[\s\S]*ประวัติซื้อ: ไม่มี[\s\S]*บิลใหม่หลังวันที่จอง: B-9[\s\S]*แชต: ไม่มีห้องแชตที่ผูกไว้ หรือไม่มีข้อความ/);
  });
  it('planAnalysis skips leads with no data, or nothing new since the last AI run (unless forced)', () => {
    const list = [
      ctx({ id: 'a' }),
      ctx({ id: 'b', chat: [], logs: [] }),
      ctx({ id: 'c', lastAiAt: '2026-11-25T01:00:00+00:00', lastActivity: '2026-11-24T09:03:18+00:00' }),
      ctx({ id: 'd', lastAiAt: '2026-11-24T01:00:00+00:00', lastActivity: '2026-11-24T09:03:18+00:00' }),
      ctx({ id: 'e', chat: [], logs: [], newBills: ['B1'] }),
    ];
    const p = planAnalysis(list, false);
    expect(p.todo.map((x) => x.id)).toEqual(['a', 'd', 'e']);
    expect(p.skipped).toEqual([{ id: 'b', reason: 'no_data' }, { id: 'c', reason: 'no_new' }]);
    expect(planAnalysis(list, true).todo.map((x) => x.id)).toEqual(['a', 'c', 'd', 'e']);
  });
  it('mergeFlags always adds the new-bill flag and drops duplicates / blanks', () => {
    expect(mergeFlags(ctx({ newBills: ['B1', 'B2'] }), ['ก', ' ', 'ก'])).toEqual(['พบบิลใหม่หลังวันที่จอง: B1, B2 — ให้เซลล์ตรวจและปิดการขาย', 'ก']);
    expect(mergeFlags(ctx(), [])).toEqual([]);
  });
  it('aiTag: warning count, tooltip lines, hidden when undone or empty', () => {
    const ai = { at: 'x', status: 'callback', applied: true, confidence: 0.9, prevStatus: 'new', prevCallback: null, callback: null,
      interest: 'คอกมีหลังคา', reason: 'r', flags: ['ก', 'ข'], nextAction: 'โทรวันนี้' };
    expect(aiTag(ai)).toEqual({ text: '⚠ AI 2', warn: true, title: 'สนใจ: คอกมีหลังคา\n⚠ ก\n⚠ ข\n→ โทรวันนี้' });
    expect(aiTag({ ...ai, flags: [] })?.text).toBe('AI');
    expect(aiTag({ ...ai, undoneAt: 'y' })).toBeNull();
    expect(aiTag({ ...ai, flags: [], interest: '', nextAction: '' })).toBeNull();
    expect(aiTag(null)).toBeNull();
  });
  it('maskDigits hides phones, bank accounts and tracking-like numbers but keeps prices and order numbers', () => {
    expect(maskDigits('โทร 091-6351651 บัญชี 050-2-60250-0 หรือ 0502602500')).toBe('โทร [ตัวเลข] บัญชี [ตัวเลข] หรือ [ตัวเลข]');
    expect(maskDigits('2180 เหลือ2,071 ค่ะ Order : #296563 ยอด 3,790.-')).toBe('2180 เหลือ2,071 ค่ะ Order : #296563 ยอด 3,790.-');
    expect(buildLeadPrompt(ctx({ chat: [{ at: 'x', who: 'ลูกค้า', text: 'เบอร์ 0812345678' }] }))).toContain('x ลูกค้า: เบอร์ [ตัวเลข]');
  });
  it('guardResult: no change without activity since the claim; unreachable needs 2+ attempts after the claim and no reply', () => {
    const r = { status: 'unreachable' as const, callback_date: null, confidence: 0.8, interest: '', reason: 'ลูกค้าเงียบ', flags: [], next_action: '' };
    const old = ctx({ logs: [], dsSince: '2026-11-23 16:27', chat: [{ at: '2026-10-09 22:09', who: 'แอดมิน', text: 'สนใจไหมคะ' }] });
    expect(guardResult(old, r)).toMatchObject({ status: 'keep', reason: 'ลูกค้าเงียบ (ยังไม่มีการติดต่อหลังวันที่จอง — คงสถานะเดิม)' });
    const once = ctx({ logs: [], dsSince: '2026-11-23 16:27', chat: [{ at: '2026-11-24 10:00', who: 'แอดมิน', text: 'สวัสดีค่ะ' }] });
    expect(guardResult(once, r)).toMatchObject({ status: 'keep', reason: 'ลูกค้าเงียบ (ติดต่อหลังจองไม่ถึง 2 ครั้ง ยังไม่นับว่าติดต่อไม่ได้)' });
    const twice = ctx({ dsSince: '2026-11-23 16:27', logs: [{ at: '2026-11-24 09:00', type: 'call', result: 'ไม่รับสาย', note: '', due: null, rep: 'x' }],
      chat: [{ at: '2026-11-24 10:00', who: 'แอดมิน', text: 'สวัสดีค่ะ' }] });
    expect(guardResult(twice, r).status).toBe('unreachable');
    const replied = ctx({ dsSince: '2026-11-23 16:27', logs: twice.logs, chat: [...twice.chat, { at: '2026-11-24 11:00', who: 'ลูกค้า', text: 'ค่ะ' }] });
    expect(guardResult(replied, r).status).toBe('keep');
    const follow = { ...r, status: 'following' as const };
    expect(guardResult(replied, follow).status).toBe('following');
    expect(guardResult(old, { ...r, status: 'keep' as const })).toEqual({ ...r, status: 'keep' });
  });
  it('labels and summary text', () => {
    expect([AI_STATUS_TEXT.keep, AI_STATUS_TEXT.callback, AI_STATUS_TEXT.undo]).toEqual(['คงสถานะ', 'รอติดต่อ', 'ย้อนกลับผล AI']);
    expect(aiSkipText('no_new')).toBe('ไม่มีความเคลื่อนไหวใหม่ตั้งแต่วิเคราะห์ครั้งก่อน');
    expect(aiSkipText('changed_meanwhile')).toBe('มีคนบันทึกการติดต่อระหว่างวิเคราะห์');
    expect(aiSkipText('อื่น ๆ')).toBe('อื่น ๆ');
    expect(summaryText({ changed: 3, kept: 5, skipped: 2 }, 0.0123)).toBe('เปลี่ยนสถานะ 3 · คงเดิม 5 · ข้าม 2 · ค่าใช้จ่าย ~$0.0123');
  });
});
