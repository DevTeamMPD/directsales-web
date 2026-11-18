'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { badgeCounts } from '@/lib/domain/badges';
import { NAV } from '@/lib/nav';
import { routeKey } from '@/lib/routes';
import { useApp } from '@/lib/state/AppProvider';
import { MeBox } from './MeBox';
import { useShell } from './ShellContext';

export function Sidebar() {
  const { state } = useApp();
  const { menuOpen } = useShell();
  const active = routeKey(usePathname());
  const badges = badgeCounts(state.leads, state.meId);

  return (
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="sidebar">
      <div className="brand">
        <div className="brand-name">MPD Direct Sale</div>
        <div className="brand-sub">MPD Group · Preview v0.1</div>
      </div>
      <nav className="nav" id="nav">
        {NAV.filter((g) => !g.adminOnly || state.isAdmin).map((g) => (
          <Fragment key={g.label}>
            <div className="nav-group" id={g.id}>{g.label}</div>
            {g.items.map((it) => (
              <Link key={it.key} className={`nav-item${active === it.key ? ' active' : ''}`} href={it.href} data-route={it.key} id={it.id}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={it.icon} /></svg>
                <span>{it.label}</span>
                {it.badge ? (
                  <b className={`nav-badge${it.badge === 'leads' ? '' : ' soft'}`} id={`badge-${it.badge}`}>{badges[it.badge] || ''}</b>
                ) : null}
              </Link>
            ))}
          </Fragment>
        ))}
      </nav>
      <MeBox />
    </aside>
  );
}
