import type { LoadedPayload } from '@/lib/state/reducer';
import { FIXTURE_DATA } from './data';

/** prototype โหมดตัวอย่างเริ่มที่ "Dev MPD" (หัวหน้า) */
export const FIXTURE_ME_ID = 'r4';

export function fixturePayload(): LoadedPayload {
  const d = structuredClone(FIXTURE_DATA);
  const me = d.reps.find((r) => r.id === FIXTURE_ME_ID);
  if (!me) throw new Error(`fixture rep ${FIXTURE_ME_ID} is missing`);
  return {
    email: 'dev@fixtures.test',
    meId: me.id,
    isAdmin: me.role === 'admin',
    reps: d.reps,
    campaigns: d.campaigns.map((c) => ({ ...c, maxPerRep: null, active: true, criteria: [] })),
    leads: d.leads,
    today: d.today,
  };
}
