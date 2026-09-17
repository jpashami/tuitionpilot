'use client';

import { useEffect, useState } from 'react';
import { money } from './ui';

interface JourneyInvoice {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
}

interface JourneyPayment {
  status: string;
  pay_amount: number;
  amount_sats: number | null;
  gobtc_payment_id: string | null;
  payment_tx_id: string | null;
  txids: string | null;
  settled_at: number | null;
}

interface Quote {
  currency: string;
  amountSats: number;
  targetAmount: number;
  rateLocked: number;
  rateNow: number;
  rateSource: string;
  rateMovePct: number;
  grossAmount: number;
  feePct: number;
  feeAmount: number;
  netAmount: number;
  varianceAmount: number;
}

type StepState = 'done' | 'current' | 'blocked' | 'todo';

const DOT: Record<StepState, string> = {
  done: 'bg-[var(--success-500)] text-white',
  current: 'bg-[var(--warning-500)] text-white',
  blocked: 'bg-[var(--red-500)] text-white',
  todo: 'bg-[var(--slate-100)] text-[var(--slate-500)] border border-[var(--border-subtle)]',
};

export default function PaymentJourney({ invoice, payment }: { invoice: JourneyInvoice; payment: JourneyPayment | null }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const paid = payment && ['paid', 'settled'].includes(payment.status);

  useEffect(() => {
    if (!payment?.amount_sats) {
      setQuote(null);
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/payments/settlement?invoiceId=${invoice.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => alive && setQuote(j.quote));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [invoice.id, payment?.amount_sats, payment?.status]);

  const cur = invoice.currency ?? 'CAD';
  const refused = invoice.status === 'refused';
  const read = invoice.amount != null;
  const requested = !!payment?.gobtc_payment_id;
  const settled = payment?.status === 'settled';
  const txids: string[] = payment?.txids ? JSON.parse(payment.txids) : [];

  const steps: { title: string; who: string; body: string; state: StepState }[] = [
    {
      title: 'Invoice read',
      who: 'Student → TuitionPilot',
      body: read ? `${money(invoice.amount, cur)} due. Agent extracted payee, term, due date and reference.` : 'Waiting for the agent to read the invoice.',
      state: read ? 'done' : 'todo',
    },
    {
      title: 'Family rules checked',
      who: 'TuitionPilot (code, not AI)',
      body: refused ? 'Refused — nothing will be paid.' : requested || invoice.status === 'needs_funds' ? 'All rules passed.' : 'Payee, student, currency, term cap, window, autopay.',
      state: refused ? 'blocked' : requested ? 'done' : read ? 'current' : 'todo',
    },
    {
      title: 'Payment request, rate locked',
      who: 'University (GoBTC merchant)',
      body: requested && quote
        ? `${money(quote.targetAmount, cur)} requested = ${quote.amountSats.toLocaleString()} sats at ${money(quote.rateLocked, cur)}/BTC. Price fixed for 30 min.`
        : 'The bursar asks for a fixed CAD amount; GoBTC converts it to sats at the current price.',
      state: refused ? 'todo' : requested ? 'done' : 'todo',
    },
    {
      title: 'Signed and paid',
      who: 'TuitionPilot wallet + GoBTC co-sign',
      body: paid
        ? 'Agent signed, GoBTC co-signed: funds are committed and cannot be spent elsewhere.'
        : invoice.status === 'needs_funds'
          ? 'Waiting: the agent wallet needs funds.'
          : payment?.status === 'dry_run'
            ? 'Dry run: stopped just before signing.'
            : 'Agent verifies payee and amount, signs its half, GoBTC adds the second signature.',
      state: paid ? 'done' : invoice.status === 'needs_funds' || payment?.status === 'dry_run' ? 'current' : 'todo',
    },
    {
      title: 'Settled on Bitcoin',
      who: 'GoBTC batch → blockchain',
      body: settled ? `Confirmed on-chain${txids[0] ? ` (tx ${txids[0].slice(0, 10)}…)` : ''}.` : paid ? 'Batched settlement pending (about 12 hours).' : 'Happens after payment, about 12 hours later.',
      state: settled ? 'done' : paid ? 'current' : 'todo',
    },
    {
      title: 'Converted to CAD (simulated)',
      who: 'University off-ramp',
      body: quote
        ? `${money(quote.netAmount, cur)} to the university's bank after a ${quote.feePct}% fee.`
        : 'The university sells the BTC for CAD at the live price.',
      state: paid && quote ? 'current' : 'todo',
    },
  ];

  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className={`w-6 h-6 shrink-0 rounded-[7px] tp-mono text-xs font-medium flex items-center justify-center ${DOT[s.state]}`}>
              {s.state === 'done' ? '✓' : s.state === 'blocked' ? '✗' : i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text-strong)]">
                {s.title} <span className="tp-mono font-normal text-[11px] tracking-[.08em] uppercase text-[var(--text-faint)] ml-1">{s.who}</span>
              </p>
              <p className="text-[13.5px] tp-muted mt-0.5">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {quote && (
        <div className="rounded-[var(--radius-md)] bg-[var(--navy-900)] border border-[var(--navy-700)] p-5 text-white">
          <p className="text-[15px] font-semibold mb-2">
            CAD conversion {paid ? '' : 'preview '}
            <span className="block tp-mono font-normal text-[11px] tracking-[.1em] uppercase text-[var(--navy-300)] mt-1">Simulated off-ramp · live price from {quote.rateSource}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="text-[var(--navy-100)]">
                <Row label="University requested" value={money(quote.targetAmount, cur)} />
                <Row label={paid ? 'Received' : 'Would receive'} value={`${quote.amountSats.toLocaleString()} sats`} />
                <Row label="BTC price when requested (locked)" value={money(quote.rateLocked, cur)} />
                <Row
                  label="BTC price now"
                  value={`${money(quote.rateNow, cur)} (${quote.rateMovePct >= 0 ? '+' : ''}${quote.rateMovePct}%)`}
                />
                <Row label="Sell value (sats × price now)" value={money(quote.grossAmount, cur)} />
                <Row label={`Off-ramp fee (${quote.feePct}%)`} value={`− ${money(quote.feeAmount, cur)}`} />
                <Row label="Net to university bank" value={money(quote.netAmount, cur)} strong />
                <Row
                  label="Difference vs. requested"
                  value={`${quote.varianceAmount >= 0 ? '+' : '−'} ${money(Math.abs(quote.varianceAmount), cur)}`}
                  tone={quote.varianceAmount >= 0 ? 'good' : 'bad'}
                />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--navy-300)]">
            The family pays exactly the locked amount. Price movement after that, and the conversion fee, fall on whoever holds the BTC — so the
            bursar converts as soon as the payment is committed, keeping the exposure to minutes.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-[#7FD9B4]' : tone === 'bad' ? 'text-[var(--red-400)]' : '';
  return (
    <tr className="border-t border-[var(--navy-700)]">
      <td className="py-2 pr-4">{label}</td>
      <td className={`py-2 text-right whitespace-nowrap tp-mono tabular-nums ${strong ? 'font-semibold text-white' : ''} ${color}`}>{value}</td>
    </tr>
  );
}
