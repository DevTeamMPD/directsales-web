import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/Shell';
import { AppProvider } from '@/lib/state/AppProvider';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
