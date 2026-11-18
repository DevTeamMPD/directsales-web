import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from 'next/font/google';
import '@/styles/prototype.css';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-plex-thai',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({ weight: '500', subsets: ['latin'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = { title: 'MPD Direct Sale' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
