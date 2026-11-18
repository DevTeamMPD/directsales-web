'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode,
} from 'react';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { initialState, reducer, type Action, type AppState } from './reducer';

export interface ModalState { node: ReactNode; cls: string; seq: number }

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  toastMsg: string | null;
  toast: (msg: string) => void;
  modal: ModalState | null;
  openModal: (node: ReactNode, cls?: string) => void;
  closeModal: () => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ) */
async function loadLive(): Promise<Action | null> {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) {
    window.location.replace('/login');
    return null;
  }
  const email = user.email ?? '';
  const me = await getMe();
  if (!me || !me.is_member) return { type: 'noAccess', email, inactive: false };
  if (!me.active) return { type: 'noAccess', email, inactive: true };
  const [team, campaigns, leads] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [modal, setModal] = useState<ModalState | null>(null);
  const modalSeq = useRef(0);

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
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (!cancelled && action) dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // toast ช่องเดียว แสดง 2.2 วิ ข้อความใหม่เริ่มนับใหม่ (prototype L124-127)
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const openModal = useCallback((node: ReactNode, cls = '') => {
    modalSeq.current += 1;
    setModal({ node, cls, seq: modalSeq.current });
  }, []);
  const closeModal = useCallback(() => setModal(null), []);

  // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
  const logout = useCallback(async () => {
    if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
    window.location.href = '/login';
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, toastMsg, toast, modal, openModal, closeModal, logout }),
    [state, toastMsg, toast, modal, openModal, closeModal, logout],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp ต้องอยู่ใน <AppProvider>');
  return v;
}
