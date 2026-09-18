'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, StatusBadge, money, shortId, statusInfo } from '@/components/ui';
import ComplianceQueue from '@/components/ComplianceQueue';

interface Balance {
  leftSats: number;
  lockedSats: number;
  source: 'gobtc' | 'onchain';
  note?: string;
}

interface Family {
  student_id: string;
  student_name: string;
  student_number: string;
  university: string;
  parent_name: string;
  approved_payee_name: string | null;
  max_per_term: number | null;
  currency: string | null;
  autopay: number | null;
  wallet: { address: string | null; shared: boolean; balance: Balance | null; balanceError: string | null };
  invoices: number;
  committedAmount: number;
  sentSats: number;
  feeSats: number;
  refused: number;
  lastActivity: string | null;
}

interface Tx {
  invoice_id: string;
  student_name: string;
  reference: string | null;
  term: string | null;
  source_name: string;
  invoice_amount: number | null;
  currency: string | null;
  due_date: string | null;
  invoice_status: string;
  decision: string | null;
  invoice_created_at: string;
  payment_status: string | null;
  pay_amount: number | null;
  amount_sats: number | null;
  fee_sats: number | null;
  rate_at_request: number | null;
  gobtc_payment_id: string | null;
  payment_tx_id: string | null;
  txids: string[];
  attempt: number | null;
  paid_seen_at: string | null;
  settled_at: number | null;
  payment_updated_at: string | null;
}

interface Overview {
  generatedAt: string;
  paymentsEnabled: boolean;
  totals: {
    families: number;
    invoices: number;
    committed: number;
    settled: number;
    held: number;
    refused: number;
    failed: number;
    committedAmount: number;
    sentSats: number;
    feeSats: number;
    walletSats: number | null;
  };
  families: Family[];
  transactions: Tx[];
}

type Filter = 'all' | 'committed' | 'held' | 'refused' | 'failed' | 'new';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'committed', label: 'Paid' },
  { id: 'held', label: 'Held' },
  { id: 'refused', label: 'Refused' },
  { id: 'failed', label: 'Failed' },
  { id: 'new', label: 'Not run' },
];

// What a row "is" for filtering and badges: a committed payment wins over the invoice status.
function effectiveStatus(t: Tx) {
  if (t.payment_status === 'paid' || t.payment_status === 'settled') return t.payment_status;
  return t.invoice_status;
}

function matches(t: Tx, f: Filter) {
  const s = effectiveStatus(t);
  switch (f) {
    case 'all':
      return true;
    case 'committed':
      return s === 'paid' || s === 'settled';
    case 'held':
      return ['needs_funds', 'needs_review', 'approved', 'paying'].includes(s);
    case 'refused':
      return s === 'refused';
    case 'failed':
      return s === 'failed';
    case 'new':
      return s === 'uploaded' || s === 'extracted';
  }
}

const sats = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString()} sats`);
const when = (s: string | null) => (s ? s.replace('T', ' ').slice(0, 16) : '—');

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/overview', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => {
          setData(j);
          setError(null);
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.transactions ?? []).filter(
      (t) =>
        matches(t, filter) &&
        (!q ||
          [t.reference, t.student_name, t.gobtc_payment_id, t.source_name, t.term]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [data, filter, query]);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = (data?.transactions ?? []).filter((t) => matches(t, f.id)).length;
    return out;
  }, [data]);

  const tot = data?.totals;
  const wallet = data?.families[0]?.wallet;

  return (
    <main className="tp-wrap py-7">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="tp-eyebrow">Admin · operations</div>
          <h1 className="tp-h1 text-[34px] mt-3 mb-1">Family wallets and transactions</h1>
          <p className="tp-muted max-w-[72ch] m-0">
            Every family, its wallet balance, and every invoice the agent has handled — paid, held or refused.
          </p>
        </div>
        <div className="tp-mono text-[11px] tracking-[.1em] uppercase tp-muted text-right">
          {data ? `Updated ${data.generatedAt.slice(11, 19)} UTC · refreshes every 20 s` : 'Loading…'}
          <br />
          Payments: {data ? (data.paymentsEnabled ? 'live' : 'dry run') : '…'}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-[var(--radius-md)] border border-[var(--red-200)] bg-[var(--red-50)] p-3 text-sm text-[var(--red-700)]">
          Couldn’t load the overview: {error}
        </div>
      )}

      {/* ---------- totals ---------- */}
      <div className="grid gap-3.5 mb-6 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Stat label="Families" value={tot ? tot.families : '…'} color="var(--navy-900)" />
        <Stat
          label="Wallet balance"
          value={tot ? (tot.walletSats == null ? 'Unavailable' : sats(tot.walletSats)) : '…'}
          sub={wallet?.balance ? (wallet.balance.source === 'gobtc' ? 'from GoBTC' : 'from the blockchain (GoBTC down)') : wallet?.balanceError ?? undefined}
          color="var(--navy-900)"
        />
        <Stat label="Paid" value={tot ? tot.committed : '…'} sub={tot ? `${money(tot.committedAmount)} in invoices · ${tot.settled} settled` : undefined} color="var(--success-500)" />
        <Stat label="Sent on Bitcoin" value={tot ? sats(tot.sentSats) : '…'} sub={tot ? `network fees ${sats(tot.feeSats)}` : undefined} color="var(--success-500)" />
        <Stat label="Held" value={tot ? tot.held : '…'} sub="needs funds, review or approval" color="var(--warning-500)" />
        <Stat label="Refused" value={tot ? tot.refused : '…'} sub={tot ? `${tot.failed} failed before signing` : undefined} color="var(--red-500)" />
      </div>

      <ComplianceQueue />

      {/* ---------- family wallets ---------- */}
      <Card eyebrow="Family wallets" title="Balances by family" className="mb-6" action={<span className="tp-count">{data?.families.length ?? 0} families</span>}>
        <div className="tp-table-wrap !border-0 !rounded-none -mx-[22px] -mb-[22px]">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>University · rules</th>
                <th>Wallet (2-of-3)</th>
                <th>Spendable</th>
                <th>Paid so far</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr>
                  <td colSpan={6} className="text-center tp-muted py-8">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.families.map((f) => (
                <tr key={f.student_id}>
                  <td>
                    <span className="block font-semibold text-[var(--text-strong)]">{f.parent_name}</span>
                    <span className="block text-[12.5px] tp-muted">
                      for {f.student_name} · <span className="tp-mono">{f.student_number}</span>
                    </span>
                  </td>
                  <td>
                    <span className="block">{f.university}</span>
                    <span className="block text-[12.5px] tp-muted">
                      Payee {f.approved_payee_name ?? '—'} · cap {f.max_per_term != null ? money(f.max_per_term, f.currency ?? 'CAD') : '—'} · autopay{' '}
                      {f.autopay ? 'on' : 'off'}
                    </span>
                  </td>
                  <td className="max-w-[16rem]">
                    {f.wallet.address ? (
                      <a className="tp-mono text-[12px] break-all" href={`https://mempool.space/address/${f.wallet.address}`} target="_blank" rel="noreferrer">
                        {shortId(f.wallet.address, 10, 8)}
                      </a>
                    ) : (
                      '—'
                    )}
                    {f.wallet.shared && <span className="block text-[11.5px] text-[var(--text-faint)] mt-0.5">demo wallet, shared</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="block tp-mono tabular-nums text-[var(--navy-900)]">
                      {f.wallet.balance ? sats(f.wallet.balance.leftSats) : 'Unavailable'}
                    </span>
                    <span className="block text-[11.5px] tp-muted">
                      {f.wallet.balance
                        ? `${f.wallet.balance.lockedSats ? `${sats(f.wallet.balance.lockedSats)} locked · ` : ''}${f.wallet.balance.source === 'gobtc' ? 'GoBTC' : 'on-chain'}`
                        : f.wallet.balanceError}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="block tp-mono tabular-nums text-[var(--navy-900)]">{money(f.committedAmount, f.currency ?? 'CAD')}</span>
                    <span className="block text-[11.5px] tp-muted">
                      {sats(f.sentSats)} · fees {sats(f.feeSats)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="block">
                      {f.invoices} invoices · {f.refused} refused
                    </span>
                    <span className="block text-[11.5px] tp-muted">last {when(f.lastActivity)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------- transactions ---------- */}
      <Card eyebrow="History" title="All invoices and payments">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`tp-mono text-[11px] tracking-[.08em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.id
                  ? 'bg-[var(--navy-900)] text-white border-[var(--navy-900)]'
                  : 'bg-white text-[var(--slate-700)] border-[var(--border-subtle)] hover:border-[var(--navy-900)]'
              }`}
            >
              {f.label} <span className="opacity-60">{counts[f.id] ?? 0}</span>
            </button>
          ))}
          <label htmlFor="admin-search" className="sr-only">
            Search
          </label>
          <input
            id="admin-search"
            className="tp-input !py-1.5 !text-sm ml-auto w-full sm:w-64"
            placeholder="Search reference, student, payment ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="tp-table-wrap !border-0 !rounded-none -mx-[22px] -mb-[22px]">
          <table className="tp-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Bitcoin</th>
                <th>Status</th>
                <th>GoBTC payment · proof</th>
              </tr>
            </thead>
            <tbody>
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center tp-muted py-8">
                    No invoices match.
                  </td>
                </tr>
              )}
              {rows.map((t) => {
                const st = effectiveStatus(t);
                const paid = st === 'paid' || st === 'settled';
                return (
                  <tr key={t.invoice_id}>
                    <td className="whitespace-nowrap tp-mono text-[12px]">
                      {when(t.payment_updated_at ?? t.invoice_created_at)}
                      <span className="block text-[11px] text-[var(--text-faint)]">created {when(t.invoice_created_at)}</span>
                    </td>
                    <td className="max-w-[20rem]">
                      <span className="block font-semibold text-[var(--text-strong)]">{t.student_name}</span>
                      <span className="block tp-mono text-[11.5px] text-[var(--navy-900)] break-all">{t.reference ?? t.source_name}</span>
                      <span className="block text-[12px] tp-muted">
                        {t.term ?? '—'}
                        {t.due_date ? ` · due ${t.due_date}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap tp-mono tabular-nums">
                      {money(t.invoice_amount, t.currency ?? 'CAD')}
                      {t.pay_amount != null && <span className="block text-[11.5px] tp-muted">demo {money(t.pay_amount, t.currency ?? 'CAD')}</span>}
                    </td>
                    <td className="whitespace-nowrap tp-mono tabular-nums">
                      {sats(t.amount_sats)}
                      {t.amount_sats != null && (
                        <span className={`block text-[11px] ${paid ? 'text-[#12734F]' : 'text-[var(--text-faint)]'}`}>{paid ? 'sent' : 'requested, not sent'}</span>
                      )}
                      <span className="block text-[11.5px] tp-muted">
                        {t.fee_sats != null ? `fee ${t.fee_sats}` : ''}
                        {t.rate_at_request ? `${t.fee_sats != null ? ' · ' : ''}@ ${money(Math.round(t.rate_at_request), t.currency ?? 'CAD')}` : ''}
                      </span>
                    </td>
                    <td className="max-w-[18rem]">
                      <StatusBadge status={st} />
                      {t.attempt && t.attempt > 1 && <span className="block text-[11px] tp-muted mt-1">attempt {t.attempt}</span>}
                      {!paid && t.decision && (
                        <span className="block text-[12px] tp-muted mt-1 line-clamp-2" title={t.decision}>
                          {t.decision}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[16rem]">
                      {t.gobtc_payment_id ? (
                        <span className="block tp-mono text-[11.5px] break-all" title={t.gobtc_payment_id}>
                          {shortId(t.gobtc_payment_id)}
                        </span>
                      ) : (
                        <span className="tp-muted">—</span>
                      )}
                      {t.txids.map((x) => (
                        <a key={x} href={`https://mempool.space/tx/${x}`} target="_blank" rel="noreferrer" className="block tp-mono text-[11.5px]">
                          tx {shortId(x, 8, 6)}
                        </a>
                      ))}
                      <span className="flex gap-3 mt-1 text-[12.5px] font-semibold">
                        <a href={`/demo?invoice=${t.invoice_id}`}>Agent view</a>
                        {paid && <a href={`/receipt/${t.invoice_id}`}>Receipt</a>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-5 text-xs tp-muted max-w-[90ch]">
        Demo note: there is no sign-in yet, so keep this app on your own machine. All families share the one demo wallet whose keys are in{' '}
        <span className="tp-mono">.env.local</span>; per-family wallets and access control come before any real launch. Status labels:{' '}
        {['paid', 'settled', 'needs_funds', 'refused'].map((s) => statusInfo(s).label).join(' · ')}.
      </p>
    </main>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <div className="bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-5 py-4 min-w-0" style={{ borderTop: `3px solid ${color}` }}>
      <div className="tp-label mb-2">{label}</div>
      <div className="tp-num text-[24px] tracking-[-0.03em] break-words">{value}</div>
      {sub && <div className="text-[12px] tp-muted mt-1">{sub}</div>}
    </div>
  );
}
