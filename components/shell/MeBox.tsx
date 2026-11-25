'use client';

import { PATHS } from '@/lib/constants';
import { useApp } from '@/lib/state/AppProvider';
import { ViewAsSwitch } from './ViewAsSwitch';

export function MeBox() {
  const { state, logout } = useApp();
  const me = state.reps.find((r) => r.id === state.meId);
  return (
    <>
      <ViewAsSwitch />
      <div className="me">
        <div className="avatar" id="me-avatar">{(me?.initials || '?').slice(0, 2)}</div>
        <div className="me-info">
          <label htmlFor="me-select" className="me-label" id="me-label">เข้าสู่ระบบแล้ว</label>
          <select id="me-select" className="me-select" disabled>
            <option>{me?.name || state.email}</option>
          </select>
        </div>
        <button className="icon-btn logout" id="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={() => void logout()}>
          <svg viewBox="0 0 24 24"><path d={PATHS.logout} /></svg>
        </button>
      </div>
    </>
  );
}
