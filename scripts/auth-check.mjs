// Challenge-response login for the instant wallet, then print the spendable balance.
// Usage: node scripts/auth-check.mjs
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils.js";
import { gobtc, requireEnv } from "./lib/env.mjs";

const env = requireEnv("GOBTC_PAYER_PRIVKEY_HEX", "GOBTC_PAYER_PUBKEY_HEX");
const privateKey = hexToBytes(env.GOBTC_PAYER_PRIVKEY_HEX);

function varint(n) {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, n >> 8);
  throw new Error("message too long");
}

function bitcoinMessageHash(message) {
  const prefix = utf8ToBytes("\x18Bitcoin Signed Message:\n");
  const msg = utf8ToBytes(message);
  return sha256(sha256(concatBytes(prefix, varint(msg.length), msg)));
}

const challenge = await gobtc("/instant/auth/get-data-to-sign", { userPubKeyHex: env.GOBTC_PAYER_PUBKEY_HEX });
// prehash: false — the digest is already hashed; the server verifies the raw digest.
const sig = secp256k1.sign(bitcoinMessageHash(challenge.messageToSign), privateKey, { prehash: false });
const auth = await gobtc("/instant/auth/get-jwt", { challengeId: challenge.challengeId, signature: bytesToHex(sig) });

const fields = Object.keys(auth).join(", ");
console.log("JWT OK. Response fields:", fields);
const accessToken = auth.accessToken ?? auth.tokens?.accessToken;
if (!accessToken) process.exit(0);

const balances = await gobtc("/instant/wallet/get-balances", {}, accessToken);
console.log("Balances (strings; spendable = leftBalance):", JSON.stringify(balances));
