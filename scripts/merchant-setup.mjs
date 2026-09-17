// YOU run this yourself: sets up the GoBTC Pay merchant (the demo "university bursar").
// Usage: node scripts/merchant-setup.mjs
// Steps: create account (or log in) → verify email code → link xpub → create sk_live_ key → save to .env.local.
// The password is never stored or printed.
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { gobtc, requireEnv, updateEnv } from "./lib/env.mjs";

const env = requireEnv("GOBTC_MERCHANT_XPUB", "GOBTC_MERCHANT_FINGERPRINT");
if (env.GOBTC_SK_LIVE) {
  console.log("Already done: GOBTC_SK_LIVE is set in .env.local.");
  process.exit(0);
}

// One readline for everything; password input is muted instead of using a second stdin reader.
const rl = createInterface({ input: stdin, output: stdout, terminal: true });
let muted = false;
rl._writeToOutput = (s) => {
  if (!muted) rl.output.write(s);
  else if (s.includes("\n") || s.includes("\r")) rl.output.write("\n");
};
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
async function askHidden(q) {
  stdout.write(q);
  muted = true;
  const a = await ask("");
  muted = false;
  return a;
}

try {
  const email = (await ask("Merchant email [jafar@novalycs.com]: ")) || "jafar@novalycs.com";

  console.log(`
What is the state of this GoBTC account?
  1) New — I have never registered this email       (creates it and emails a 6-digit code)
  2) Registered, and I have the 6-digit code now     (verifies it)
  3) Already registered AND verified before          (logs in with the password)`);
  const choice = (await ask("Choose 1, 2 or 3 [1]: ")) || "1";

  let session;
  if (choice === "1") {
    const password = await askHidden("Choose a password (min. 12 chars, hidden): ");
    const again = await askHidden("Repeat the password: ");
    if (password !== again) throw new Error("Passwords don't match. Nothing was created — run the script again.");
    const reg = await gobtc("/merchant/auth/register", {
      email,
      password,
      displayName: "Novalycs",
      merchantName: "TuitionPilot Demo University Bursar",
    });
    console.log(`\nAccount created (status: ${reg.status}). Check ${email} for a 6-digit code — it expires in 30 minutes.`);
    session = await verify(email);
  } else if (choice === "2") {
    session = await verify(email);
  } else if (choice === "3") {
    const password = await askHidden("Password (hidden): ");
    const login = await gobtc("/merchant/auth/login", { email, password });
    if (login.mfaToken) throw new Error("This account has 2FA enabled; this script doesn't handle 2FA.");
    session = login;
  } else {
    throw new Error("Please choose 1, 2 or 3.");
  }

  // The access token lives 10 minutes — do the rest immediately.
  const token = session.tokens.accessToken;
  const membership = session.memberships?.find((m) => m.status === "active") ?? session.memberships?.[0];
  const merchantId = session.activeMerchantId ?? membership?.merchantId;
  if (!merchantId) throw new Error("No merchant found on this account.");
  console.log(`Signed in. Merchant: ${membership?.merchantName ?? ""} (${merchantId})`);
  updateEnv({ GOBTC_MERCHANT_ID: merchantId });

  const me = await gobtc("/merchant/auth/me", {}, token);
  if (me.walletLinked) {
    console.log(`Wallet already linked (${me.walletAddress ?? "address hidden"}) — skipping.`);
  } else {
    await gobtc(
      "/merchant/auth/xpub/link-authorized",
      {
        xpub: env.GOBTC_MERCHANT_XPUB,
        derivationPath: "m/84'/0'/0'",
        masterFingerprint: env.GOBTC_MERCHANT_FINGERPRINT,
        label: "TuitionPilot merchant wallet",
      },
      token,
    );
    console.log("Wallet (xpub) linked.");
  }

  // Never send storeId: a store-scoped key can't create payments or manage webhooks.
  const key = await gobtc("/merchant/api-key/create", { label: "TuitionPilot agent key", type: "secret" }, token);
  updateEnv({ GOBTC_SK_LIVE: key.apiKey.secret });
  console.log(`API key ${key.apiKey.prefix}… saved to .env.local (GoBTC shows it only once).`);
  console.log("\nDone. Restart the app (npm run dev) so it picks up the new values.");
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  if (/already|exists|conflict/i.test(e.message)) {
    console.error("This email seems to be registered already — run again and choose 2 (have the code) or 3 (already verified).");
  }
  process.exitCode = 1;
} finally {
  rl.close();
}

async function verify(email) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const code = (await ask("6-digit code from the email: ")).replace(/\s+/g, "");
    try {
      return await gobtc("/merchant/auth/verify-email", { email, code });
    } catch (e) {
      console.error(`  Code not accepted: ${e.message}`);
      if (attempt === 3) throw new Error("Verification failed 3 times. If the code expired, register again with option 1 later or contact GoBTC in Discord.");
    }
  }
}
