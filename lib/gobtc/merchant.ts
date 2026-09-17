import 'server-only';
import { gobtcPost, requireEnv, sats } from './client';

export type PaymentStatus =
  | 'initiated'
  | 'detected'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'canceled'
  | 'cleared';

export interface MerchantPayment {
  paymentId: string;
  status: PaymentStatus;
  merchantId: string;
  merchantName: string;
  externalId: string | null;
  amount: number;
  currency: string;
  amountSats: number;
  btcPriceInCurrency: number;
  expiresAt: number | null;
  version: number;
  paidAt: number | null;
  transactions: { txid: string; amountSats: number; confirmations: number | null }[];
  checkoutUrl?: string;
}

// Parse permissively: idempotent replays carry extra fields, and some fields are optional.
function toPayment(raw: any): MerchantPayment {
  return {
    paymentId: raw.paymentId,
    status: raw.status,
    merchantId: raw.merchantId,
    merchantName: raw.merchantDisplayName ?? raw.merchantName,
    externalId: raw.externalId ?? null,
    amount: Number(raw.amount),
    currency: raw.currency,
    amountSats: sats(raw.amountSats),
    btcPriceInCurrency: Number(raw.btcPriceInCurrency ?? 0),
    expiresAt: raw.expiresAt ?? null,
    version: Number(raw.version ?? 0),
    paidAt: raw.paidAt ?? null,
    transactions: (raw.transactions ?? []).map((t: any) => ({
      txid: t.txid,
      amountSats: sats(t.amountSats),
      confirmations: t.confirmations ?? null,
    })),
    checkoutUrl: raw.checkoutUrl,
  };
}

/**
 * Issue a payment request as the (demo) university bursar.
 * externalId is the idempotency key: same id + same amount returns the original payment;
 * same id + different amount throws external_id_conflict.
 */
export async function createPayment(input: {
  amount: number;
  currency: string;
  externalId: string;
  ttlSeconds?: number;
}): Promise<MerchantPayment> {
  const raw = await gobtcPost<any>(
    '/merchant/payment/create',
    input,
    requireEnv('GOBTC_SK_LIVE'),
  );
  return toPayment(raw);
}

/** Public endpoint — treat paymentId as a read token. */
export async function getPayment(paymentId: string): Promise<MerchantPayment> {
  return toPayment(await gobtcPost<any>('/merchant/payment/get', { paymentId }));
}

export async function createWebhook(url: string) {
  return gobtcPost<{ webhook: { id: string; signingSecret: string } }>(
    '/merchant/webhook/create',
    { url, scope: { type: 'merchant' }, events: ['payment.status.updated'], label: 'TuitionPilot' },
    requireEnv('GOBTC_SK_LIVE'),
  );
}
