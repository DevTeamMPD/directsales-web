import type { LoadedPayload } from '@/lib/state/reducer';
import { DEFAULT_RFM_CONFIG } from '@/lib/domain/rfm';
import { withBaseExtras } from './base';
import { FIXTURE_DATA } from './data';
import { FIXTURE_OUTREACH } from './outreach';

/** prototype โหมดตัวอย่างเริ่มที่ "Dev MPD" (หัวหน้า) */
export const FIXTURE_ME_ID = 'r4';

/**
 * search = window.location.search: `?claim=<leadId>` (ซ้ำได้) ทำเหมือน Dev MPD กด "จอง" ลีดนั้นในโหมดตัวอย่าง (prototype L889)
 * ใช้ใน e2e ของ popup ยกเลิกจอง เพราะข้อมูลตัวอย่างไม่มีลีดที่ claimedBy = ตัวเอง
 */
export function fixturePayload(search = ''): LoadedPayload {
  const d = structuredClone(FIXTURE_DATA);
  const me = d.reps.find((r) => r.id === FIXTURE_ME_ID);
  if (!me) throw new Error(`fixture rep ${FIXTURE_ME_ID} is missing`);
  for (const id of new URLSearchParams(search).getAll('claim')) {
    const l = d.leads.find((x) => x.id === id);
    if (l) Object.assign(l, { owner: me.id, claimedBy: me.id, claimedAt: `${d.today}T10:00` });
  }
  return {
    email: 'dev@fixtures.test',
    meId: me.id,
    isAdmin: me.role === 'admin',
    live: false,
    reps: d.reps,
    campaigns: d.campaigns.map((c) => ({ ...c, maxPerRep: null, active: true, criteria: [] })),
    leads: d.leads,
    customers: withBaseExtras(d.customers), // + ห้องแชต / RFM / tag ของ /mine /pool
    today: d.today,
    rfmConfig: [...DEFAULT_RFM_CONFIG],
    outreachDemo: structuredClone(FIXTURE_OUTREACH),
  };
}
