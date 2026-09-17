// End-to-end smoke test on MAINNET. YOU run this — it spends real (granted) BTC.
// Usage: node scripts/pay-once.mjs [amountCAD=1.00] [externalId]
// Flow: merchant creates payment → agent inspects payee → build PSBT → sign → submit → poll paid.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils.js";
import * as bitcoin from "bitcoinjs-lib";
import { createInterface } from "node:readline/promises";
import { gobtc, requireEnv } from "./lib/env.mjs";

const env = requireEnv("GOBTC_SK_LIVE", "GOBTC_MERCHANT_ID", "GOBTC_PAYER_PRIVKEY_HEX", "GOBTC_PAYER_PUBKEY_HEX");
const amount = Number(process.argv[2] ?? "1.00");
const externalId = process.argv[3] ?? `smoke-${Date.now()}`;
const key = hexToBytes(env.GOBTC_PAYER_PRIVKEY_HEX);

// --- agent login ---
const hashMsg = (m) => {
  const msg = utf8ToBytes(m);
  return sha256(sha256(concatBytes(utf8ToBytes("\x18Bitcoin Signed Message:\n"), Uint8Array.of(msg.length), msg)));
};
const ch = await gobtc("/instant/auth/get-data-to-sign", { userPubKeyHex: env.GOBTC_PAYER_PUBKEY_HEX });
const { accessToken } = await gobtc("/instant/auth/get-jwt", {
  challengeId: ch.challengeId,
  signature: bytesToHex(secp256k1.sign(hashMsg(ch.messageToSign), key, { prehash: false })),
});
const bal = await gobtc("/instant/wallet/get-balances", {}, accessToken);
console.log(`Agent spendable balance: ${bal.leftBalance} sats`);

// --- merchant issues payment (idempotent on externalId) ---
const payment = await gobtc("/merchant/payment/create", { amount, currency: "CAD", externalId }, env.GOBTC_SK_LIVE);
console.log(`Payment ${payment.paymentId}: ${payment.amount} ${payment.currency} = ${payment.amountSats} sats, status ${payment.status}`);

// --- agent verifies payee before paying ---
const view = await gobtc("/instant/transaction/get-payment", { paymentId: payment.paymentId }, accessToken);
if (view.merchantId !== env.GOBTC_MERCHANT_ID) throw new Error(`Payee mismatch: ${view.merchantId}`);
if (view.status !== "initiated") throw new Error(`Payment not payable (status ${view.status})`);

const built = await gobtc("/instant/psbt/build-transaction-to-sign-payment", { paymentId: payment.paymentId }, accessToken);
const s = built.summary;
console.log(`Built: ${s.amountSats} sats to ${s.toAddress}, fee ${s.feeSats} sats (${s.feeRateSatVb} sat/vB), change ${s.changeSats}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ok = (await rl.question("Sign and submit this mainnet payment? (yes/N): ")).trim().toLowerCase() === "yes";
rl.close();
if (!ok) {
  console.log("Not submitted. Nothing was spent.");
  process.exit(0);
}

const psbt = bitcoin.Psbt.fromBase64(built.psbtBase64);
const signer = {
  publicKey: Buffer.from(secp256k1.getPublicKey(key, true)),
  sign: (h) => Buffer.from(secp256k1.sign(h, key, { prehash: false })),
};
for (let i = 0; i < psbt.data.inputs.length; i++) psbt.signInput(i, signer); // do not finalize

const t0 = Date.now();
const sub = await gobtc(
  "/instant/transaction/pay-and-sign-pre-authorized-transaction",
  { paymentId: payment.paymentId, jobId: built.jobId, signedPsbtBase64: psbt.toBase64() },
  accessToken,
);
console.log(`Submitted: success=${sub.success} paymentTxId=${sub.paymentTxId}`);

for (let i = 0; i < 20; i++) {
  const p = await gobtc("/merchant/payment/get", { paymentId: payment.paymentId });
  console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s status=${p.status} paidAt=${p.paidAt ?? null} txs=${(p.transactions ?? []).length}`);
  if (p.status === "paid" || p.status === "cleared") break;
  await new Promise((r) => setTimeout(r, 2000));
}
console.log(`Re-run with the same externalId (${externalId}) to confirm no second payment is created.`);
