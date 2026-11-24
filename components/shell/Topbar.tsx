'use client';

import { usePathname } from 'next/navigation';
import { PATHS } from '@/lib/constants';
import { routeMeta } from '@/lib/routes';
import { useApp } from '@/lib/state/AppProvider';
import { BrandSwitch } from './BrandSwitch';
import { useShell } from './ShellContext';

export function Topbar() {
  const { state } = useApp();
  const { openMenu, setActionsEl } = useShell();
  const pathname = usePathname();
  const { title, sub } = routeMeta(pathname, state.campaigns);
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" id="menu-btn" aria-label="เปิดเมนู" onClick={openMenu}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS.menu} /></svg>
      </button>
      <div className="topbar-title">
        <h1 id="page-title">{title}</h1>
        <span id="page-sub" className="page-sub">{sub}</span>
      </div>
      {/* นอก #topbar-actions: หน้าต่าง ๆ portal ปุ่มของตัวเองเข้าไปที่นั่น */}
      <BrandSwitch brandPage={pathname.startsWith('/campaigns/')} />
      <div className="topbar-actions" id="topbar-actions" ref={setActionsEl} />
    </header>
  );
}
