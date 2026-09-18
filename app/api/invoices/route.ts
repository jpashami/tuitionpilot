import { NextRequest, NextResponse } from 'next/server';
import { getDb, type InvoiceRow, type PaymentRow } from '@/lib/db';
import { createInvoice, createInvoiceFromSample } from '@/lib/samples';

export const runtime = 'nodejs';

const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];

export async function GET() {
  const db = getDb();
  const invoices = db
    .prepare("SELECT i.* FROM invoices i JOIN students s ON s.id = i.student_id WHERE s.status = 'active' ORDER BY i.created_at DESC, i.rowid DESC")
    .all() as InvoiceRow[];
  const payments = db.prepare('SELECT * FROM payments').all() as PaymentRow[];
  return NextResponse.json({
    invoices: invoices.map(({ source_path, ...inv }) => ({
      ...inv,
      payment: payments.find((p) => p.invoice_id === inv.id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      const { sample, studentId } = await req.json();
      return NextResponse.json({ id: createInvoiceFromSample(String(sample), studentId ? String(studentId) : undefined) });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: `Unsupported type ${file.type}` }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (10 MB max)' }, { status: 400 });
    const studentId = form.get('studentId');
    const id = createInvoice({ name: file.name, mediaType: file.type, data: Buffer.from(await file.arrayBuffer()), studentId: studentId ? String(studentId) : undefined });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
