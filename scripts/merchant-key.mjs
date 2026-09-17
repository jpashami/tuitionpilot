// Generate the merchant (demo university bursar) HD wallet and store it in .env.local.
// Usage: node scripts/merchant-key.mjs   (refuses to overwrite an existing key)
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { readEnv, updateEnv } from "./lib/env.mjs";

if (readEnv().GOBTC_MERCHANT_XPUB) {
  console.log("Merchant key already exists in .env.local — not overwriting.");
  process.exit(0);
}

const mnemonic = generateMnemonic(wordlist, 128);
const master = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
const account = master.derive("m/84'/0'/0'");

updateEnv({
  GOBTC_MERCHANT_MNEMONIC: `"${mnemonic}"`,
  GOBTC_MERCHANT_XPUB: account.publicExtendedKey, // xpub (ypub/zpub are rejected)
  GOBTC_MERCHANT_FINGERPRINT: master.fingerprint.toString(16).padStart(8, "0"),
});

console.log("Merchant key saved to .env.local (xpub prefix:", account.publicExtendedKey.slice(0, 4) + ").");
console.log("Back up GOBTC_MERCHANT_MNEMONIC somewhere safe — it controls the merchant's received BTC.");
