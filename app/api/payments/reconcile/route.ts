import { NextRequest, NextResponse } from 'next/server';
import { reconcile } from '@/lib/payments';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json();
  try {
    return NextResponse.json(await reconcile(String(invoiceId)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
