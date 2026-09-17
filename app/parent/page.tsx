'use client';

import { useEffect, useState } from 'react';
import { Button, Card, StatusBadge, VerifiedIcon, money } from '@/components/ui';

interface Wallet {
  address: string | null;
  merchantConfigured: boolean;
  agentConfigured: boolean;
  paymentsEnabled: boolean;
  demoScale: number;
  balance: { leftSats: number; totalSats: number; lockedSats: number } | null;
  error: string | null;
}

interface Mandate {
  approved_payee_name: string;
  approved_payee_merchant_id: string;
  currency: string;
  max_per_term: number;
  pay_window_days: number;
  autopay: number;
}

interface Student {
  name: string;
  university: string;
  student_number: string;
  parent_name: string;
}

interface InvoiceSummary {
  id: string;
  term: string | null;
  source_name: string;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  status: string;
  decision: string | null;
  payment: { status: string; pay_amount: number; amount_sats: number | null; gobtc_payment_id: string | null } | null;
}

export default function ParentPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [form, setForm] = useState({ max_per_term: '', pay_window_days: '', autopay: true });
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/wallet').then((r) => r.json()).then(setWallet);
    fetch('/api/invoices').then((r) => r.json()).then((j) => setInvoices(j.invoices ?? []));
    fetch('/api/mandate')
      .then((r) => r.json())
      .then((j) => {
        setStudent(j.student);
        setMandate(j.mandate);
        setForm({ max_per_term: String(j.mandate.max_per_term), pay_window_days: String(j.mandate.pay_window_days), autopay: j.mandate.autopay === 1 });
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(null);
    const r = await fetch('/api/mandate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) return setSaved({ ok: false, text: j.error });
    setMandate(j.mandate);
    setSaved({ ok: true, text: 'Rules saved. They apply to the next invoice the agent checks.' });
  }

  const committed = invoices
    .filter((i) => ['paid', 'settled'].includes(i.payment?.status ?? ''))
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);

  return (
    <main className="tp-wrap py-7 flex flex-wrap gap-[22px] items-start">
      <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-[18px]">
        <Card accent size="lg">
          <div className="tp-eyebrow">Family</div>
          <h1 className="tp-h1 text-[26px] mt-2.5 mb-0.5">{student?.parent_name ?? '…'}</h1>
          <p className="tp-muted text-[14.5px] mb-5">Paying for {student?.name ?? '…'}</p>
          <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <div>
              <dt className="tp-label mb-1">University</dt>
              <dd className="font-semibold text-[var(--text-strong)]">{student?.university ?? '…'}</dd>
            </div>
            <div>
              <dt className="tp-label mb-1">Student number</dt>
              <dd className="tp-mono text-sm text-[var(--navy-900)]">{student?.student_number ?? '…'}</dd>
            </div>
            <div>
              <dt className="tp-label mb-1">Committed this year</dt>
              <dd className="tp-num text-[19px]">{money(committed)}</dd>
            </div>
            <div>
              <dt className="tp-label mb-1">Invoices handled</dt>
              <dd className="tp-num text-[19px]">{invoices.length}</dd>
            </div>
          </dl>
        </Card>

        <Card size="lg" eyebrow="Mandate" title="Payment rules">
          <p className="text-[13.5px] tp-muted -mt-2 mb-5 max-w-[52ch]">
            These rules run in code on every invoice. The agent can’t talk its way past them, and an invoice can never change them.
          </p>
          {mandate && (
            <form onSubmit={save} className="flex flex-col gap-5">
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] border-l-[3px] border-l-[var(--success-500)] bg-[var(--slate-50)] px-4 py-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <VerifiedIcon />
                  <span className="tp-mono text-[11px] tracking-[.12em] uppercase text-[#12734F]">Approved payee · verified, fixed</span>
                </div>
                <div className="font-semibold text-[15px] text-[var(--text-strong)]">{mandate.approved_payee_name}</div>
                <div className="tp-mono text-xs tp-muted mt-1 break-all">{mandate.approved_payee_merchant_id}</div>
                <div className="text-[13px] tp-muted mt-2">Changing the payee takes a new verification from you — never an instruction inside an invoice.</div>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                <div className="tp-field">
                  <label htmlFor="cap">Maximum per term ({mandate.currency})</label>
                  <input
                    id="cap"
                    className="tp-input"
                    type="number"
                    min={1}
                    value={form.max_per_term}
                    onChange={(e) => setForm({ ...form, max_per_term: e.target.value })}
                  />
                  <span className="tp-hint">Across all invoices in one term</span>
                </div>
                <div className="tp-field">
                  <label htmlFor="days">Pay no earlier than (days before due)</label>
                  <input
                    id="days"
                    className="tp-input"
                    type="number"
                    min={0}
                    max={120}
                    value={form.pay_window_days}
                    onChange={(e) => setForm({ ...form, pay_window_days: e.target.value })}
                  />
                  <span className="tp-hint">Keeps money in your wallet longer</span>
                </div>
              </div>

              <label
                htmlFor="autopay"
                className={`flex items-start gap-3 rounded-[var(--radius-sm)] border bg-white px-4 py-3.5 cursor-pointer ${
                  form.autopay ? 'border-[var(--red-500)]' : 'border-[var(--border-strong)]'
                }`}
              >
                <input
                  id="autopay"
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--red-500)]"
                  checked={form.autopay}
                  onChange={(e) => setForm({ ...form, autopay: e.target.checked })}
                />
                <span>
                  <span className="block font-semibold text-[14.5px] text-[var(--text-strong)]">Let the agent pay invoices that pass every rule</span>
                  <span className="block text-[13px] tp-muted mt-0.5">
                    {form.autopay
                      ? 'Clean invoices pay themselves. Anything that fails a rule is refused and explained.'
                      : 'Off — the agent checks every invoice but refuses to pay until you turn this back on.'}
                  </span>
                </span>
              </label>

              <div className="flex items-center gap-3 flex-wrap">
                <Button type="submit" arrow>
                  Save rules
                </Button>
                {saved && (
                  <span role="status" className={`text-sm ${saved.ok ? 'text-[#12734F]' : 'text-[var(--red-600)]'}`}>
                    {saved.text}
                  </span>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>

      <div className="flex-[1_1_420px] min-w-0 flex flex-col gap-[18px]">
        <div className="tp-dark" style={{ borderTop: '3px solid var(--red-500)' }}>
          <div className="tp-eyebrow mb-3.5">Family wallet</div>
          <h2 className="tp-h2 text-[24px] !mt-0 mb-1.5">2-of-3 multisig · Bitcoin mainnet</h2>
          <p className="text-sm leading-relaxed text-[var(--navy-300)] mb-[18px] max-w-[52ch]">
            Send BTC here from any wallet or exchange. Every payment needs two signatures: the agent’s and GoBTC’s co-signature, which
            GoBTC only gives for a real payment request. A third recovery key protects the funds. Bitcoin’s price moves, so top up shortly before a due date rather than months ahead.
          </p>
          <div className="rounded-[var(--radius-sm)] bg-[var(--navy-950)] border border-[var(--navy-700)] px-4 py-3 tp-mono text-[12.5px] text-white break-all leading-relaxed">
            {wallet?.address ?? '…'}
          </div>
          <dl className="grid gap-[18px] mt-[22px] pt-5 border-t border-[var(--navy-700)] [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
            <div>
              <dt className="tp-label-dark mb-1">Spendable</dt>
              <dd className="font-[family-name:var(--font-display)] text-[22px] font-bold tracking-[-0.02em]">
                {wallet?.balance ? `${wallet.balance.leftSats.toLocaleString()} sats` : wallet?.error ? 'Unavailable' : '…'}
              </dd>
            </div>
            <div>
              <dt className="tp-label-dark mb-1">Locked in pending</dt>
              <dd className="font-[family-name:var(--font-display)] text-[22px] font-bold tracking-[-0.02em]">
                {wallet?.balance ? `${wallet.balance.lockedSats.toLocaleString()} sats` : '…'}
              </dd>
            </div>
            <div>
              <dt className="tp-label-dark mb-1">Payments</dt>
              <dd className="text-sm font-semibold mt-1">{wallet ? (wallet.paymentsEnabled ? 'Live — signed and sent' : 'Dry run — stops before signing') : '…'}</dd>
            </div>
            <div>
              <dt className="tp-label-dark mb-1">Demo scale</dt>
              <dd className="text-sm font-semibold mt-1">{wallet ? `1 : ${Math.round(1 / wallet.demoScale).toLocaleString()}` : '…'}</dd>
            </div>
          </dl>
          {wallet && (!wallet.merchantConfigured || !wallet.agentConfigured) && (
            <div className="mt-4 rounded-[var(--radius-sm)] bg-[rgba(201,135,26,.15)] border border-[rgba(201,135,26,.4)] px-3.5 py-2.5 text-[13px] text-[#F3D9A6]">
              {!wallet.merchantConfigured && <p>The bursar’s GoBTC account isn’t configured (run scripts/merchant-setup.mjs).</p>}
              {!wallet.agentConfigured && <p>ANTHROPIC_API_KEY is not set, so the agent can’t run.</p>}
            </div>
          )}
        </div>

        <Card size="lg" eyebrow="Activity" title="Invoices and receipts" action={<span className="tp-count">{invoices.length} total</span>}>
          {invoices.length === 0 && <p className="text-sm tp-muted">Nothing yet.</p>}
          <div className="flex flex-col">
            {invoices.map((i) => {
              const st = i.payment?.status === 'paid' || i.payment?.status === 'settled' ? i.payment.status : i.status;
              return (
                <div key={i.id} className="flex flex-col gap-1.5 py-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="tp-num text-[19px]">{i.amount != null ? money(i.amount, i.currency ?? 'CAD') : 'Not read yet'}</span>
                      <span className="tp-mono text-xs tp-muted">
                        {i.term ?? i.source_name}
                        {i.due_date ? ` · due ${i.due_date}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={st} />
                  </div>
                  {i.decision && <p className="text-[13.5px] tp-muted m-0 max-w-[64ch]">{i.decision}</p>}
                  <div className="tp-mono text-[11px] text-[var(--text-faint)] break-all">
                    {i.reference ?? '—'}
                    {i.payment?.gobtc_payment_id ? ` · payment ${i.payment.gobtc_payment_id}` : ''}
                  </div>
                  {(st === 'paid' || st === 'settled') && (
                    <a href={`/receipt/${i.id}`} className="text-[13px] font-semibold">
                      View receipt →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </main>
  );
}
