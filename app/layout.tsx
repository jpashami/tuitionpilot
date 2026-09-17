import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import Header from '@/components/Header';
import MandateStrip from '@/components/MandateStrip';
import { paymentsEnabled } from '@/lib/payments';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'TuitionPilot',
  description: 'An AI agent that pays international tuition on time, within limits the family sets — powered by GoBTC Pay.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Header live={paymentsEnabled()}>
          <MandateStrip />
        </Header>
        {children}
      </body>
    </html>
  );
}
