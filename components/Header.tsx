'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lockup } from './Logo';

const TABS = [
  { href: '/demo', label: 'Agent', section: 'Agent console' },
  { href: '/parent', label: 'Parent', section: 'Parent view' },
  { href: '/bursar', label: 'Bursar', section: 'Bursar view' },
];

export default function Header({ live, children }: { live: boolean; children?: React.ReactNode }) {
  const pathname = usePathname();
  const current = TABS.find((t) => pathname?.startsWith(t.href));

  return (
    <header className="tp-header">
      <div className="tp-wrap">
        <div className="tp-header-row">
          <Link href="/" className="tp-brand" aria-label="TuitionPilot home">
            <Lockup size={30} reversed endorsement={false} />
            <span className="tp-brand-section">{current?.section ?? (pathname?.startsWith('/receipt') ? 'Receipt' : 'Novalycs')}</span>
          </Link>
          <div className="flex-1" />
          <nav className="tp-tabs" aria-label="Views">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className="tp-tab" aria-current={current?.href === t.href ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
          <div className={`tp-mode ${live ? 'live' : ''}`} title={live ? 'Payments are signed and sent on Bitcoin mainnet' : 'The agent stops right before signing'}>
            <b aria-hidden="true" />
            {live ? 'Live signing' : 'Dry run'}
          </div>
        </div>
        {current?.href === '/demo' && children}
      </div>
    </header>
  );
}
