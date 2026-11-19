import type { LogInput } from '@/lib/api/rpc';
import type { ContactType, Lead, LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';

// ฟอร์ม popup บันทึกโทร/แชต (legacy/app.js L524-579) เป็นฟังก์ชันล้วน

export const LOG_RESULTS: Readonly<Record<ContactType, readonly string[]>> = {
  call: ['คุยแล้ว', 'ไม่รับสาย', 'สายไม่ว่าง', 'เบอร์ผิด'],
  chat: ['ตอบกลับแล้ว', 'อ่านแล้วไม่ตอบ', 'ส่งโปรโมชันแล้ว'],
};

export type LogStatus = Exclude<LeadStatus, 'new'> | 'dnc' | 'release';

export const LOG_WARN: Readonly<Partial<Record<LogStatus, string>>> = {
  dnc: 'ลูกค้ารายนี้จะถูกทำเครื่องหมายห้ามโทรถาวร คุณติดต่อได้ทางแชตเท่านั้น (ยังเห็นในหน้า Direct Sale ของคุณ) เซลล์คนอื่นจะไม่เห็นลูกค้ารายนี้ และหัวหน้าเห็นในถังไม่สะดวกให้โทร',
  release: 'ลูกค้ารายนี้จะออกจากรายการของคุณและกลับเข้าถังให้เซลล์คนอื่นโทร คุณจะไม่เห็นลูกค้ารายนี้อีก',
};

export interface LogForm {
  type: ContactType; result: string; status: LogStatus; callback: string; interest: string;
  bills: string; amount: string; closed: string; note: string;
}

type LogLead = Pick<Lead, 'noCall' | 'status' | 'callback' | 'interest' | 'closedBills' | 'closedAmount' | 'closedAt'>;

/** ค่าเริ่มของฟอร์ม (L527, L537-542): ห้ามโทร → แชตเท่านั้น; ลีดใหม่ → กำลังติดตาม; วันนัดเดิมที่ยังไม่ผ่าน */
export function initialLogForm(l: LogLead, type: ContactType, today: string): LogForm {
  const t: ContactType = l.noCall ? 'chat' : type;
  return {
    type: t,
    result: LOG_RESULTS[t][0],
    status: l.status === 'new' ? 'following' : l.status,
    callback: l.callback && l.callback >= today ? l.callback : '',
    interest: l.interest || '',
    bills: (l.closedBills || []).join(', '),
    amount: l.closedAmount == null ? '' : String(l.closedAmount),
    closed: l.closedAt || today,
    note: '',
  };
}

/** ตัวเลือก "สถานะลูกค้าหลังบันทึก" (L536-537) */
export function logStatusOptions(noCall: boolean): Array<[LogStatus, string]> {
  const statuses = (Object.keys(STATUS) as LeadStatus[])
    .filter((k): k is Exclude<LeadStatus, 'new'> => k !== 'new')
    .map((k): [LogStatus, string] => [k, STATUS[k]]);
  if (noCall) return statuses;
  return [...statuses, ['dnc', 'ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)'], ['release', 'คัดออก (คืนให้คนอื่นโทร)']];
}

/** ส่วนของฟอร์มที่แสดงตามสถานะ (cbToggle L550): วันนัด, ข้อมูลปิดการขาย, คำเตือน (+ "* ใส่เหตุผล") */
export const logSections = (status: LogStatus): { callback: boolean; won: boolean; warn: string } => ({
  callback: status === 'callback', won: status === 'won', warn: LOG_WARN[status] ?? '',
});

export const splitBills = (s: string): string[] => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export type LogField = 'callback' | 'note' | 'bills';

/** ตรวจก่อนบันทึก ตามลำดับเดียวกับ prototype (L558-563) */
export function validateLog(f: LogForm, today: string): { msg: string; field: LogField } | null {
  if (f.status === 'callback' && !f.callback) return { msg: 'เลือกวันที่นัดติดต่อก่อนบันทึก', field: 'callback' };
  if (f.status === 'callback' && f.callback < today) return { msg: 'วันที่นัดติดต่อต้องไม่ย้อนหลัง', field: 'callback' };
  if ((f.status === 'dnc' || f.status === 'release') && !f.note.trim()) return { msg: 'ใส่เหตุผลในหมายเหตุก่อนบันทึก', field: 'note' };
  if (f.status === 'won' && !splitBills(f.bills).length) return { msg: 'ใส่เลขบิลที่ขายได้ก่อนปิดการขาย', field: 'bills' };
  return null;
}

export interface LogSave { input: LogInput; then: 'dnc' | 'release' | null; msg: string }

/**
 * แปลงฟอร์มเป็นอาร์กิวเมนต์ dsales_log (L567-575): dnc = สถานะเดิม (ใหม่ → กำลังติดตาม) + ผล "ไม่สะดวกให้โทร" แล้วตั้งห้ามโทร,
 * release = สถานะใหม่ + ผล "คัดออก" แล้วยกเลิกจอง; วันที่ปิดการขาย (#f-closed) ไม่ส่ง (เหมือน prototype)
 */
export function buildLogSave(f: LogForm, lead: Pick<Lead, 'id' | 'status'>): LogSave {
  let status: LeadStatus;
  let result = f.result;
  if (f.status === 'dnc') {
    status = lead.status === 'new' ? 'following' : lead.status;
    result = 'ไม่สะดวกให้โทร';
  } else if (f.status === 'release') {
    status = 'new';
    result = 'คัดออก';
  } else {
    status = f.status;
  }
  const won = status === 'won';
  return {
    input: {
      leadId: lead.id, type: f.type, result, note: f.note.trim() || '(ไม่มีหมายเหตุ)', status,
      callback: f.status === 'callback' ? f.callback : null, interest: f.interest.trim(),
      bills: won ? splitBills(f.bills) : [], amount: won && f.amount !== '' ? Number(f.amount) : null,
    },
    then: f.status === 'dnc' || f.status === 'release' ? f.status : null,
    msg: f.status === 'dnc' ? 'ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น'
      : f.status === 'release' ? 'คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร' : 'บันทึกแล้ว',
  };
}

/** ขั้นของการบันทึก: dsales_log แล้ว (ถ้ามี) dsales_set_nocall / dsales_unclaim_lead */
export type LogStep = 'log' | 'dnc' | 'release';
/** ขั้นที่สำเร็จแล้วของฟอร์มชุดเดิม (key = อาร์กิวเมนต์ทั้งหมด) — กดบันทึกซ้ำหลังสำเร็จบางขั้นไม่บันทึกประวัติซ้ำ */
export interface LogProgress { key: string; done: LogStep[] }

/** ขั้นที่ยังต้องทำ: ฟอร์มเดิม (key เท่ากัน) ข้ามขั้นที่สำเร็จแล้ว; แก้ฟอร์มแล้ว = ชุดใหม่ เริ่มตั้งแต่ dsales_log */
export function logSteps(plan: LogSave, progress: LogProgress | null): { key: string; steps: LogStep[] } {
  const key = JSON.stringify([plan.input, plan.then]);
  const all: LogStep[] = plan.then ? ['log', plan.then] : ['log'];
  const done = progress?.key === key ? progress.done : [];
  return { key, steps: all.filter((s) => !done.includes(s)) };
}
