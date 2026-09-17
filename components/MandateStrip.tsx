'use client';

import { useEffect, useState } from 'react';
import { VerifiedIcon, money, shortId } from './ui';

interface MandateInfo {
  approved_payee_name: string;
  approved_payee_merchant_id: string;
  max_per_term: number;
  pay_window_days: number;
  autopay: number;
  currency: string;
}

/** Dark summary of the family's rules and wallet, shown under the header on the agent console. */
export default function MandateStrip() {
  const [mandate, setMandate] = useState<MandateInfo | null>(null);
  const [committed, setCommitted] = useState(0);
  const [balance, setBalance] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    const load = () => {
      fetch('/api/mandate', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMandate(j.mandate));
      fetch('/api/invoices', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) =>
          setCommitted(
            (j.invoices ?? [])
              .filter((i: { payment?: { status: string } | null }) => ['paid', 'settled'].includes(i.payment?.status ?? ''))
              .reduce((s: number, i: { amount: number | null }) => s + (i.amount ?? 0), 0),
          ),
        );
      fetch('/api/wallet', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setBalance(j.balance?.leftSats ?? null))
        .catch(() => setBalance(null));
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tp-strip">
      <div className="tp-stat wide">
        <div className="tp-stat-label">Approved payee</div>
        <div className="tp-stat-text">
          <VerifiedIcon />
          {mandate?.approved_payee_name ?? '…'}
        </div>
        <div className="tp-stat-sub">{shortId(mandate?.approved_payee_merchant_id)} · verified, fixed</div>
      </div>
      <div className="tp-stat">
        <div className="tp-stat-label">Cap per term</div>
        <div className="tp-stat-value">{mandate ? money(mandate.max_per_term, mandate.currency) : '…'}</div>
        <div className="tp-stat-sub">{money(committed)} committed this year</div>
      </div>
      <div className="tp-stat">
        <div className="tp-stat-label">Payment window</div>
        <div className="tp-stat-value">{mandate ? `${mandate.pay_window_days} days` : '…'}</div>
        <div className="tp-stat-sub">before the due date · autopay {mandate?.autopay ? 'on' : 'off'}</div>
      </div>
      <div className="tp-stat">
        <div className="tp-stat-label">Agent wallet</div>
        <div className="tp-stat-value">{balance === undefined ? '…' : balance === null ? 'Unavailable' : `${balance.toLocaleString()} sats`}</div>
        <div className="tp-stat-sub">spendable on Bitcoin mainnet</div>
      </div>
      <div className="tp-stat wide">
        <div className="tp-stat-label">Signing policy</div>
        <div className="tp-stat-text">2-of-3 · agent key + GoBTC co-sign</div>
        <div className="tp-stat-sub">Rules run in code before the agent signs</div>
      </div>
    </div>
  );
}
