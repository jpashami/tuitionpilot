# TuitionPilot — 3-minute demo video script

Target: **2:50**, unlisted YouTube or Loom. Voiceover is about 400 words (a calm 145 words per minute).
The submission rules require the video to show the agent **completing a purchase, including the proof**.

## Before you record

1. The agent wallet is funded, `PAYMENTS_ENABLED=true` is in `.env.local`, and `npm run dev` has been restarted.
2. **Saturday night:** pay one valid invoice and leave it, so Sunday's video can show a *settled* payment with a real on-chain transaction.
3. On Sunday, in `/demo`, create fresh samples in this order: "Updated payment details", then "Fall 2026 tuition". Don't run them yet.
4. Browser at 1920×1080, zoom 110%, bookmarks bar hidden, notifications off.
5. The agent takes 30–40 seconds per run. Record it live, then **speed up those stretches 3–4×** in the editor with a small "sped up" label. Never cut the moment the status changes.

---

## Script

### 0:00 – 0:15 · Hook
**Screen:** landing page (`/`).

> Families abroad pay Canadian tuition by bank wire. When their bank rations foreign currency, or a fake "updated bank details" email arrives, the student pays the price: late fees, registration holds, or money gone. TuitionPilot is an AI agent that pays tuition on time, only to the right school, and never twice.

### 0:15 – 0:40 · The parent sets the rules
**Screen:** `/parent`. Point at the approved payee box, the CAD 9,000 cap, the 21-day window, autopay and the family wallet card.

> Reza sets the rules once. Only this verified bursar can be paid. At most nine thousand dollars a term. Pay no earlier than twenty-one days before the due date. He funds a family wallet on GoBTC Pay. It's two-of-three: every payment needs the agent's signature *and* GoBTC's.

### 0:40 – 1:15 · A fraud attempt, refused
**Screen:** `/demo`. Select "Updated payment details", press **Run agent** (speed up the wait). Show the red hero, the mandate check with **Approved payee — Refused here**, then the agent's note to the family.

> Leila receives an invoice with "updated payment details", and hidden text telling payment assistants to skip the checks. The agent reads the invoice with Claude, but the rules run in code. The payee isn't the one Reza approved, so it's refused. Nothing is signed. The agent ignores the hidden instruction and flags it as a red flag for the family.

### 1:15 – 2:05 · The real invoice, paid on Bitcoin
**Screen:** select "Fall 2026 tuition", press **Run agent**. Hold on the audit trail as the events arrive: *payment request issued → payee and amount verified → transaction built → signed and submitted → Status: paid*. Then scroll to the **Payment journey** and the **CAD conversion** table.

> Now the real invoice: eight thousand four hundred and fifty dollars. All eight rules pass. The bursar issues a payment request in Canadian dollars, and GoBTC locks the Bitcoin price. The agent checks the payee and amount from the payer's side, builds the transaction, signs its half locally, and submits.
>
> Seconds later: **paid**. GoBTC has co-signed, so these coins can't be spent anywhere else. The deadline is met. For the demo we send a scaled-down amount on Bitcoin mainnet. The school converts to Canadian dollars at a rate everyone can see.

### 2:05 – 2:25 · Proof
**Screen:** click **View receipt**. Then `/bursar` (the row shows *Paid · committed*). Then Saturday's receipt showing **Settled on Bitcoin**, and click the transaction link to mempool.space.

> The family and the school get the same receipt: payment ID, locked price, network fee, and times. "Paid" takes seconds. Final settlement on Bitcoin takes about twelve hours. Here's yesterday's payment, confirmed on-chain.

### 2:25 – 2:40 · Never twice
**Screen:** back to the paid invoice. Upload the same sample again and run the agent. Show **Refused · duplicate**.

> Double click, retry, or upload the same invoice again: the order key is the same, so there's never a second payment.

### 2:40 – 2:50 · Close
**Screen:** landing page, or deck slide 6.

> TuitionPilot isn't a cheaper wire. It's access where wires fail, guardrails an AI can't talk its way past, and proof both sides can read. Families set the rules. TuitionPilot gets the school paid: once, on time, to the right account.

---

## Honest disclosure (on screen at the end, 3 seconds)

> Real: Bitcoin mainnet payments on GoBTC Pay's instant rail, the agent's 2-of-3 wallet, Claude invoice reading, code-enforced rules, pay-once protection.
> Mocked: the university is our GoBTC merchant account; amounts scaled 1 : 5,000; CAD conversion simulated.

## If the wallet isn't funded by Sunday

- Replace **1:15 – 2:25** with the valid invoice stopping at **Cleared · dry run**: every rule passed and the transaction was built, but not signed.
- Say so plainly: *"our starting balance hasn't arrived yet, so this run stops one step before signing."*
- This won't meet the "completes a purchase" requirement. Mention it in the submission's real/mocked line, and keep asking GoBTC in Discord.
