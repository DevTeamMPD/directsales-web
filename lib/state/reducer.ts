import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, Lead, LeadJson, Rep } from '@/lib/api/types';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) + focusSearch (L616: โฟกัสช่องค้นหาถังหลัง "เลือกจากถัง" — หน้าแคมเปญแผน C ใช้) */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all',
  period: { from: '', to: '', key: 'all' }, focusSearch: false,
};

/** live = ข้อมูลจาก Supabase; false = โหมด fixture (อ่านแบบโหมดตัวอย่างของ prototype และไม่เรียก RPC ที่เขียนข้อมูล) */
export interface LoadedPayload { email: string; meId: string; isAdmin: boolean; live: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[]; today: string }
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'error';
/** poolVersion เพิ่มทุกครั้งที่ถังลูกค้าต้องโหลดใหม่ (prototype ui.pool.loaded = false) */
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters; poolVersion: number }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, live: false, reps: [], campaigns: [], leads: [], today: '',
  ui: initialUi, poolVersion: 0,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'setUi'; patch: Partial<UiFilters> }
  | { type: 'invalidatePool' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      // หลังโหลดเสร็จ error ระหว่างใช้งานแสดงด้วย toast เท่านั้น (ห้ามแทนทั้ง Shell ด้วยการ์ด error)
      return state.phase === 'ready' ? state : { ...state, phase: 'error', error: action.error };
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
    case 'invalidatePool':
      return { ...state, poolVersion: state.poolVersion + 1 };
  }
}
