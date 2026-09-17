'use client';

import { useEffect, useState } from 'react';
import { StatusBadge, money } from '@/components/ui';

interface Row {
  id: string;
  student_name: string;
  student_number: string;
  term: string;
  reference: string;
  invoice_amount: number;
  pay_amount: number;
  currency: string;
  amount_sats: number | null;
  status: string;
  gobtc_payment_id: string;
  txids: string | null;
  updated_at: string;
}

interface Counts {
  issued: number;
  committed: number;
  settled: number;
  awaiting: number;
  refusedByAgent: number;
}

const STATS: { key: keyof Counts; label: string; color: string }[] = [
  { key: 'issued', label: 'Requests issued', color: 'var(--navy-900)' },
  { key: 'committed', label: 'Paid (committed)', color: 'var(--success-500)' },
  { key: 'awaiting', label: 'Awaiting payment', color: 'var(--warning-500)' },
  { key: 'refusedByAgent', label: 'Refused by agent', color: 'var(--red-500)' },
];

export default function BursarPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/bursar', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          setRows(j.payments ?? []);
          setCounts(j.counts ?? null);
        });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="tp-wrap py-7">
      <div className="max-w-[1080px] mx-auto">
        <div className="mb-6">
          <div className="tp-eyebrow">Bursar view · demo</div>
          <h1 className="tp-h1 text-[34px] mt-3 mb-2">Northshore University Bursar</h1>
          <p className="text-base leading-relaxed tp-muted max-w-[72ch]">
            Payment requests issued through GoBTC Pay, and what the university sees.{' '}
            <strong className="font-semibold text-[var(--text-strong)]">Paid</strong> means the funds are committed and can’t move elsewhere;{' '}
            <strong className="font-semibold text-[var(--text-strong)]">settled</strong> means confirmed on-chain.
          </p>
        </div>

        <div className="flex gap-3.5 flex-wrap mb-[22px]">
          {STATS.map((s) => (
            <div
              key={s.key}
              className="flex-[1_1_160px] min-w-0 bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-5 py-[18px]"
              style={{ borderTop: `3px solid ${s.color}` }}
            >
              <div className="tp-label mb-2">{s.label}</div>
              <div className="tp-num text-[28px] tracking-[-0.03em]">{counts ? counts[s.key] : '…'}</div>
            </div>
          ))}
        </div>

        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Reference</th>
                <th>Invoice</th>
                <th>Requested (demo)</th>
                <th>Status</th>
                <th>GoBTC payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center tp-muted py-8">
                    No payment requests yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const paid = r.status === 'paid' || r.status === 'settled';
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="block font-semibold text-[14.5px] text-[var(--text-strong)]">{r.student_name}</span>
                      <span className="block tp-mono text-[11px] tp-muted mt-0.5">
                        {r.student_number} · {r.term}
                      </span>
                    </td>
                    <td className="tp-mono text-[11.5px] text-[var(--navy-900)]">{r.reference}</td>
                    <td className="tp-mono tabular-nums text-[var(--navy-900)] whitespace-nowrap">{money(r.invoice_amount, r.currency)}</td>
                    <td className="whitespace-nowrap">
                      <span className={`block tp-mono tabular-nums ${paid ? 'text-[var(--navy-900)]' : 'text-[var(--text-muted)]'}`}>
                        {money(r.pay_amount, r.currency)}
                      </span>
                      <span className="block tp-mono text-[11px] tp-muted mt-0.5">
                        {r.amount_sats != null ? `${r.amount_sats.toLocaleString()} sats` : '—'} · {paid ? 'received' : 'not received'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="max-w-[16rem]">
                      <span className="block tp-mono text-[11px] text-[var(--navy-900)] break-all">{r.gobtc_payment_id}</span>
                      <span className="block tp-mono text-[11px] text-[var(--text-faint)] mt-0.5">{r.updated_at}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3.5 flex-wrap mt-[22px]">
          <div className="flex-[1_1_300px] min-w-0 bg-[var(--navy-900)] rounded-[var(--radius-md)] border-l-[3px] border-l-[var(--success-500)] px-6 py-5 text-white">
            <div className="tp-label-dark mb-2">Paid · seconds</div>
            <p className="text-[14.5px] leading-relaxed max-w-[46ch] m-0">
              GoBTC accepted the agent’s signature and committed to co-sign. The coins can’t move without GoBTC, so the deadline is met even before
              confirmation.
            </p>
          </div>
          <div className="flex-[1_1_300px] min-w-0 bg-[var(--navy-900)] rounded-[var(--radius-md)] border-l-[3px] border-l-[var(--red-500)] px-6 py-5 text-white">
            <div className="tp-label-dark mb-2">Settled · about 12 hours</div>
            <p className="text-[14.5px] leading-relaxed max-w-[46ch] m-0">
              Confirmed on Bitcoin with transaction IDs present. The university converts to CAD (simulated in this demo) and the final receipt is issued.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
