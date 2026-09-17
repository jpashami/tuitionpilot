// Register the agent's 2-of-3 instant wallet and store its multisig address.
// Usage: node scripts/wallet-register.mjs
import { gobtc, requireEnv, updateEnv } from "./lib/env.mjs";

const env = requireEnv("GOBTC_PAYER_PUBKEY_HEX");
if (env.GOBTC_PAYER_ADDRESS) {
  console.log("Wallet already registered:", env.GOBTC_PAYER_ADDRESS);
  process.exit(0);
}

const wallet = await gobtc("/instant/wallet/register", { userPubKeyHex: env.GOBTC_PAYER_PUBKEY_HEX });
updateEnv({ GOBTC_PAYER_ADDRESS: wallet.address, GOBTC_SERVER_PUBKEY_HEX: wallet.serverPubKeyHex });
console.log("Agent multisig address (post this in the Track 2 channel for the grant):");
console.log(wallet.address);
