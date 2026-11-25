'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { EXPIRED_TEXT, INACTIVE_TEXT, LOADING_TEXT, NO_ACCESS_TEXT, NoAccess } from '@/components/auth/NoAccess';
import { useApp } from '@/lib/state/AppProvider';
import { ModalRoot } from './ModalRoot';
import { ShellContext } from './ShellContext';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { Topbar } from './Topbar';
import { ViewAsBar } from './ViewAsSwitch';

export function Shell({ children }: { children: ReactNode }) {
  const { state, logout } = useApp();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setMenuOpen(false); // route() ของ prototype ปิดเมนูมือถือทุกครั้งที่เปลี่ยนหน้า
  }, [pathname]);

  const shell = useMemo(
    () => ({ menuOpen, openMenu: () => setMenuOpen(true), closeMenu: () => setMenuOpen(false), actionsEl, setActionsEl }),
    [menuOpen, actionsEl],
  );

  if (state.phase === 'loading') return <NoAccess message={LOADING_TEXT} />;
  if (state.phase === 'expired') return <NoAccess message={EXPIRED_TEXT} email={state.email} onLogout={logout} logoutText="เข้าสู่ระบบใหม่" />;
  if (state.phase === 'no-access' || state.phase === 'inactive') {
    return <NoAccess message={state.phase === 'inactive' ? INACTIVE_TEXT : NO_ACCESS_TEXT} email={state.email} onLogout={logout} />;
  }
  if (state.phase === 'error') {
    return <NoAccess message={state.error} isError onRetry={() => window.location.reload()} onLogout={logout} />;
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className="app">
        <Sidebar />
        <div className={`scrim${menuOpen ? ' open' : ''}`} id="scrim" onClick={shell.closeMenu} />
        <main className="main">
          <Topbar />
          <ViewAsBar />
          <section className="content" id="view">{children}</section>
        </main>
      </div>
      <ModalRoot />
      <Toast />
    </ShellContext.Provider>
  );
}
