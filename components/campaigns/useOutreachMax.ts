'use client';

import { useEffect, useState } from 'react';
import { getWorkerStatus } from '@/lib/api/rpc';
import { maxBatch } from '@/lib/domain/outreach';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** จำนวนสูงสุดต่อชุดจาก dsales_worker_status_get — โหลดครั้งแรกเมื่อ active (เริ่มติ๊ก); ล้มเหลว = ค่าเริ่มต้น 50 · โหมด fixture = ค่าตัวอย่าง */
export function useOutreachMax(active: boolean): number {
  const { live, outreachDemo } = useAppState();
  const { handleAuthError } = useActions();
  const [liveMax, setLiveMax] = useState<number | null>(null);
  const want = live && active && liveMax === null;
  useEffect(() => {
    if (!want) return;
    let alive = true;
    getWorkerStatus().then(
      (s) => {
        if (alive) setLiveMax(maxBatch(s?.settings));
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setLiveMax(maxBatch(null));
      },
    );
    return () => {
      alive = false;
    };
  }, [want, handleAuthError]);
  return live ? (liveMax ?? maxBatch(null)) : maxBatch(outreachDemo?.worker.settings);
}
