import { NextRequest, NextResponse } from 'next/server';
import { getDb, type InvoiceRow } from '@/lib/db';
import { paymentForInvoice } from '@/lib/payments';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = Number(req.nextUrl.searchParams.get('after') ?? '0');
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const events = db
    .prepare('SELECT id, run_id, kind, title, detail, created_at FROM events WHERE invoice_id = ? AND id > ? ORDER BY id')
    .all(id, after);
  const { source_path, ...safeInvoice } = invoice;
  return NextResponse.json({ invoice: safeInvoice, payment: paymentForInvoice(id) ?? null, events });
}
