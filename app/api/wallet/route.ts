import { NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/payments';
import { cachedWalletBalance, type CachedBalance } from '@/lib/walletBalance';

export const runtime = 'nodejs';

export async function GET() {
  const status = {
    address: process.env.GOBTC_PAYER_ADDRESS ?? null,
    merchantConfigured: !!process.env.GOBTC_SK_LIVE && !!process.env.GOBTC_MERCHANT_ID,
    agentConfigured: !!process.env.ANTHROPIC_API_KEY,
    paymentsEnabled: paymentsEnabled(),
    demoScale: Number(process.env.DEMO_AMOUNT_SCALE ?? '0.0002'),
    balance: null as null | CachedBalance,
    error: null as string | null,
  };
  try {
    status.balance = await cachedWalletBalance();
  } catch (e) {
    status.error = (e as Error).message;
  }
  return NextResponse.json(status);
}
