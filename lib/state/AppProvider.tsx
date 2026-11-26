'use client';

import {
  createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode,
} from 'react';
import { errorMessage, kindOf } from '@/lib/api/errors';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import type { Lead, LeadJson } from '@/lib/api/types';
import { readStoredBrand, writeStoredBrand, type BrandScope } from '@/lib/domain/brand';
import { readStoredViewAs, writeStoredViewAs } from '@/lib/domain/viewAs';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { createBusyGuard } from './busy';
import { initialState, reducer, type Action, type AppState, type PoolUi, type UiFilters } from './reducer';
import { classifySession } from './session';
import { createToaster } from './toast';

import { closeModalState, type ModalState } from './modal';

export type { ModalState };

/** ตรวจว่าข้ามเที่ยงคืน (เวลาไทย) หรือยังทุก 1 นาที — เปิดหน้าค้างข้ามวัน "วันนี้" / เลยนัด / นัดวันนี้ ต้องเปลี่ยนตาม */
export const TODAY_CHECK_MS = 60_000;

/** localStorage ของเบราว์เซอร์ — ฝั่ง server / เบราว์เซอร์ที่บล็อก storage (getter โยน SecurityError) = undefined */
function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** ฟังก์ชันที่คงที่ตลอดอายุ provider — component ที่ใช้แค่ส่วนนี้ไม่ re-render ตาม state / toast / modal */
export interface AppActions {
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** error ระหว่างใช้งานหน้า (RPC ล้ม) → session หมดอายุ/ถูกปิดใช้งาน = การ์ด (handleAuthError) ไม่ toast, นอกนั้น toast */
  toastError: (e: unknown) => void;
  /** session หมดอายุ (JWT / not_authenticated) หรือไม่ใช่สมาชิก active แล้ว (not_member) → ล้างข้อมูลแล้วแสดงการ์ด; คืน true ถ้าจัดการแล้ว */
  handleAuthError: (e: unknown) => boolean;
  /** กันกดซ้ำ: key เดียวกันทำได้ทีละครั้ง (ครั้งที่ซ้อนเข้ามาไม่ทำอะไร) */
  once: <T>(key: string, fn: () => Promise<T>) => Promise<T | undefined>;
  openModal: (node: ReactNode, cls?: string) => void;
  /** ไม่ระบุ seq = ปิดเสมอ; ระบุ seq (จาก useModalSeq) = ปิดเฉพาะเมื่อ popup นั้นยังเปิดอยู่ */
  closeModal: (seq?: number) => void;
  logout: () => Promise<void>;
  upsertLead: (lead: LeadJson) => void;
  patchLead: (id: string, patch: Partial<Lead>) => void;
  setUi: (patch: Partial<UiFilters>) => void;
  setPool: (patch: Partial<PoolUi>) => void;
  /** แบรนด์ใหญ่ใน topbar — จำไว้ใน localStorage (dsales.brand) */
  setBrand: (b: BrandScope) => void;
  /** หัวหน้าดู/ทำแทนเซลล์ (null = ทั้งทีม) — จำไว้ใน localStorage (dsales.viewAs) */
  setViewAs: (id: string | null) => void;
}

const StateContext = createContext<AppState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);
// undefined = ไม่มี provider (null = ไม่มี toast / popup)
const ToastContext = createContext<string | null | undefined>(undefined);
const ModalContext = createContext<ModalState | null | undefined>(undefined);

/**
 * โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ)
 * 'login' = ต้องไป /login (ผู้เรียก redirect เองเฉพาะเมื่อ effect ยังไม่ถูกยกเลิก — StrictMode ของ dev mount สองรอบ)
 */
async function loadLive(): Promise<Action | 'login'> {
  const auth = supabase().auth;
  const { data: sessionData, error: sessionError } = await auth.getSession();
  const hasSession = !!sessionData.session;
  const { data: userData, error: userError } = hasSession ? await auth.getUser() : { data: { user: null }, error: null };
  const check = classifySession({ hasSession, sessionError, user: userData.user, userError });
  if (check.kind === 'login') return 'login';
  if (check.kind === 'error') throw new Error(check.message);
  const email = check.email;
  const me = await getMe();
  if (!me || !me.is_member) return { type: 'noAccess', email, inactive: false };
  if (!me.active) return { type: 'noAccess', email, inactive: true };
  const [team, campaigns, leads] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, live: true, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), customers: [], today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const toaster = useMemo(() => createToaster(setToastMsg), []);

  useEffect(() => {
    // แบรนด์ที่จำไว้ในเครื่อง — ตั้งก่อนโหลดข้อมูล (setBrand ไม่ถูกทิ้งก่อน phase ready; ตอน loaded ปรับตามสิทธิ์)
    dispatch({ type: 'setBrand', brand: readStoredBrand(browserStorage()) });
    dispatch({ type: 'setViewAs', id: readStoredViewAs(browserStorage()) });
    let cancelled = false;
    (async () => {
      let action: Action | 'login';
      try {
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') {
          const { fixturePayload } = await import('@/lib/fixtures/load');
          action = { type: 'loaded', payload: fixturePayload(window.location.search) };
        } else {
          action = await loadLive();
        }
      } catch (e) {
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${errorMessage(e)}` };
      }
      if (cancelled) return;
      if (action === 'login') window.location.replace('/login');
      else dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // เปิดค้างข้ามเที่ยงคืน: เลื่อน today ตามเวลาไทย (ล็อกอินจริงเท่านั้น โหมด fixture ตรึงวันที่ 2026-11-04 ตาม prototype)
  useEffect(() => {
    if (!state.live || state.phase !== 'ready') return;
    const tick = () => dispatch({ type: 'setToday', today: todayBangkok() });
    const timer = setInterval(tick, TODAY_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.live, state.phase]);

  // เคลียร์ timer ของ toast ตอน unmount
  useEffect(() => () => toaster.dispose(), [toaster]);

  const actions = useMemo<AppActions>(() => {
    let seq = 0;
    const busy = createBusyGuard();
    const handleAuthError = (e: unknown): boolean => {
      const kind = kindOf(e);
      if (kind !== 'auth' && kind !== 'member') return false;
      setModal(null);
      dispatch({ type: 'sessionLost', reason: kind === 'auth' ? 'expired' : 'inactive' });
      return true;
    };
    return {
      dispatch,
      toast: toaster.toast,
      toastError: (e) => {
        if (handleAuthError(e)) return; // การ์ดแสดงอยู่แล้ว ไม่ต้อง toast ซ้ำ
        toaster.toast(errorMessage(e));
      },
      handleAuthError,
      once: (key, fn) => busy.run(key, fn),
      openModal: (node, cls = '') => {
        seq += 1;
        setModal({ node, cls, seq });
      },
      closeModal: (seq) => setModal((m) => closeModalState(m, seq)),
      // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
      logout: async () => {
        if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
        window.location.href = '/login';
      },
      upsertLead: (lead) => dispatch({ type: 'upsertLead', lead }),
      patchLead: (id, patch) => dispatch({ type: 'patchLead', id, patch }),
      setUi: (patch) => dispatch({ type: 'setUi', patch }),
      setPool: (patch) => dispatch({ type: 'setPool', patch }),
      setBrand: (b) => {
        writeStoredBrand(browserStorage(), b);
        dispatch({ type: 'setBrand', brand: b });
      },
      setViewAs: (id) => {
        writeStoredViewAs(browserStorage(), id);
        dispatch({ type: 'setViewAs', id });
        dispatch({ type: 'invalidatePool' });
      },
    };
  }, [toaster]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <ToastContext.Provider value={toastMsg}>
          <ModalContext.Provider value={modal}>{children}</ModalContext.Provider>
        </ToastContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useAppState(): AppState {
  const v = useContext(StateContext);
  if (!v) throw new Error('useAppState ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useActions(): AppActions {
  const v = useContext(ActionsContext);
  if (!v) throw new Error('useActions ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useToastMsg(): string | null {
  const v = useContext(ToastContext);
  if (v === undefined) throw new Error('useToastMsg ต้องอยู่ใน <AppProvider>');
  return v;
}

/** ลำดับของ popup ที่ครอบ component นี้อยู่ (ModalRoot ใส่ให้) ใช้กับ closeModal(seq) หลัง await */
export const ModalSeqContext = createContext<number | undefined>(undefined);
export function useModalSeq(): number | undefined {
  return useContext(ModalSeqContext);
}

export function useModalState(): ModalState | null {
  const v = useContext(ModalContext);
  if (v === undefined) throw new Error('useModalState ต้องอยู่ใน <AppProvider>');
  return v;
}

/** state + actions (re-render เมื่อ state เปลี่ยน แต่ไม่ตาม toast / modal) — ใช้กับ shell เดิม */
export function useApp(): AppActions & { state: AppState } {
  const state = useAppState();
  const actions = useActions();
  return useMemo(() => ({ ...actions, state }), [actions, state]);
}
