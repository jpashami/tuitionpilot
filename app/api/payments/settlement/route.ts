import { NextRequest, NextResponse } from 'next/server';
import { paymentForInvoice } from '@/lib/payments';
import { quoteSettlement } from '@/lib/settlement';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get('invoiceId');
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
  const payment = paymentForInvoice(invoiceId);
  if (!payment) return NextResponse.json({ quote: null });
  return NextResponse.json({ status: payment.status, quote: await quoteSettlement(payment) });
}
