import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, Lead, LeadJson, Rep } from '@/lib/api/types';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all', period: { from: '', to: '', key: 'all' },
};

export interface LoadedPayload { email: string; meId: string; isAdmin: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[]; today: string }
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'error';
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, reps: [], campaigns: [], leads: [], today: '', ui: initialUi,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'setUi'; patch: Partial<UiFilters> };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      return { ...state, phase: 'error', error: action.error };
    case 'upsertLead':
      return { ...state, leads: upsertLead(state.leads, action.lead) };
    case 'patchLead':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) };
    case 'removeLead':
      return { ...state, leads: state.leads.filter((l) => l.id !== action.id) };
    case 'upsertCampaign': {
      const exists = state.campaigns.some((c) => c.id === action.campaign.id);
      return {
        ...state,
        campaigns: exists ? state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)) : [...state.campaigns, action.campaign],
      };
    }
    case 'setUi':
      return { ...state, ui: { ...state.ui, ...action.patch } };
  }
}
