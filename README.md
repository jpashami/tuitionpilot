<p><img src="public/brand/tuitionpilot-lockup.svg" alt="TuitionPilot — A Novalycs product" width="360"></p>

# TuitionPilot

An AI agent that pays international students' university tuition on time and refuses fraud, within limits the family sets. It pays from its own wallet through [GoBTC Pay](https://gobtcpay.com); the school receives CAD.

Built by team **Novalycs** for Agentic Commerce Pioneers Edition II, Track 2 (Pay with Bitcoin, powered by GoBTC Pay).

| | |
|---|---|
| Website | [tuitionpilot.jpashami.workers.dev](https://tuitionpilot.jpashami.workers.dev) |
| Pitch deck (11 slides) | [online](https://tuitionpilot.jpashami.workers.dev/deck/) · [PDF](docs/deck/TuitionPilot-Novalycs-deck.pdf) |
| Product requirements | [online](https://tuitionpilot.jpashami.workers.dev/prd/) · [source](docs/prd.html) |
| Demo video script | [docs/video-script.md](docs/video-script.md) |
| Presenter | Jafar Pashami · Demo Day 21 Sep 2026, online |

## The problem

Families abroad usually pay tuition by international wire. That breaks down in three ways:
- **Access:** in some countries banks ration or refuse foreign exchange for study abroad (Nigeria's central bank stopped supplying it). Where wires do work, they take 1–5 days and hide a 2–4% margin.
- **Deadlines:** a missed due date means late fees and a hold on course registration.
- **Fraud:** tuition scams against international students are rising in Canada, and parents far away can't easily tell a real invoice from a fake one.

TuitionPilot is **not** pitched as cheaper than specialist FX providers, and it doesn't promise the best exchange rate. It offers access where wires fail, guardrails an AI can't talk its way past, and proof both sides can read. The school receives CAD; Bitcoin (GoBTC Pay, for this track) is only the rail in between, and production would add stablecoins, which families in our first corridor (Nigeria → Canada) already hold.

## What the agent does

1. **Reads the invoice.** The student uploads it as a PDF, photo or text file. Claude extracts the payee, its GoBTC merchant ID, the student number, term, amount, currency, due date and reference.
2. **Checks the family's rules (the mandate) in code.** The rules are:
   - only the approved payee,
   - the correct student,
   - the correct currency,
   - a cap per term that counts payments already made,
   - a payment window before the due date,
   - autopay switched on.

   The agent can't override these. `pay_invoice` runs the same check again before any money moves.
3. **Pays exactly once:**
   - The bursar issues a GoBTC payment request. Its `externalId` is a hash of the invoice content, so the same invoice always gets the same request.
   - The agent looks at the request from the payer's side and checks the payee and amount.
   - It checks its balance, then builds the transaction (a PSBT, a partially signed Bitcoin transaction) and checks the amount again.
   - It signs locally with its key in the 2-of-3 wallet and submits.
   - A database row is claimed atomically before paying, so double clicks, retries and duplicate uploads can't cause a second payment.
4. **Reports proof.** It returns the payment ID, the order key, and transaction IDs once the payment is settled.

### When is a payment "done"?

- **paid:** GoBTC has accepted the agent's signature and committed to co-signing. The coins can't move without GoBTC's key, so they can't be spent twice. TuitionPilot treats the tuition as *committed* at this point, which is enough to avoid a late fee.
- **settled:** `paidAt` is set and the transaction is on-chain. Settlement is batched and takes about 12 hours on average. The *final receipt* is issued only at this point.
- If a submit hits a network error, the payment is marked `unknown`. It is then checked against GoBTC and never submitted again blindly.

### What's real and what's mocked

- **Real:**
  - Bitcoin mainnet payments on GoBTC Pay's instant rail,
  - the agent's own 2-of-3 wallet,
  - invoice reading with Claude,
  - the mandate checks and the protection against paying twice.
- **Mocked:**
  - The university is our own GoBTC merchant account.
  - Payment amounts are scaled down from the invoice amount (`DEMO_AMOUNT_SCALE`, 1:5000 by default).
  - Converting the Bitcoin to CAD is simulated (live mempool.space price, `OFFRAMP_FEE_PCT` fee). A real payout needs a licensed off-ramp partner: GoBTC's custodial off-ramp (`/merchant/custodial/offramp/*`, which needs a verified custodial account) or an education-payments company that already accepts stablecoins.

The product write-up, including the market research behind this positioning, is in [docs/prd.html](docs/prd.html).

## Run it

```bash
git clone https://github.com/jpashami/tuitionpilot.git
cd tuitionpilot
npm install
cp env.example .env.local   # then fill in the values below
```

Requires Node.js 20 or later (developed on Node 24). If `better-sqlite3` complains about a Node version mismatch, run `npm rebuild better-sqlite3`.

1. **Keys and wallet.** Keys are generated locally; secrets are written only to `.env.local`.
   ```bash
   node scripts/merchant-key.mjs      # bursar HD wallet (xpub)
   node scripts/merchant-setup.mjs    # run this yourself: register, verify email, link xpub, create sk_live_
   node scripts/payer-key.mjs         # agent key
   node scripts/wallet-register.mjs   # agent 2-of-3 wallet address; fund it
   node scripts/auth-check.mjs        # challenge-response login and balance
   ```
2. Set `ANTHROPIC_API_KEY` in `.env.local`.
3. **Optional mainnet smoke test.** It asks for confirmation before signing.
   ```bash
   node scripts/pay-once.mjs 1.00
   ```
4. **Start the app** and open http://localhost:3000/demo:
   ```bash
   npm run dev
   ```
   Payments are a dry run until you set `PAYMENTS_ENABLED=true`. In a dry run, the agent stops after building the transaction.

To run the offline tests of the rules and the refusal and duplicate paths:

```bash
npm run test:logic
```

## Website

The public landing page is a static site in `site/`, hosted on Cloudflare as a Worker serving static assets (`cloudflare/wrangler.jsonc`). `npm run site:build` copies the deck, its PDF and the PRD from `docs/` into `site/`.

```bash
npx wrangler@4 login     # once
npm run site:deploy      # build and publish
```

## Onboarding and compliance

TuitionPilot would be a money services business in Canada, so onboarding follows FINTRAC's client-identification rules and PIPEDA:

- **Who is verified:** the *payer* (the person funding a CAD 1,000+ transfer). Accepted: passport, driver's licence, provincial ID or PR card, or two independent sources (utility bill, bank statement, CRA notice, birth certificate). A study permit is *not* photo ID; it is used only to show the student's eligibility.
- **Registration** (`/register`): payer details with third-party and PEP declarations, student details, payment rules, document upload, purpose-specific consent. A privacy access code is shown once.
- **Compliance queue** (Admin page): a reviewer accepts or rejects each document; the payer becomes *verified* by photo ID or by two accepted sources. The agent refuses to pay for a family whose payer isn't verified (rule `payer_verified`).
- **My data** (`/privacy`): with email + code, a person can see everything held, export it as JSON, withdraw optional consents, or erase. Erasure deletes contact details, document images, invoice files and transcripts immediately; identity-verification and payment records stay 5 years (FINTRAC), minimised and dated for purge.

Not built: automated document-authenticity checks, sanctions/PEP screening, and sign-in for the admin console.

## Pages

- `/demo`: choose a sample or upload an invoice, run the agent, and watch the live timeline and payment proof.
- `/parent`: the wallet address and balance, the payment rules (mandate), and receipts.
- `/bursar`: what the university sees.
- `/admin`: every family, wallet balances, the compliance queue and the full transaction history.
- `/register` and `/privacy`: onboarding and PIPEDA self-service (see above).
- `/receipt/<invoice id>`: the receipt shared by the family and the school.

The sample invoices in `samples/` are:
- a valid invoice,
- a fake "updated payment details" invoice with an instruction injected into its text,
- an invoice that goes over the term cap.

## Stack

- Next.js 16 (App Router) with Tailwind and SQLite (`better-sqlite3`)
- Claude (`claude-opus-5`) through `@anthropic-ai/sdk`, with tool use and server-side fallbacks
- GoBTC Pay API v1.2, `@noble/curves` 2.4 and `bitcoinjs-lib`

## Brand

The TuitionPilot mark (red apex over a navy delta wing) and lockup are in `public/brand/` and `docs/brand/`; the React components are in `components/Logo.tsx`. The UI follows the Novalycs design system (navy `#0A0B3B`, red `#D2102C`, Space Grotesk and IBM Plex).

## Layout

- `lib/gobtc/`: the GoBTC client (merchant API, instant-wallet login, building, signing and submitting payments)
- `lib/mandate.ts`: the rule checks, which don't use an LLM and always give the same answer
- `lib/payments.ts`: paying exactly once, and checking payment status
- `lib/agent/tuitionAgent.ts`: the Claude tool-use loop
- `app/api/*`: the HTTP routes
- `app/{demo,parent,bursar}`: the UI
- `app/receipt/[invoiceId]`: printable payment receipt
- `lib/settlement.ts`: simulated CAD conversion view
- `site/`, `cloudflare/`: the public landing page and its Cloudflare config
- `scripts/`: key generation, merchant setup, wallet registration and a mainnet smoke test
- `tests/logic.test.mts`: offline tests for the rules and pay-once paths
