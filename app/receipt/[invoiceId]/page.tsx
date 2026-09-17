import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lockup } from '@/components/Logo';
import { StatusBadge, money } from '@/components/ui';
import PrintButton from './PrintButton';
import { getDb, getMandate, type InvoiceRow, type StudentRow } from '@/lib/db';
import { paymentForInvoice } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined;
  if (!invoice) notFound();
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(invoice.student_id) as StudentRow;
  const mandate = getMandate(invoice.student_id);
  const payment = paymentForInvoice(invoiceId);
  const cur = invoice.currency ?? 'CAD';
  const paid = payment && (payment.status === 'paid' || payment.status === 'settled');
  const txids: string[] = payment?.txids ? JSON.parse(payment.txids) : [];
  const rate = payment?.rate_at_request ?? (payment?.amount_sats ? (payment.pay_amount * 1e8) / payment.amount_sats : null);

  return (
    <main className="tp-wrap py-8 print:py-0">
      <div className="max-w-[760px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
          <Link href="/demo" className="text-sm">
            ← Back to the agent console
          </Link>
          {paid && <PrintButton />}
        </div>

        <article className="tp-card lg !p-0 overflow-hidden print:shadow-none print:border-0">
          <header className="flex items-start justify-between gap-6 flex-wrap px-8 pt-8 pb-6 border-b-[3px] border-b-[var(--red-500)]">
            <Lockup size={40} />
            <div className="text-right">
              <div className="tp-label">{paid ? 'Payment receipt' : 'Payment status'}</div>
              <div className="tp-mono text-sm text-[var(--navy-900)] mt-1">{invoice.reference ?? invoice.id}</div>
              <div className="mt-2">
                <StatusBadge status={payment?.status === 'paid' || payment?.status === 'settled' ? payment.status : invoice.status} />
              </div>
            </div>
          </header>

          {!paid ? (
            <div className="px-8 py-10">
              <h1 className="tp-h1 text-[26px] m-0">No receipt yet</h1>
              <p className="tp-muted mt-2 max-w-[56ch]">
                A receipt is issued once the payment is committed. {invoice.decision ?? 'The agent has not paid this invoice.'}
              </p>
            </div>
          ) : (
            <>
              <section className="px-8 py-7 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                <div>
                  <div className="tp-label mb-1">Paid to</div>
                  <div className="font-semibold text-[var(--text-strong)]">{mandate?.approved_payee_name ?? invoice.payee_name}</div>
                  <div className="tp-mono text-[11.5px] tp-muted break-all mt-0.5">{invoice.payee_merchant_id}</div>
                </div>
                <div>
                  <div className="tp-label mb-1">On behalf of</div>
                  <div className="font-semibold text-[var(--text-strong)]">{student.name}</div>
                  <div className="tp-mono text-[11.5px] tp-muted mt-0.5">
                    {student.student_number} · {invoice.term}
                  </div>
                  <div className="text-[13px] tp-muted mt-0.5">Funded by {student.parent_name}</div>
                </div>
              </section>

              <section className="px-8">
                <table className="w-full text-sm">
                  <tbody>
                    <Line label="Invoice total" value={money(invoice.amount, cur)} />
                    <Line label="Due date" value={invoice.due_date ?? '—'} />
                    <Line label="Paid in this demo (scaled)" value={money(payment.pay_amount, cur)} />
                    <Line label="Bitcoin sent" value={payment.amount_sats != null ? `${payment.amount_sats.toLocaleString()} sats` : '—'} />
                    <Line label="BTC price locked at request" value={rate ? money(Math.round(rate), cur) : '—'} />
                    <Line label="Network fee (paid by the family wallet)" value={payment.fee_sats != null ? `${payment.fee_sats} sats` : '—'} />
                    <Line label="Committed (GoBTC co-signed)" value={payment.paid_seen_at ? payment.paid_seen_at.replace('T', ' ').slice(0, 19) + ' UTC' : '—'} />
                    <Line
                      label="Settled on Bitcoin"
                      value={payment.settled_at ? new Date(payment.settled_at * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Pending (about 12 hours)'}
                    />
                  </tbody>
                </table>
              </section>

              <section className="px-8 py-7 grid gap-4 sm:grid-cols-2">
                <Proof label="GoBTC payment ID" value={payment.gobtc_payment_id} />
                <Proof label="Order key (one payment per invoice)" value={payment.external_id} />
                {payment.payment_tx_id && <Proof label="Payment transaction ID" value={payment.payment_tx_id} />}
                {txids.map((t) => (
                  <div key={t} className="sm:col-span-2 min-w-0">
                    <div className="tp-label mb-1">On-chain transaction</div>
                    <a href={`https://mempool.space/tx/${t}`} className="tp-mono text-[12.5px] break-all">
                      {t}
                    </a>
                  </div>
                ))}
              </section>

              <footer className="px-8 py-5 bg-[var(--slate-50)] border-t border-[var(--border-subtle)] text-xs tp-muted leading-relaxed">
                Paid by the TuitionPilot agent from a 2-of-3 family wallet on GoBTC Pay after every family rule passed. Demo: amounts are scaled down from
                the invoice; the university is a demo GoBTC merchant, and conversion to CAD is simulated.
              </footer>
            </>
          )}
        </article>
      </div>
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-[var(--border-subtle)]">
      <td className="py-2.5 pr-4 tp-muted">{label}</td>
      <td className="py-2.5 text-right tp-mono tabular-nums text-[var(--navy-900)] whitespace-nowrap">{value}</td>
    </tr>
  );
}

function Proof({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="tp-label mb-1">{label}</div>
      <div className="tp-mono text-[12.5px] text-[var(--navy-900)] break-all">{value ?? '—'}</div>
    </div>
  );
}
