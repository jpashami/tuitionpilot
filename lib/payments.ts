import 'server-only';
import { externalIdFor } from './invoiceKey';
import { getDb, getMandate, logEvent, newId, type InvoiceRow, type PaymentRow } from './db';
import { checkMandate } from './mandate';
import { GoBtcError } from './gobtc/client';
import { createPayment, getPayment } from './gobtc/merchant';
import { buildPsbt, getSpendableBalance, inspectPayment, signPsbt, submitSignedPsbt } from './gobtc/instant';

/** Real mainnet submission only when explicitly enabled. Otherwise stop after building the PSBT. */
export function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === 'true';
}

/**
 * Demo amounts: a real CAD 8,450 invoice is paid at DEMO_AMOUNT_SCALE (default 1:5000 → CAD 1.69)
 * so the one-time grant covers several payments. Disclosed in the "real vs mocked" line.
 */
export function payAmountFor(invoiceAmount: number) {
  const scale = Number(process.env.DEMO_AMOUNT_SCALE ?? '0.0002');
  return Math.round(invoiceAmount * scale * 100) / 100;
}

export { externalIdFor } from './invoiceKey';

const DUST_FLOOR_SATS = 750;

export interface PayResult {
  status: string;
  payment?: PaymentRow;
  message: string;
}

function setPayment(id: string, fields: Partial<PaymentRow>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  getDb()
    .prepare(`UPDATE payments SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...fields, id });
}

function setInvoice(id: string, status: string, decision?: string) {
  getDb()
    .prepare('UPDATE invoices SET status = ?, decision = COALESCE(?, decision) WHERE id = ?')
    .run(status, decision ?? null, id);
}

export function paymentForInvoice(invoiceId: string) {
  return getDb()
    .prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(invoiceId) as PaymentRow | undefined;
}

/**
 * Pay one invoice exactly once.
 * - Re-checks the mandate (the agent's opinion is not enough).
 * - Claims the payment row atomically, so double clicks / concurrent runs can't both pay.
 * - Verifies payee + amount on the payment request and the PSBT before signing.
 * - A network error after submit leaves status "unknown": reconcile, never re-submit.
 */
export async function payInvoice(invoiceId: string, runId?: string): Promise<PayResult> {
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined;
  if (!invoice) return { status: 'error', message: 'Invoice not found.' };

  // Same invoice uploaded twice → same key. Report it as a duplicate, never pay it again.
  if (invoice.amount != null) {
    const dup = db
      .prepare('SELECT * FROM payments WHERE base_key = ? AND invoice_id != ?')
      .get(externalIdFor(invoice), invoice.id) as PaymentRow | undefined;
    if (dup) {
      setInvoice(invoice.id, 'refused', `Duplicate of an invoice already handled (payment ${dup.status}).`);
      logEvent({ runId, invoiceId, kind: 'decision', title: 'Duplicate invoice — not paying again', detail: { externalId: dup.external_id, status: dup.status } });
      return { status: 'duplicate', payment: dup, message: `Duplicate invoice: this tuition was already handled (payment ${dup.status}). Nothing was paid.` };
    }
  }

  const mandate = getMandate(invoice.student_id);
  const check = checkMandate(invoice, mandate);
  if (!check.ok) {
    setInvoice(invoice.id, 'refused', check.reasons.join(' '));
    logEvent({ runId, invoiceId, kind: 'decision', title: 'Refused by mandate — nothing was paid', detail: check });
    return { status: 'refused', message: `Refused: ${check.reasons.join(' ')}` };
  }

  const baseKey = externalIdFor(invoice);
  const payAmount = payAmountFor(invoice.amount!);

  // Idempotent plan: one row per invoice key; attempts only change after a request expired unpaid.
  db.prepare(
    `INSERT OR IGNORE INTO payments (id, invoice_id, base_key, external_id, invoice_amount, pay_amount, currency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'planned')`,
  ).run(newId('pay'), invoice.id, baseKey, `${baseKey}-a1`, invoice.amount, payAmount, invoice.currency);
  let row = db.prepare('SELECT * FROM payments WHERE base_key = ?').get(baseKey) as PaymentRow;

  // Atomic claim: only a planned (or dry-run) row can move to paying.
  const claimed = db
    .prepare(`UPDATE payments SET status = 'paying', error = NULL, updated_at = datetime('now') WHERE id = ? AND status IN ('planned','dry_run','failed')`)
    .run(row.id).changes;
  if (!claimed) {
    logEvent({ runId, invoiceId, kind: 'payment', title: `Already ${row.status} — not paying again`, detail: { externalId: row.external_id } });
    return { status: row.status, payment: row, message: `This invoice is already ${row.status}; no second payment was made.` };
  }
  setInvoice(invoice.id, 'paying');

  try {
    // A previous attempt's request may have expired (e.g. after a dry run). Only then use a new key.
    if (row.gobtc_payment_id) {
      const prev = await getPayment(row.gobtc_payment_id);
      if (prev.status === 'paid' || prev.status === 'cleared' || prev.paidAt) {
        setPayment(row.id, { status: 'paid' });
        return reconcile(invoice.id, runId);
      }
      if (['expired', 'canceled', 'failed'].includes(prev.status)) {
        const attempt = row.attempt + 1;
        setPayment(row.id, { attempt, external_id: `${baseKey}-a${attempt}`, gobtc_payment_id: null, job_id: null, amount_sats: null, fee_sats: null });
        logEvent({ runId, invoiceId, kind: 'payment', title: `Previous request ${prev.status}; starting attempt ${attempt}` });
      }
    }
    row = db.prepare('SELECT * FROM payments WHERE id = ?').get(row.id) as PaymentRow;
    const externalId = row.external_id;

    // 1. Bursar issues the payment request (idempotent on externalId).
    const req = await createPayment({ amount: payAmount, currency: invoice.currency!, externalId });
    setPayment(row.id, {
      gobtc_payment_id: req.paymentId,
      amount_sats: req.amountSats,
      rate_at_request: req.btcPriceInCurrency || null,
      request_expires_at: req.expiresAt,
    });
    logEvent({
      runId, invoiceId, kind: 'payment', title: 'Payment request issued by bursar',
      detail: { paymentId: req.paymentId, amount: req.amount, currency: req.currency, amountSats: req.amountSats, btcPrice: req.btcPriceInCurrency, rateLockedUntil: req.expiresAt, status: req.status },
    });

    if (req.status !== 'initiated') {
      // Idempotent replay of an already-touched payment: reconcile instead of paying.
      setPayment(row.id, { status: req.status === 'paid' || req.status === 'cleared' ? 'paid' : 'unknown' });
      return reconcile(invoice.id, runId);
    }

    // 2. Agent verifies what it is about to pay, from the payer's side.
    const view = await inspectPayment(req.paymentId);
    const payeeOk = view.merchantId === mandate!.approved_payee_merchant_id;
    const amountOk = Math.abs(view.amount - payAmount) < 0.005 && view.currency.toUpperCase() === invoice.currency!.toUpperCase();
    logEvent({
      runId, invoiceId, kind: 'decision', title: payeeOk && amountOk ? 'Payee and amount verified' : 'Verification failed',
      detail: { merchantId: view.merchantId, merchantName: view.merchantName, amount: view.amount, currency: view.currency, amountSats: view.amountSats },
    });
    if (!payeeOk || !amountOk) throw new Error('Payment request does not match the approved payee/amount.');
    if (view.amountSats < DUST_FLOOR_SATS) throw new Error(`Amount ${view.amountSats} sats is below the ~${DUST_FLOOR_SATS}-sat floor.`);

    // 3. Balance, then build.
    const balance = await getSpendableBalance();
    if (balance.note) logEvent({ runId, invoiceId, kind: 'payment', title: 'Balance read from the blockchain', detail: balance.note });
    if (balance.leftSats < view.amountSats + 250) {
      throw new Error(`Agent wallet needs funds: ${balance.leftSats} sats spendable, this demo payment needs about ${view.amountSats + 250} sats (${view.amountSats} + fee). Nothing was signed or sent.`);
    }
    const built = await buildPsbt(req.paymentId);
    if (built.summary.amountSats !== view.amountSats) throw new Error('PSBT amount differs from the payment request.');
    setPayment(row.id, { job_id: built.jobId, fee_sats: built.summary.feeSats });
    logEvent({
      runId, invoiceId, kind: 'payment', title: 'Transaction built (2-of-3, not yet signed)',
      detail: { amountSats: built.summary.amountSats, feeSats: built.summary.feeSats, feeRate: built.summary.feeRateSatVb, balanceSats: balance.leftSats, balanceSource: balance.source },
    });

    if (!paymentsEnabled()) {
      setPayment(row.id, { status: 'dry_run' });
      setInvoice(invoice.id, 'approved', 'Approved; dry run stopped before signing (PAYMENTS_ENABLED is off).');
      logEvent({ runId, invoiceId, kind: 'payment', title: 'Dry run — stopped before signing', detail: 'Set PAYMENTS_ENABLED=true to submit on mainnet.' });
      return { status: 'dry_run', message: 'Approved and built, but payments are disabled, so nothing was signed or sent.' };
    }

    // 4. Sign locally (key never leaves the server) and submit.
    const signed = signPsbt(built.psbtBase64);
    setPayment(row.id, { status: 'submitted' });
    let sub;
    try {
      sub = await submitSignedPsbt(req.paymentId, built.jobId, signed);
    } catch (e) {
      if (e instanceof GoBtcError && e.code === 'network_error') {
        setPayment(row.id, { status: 'unknown', error: e.message });
        logEvent({ runId, invoiceId, kind: 'error', title: 'Submit outcome unknown — will reconcile, not retry', detail: e.message });
        return reconcile(invoice.id, runId);
      }
      throw e;
    }
    setPayment(row.id, { payment_tx_id: sub.paymentTxId });
    logEvent({ runId, invoiceId, kind: 'payment', title: 'Signed and submitted', detail: sub });

    // 5. Wait briefly for "paid" (seconds).
    for (let i = 0; i < 10; i++) {
      const r = await reconcile(invoice.id, runId, { quiet: true });
      if (r.status === 'paid' || r.status === 'settled') return r;
      await new Promise((res) => setTimeout(res, 1500));
    }
    return reconcile(invoice.id, runId);
  } catch (e) {
    const message = (e as Error).message;
    const current = db.prepare('SELECT status FROM payments WHERE id = ?').get(row.id) as { status: string };
    // Never mark a submitted payment as failed on our side; it may have gone through.
    if (current.status === 'submitted' || current.status === 'unknown') {
      setPayment(row.id, { status: 'unknown', error: message });
      return reconcile(invoice.id, runId);
    }
    setPayment(row.id, { status: 'failed', error: message });
    setInvoice(invoice.id, message.startsWith('Agent wallet needs funds') ? 'needs_funds' : 'failed', message);
    logEvent({ runId, invoiceId, kind: 'error', title: 'Payment failed before signing — nothing was spent', detail: message });
    row = db.prepare('SELECT * FROM payments WHERE id = ?').get(row.id) as PaymentRow;
    return { status: 'failed', payment: row, message };
  }
}

/**
 * paid   = platform co-signed; coins can't be double-spent → tuition is committed.
 * settled = paidAt set, on-chain (≈12h) → final receipt.
 */
export async function reconcile(invoiceId: string, runId?: string, opts: { quiet?: boolean } = {}): Promise<PayResult> {
  const row = paymentForInvoice(invoiceId);
  if (!row?.gobtc_payment_id) return { status: row?.status ?? 'none', payment: row, message: 'No payment request yet.' };

  const p = await getPayment(row.gobtc_payment_id);
  let status = row.status;
  if (p.paidAt) status = 'settled';
  else if (p.status === 'paid' || p.status === 'cleared') status = 'paid';
  else if (['expired', 'canceled', 'failed'].includes(p.status) && row.status !== 'submitted') status = 'failed';

  if (status !== row.status || (p.paidAt && !row.settled_at)) {
    setPayment(row.id, {
      status,
      paid_seen_at: status === 'paid' || status === 'settled' ? (row.paid_seen_at ?? new Date().toISOString()) : row.paid_seen_at,
      settled_at: p.paidAt,
      txids: p.transactions.length ? JSON.stringify(p.transactions.map((t) => t.txid)) : row.txids,
    });
    if (status === 'paid') setInvoice(invoiceId, 'paid', 'Tuition committed: payment authorized and co-signed (settles on-chain later).');
    if (status === 'settled') setInvoice(invoiceId, 'settled', 'Tuition settled on-chain.');
    if (status === 'failed') setInvoice(invoiceId, 'failed', `Payment ${p.status}.`);
    logEvent({ runId, invoiceId, kind: 'payment', title: `Status: ${status}`, detail: { gobtc: p.status, paidAt: p.paidAt, txids: p.transactions.map((t) => t.txid) } });
  } else if (!opts.quiet && status === 'unknown') {
    logEvent({ runId, invoiceId, kind: 'payment', title: 'Still reconciling', detail: { gobtc: p.status } });
  }

  const updated = paymentForInvoice(invoiceId)!;
  const message =
    status === 'settled' ? 'Settled on-chain — final receipt available.'
    : status === 'paid' ? 'Paid: the platform co-signed, so the funds are committed to the university. On-chain settlement follows (≈12h).'
    : `Payment status: ${status} (GoBTC: ${p.status}).`;
  return { status, payment: updated, message };
}
