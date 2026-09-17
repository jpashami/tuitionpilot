import 'server-only';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as bitcoin from 'bitcoinjs-lib';
import { gobtcPost, GoBtcError, requireEnv, sats } from './client';

// ---------- auth (challenge-response, 10-minute JWT) ----------

const TOKEN_TTL_MS = 9 * 60 * 1000; // refresh a minute before the 10-minute expiry
let cached: { accessToken: string; refreshToken: string; obtainedAt: number } | null = null;

function privateKey(): Uint8Array {
  return hexToBytes(requireEnv('GOBTC_PAYER_PRIVKEY_HEX'));
}

function varint(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, n >> 8);
  throw new Error('message too long');
}

function bitcoinMessageHash(message: string): Uint8Array {
  const prefix = utf8ToBytes('\x18Bitcoin Signed Message:\n');
  const msg = utf8ToBytes(message);
  return sha256(sha256(concatBytes(prefix, varint(msg.length), msg)));
}

async function login() {
  const challenge = await gobtcPost<{ challengeId: string; messageToSign: string }>(
    '/instant/auth/get-data-to-sign',
    { userPubKeyHex: requireEnv('GOBTC_PAYER_PUBKEY_HEX') },
  );
  // prehash: false — the digest is already hashed; the server verifies the raw digest.
  const sig = secp256k1.sign(bitcoinMessageHash(challenge.messageToSign), privateKey(), {
    prehash: false,
  });
  const tokens = await gobtcPost<{ accessToken: string; refreshToken: string }>(
    '/instant/auth/get-jwt',
    { challengeId: challenge.challengeId, signature: bytesToHex(sig) },
  );
  cached = { ...tokens, obtainedAt: Date.now() };
}

async function refresh() {
  if (!cached) return login();
  try {
    const tokens = await gobtcPost<{ accessToken: string; refreshToken: string }>(
      '/instant/auth/refresh-jwt',
      {},
      cached.refreshToken,
    );
    cached = { ...tokens, obtainedAt: Date.now() };
  } catch {
    await login(); // re-running the challenge with the stored key is cheap
  }
}

async function token(): Promise<string> {
  if (!cached) await login();
  else if (Date.now() - cached.obtainedAt > TOKEN_TTL_MS) await refresh();
  return cached!.accessToken;
}

/** Instant call with one automatic re-auth on 401. */
async function instantPost<T>(path: string, body: unknown): Promise<T> {
  try {
    return await gobtcPost<T>(path, body, await token());
  } catch (e) {
    if (e instanceof GoBtcError && e.httpStatus === 401) {
      await login();
      return gobtcPost<T>(path, body, await token());
    }
    throw e;
  }
}

// ---------- wallet ----------

export interface WalletBalance {
  leftSats: number;
  totalSats: number;
  lockedSats: number;
  raw: Record<string, string | null>;
}

export async function getBalance(): Promise<WalletBalance> {
  const raw = await instantPost<Record<string, string | null>>('/instant/wallet/get-balances', {});
  return {
    leftSats: sats(raw.leftBalance),
    totalSats: sats(raw.totalBalance),
    lockedSats: sats(raw.lockedBalance),
    raw,
  };
}

export function walletAddress(): string {
  return requireEnv('GOBTC_PAYER_ADDRESS');
}

// ---------- paying ----------

/** Payer-side view of a payment request — used to verify the payee before paying. */
export async function inspectPayment(paymentId: string) {
  const raw = await instantPost<any>('/instant/transaction/get-payment', { paymentId });
  return {
    paymentId: raw.paymentId as string,
    status: raw.status as string,
    merchantId: raw.merchantId as string,
    merchantName: (raw.merchantDisplayName ?? raw.merchantName) as string,
    amount: Number(raw.amount),
    currency: raw.currency as string,
    amountSats: sats(raw.amountSats),
    expiresAt: (raw.expiresAt ?? null) as number | null,
  };
}

export interface BuiltPsbt {
  jobId: string;
  psbtBase64: string;
  summary: {
    toAddress: string;
    amountSats: number;
    feeSats: number;
    changeSats: number;
    feeRateSatVb: number;
  };
}

export async function buildPsbt(paymentId: string): Promise<BuiltPsbt> {
  const raw = await instantPost<any>('/instant/psbt/build-transaction-to-sign-payment', {
    paymentId,
  });
  return {
    jobId: raw.jobId,
    psbtBase64: raw.psbtBase64,
    summary: {
      toAddress: raw.summary.toAddress,
      amountSats: sats(raw.summary.amountSats),
      feeSats: sats(raw.summary.feeSats),
      changeSats: sats(raw.summary.changeSats),
      feeRateSatVb: Number(raw.summary.feeRateSatVb),
    },
  };
}

/** Sign every input with the payer key. Do NOT finalize — the platform adds the 2nd signature. */
export function signPsbt(psbtBase64: string): string {
  const key = privateKey();
  const signer = {
    publicKey: Buffer.from(secp256k1.getPublicKey(key, true)),
    sign: (hash: Buffer) => Buffer.from(secp256k1.sign(hash, key, { prehash: false })),
  };
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
  for (let i = 0; i < psbt.data.inputs.length; i++) psbt.signInput(i, signer);
  return psbt.toBase64();
}

export async function submitSignedPsbt(paymentId: string, jobId: string, signedPsbtBase64: string) {
  return instantPost<{ success: boolean; paymentTxId: string; paymentId: string }>(
    '/instant/transaction/pay-and-sign-pre-authorized-transaction',
    { paymentId, jobId, signedPsbtBase64 },
  );
}
