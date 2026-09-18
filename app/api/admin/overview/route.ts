import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { paymentsEnabled } from '@/lib/payments';
import { cachedWalletBalance, type CachedBalance } from '@/lib/walletBalance';

export const runtime = 'nodejs';

interface FamilyRow {
  student_id: string;
  student_name: string;
  student_number: string;
  university: string;
  parent_name: string;
  approved_payee_name: string | null;
  max_per_term: number | null;
  currency: string | null;
  autopay: number | null;
}

interface TxRow {
  invoice_id: string;
  student_id: string;
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
  txids: string | null;
  attempt: number | null;
  paid_seen_at: string | null;
  settled_at: number | null;
  payment_updated_at: string | null;
}

const COMMITTED = ['paid', 'settled'];

/** Operator view: every family, its wallet, and every invoice with its payment (if any). */
export async function GET() {
  const db = getDb();

  const families = db
    .prepare(
      `SELECT s.id AS student_id, s.name AS student_name, s.student_number, s.university, s.parent_name,
              m.approved_payee_name, m.max_per_term, m.currency, m.autopay
       FROM students s LEFT JOIN mandates m ON m.student_id = s.id AND m.active = 1
       WHERE s.status = 'active'
       ORDER BY s.name`,
    )
    .all() as FamilyRow[];

  const transactions = db
    .prepare(
      `SELECT i.id AS invoice_id, i.student_id, s.name AS student_name, i.reference, i.term, i.source_name,
              i.amount AS invoice_amount, i.currency, i.due_date, i.status AS invoice_status, i.decision,
              i.created_at AS invoice_created_at,
              p.status AS payment_status, p.pay_amount, p.amount_sats, p.fee_sats, p.rate_at_request,
              p.gobtc_payment_id, p.payment_tx_id, p.txids, p.attempt, p.paid_seen_at, p.settled_at,
              p.updated_at AS payment_updated_at
       FROM invoices i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN payments p ON p.invoice_id = i.id
       ORDER BY COALESCE(p.updated_at, i.created_at) DESC, i.rowid DESC`,
    )
    .all() as TxRow[];

  // The demo has one agent wallet (keys in .env.local); every family shares it until per-family wallets exist.
  let balance: CachedBalance | null = null;
  let balanceError: string | null = null;
  try {
    balance = await cachedWalletBalance();
  } catch (e) {
    balanceError = (e as Error).message;
  }
  const address = process.env.GOBTC_PAYER_ADDRESS ?? null;

  const familyViews = families.map((f) => {
    const mine = transactions.filter((t) => t.student_id === f.student_id);
    const committed = mine.filter((t) => COMMITTED.includes(t.payment_status ?? ''));
    return {
      ...f,
      wallet: { address, shared: true, balance, balanceError },
      invoices: mine.length,
      committedAmount: committed.reduce((s, t) => s + (t.invoice_amount ?? 0), 0),
      sentSats: committed.reduce((s, t) => s + (t.amount_sats ?? 0), 0),
      feeSats: committed.reduce((s, t) => s + (t.fee_sats ?? 0), 0),
      refused: mine.filter((t) => t.invoice_status === 'refused').length,
      lastActivity: mine[0]?.payment_updated_at ?? mine[0]?.invoice_created_at ?? null,
    };
  });

  const committed = transactions.filter((t) => COMMITTED.includes(t.payment_status ?? ''));
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    paymentsEnabled: paymentsEnabled(),
    totals: {
      families: families.length,
      invoices: transactions.length,
      committed: committed.length,
      settled: transactions.filter((t) => t.payment_status === 'settled').length,
      held: transactions.filter((t) => ['needs_funds', 'needs_review', 'approved', 'paying'].includes(t.invoice_status)).length,
      refused: transactions.filter((t) => t.invoice_status === 'refused').length,
      failed: transactions.filter((t) => t.invoice_status === 'failed').length,
      committedAmount: committed.reduce((s, t) => s + (t.invoice_amount ?? 0), 0),
      sentSats: committed.reduce((s, t) => s + (t.amount_sats ?? 0), 0),
      feeSats: committed.reduce((s, t) => s + (t.fee_sats ?? 0), 0),
      walletSats: balance?.leftSats ?? null,
    },
    families: familyViews,
    transactions: transactions.map((t) => ({ ...t, txids: t.txids ? (JSON.parse(t.txids) as string[]) : [] })),
  });
}
