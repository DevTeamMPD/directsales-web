'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SetupPage } from '@/components/setup/SetupPage';
import { useApp } from '@/lib/state/AppProvider';

export default function Page() {
  const { state } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!state.isAdmin) router.replace('/leads'); // หลังบ้านเฉพาะหัวหน้า (prototype route L140)
  }, [state.isAdmin, router]);
  if (!state.isAdmin) return null;
  return <SetupPage />;
}
