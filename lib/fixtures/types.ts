import type { Campaign, DemoCustomer, Lead, Rep } from '@/lib/api/types';

/** รูปของ window.DS_DATA ใน legacy/data.js */
export type FixtureCustomer = DemoCustomer;
export interface FixtureData {
  reps: Rep[];
  campaigns: Pick<Campaign, 'id' | 'brand' | 'claimMode' | 'name' | 'start' | 'end' | 'note'>[];
  leads: Lead[];
  customers: FixtureCustomer[];
  today: string;
}
