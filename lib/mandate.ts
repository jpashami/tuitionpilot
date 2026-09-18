import 'server-only';
import { getDb, type InvoiceRow, type MandateRow } from './db';
import { externalIdFor } from './invoiceKey';

export interface MandateCheck {
  ok: boolean;
  reasons: string[];
  checks: { rule: string; passed: boolean; detail: string }[];
}

/**
 * Deterministic spending rules. The agent can call this but cannot override it:
 * pay_invoice re-runs the same check before any money moves.
 */
export function checkMandate(invoice: InvoiceRow, mandate: MandateRow | undefined, now = new Date()): MandateCheck {
  const checks: MandateCheck['checks'] = [];
  const add = (rule: string, passed: boolean, detail: string) => checks.push({ rule, passed, detail });

  if (!mandate) {
    add('mandate_exists', false, 'No active mandate for this student.');
    return summarize(checks);
  }
  add('mandate_exists', true, `Mandate ${mandate.id} is active.`);

  // FINTRAC: the person requesting a virtual-currency transfer of CAD 1,000+ must be identified first.
  const payer = getDb()
    .prepare("SELECT verification_status, verification_method FROM persons WHERE student_id = ? AND role = 'payer' AND erased_at IS NULL")
    .get(invoice.student_id) as { verification_status: string; verification_method: string | null } | undefined;
  add(
    'payer_verified',
    payer?.verification_status === 'verified',
    payer?.verification_status === 'verified'
      ? `Payer identity verified (${payer.verification_method?.replace('_', ' ') ?? 'FINTRAC method'}).`
      : payer
        ? `Payer identity is ${payer.verification_status} — compliance review not complete.`
        : 'No verified payer on file for this family.',
  );

  const fieldsPresent =
    invoice.amount != null && !!invoice.currency && !!invoice.due_date && !!invoice.term && !!invoice.payee_merchant_id;
  add('invoice_complete', fieldsPresent, fieldsPresent ? 'All required invoice fields extracted.' : 'Invoice is missing amount, currency, term, due date or payee ID.');
  if (!fieldsPresent) return summarize(checks);

  add(
    'approved_payee',
    invoice.payee_merchant_id === mandate.approved_payee_merchant_id,
    invoice.payee_merchant_id === mandate.approved_payee_merchant_id
      ? `Payee is the approved ${mandate.approved_payee_name}.`
      : `Payee ID ${invoice.payee_merchant_id} is not the approved ${mandate.approved_payee_name}.`,
  );

  add(
    'currency',
    invoice.currency!.toUpperCase() === mandate.currency.toUpperCase(),
    `Invoice currency ${invoice.currency}, mandate currency ${mandate.currency}.`,
  );

  const student = getDb().prepare('SELECT student_number FROM students WHERE id = ?').get(invoice.student_id) as
    | { student_number: string }
    | undefined;
  add(
    'student_match',
    !!student && invoice.student_number === student.student_number,
    `Invoice student number ${invoice.student_number ?? '—'}, on file ${student?.student_number ?? '—'}.`,
  );

  // The same invoice content already has a payment (another upload of it): never pay it again.
  const dup = getDb()
    .prepare(
      `SELECT p.status FROM payments p WHERE p.base_key = ? AND p.invoice_id != ?
       AND p.status IN ('paying','submitted','paid','settled','unknown','dry_run')`,
    )
    .get(externalIdFor(invoice), invoice.id) as { status: string } | undefined;
  add(
    'not_duplicate',
    !dup,
    dup ? `Duplicate: this invoice was already handled (payment ${dup.status}).` : 'No earlier payment for this invoice.',
  );

  const alreadyThisTerm = (
    getDb()
      .prepare(
        `SELECT COALESCE(SUM(p.invoice_amount), 0) AS total FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE i.student_id = ? AND i.term = ? AND p.invoice_id != ?
           AND p.status IN ('paying','submitted','paid','settled','unknown')`,
      )
      .get(invoice.student_id, invoice.term, invoice.id) as { total: number }
  ).total;
  const termTotal = alreadyThisTerm + invoice.amount!;
  add(
    'term_cap',
    termTotal <= mandate.max_per_term,
    `${fmt(termTotal, mandate.currency)} this term (incl. ${fmt(alreadyThisTerm, mandate.currency)} already committed) vs cap ${fmt(mandate.max_per_term, mandate.currency)}.`,
  );

  // Due at the end of the due date (server local time). Past that moment it is overdue, even by minutes.
  const due = /^\d{4}-\d{2}-\d{2}$/.test(invoice.due_date!) ? new Date(`${invoice.due_date}T23:59:59`) : new Date(NaN);
  const msToDue = due.getTime() - now.getTime();
  const daysToDue = msToDue < 0 ? -1 : Math.ceil(msToDue / 86_400_000);
  const inWindow = !Number.isNaN(msToDue) && msToDue >= 0 && daysToDue <= mandate.pay_window_days;
  add(
    'pay_window',
    inWindow,
    Number.isNaN(daysToDue)
      ? `Unreadable due date ${invoice.due_date}.`
      : daysToDue < 0
        ? `Due date ${invoice.due_date} has passed — needs a human.`
        : `Due in ${daysToDue} days; mandate pays within ${mandate.pay_window_days} days of the deadline.`,
  );

  add('autopay_enabled', mandate.autopay === 1, mandate.autopay === 1 ? 'Parent enabled autopay.' : 'Autopay is paused by the parent.');

  return summarize(checks);
}

function summarize(checks: MandateCheck['checks']): MandateCheck {
  const failed = checks.filter((c) => !c.passed);
  // Lead with the duplicate reason when present: it explains any cap failure that follows from it.
  failed.sort((a, b) => Number(b.rule === 'not_duplicate') - Number(a.rule === 'not_duplicate'));
  return { ok: failed.length === 0, reasons: failed.map((c) => c.detail), checks };
}

export function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}
