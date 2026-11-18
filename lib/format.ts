// ตัวจัดรูปแบบจาก prototype (legacy/app.js L6-8, L412, L941) — วันที่/เวลาคิดตาม Asia/Bangkok เสมอ ไม่ขึ้นกับเครื่อง
const TZ = 'Asia/Bangkok';
const bkk = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function bangkokParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(bkk.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const baht = (n: number | string | null | undefined): string => Number(n || 0).toLocaleString('th-TH') + '.-';

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${+d}/${+m}/${y}`;
}

export function fmtDT(s: string | null | undefined): string {
  if (!s) return '—';
  return fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '');
}

/** วันนี้ (YYYY-MM-DD) ตามเวลาไทย */
export const todayBangkok = (now: Date = new Date()): string => bangkokParts(now).date;

/** today + เวลาไทย HH:MM (prototype ใช้ today ของ state ซึ่งในโหมด fixture = 2026-11-04) */
export function nowStamp(now: Date = new Date(), today?: string): string {
  const p = bangkokParts(now);
  return `${today || p.date}T${p.time}`;
}

/** timestamptz จาก server → 'YYYY-MM-DDTHH:MM' เวลาไทย (ค่าว่าง/อ่านไม่ได้คืนค่าเดิม) */
export function localStamp(iso: string | null | undefined): string | null {
  if (!iso) return iso ?? null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = bangkokParts(d);
  return `${p.date}T${p.time}`;
}
