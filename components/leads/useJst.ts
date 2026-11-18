'use client';

import { useCallback } from 'react';
import { browserJstDeps, jstOpen, type JstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

export function useJst(): (t: JstTarget, opts?: { auto?: boolean }) => void {
  const { reps, meId } = useAppState();
  const { toast } = useActions();
  const rep = reps.find((r) => r.id === meId)?.name || '';
  return useCallback(
    (t: JstTarget, opts: { auto?: boolean } = {}) => {
      void jstOpen(t, rep, browserJstDeps(toast), opts);
    },
    [rep, toast],
  );
}
