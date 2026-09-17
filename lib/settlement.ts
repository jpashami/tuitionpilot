import 'server-only';
import type { PaymentRow } from './db';

/**
 * Bursar-side conversion of received BTC to CAD.
 *
 * GoBTC's real off-ramp (/merchant/custodial/offramp/*) needs a custodial merchant account
 * (Uphold business verification, bank account, 2FA, travel rule). Our demo merchant is
 * non-custodial, so this quote is SIMULATED: live market rate + a configurable fee.
 */

const PRICE_TTL_MS = 60_000;
const cache = new Map<string, { rate: number; at: number }>();

/** Live BTC price in `currency` from mempool.space (public, no key). */
export async function liveBtcRate(currency: string): Promise<{ rate: number; source: string; at: number } | null> {
  const key = currency.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return { rate: hit.rate, source: 'mempool.space', at: hit.at };
  try {
    const res = await fetch('https://mempool.space/api/v1/prices', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const rate = Number(json[key]);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const at = Date.now();
    cache.set(key, { rate, at });
    return { rate, source: 'mempool.space', at };
  } catch {
    return null;
  }
}

export interface SettlementQuote {
  simulated: true;
  currency: string;
  amountSats: number;
  targetAmount: number; // what the university asked for (demo-scaled)
  rateLocked: number; // BTC price GoBTC used when the payment request was created
  rateLockedAt: string;
  rateNow: number;
  rateSource: string;
  rateMovePct: number;
  grossAmount: number; // sats × rateNow
  feePct: number;
  feeAmount: number;
  netAmount: number; // what lands in the university's bank account
  varianceAmount: number; // net − target
  quoteExpiresAt: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function quoteSettlement(p: PaymentRow): Promise<SettlementQuote | null> {
  if (!p.amount_sats) return null;
  const rateLocked = p.rate_at_request ?? (p.pay_amount * 1e8) / p.amount_sats;
  const live = await liveBtcRate(p.currency);
  const rateNow = live?.rate ?? rateLocked;
  const feePct = Number(process.env.OFFRAMP_FEE_PCT ?? '1');

  const grossAmount = (p.amount_sats / 1e8) * rateNow;
  const feeAmount = grossAmount * (feePct / 100);
  const netAmount = grossAmount - feeAmount;

  return {
    simulated: true,
    currency: p.currency,
    amountSats: p.amount_sats,
    targetAmount: p.pay_amount,
    rateLocked: Math.round(rateLocked),
    rateLockedAt: p.created_at,
    rateNow: Math.round(rateNow),
    rateSource: live ? live.source : 'locked rate (live price unavailable)',
    rateMovePct: round2(((rateNow - rateLocked) / rateLocked) * 100),
    grossAmount: round2(grossAmount),
    feePct,
    feeAmount: round2(feeAmount),
    netAmount: round2(netAmount),
    varianceAmount: round2(netAmount - p.pay_amount),
    quoteExpiresAt: Date.now() + 60_000,
  };
}
