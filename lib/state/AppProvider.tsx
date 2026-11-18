'use client';

import {
  createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode,
} from 'react';
import { errorMessage } from '@/lib/api/errors';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import type { Lead, LeadJson } from '@/lib/api/types';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { initialState, reducer, type Action, type AppState, type UiFilters } from './reducer';
import { classifySession } from './session';
import { createToaster } from './toast';

export interface ModalState { node: ReactNode; cls: string; seq: number }

/** ฟังก์ชันที่คงที่ตลอดอายุ provider — component ที่ใช้แค่ส่วนนี้ไม่ re-render ตาม state / toast / modal */
export interface AppActions {
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** error ระหว่างใช้งานหน้า (RPC ล้ม) → toast เสมอ */
  toastError: (e: unknown) => void;
  openModal: (node: ReactNode, cls?: string) => void;
  closeModal: () => void;
  logout: () => Promise<void>;
  upsertLead: (lead: LeadJson) => void;
  patchLead: (id: string, patch: Partial<Lead>) => void;
  setUi: (patch: Partial<UiFilters>) => void;
}

const StateContext = createContext<AppState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);
// undefined = ไม่มี provider (null = ไม่มี toast / popup)
const ToastContext = createContext<string | null | undefined>(undefined);
const ModalContext = createContext<ModalState | null | undefined>(undefined);

/** โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ) */
async function loadLive(): Promise<Action | null> {
  const auth = supabase().auth;
  const { data: sessionData, error: sessionError } = await auth.getSession();
  const hasSession = !!sessionData.session;
  const { data: userData, error: userError } = hasSession ? await auth.getUser() : { data: { user: null }, error: null };
  const check = classifySession({ hasSession, sessionError, user: userData.user, userError });
  if (check.kind === 'login') {
    window.location.replace('/login');
    return null;
  }
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
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const toaster = useMemo(() => createToaster(setToastMsg), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let action: Action | null;
      try {
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') {
          const { fixturePayload } = await import('@/lib/fixtures/load');
          action = { type: 'loaded', payload: fixturePayload() };
        } else {
          action = await loadLive();
        }
      } catch (e) {
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${errorMessage(e)}` };
      }
      if (!cancelled && action) dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // เคลียร์ timer ของ toast ตอน unmount
  useEffect(() => () => toaster.dispose(), [toaster]);

  const actions = useMemo<AppActions>(() => {
    let seq = 0;
    return {
      dispatch,
      toast: toaster.toast,
      toastError: (e) => toaster.toast(errorMessage(e)),
      openModal: (node, cls = '') => {
        seq += 1;
        setModal({ node, cls, seq });
      },
      closeModal: () => setModal(null),
      // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
      logout: async () => {
        if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
        window.location.href = '/login';
      },
      upsertLead: (lead) => dispatch({ type: 'upsertLead', lead }),
      patchLead: (id, patch) => dispatch({ type: 'patchLead', id, patch }),
      setUi: (patch) => dispatch({ type: 'setUi', patch }),
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
