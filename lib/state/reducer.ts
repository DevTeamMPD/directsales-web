import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, DemoCustomer, Lead, LeadJson, OutreachDemo, Rep } from '@/lib/api/types';
import { upsertRep } from '@/lib/domain/setup';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) + focusSearch (L616: โฟกัสช่องค้นหาถังหลัง "เลือกจากถัง" — หน้าแคมเปญแผน C ใช้) */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
  /** อัตราค่าคอม (%) ของตาราง Dashboard — prototype state.commissionRate (ล็อกอินจริงไม่บันทึก หายเมื่อโหลดหน้าใหม่) */
  commissionRate: number;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all',
  period: { from: '', to: '', key: 'all' }, focusSearch: false, commissionRate: 0,
};

/**
 * ส่วนของ ui.pool (prototype L616) ที่คงค่าข้ามหน้า: แบรนด์ของถัง, คำค้น, หน้า, จำนวนลูกค้าทั้งแบรนด์ (นับครั้งเดียวต่อแบรนด์ = grandFor)
 * แถว/total/loading/err อยู่ใน state ของ PoolPanel ซึ่งโหลดใหม่ทุกครั้งที่ mount (= prototype ตั้ง ui.pool.loaded = false ใน renderCampaign)
 */
export interface PoolUi { brand: Brand | null; q: string; page: number; grand: number | null; grandFor: Brand | null }
export const initialPool: PoolUi = { brand: null, q: '', page: 0, grand: null, grandFor: null };

/** live = ข้อมูลจาก Supabase; false = โหมด fixture (อ่านแบบโหมดตัวอย่างของ prototype และไม่เรียก RPC ที่เขียนข้อมูล) */
export interface LoadedPayload {
  email: string; meId: string; isAdmin: boolean; live: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[];
  /** ลูกค้าของถัง/ตัวสร้างแคมเปญในโหมดตัวอย่าง — ล็อกอินจริง = [] (prototype loadLive L980) */
  customers: DemoCustomer[];
  today: string;
  /** ข้อมูลตัวอย่างของหน้าส่งข้อความ (template / ชุดที่ส่ง / worker) — โหมด fixture เท่านั้น ล็อกอินจริงไม่มี */
  outreachDemo?: OutreachDemo | null;
}
/** expired = session หมดอายุระหว่างใช้งาน (ต้องล็อกอินใหม่) */
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'expired' | 'error';
/** poolVersion เพิ่มทุกครั้งที่ถังลูกค้าต้องโหลดใหม่ (prototype ui.pool.loaded = false) */
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters; poolVersion: number; pool: PoolUi }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, live: false, reps: [], campaigns: [], leads: [], customers: [], today: '',
  ui: initialUi, poolVersion: 0, pool: initialPool,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'sessionLost'; reason: 'expired' | 'inactive' }
  | { type: 'setToday'; today: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'upsertRep'; rep: Rep }
  | { type: 'setUi'; patch: Partial<UiFilters> }
  | { type: 'setPool'; patch: Partial<PoolUi> }
  | { type: 'invalidatePool' };

const DATA_ACTIONS: ReadonlySet<Action['type']> = new Set<Action['type']>([
  'upsertLead', 'patchLead', 'removeLead', 'upsertCampaign', 'upsertRep', 'setUi', 'setPool', 'invalidatePool',
]);

export function reducer(state: AppState, action: Action): AppState {
  // หลัง sessionLost/noAccess ห้ามมี action ที่ค้างอยู่ (เช่น RPC ที่ตอบกลับช้า) เติมข้อมูลกลับเข้ามา
  if (state.phase !== 'ready' && DATA_ACTIONS.has(action.type)) return state;
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      // หลังโหลดเสร็จ error ระหว่างใช้งานแสดงด้วย toast เท่านั้น (ห้ามแทนทั้ง Shell ด้วยการ์ด error)
      return state.phase === 'ready' ? state : { ...state, phase: 'error', error: action.error };
    case 'sessionLost':
      // ระหว่างใช้งาน: session หมดอายุ / ถูกปิดใช้งาน → ล้างข้อมูลลูกค้าทั้งหมดออกจากหน้า เหลือแค่การ์ด (คงอีเมลไว้แสดง)
      return state.phase === 'ready' ? { ...initialState, phase: action.reason, email: state.email } : state;
    case 'setToday':
      return action.today && action.today !== state.today ? { ...state, today: action.today } : state;
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
    case 'upsertRep':
      return { ...state, reps: upsertRep(state.reps, action.rep, state.meId) };
    case 'setUi':
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case 'setPool':
      return { ...state, pool: { ...state.pool, ...action.patch } };
    case 'invalidatePool':
      return { ...state, poolVersion: state.poolVersion + 1 };
  }
}
