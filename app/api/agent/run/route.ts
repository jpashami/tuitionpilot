import { NextRequest, NextResponse } from 'next/server';
import { runTuitionAgent } from '@/lib/agent/tuitionAgent';

export const runtime = 'nodejs';
export const maxDuration = 300;

// One agent run per invoice at a time (the payment layer is idempotent regardless).
const running = new Set<string>();

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
  if (running.has(invoiceId)) return NextResponse.json({ error: 'Agent is already running for this invoice' }, { status: 409 });
  running.add(invoiceId);
  try {
    return NextResponse.json(await runTuitionAgent(invoiceId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    running.delete(invoiceId);
  }
}
