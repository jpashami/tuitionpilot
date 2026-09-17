import { NextResponse } from 'next/server';
import { getBalance } from '@/lib/gobtc/instant';
import { paymentsEnabled } from '@/lib/payments';

export const runtime = 'nodejs';

// GoBTC balance calls can take many seconds; keep one fresh-enough answer for all viewers.
let cached: { at: number; balance: { leftSats: number; totalSats: number; lockedSats: number } } | null = null;
const TTL_MS = 30_000;

export async function GET() {
  const status = {
    address: process.env.GOBTC_PAYER_ADDRESS ?? null,
    merchantConfigured: !!process.env.GOBTC_SK_LIVE && !!process.env.GOBTC_MERCHANT_ID,
    agentConfigured: !!process.env.ANTHROPIC_API_KEY,
    paymentsEnabled: paymentsEnabled(),
    demoScale: Number(process.env.DEMO_AMOUNT_SCALE ?? '0.0002'),
    balance: null as null | { leftSats: number; totalSats: number; lockedSats: number },
    error: null as string | null,
  };
  try {
    if (!cached || Date.now() - cached.at > TTL_MS) {
      const b = await getBalance();
      cached = { at: Date.now(), balance: { leftSats: b.leftSats, totalSats: b.totalSats, lockedSats: b.lockedSats } };
    }
    status.balance = cached.balance;
  } catch (e) {
    status.error = (e as Error).message;
  }
  return NextResponse.json(status);
}
