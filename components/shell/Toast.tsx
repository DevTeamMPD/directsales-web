'use client';

import { useToastMsg } from '@/lib/state/AppProvider';

export function Toast() {
  const msg = useToastMsg();
  return <div className="toast" id="toast" hidden={!msg}>{msg}</div>;
}
