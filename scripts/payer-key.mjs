// Generate the agent's payer key (separate from the merchant key) and store it in .env.local.
// Usage: node scripts/payer-key.mjs   (refuses to overwrite an existing key)
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { readEnv, updateEnv } from "./lib/env.mjs";

if (readEnv().GOBTC_PAYER_PRIVKEY_HEX) {
  console.log("Payer key already exists in .env.local — not overwriting.");
  process.exit(0);
}

const privateKey = secp256k1.utils.randomSecretKey();
const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed

updateEnv({
  GOBTC_PAYER_PRIVKEY_HEX: bytesToHex(privateKey),
  GOBTC_PAYER_PUBKEY_HEX: bytesToHex(publicKey),
});
console.log("Payer key saved to .env.local. Public key:", bytesToHex(publicKey));
console.log("Back up GOBTC_PAYER_PRIVKEY_HEX — it is one of the keys on the agent's 2-of-3 wallet.");
