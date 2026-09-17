import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, i.reference, i.term, i.student_number, s.name AS student_name
       FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN students s ON s.id = i.student_id
       WHERE p.gobtc_payment_id IS NOT NULL
       ORDER BY p.updated_at DESC`,
    )
    .all() as { status: string }[];
  const refused = (db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status = 'refused'").get() as { n: number }).n;
  return NextResponse.json({
    payments: rows,
    counts: {
      issued: rows.length,
      committed: rows.filter((r) => r.status === 'paid' || r.status === 'settled').length,
      settled: rows.filter((r) => r.status === 'settled').length,
      awaiting: rows.filter((r) => !['paid', 'settled'].includes(r.status)).length,
      refusedByAgent: refused,
    },
  });
}
