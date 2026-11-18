'use client';

import { useApp } from '@/lib/state/AppProvider';

export function Toast() {
  const { toastMsg } = useApp();
  return <div className="toast" id="toast" hidden={!toastMsg}>{toastMsg}</div>;
}
