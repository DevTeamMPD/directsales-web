import type { Campaign, Channel, Lead, Purchase, Rep } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';

/** รูปของ window.DS_DATA ใน legacy/data.js */
export interface FixtureCustomer {
  id: string; name: string; phone: string; address: string; brand: Brand; shop: string; chatName: string; channels: Channel[]; purchases: Purchase[];
}
export interface FixtureData {
  reps: Rep[];
  campaigns: Pick<Campaign, 'id' | 'brand' | 'claimMode' | 'name' | 'start' | 'end' | 'note'>[];
  leads: Lead[];
  customers: FixtureCustomer[];
  today: string;
}
