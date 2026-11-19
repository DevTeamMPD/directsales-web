'use client';

import { createContext, useContext } from 'react';

export interface ShellValue {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  actionsEl: HTMLDivElement | null;
  setActionsEl: (el: HTMLDivElement | null) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell ต้องอยู่ใน <Shell>');
  return v;
}
