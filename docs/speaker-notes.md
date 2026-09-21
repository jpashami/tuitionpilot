# TuitionPilot — timed speaker notes

**Slot:** 5 minutes · **Deck:** 12 slides · **Presenter:** Jafar Pashami
**Target pace:** ~145 words per minute. The script below is 660 spoken words — about 4:35 of talking, which leaves roughly 25 seconds of slack for the agent's live runs on slide 05. Each run takes 30–40 seconds, so keep talking over them rather than waiting in silence.

Open the deck at `/deck/` and press **F** for fullscreen, or present the PDF. `?slide=N` opens a single slide at native size if you need to jump.

## Timing at a glance

| Time | Slide | Beat | Length |
|---|---|---|---|
| 0:00 | 01 · Title | Who you are, one line | 0:15 |
| 0:15 | 02 · Problem | The money can't leave | 0:40 |
| 0:55 | 03 · Value proposition | The one sentence | 0:25 |
| 1:20 | 04 · Solution | How it works | 0:30 |
| 1:50 | 05 · Demo | **Pays one, refuses two** | 1:15 |
| 3:05 | 06 · Why it's safe | AI reads, code decides | 0:25 |
| 3:30 | 07 · Competition | Where we win | 0:20 |
| 3:50 | 08 · Market | TAM / SAM / TM | 0:20 |
| 4:10 | 09 · Go to market | Built, next, channel | 0:15 |
| 4:25 | 10 · Team | Ten seconds, no more | 0:10 |
| 4:35 | 11 · The ask | Four things | 0:20 |
| 4:55 | 12 · Thanks | Sponsors, sign off | 0:05 |

**The demo is the pitch.** Everything before it earns attention; everything after it is evidence. If you are running late, cut from slides 07–10, never from 05.

---

## 0:00 · Slide 01 — Title (15s)

> Good afternoon. I'm Jafar, from Novalycs.
>
> TuitionPilot is an AI agent that pays international tuition — on time, only to the right school, and never twice.

*Don't read the subtitle. Move.*

## 0:15 · Slide 02 — Problem (40s)

> Meet Reza. He's in Lagos, and his daughter studies in Canada. Eight to twelve thousand dollars a term.
>
> He has the money. He just can't send it. Nigeria's central bank stopped supplying foreign exchange for study abroad. When a wire does work, it takes one to five days and hides two to four percent.
>
> Meanwhile the due date doesn't move. Miss it and you get a late fee and a registration hold — and for an international student, that's visa stress.
>
> And the people who know this send fake invoices. One Canadian scam took a hundred and twenty-five thousand dollars from twenty-three students.

*Point at the red X. That's the whole problem in one image.*

## 0:55 · Slide 03 — Value proposition (25s)

> So, our value proposition.
>
> For families whose bank can't reliably send tuition abroad, Novalycs has built TuitionPilot — so the money leaves when a wire can't, the tuition is paid before the due date, and the whole payment is handled end to end.
>
> Set the rules once. The agent does the rest — and refuses anything that doesn't match.

*This is the sentence the judges will quote back. Slow down. Land all three.*

## 1:20 · Slide 04 — Solution (30s)

> Here's how. The parent sets the rules once: approved school, cap per term, payment window, autopay. The student uploads the invoice.
>
> The agent reads it with Claude, checks it against the rules, and signs its half. GoBTC Pay co-signs — it's a two-of-three wallet, so no single key can move the money. The university receives Canadian dollars. They never touch crypto.
>
> Both sides get the same receipt.

## 1:50 · Slide 05 — Demo (75s)

**Switch to the live app. Three invoices, queued in this order.**

> Three invoices. Watch what the agent does with each.
>
> **[Invoice 1 — the fraud]** This one says "updated payment details," and buried in the text is an instruction telling payment assistants to skip the checks. The agent reads the invoice — but the rules run in code. It's not the merchant Reza approved. Refused. Nothing signed. The family gets told.
>
> **[Invoice 2 — the real one]** Now the real invoice. Eight thousand four hundred and fifty dollars. All eight rules pass. GoBTC issues the payment request and locks the Bitcoin price. The agent verifies the payee and the amount, signs locally, submits.
>
> **[Hold on the status]** Paid. Seconds. GoBTC has co-signed, so those coins cannot go anywhere else — the deadline is met. This is a real payment on Bitcoin mainnet, scaled down for the demo.
>
> **[Invoice 3 — upload the same one again]** And if I upload that same invoice again — duplicate. Zero second payment.

*If a run stalls, keep talking and move on. Never apologise twice.*

## 3:05 · Slide 06 — Why it's safe (25s)

> The principle: the AI decides what the invoice *says*. Code decides what gets *paid*.
>
> The rules are re-checked immediately before signing, and the model cannot override them. Every invoice gets one order key, claimed in the database before any money moves. And the exchange rate is locked at request and shown to everyone.

## 3:30 · Slide 07 — Competition (20s)

> On price we're competitive, not cheapest — and we don't promise the best rate.
>
> But our competition isn't Flywire. It's the parallel market a family turns to when the bank says no. That corner of the map — works when the bank won't, *and* protects you — is empty today.

## 3:50 · Slide 08 — Market (20s)

> Twenty-five billion dollars of tuition crosses a border into Canada every year. Our corridor — Nigeria to Canada — is a billion of that. Year one we're going after a thousand families.
>
> And the cap cut student numbers twenty-six percent, so every school is now fighting for the students who *can* pay.

## 4:10 · Slide 09 — Go to market (15s)

> It already works on mainnet. Next six months: an off-ramp partner so the school is paid in Canadian dollars directly, a stablecoin rail, and FINTRAC registration. We reach families through education agents and university international offices.

## 4:25 · Slide 10 — Team (10s)

> I built all of this — the agent, the Bitcoin signing path, and the compliance onboarding most demos skip.

## 4:35 · Slide 11 — The ask (20s)

> Four asks. An off-ramp partner who takes stablecoins and pays a Canadian bursar. One university office to pilot with. FINTRAC guidance. And ten families in Lagos paying tuition this term.
>
> Families set the rules. TuitionPilot makes sure the school gets paid — once, on time, to the right account.

## 4:55 · Slide 12 — Thanks (5s)

> Thank you to Agnic AI and GoBTC Pay. Happy to take questions.

---

## If you're over time

Cut in this order — each is self-contained:

1. Slide 09, go to market (–15s)
2. Slide 07, competition (–20s) — keep the one line "our competition is the parallel market"
3. Slide 08, market, down to the first sentence only (–12s)

## Questions to expect

**"Is this actually cheaper?"**
No, and we don't claim it. One-and-a-half to four-and-a-half percent all-in — competitive with Flywire, not better. We win where the wire fails. A family whose bank refused foreign exchange is comparing us to a late fee, not to Convera.

**"What's real and what's mocked?"**
Real: the mainnet payment, the agent's two-of-three wallet, the invoice reading, the rules, the pay-once protection. Mocked: we play the university's merchant account, amounts are scaled one to five thousand, and the conversion to Canadian dollars is simulated. It's on the demo slide.

**"What if the model is wrong about the invoice?"**
Then the rule check catches it, because the rules don't come from the invoice — they come from the parent. Payee, student, currency, cap, window. And new schools or large amounts go to human approval.

**"Prompt injection?"**
Demonstrated on stage. Invoice two has hidden text telling payment assistants to skip the checks. The agent treats invoice text as data, flags it, and refuses.

**"Isn't Bitcoin too volatile for tuition?"**
That's why the rate is locked at request for thirty minutes and the wallet is topped up just before a due date, not months ahead. And it's why the stablecoin rail is next — families in this corridor already hold USDT.

**"Are you registered with FINTRAC?"**
Not yet — we'd be a money services business, and we register before operating, or launch through a licensed partner. The client-identification flow is already built: payer verified before any transfer over a thousand dollars, records kept five years.

**"Why would a university agree?"**
They don't have to hold crypto or change anything — they receive Canadian dollars through an off-ramp partner. What they get is fewer unpaid fees and fewer registration holds on students they've already admitted.
