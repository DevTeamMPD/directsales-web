import { describe, expect, it } from 'vitest';
import type { Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import { buildLogSave, initialLogForm, LOG_WARN, logSections, logStatusOptions, splitBills, validateLog } from './log';

const F = fixturePayload();
const T = F.today;
const byId = (id: string): Lead => {
  const l = F.leads.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};
const base = initialLogForm(byId('L1000'), 'call', T);

describe('log modal (prototype logModal L524-600)', () => {
  it('initial values follow the lead', () => {
    expect(initialLogForm(byId('L1014'), 'call', T)).toEqual({
      type: 'call', result: 'คุยแล้ว', status: 'callback', callback: '', interest: 'เตียงนอนเด็ก', bills: '', amount: '', closed: '2026-11-04', note: '',
    });
    expect(initialLogForm(byId('L1019'), 'call', T)).toMatchObject({ status: 'callback', callback: '2026-11-06', interest: 'แผ่นรองคลาน' });
    expect(base).toMatchObject({ type: 'call', result: 'คุยแล้ว', status: 'following', interest: '' });
    expect(initialLogForm(byId('L1011'), 'call', T)).toMatchObject({ type: 'chat', result: 'ตอบกลับแล้ว', status: 'following', interest: 'ทรายแมว' });
    expect(initialLogForm(byId('L1012'), 'call', T)).toMatchObject({ status: 'won', bills: '369295', amount: '3290', closed: '2026-10-31' });
  });
  it('status options: every status except new, plus dnc/release unless the lead is no-call', () => {
    expect(logStatusOptions(false)).toEqual([
      ['following', 'กำลังติดตาม'], ['callback', 'รอติดต่อ'], ['won', 'ปิดการขายแล้ว'], ['lost', 'ไม่สนใจ'], ['unreachable', 'ติดต่อไม่ได้'],
      ['dnc', 'ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)'], ['release', 'คัดออก (คืนให้คนอื่นโทร)'],
    ]);
    expect(logStatusOptions(true).map(([v]) => v)).toEqual(['following', 'callback', 'won', 'lost', 'unreachable']);
  });
  it('sections shown per status (cbToggle L550)', () => {
    expect(logSections('callback')).toEqual({ callback: true, won: false, warn: '' });
    expect(logSections('won')).toEqual({ callback: false, won: true, warn: '' });
    expect(logSections('following')).toEqual({ callback: false, won: false, warn: '' });
    expect(logSections('dnc').warn).toBe(LOG_WARN.dnc);
    expect(LOG_WARN.dnc).toBe('ลูกค้ารายนี้จะถูกทำเครื่องหมายห้ามโทรถาวร คุณติดต่อได้ทางแชตเท่านั้น (ยังเห็นในหน้า Direct Sale ของคุณ) เซลล์คนอื่นจะไม่เห็นลูกค้ารายนี้ และหัวหน้าเห็นในถังไม่สะดวกให้โทร');
    expect(logSections('release').warn).toBe('ลูกค้ารายนี้จะออกจากรายการของคุณและกลับเข้าถังให้เซลล์คนอื่นโทร คุณจะไม่เห็นลูกค้ารายนี้อีก');
  });
  it('splitBills splits on commas and whitespace', () => {
    expect(splitBills('312345, 312399  312400,,')).toEqual(['312345', '312399', '312400']);
    expect(splitBills(' , ')).toEqual([]);
  });
  it('validateLog checks in the prototype order and names the field to focus', () => {
    expect(validateLog({ ...base, status: 'callback', callback: '' }, T)).toEqual({ msg: 'เลือกวันที่นัดติดต่อก่อนบันทึก', field: 'callback' });
    expect(validateLog({ ...base, status: 'callback', callback: '2026-11-03' }, T)).toEqual({ msg: 'วันที่นัดติดต่อต้องไม่ย้อนหลัง', field: 'callback' });
    expect(validateLog({ ...base, status: 'callback', callback: '2026-11-04' }, T)).toBeNull();
    expect(validateLog({ ...base, status: 'dnc', note: '   ' }, T)).toEqual({ msg: 'ใส่เหตุผลในหมายเหตุก่อนบันทึก', field: 'note' });
    expect(validateLog({ ...base, status: 'release', note: '' }, T)?.field).toBe('note');
    expect(validateLog({ ...base, status: 'won', bills: ' , ' }, T)).toEqual({ msg: 'ใส่เลขบิลที่ขายได้ก่อนปิดการขาย', field: 'bills' });
    expect(validateLog({ ...base, status: 'won', bills: '312345' }, T)).toBeNull();
    expect(validateLog(base, T)).toBeNull();
  });
  it('buildLogSave maps the form to dsales_log arguments (live save L567-572)', () => {
    const l = { id: 'L1', status: 'new' as const };
    expect(buildLogSave({ ...base, note: '  ', interest: ' ทรายแมว ', callback: '2026-11-09' }, l)).toEqual({
      input: { leadId: 'L1', type: 'call', result: 'คุยแล้ว', note: '(ไม่มีหมายเหตุ)', status: 'following', callback: null, interest: 'ทรายแมว', bills: [], amount: null },
      then: null, msg: 'บันทึกแล้ว',
    });
    expect(buildLogSave({ ...base, status: 'callback', callback: '2026-11-09', bills: '1', amount: '50' }, l).input)
      .toMatchObject({ status: 'callback', callback: '2026-11-09', bills: [], amount: null });
    expect(buildLogSave({ ...base, status: 'won', bills: '312345, 312399', amount: '4990', note: 'ปิดได้' }, l).input)
      .toMatchObject({ status: 'won', bills: ['312345', '312399'], amount: 4990, note: 'ปิดได้' });
    expect(buildLogSave({ ...base, status: 'won', bills: '1', amount: '' }, l).input.amount).toBeNull();
  });
  it('buildLogSave: dnc keeps the previous status, release returns the lead to the pool', () => {
    expect(buildLogSave({ ...base, status: 'dnc', note: 'ลูกค้าขอ' }, { id: 'L1', status: 'new' })).toEqual({
      input: { leadId: 'L1', type: 'call', result: 'ไม่สะดวกให้โทร', note: 'ลูกค้าขอ', status: 'following', callback: null, interest: '', bills: [], amount: null },
      then: 'dnc', msg: 'ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น',
    });
    expect(buildLogSave({ ...base, status: 'dnc', note: 'x' }, { id: 'L1', status: 'callback' }).input.status).toBe('callback');
    expect(buildLogSave({ ...base, status: 'release', note: 'โทรไม่ติด 5 ครั้ง' }, { id: 'L1', status: 'following' })).toMatchObject({
      input: { status: 'new', result: 'คัดออก', note: 'โทรไม่ติด 5 ครั้ง' }, then: 'release', msg: 'คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร',
    });
  });
});
