# TuitionPilot — timed speaker notes

**Slot:** 5 minutes · **Deck:** 12 slides · **Presenter:** Jafar Pashami
**Pace:** ~145 words per minute. The script is 642 spoken words — 4:26 of talking.

## Does 5 minutes work?

Yes, but only with **two live agent runs, not three.**

The speech fits comfortably: 4:26 against a 5:00 slot. The constraint is not talking, it is the agent's wall clock. Each run takes 30–40 seconds, and you cannot talk for the whole of it without repeating yourself.

| Demo plan | Demo takes | Whole pitch | Verdict |
|---|---|---|---|
| 3 live runs (fraud, real, over-cap) | 105–120s | **5:23** | over |
| **2 live runs** (fraud, real) | 70–80s | **4:53** | fits, ~7s spare |
| 1 live run (real only), rest pre-run | 35–40s | 4:18 | comfortable |

**Run this plan:** do the fraud invoice and the real payment live. Run the over-cap invoice and the duplicate upload *before* you present, so their results are already on screen — then point at them. Same evidence, five seconds instead of seventy.

**Checkpoint:** you should be starting the demo at **2:15**. If you reach slide 06 later than 2:30, drop to one live run — pre-run the fraud invoice before you present and show the refused result on screen.

The runs are also the only part you don't control. If one is slow, keep narrating the audit trail as events arrive; don't stop and watch.

Open the deck at `/deck/` and use fullscreen, or present the PDF. `?slide=N` opens one slide at native size.

## Timing

| Time | Slide | Beat | Length |
|---|---|---|---|
| 0:00 | 01 · Title | What it is, in one line | 0:12 |
| 0:12 | 02 · Problem | Three people, three failures | 0:45 |
| 0:57 | 03 · Value proposition | The statement | 0:23 |
| 1:20 | 04 · How it works | The path of one payment | 0:25 |
| 1:45 | 05 · Architecture | Model reads, code decides | 0:30 |
| 2:15 | 06 · Demo | **Two live runs** | 1:15 |
| 3:25 | 07 · Competition | What exists today | 0:20 |
| 3:45 | 08 · Market | TAM / SAM / TM | 0:20 |
| 4:05 | 09 · Built / next | Honest status | 0:18 |
| 4:23 | 10 · Team | Say your name, move on | 0:07 |
| 4:30 | 11 · Ask | What would help | 0:20 |
| 4:50 | 12 · Thanks | Credits, stop talking | 0:10 |

The demo is the centre. If you are behind, cut from 07–09, never from 06.

---

## 0:00 · Slide 01 — Title (12s)

> I'm Jafar, from Novalycs. This is TuitionPilot — an AI agent that pays international tuition.
>
> It reads the invoice, checks it against rules the family set, pays from its own wallet, and refuses anything that doesn't match.

## 0:12 · Slide 02 — Problem (45s)

> Paying tuition across a border fails differently for each of the three people involved.
>
> **The parent** has the money and can't send it. Nigeria's central bank stopped supplying foreign exchange for study abroad, and where a wire works it takes one to five days.
>
> **The student** can't tell what's real. "Updated payment details" looks exactly like a real invoice — one Canadian scam took a hundred and twenty-five thousand dollars from twenty-three students. And nobody can prove the school was paid.
>
> **The university** sees an unpaid balance and can't tell whether money is coming or was never sent. Its only lever is a registration hold — on a student it already admitted.

*Three cards, three voices. Let the quotes do the work.*

## 0:57 · Slide 03 — Value proposition (23s)

> So: for families whose bank can't reliably send tuition abroad, we built TuitionPilot, so that the money leaves when a wire can't, the tuition is paid before the due date, and the payment is handled end to end.
>
> For these families the alternative isn't a cheaper wire. It's no wire.

*Slow down here. Three benefits, land all three.*

## 1:20 · Slide 04 — How it works (25s)

> The parent sets the rules once: approved school, cap per term, payment window. The student uploads the invoice.
>
> The agent reads it, checks it, signs half the transaction. GoBTC Pay co-signs — two-of-three, so no single key moves the money. The university receives Canadian dollars; it never touches crypto. Both sides read the same receipt.

## 1:45 · Slide 05 — Architecture (30s)

> Here's how it's put together, because this is the part I'd want to ask about.
>
> Claude reads the invoice into fields — payee, amount, term, due date. That's all it does. It never returns a decision.
>
> The decision is a rule engine in ordinary TypeScript: eight rules, re-run immediately before anything is signed. Only if all eight pass does GoBTC issue a payment request.
>
> Underneath, an order key hashed from the invoice is claimed before paying, so one invoice can only ever produce one payment.

*This slide is why the demo is believable. Don't rush it.*

## 2:15 · Slide 06 — Demo (75s — two live runs)

**Switch to the live app. Run the fraud invoice and the real payment live. The over-cap invoice and the duplicate upload are already on screen from your pre-demo test — point at them, don't re-run them.**

> Three invoices on the slide. I'll run two of them live.
>
> **[Run 1 — the fraud]** This one says "updated payment details," and hidden in the text is an instruction telling payment assistants to skip the checks. The agent reads the invoice — but the rules run in code. It isn't the merchant the parent approved. Refused. Nothing signed.
>
> **[Run 2 — the real invoice]** Now the real one: eight thousand four hundred and fifty dollars. All eight rules pass. GoBTC issues the request and locks the Bitcoin price. The agent verifies the payee and the amount, signs locally, submits.
>
> **[Hold on the status change]** Paid. GoBTC has co-signed, so those coins can't go anywhere else — the deadline is met. This is a real payment on Bitcoin mainnet, scaled down for the demo.
>
> **[Point at the rows already on screen]** The third one is there from earlier: three thousand four hundred over the term cap, refused. And below it, the same invoice uploaded twice — one order key, no second payment.

*Narrate the audit trail while each run works. If one stalls, move on — don't watch it.*

## 3:25 · Slide 07 — Competition (20s)

> This is how families pay today. We're competitive on cost, not cheapest, and we don't promise the best rate.
>
> The route we'd actually be replacing is the bottom one — the parallel market, used when the wire fails. That's where there's no fraud protection and no receipt.

## 3:45 · Slide 08 — Market (20s)

> Twenty-five billion dollars of tuition crosses a border into Canada each year. The Nigeria corridor is about a billion of that. Year one we'd be aiming at a thousand families — and that last number is an assumption, not a forecast.

## 4:05 · Slide 09 — Built / next (18s)

> Built: a real payment on mainnet, refusals, no duplicates, the compliance onboarding.
>
> What has to be true next: a licensed off-ramp partner, a stablecoin rail, and FINTRAC registration.

## 4:23 · Slide 10 — Team (7s)

> That's me — Jafar, Novalycs. Payments engineering and AI agents.

## 4:30 · Slide 11 — Ask (20s)

> Four things would help. An off-ramp partner who takes stablecoins and can pay a Canadian bursar. One university office willing to pilot. FINTRAC guidance. And ten families in the corridor to tell us whether we've got the problem right.

## 4:50 · Slide 12 — Thanks (10s)

> Thank you to Agnic AI and to GoBTC Pay. The code and the write-up are both linked here. Happy to take questions.

---

## If you run long

Cut in this order — each is self-contained:

1. Drop to one live run on slide 06 — pre-run the fraud invoice (–35s, by far the biggest saving)
2. Slide 09 (–18s)
3. Slide 07, down to the one line about the parallel market (–14s)
4. Slide 08, down to the first sentence (–12s)

## Questions to expect

**"Is it cheaper?"**
No. One-and-a-half to four-and-a-half percent all in, which is competitive with Flywire and not better. The case isn't price, it's that these families often can't send the money at all.

**"What's real and what's mocked?"**
Real: the mainnet payment, the two-of-three wallet, the invoice reading, the rules, the pay-once protection. Mocked: we play the university's merchant account, amounts are scaled one to five thousand, and the conversion to Canadian dollars is simulated. It's on the demo slide.

**"What if the model reads the invoice wrong?"**
The rule check catches it, because the rules don't come from the invoice — they come from the parent. Payee, student, currency, cap, window. New schools and large amounts would go to human approval.

**"Prompt injection?"**
Shown on stage. Invoice one has hidden text telling payment assistants to skip the checks. Invoice text is treated as data; the agent flags it and refuses.

**"Isn't Bitcoin too volatile for tuition?"**
The rate is locked at request for thirty minutes, and the wallet is topped up just before a due date rather than months ahead. Stablecoins are the next rail — families in this corridor already hold USDT.

**"Are you registered with FINTRAC?"**
No. We'd be a money services business, so that's registration before operating, or launching through a licensed partner. The client-identification flow is already built — payer verified before any transfer over a thousand dollars, records kept five years.

**"Why would a university take this?"**
They don't hold crypto or change anything; they receive Canadian dollars through an off-ramp partner. What changes is that they can see a payment is committed instead of guessing.

**"What did you learn building it?"**
The interesting problem wasn't Bitcoin — it was deciding what the model is allowed to decide. Every safety property in this project comes from narrowing that, not from a better prompt.

## Before you present

- [ ] Add a photo at `docs/deck/assets/jafar.jpg` (square, 600px+) — otherwise slide 10 shows a "JP" monogram
- [ ] Add `docs/deck/assets/agnic.svg` and `docs/deck/assets/gobtc-pay.svg` — otherwise slides 01 and 12 show text wordmarks
- [ ] Re-export the PDF after adding either (`npm run site:build`, then print `/deck/` from the browser)
- [ ] Wallet funded, `PAYMENTS_ENABLED=true`, `npm run dev` restarted
- [ ] Demo samples created in order: "Updated payment details", then "Fall 2026 tuition"
- [ ] Run the over-cap invoice and the duplicate upload **before** presenting, so both results are already on screen
- [ ] Time one agent run on the day — if it is over 40s, switch to the one-live-run plan
