'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useShell } from './ShellContext';

/** ปุ่มของแต่ละหน้าใน #topbar-actions (หายเองเมื่อออกจากหน้า = prototype ล้าง #topbar-actions ทุก route) */
export function TopbarActions({ children }: { children: ReactNode }) {
  const { actionsEl } = useShell();
  return actionsEl ? createPortal(children, actionsEl) : null;
}
