# TuitionPilot — demo video script

**Target: 3:50.** Room to land between 3:00 and 5:00. Voiceover is ~520 words at a calm 145 wpm, plus the demo's on-screen time.

The submission requires the video to show the agent **completing a purchase, including the proof**. That happens at 2:05–2:50 and is the one section you cannot cut.

Unlike the live pitch, this is edited — so all three invoices get run, and the waiting gets cut out.

---

## How to record it

**What you need.** A screen recorder, a quiet room and a microphone that isn't your laptop's built-in one if you can help it. Wired earbuds with a mic beat a laptop mic.

**Recorder — pick one:**
- **OBS Studio** (free, macOS/Windows/Linux). Most control. Set Output to 1920×1080, 30fps, and capture a *window* rather than the whole display so notifications can't appear.
- **QuickTime** (macOS, built in) — File → New Screen Recording. Simplest, no setup.
- **Xbox Game Bar** (Windows, built in) — Win+G.
- **Loom** — easiest of all, gives you a shareable link immediately, and records your face in a corner bubble if you want that.

**Editor — pick one:**
- **Descript** — best fit here. It transcribes your audio and you edit the video by deleting words. Removing "um" and tightening pauses takes minutes.
- **DaVinci Resolve** (free) or **iMovie** / **CapCut** — fine if you prefer a timeline.

**Before you hit record**
1. Wallet funded, `PAYMENTS_ENABLED=true` in `.env.local`, `npm run dev` restarted.
2. **The night before:** pay one valid invoice and leave it, so the video can show a *settled* payment with a real on-chain transaction.
3. Fresh samples created in `/demo` in this order: "Updated payment details", then "Fall 2026 tuition". Don't run them yet.
4. Browser at 1920×1080, zoom 110%, bookmarks bar hidden, notifications off, one clean window.
5. Deck open in a second window at `/deck/` in fullscreen.

**Recording approach.** Record in three takes — deck, demo, close — rather than one continuous run. A fluffed line costs you one take, not the whole video. Record the demo live at real speed, then **speed the waiting stretches 3–4× in the edit** with a small "sped up" label. Never cut or speed up the moment a status changes; that's the evidence.

**Publishing.** Unlisted YouTube or a Loom link. Put the link in the submission and in the README.

---

## Script

### 0:00 – 0:20 · Open
**Screen:** deck slide 01.

> I'm Jafar, from Novalycs. TuitionPilot is an AI agent that pays international tuition. It reads the invoice, checks it against rules the family set, pays from its own wallet, and refuses anything that doesn't match.

### 0:20 – 0:55 · The problem
**Screen:** deck slide 02. Let each of the three cards sit while you speak about it.

> Paying tuition across a border fails differently for the three people involved.
>
> The parent has the money and can't send it — Nigeria's central bank stopped supplying foreign exchange for study abroad.
>
> The student can't tell what's real. "Updated payment details" looks exactly like a genuine invoice, and one Canadian scam took a hundred and twenty-five thousand dollars from twenty-three students.
>
> And the university just sees an unpaid balance. It can't tell whether money is coming, so it places a registration hold on a student it already admitted.

### 0:55 – 1:15 · What we built
**Screen:** deck slide 03.

> So: for families whose bank can't reliably send tuition abroad, we built TuitionPilot — so the money leaves when a wire can't, the tuition is paid before the due date, and the payment is handled end to end.

### 1:15 – 1:35 · The flow
**Screen:** deck slide 04.

> The parent sets the rules once — approved school, cap per term, payment window. The student uploads the invoice. The agent signs half the transaction, GoBTC Pay co-signs the other half, and the university receives Canadian dollars. It never touches crypto.

### 1:35 – 2:05 · Architecture
**Screen:** deck slide 05. Hold on the red "Rule engine" box.

> Here's the part that matters. Claude reads the invoice into fields — payee, amount, term, due date. That's all it does; it never returns a decision.
>
> The decision is a rule engine in ordinary TypeScript. Eight rules, re-run immediately before anything is signed. Only if all eight pass does a payment request get issued.

### 2:05 – 2:30 · A fraud attempt, refused
**Screen:** `/demo`. Select "Updated payment details", press **Run agent**. Speed up the wait. Show the refusal, the failing rule, and the note to the family.

> Leila's invoice says "updated payment details", and hidden in the text is an instruction telling payment assistants to skip the checks.
>
> The agent reads it — but the rules run in code. The payee isn't the one her father approved, so it's refused. Nothing is signed. And the agent flags the hidden instruction rather than following it.

### 2:30 – 3:10 · The real invoice, paid
**Screen:** select "Fall 2026 tuition", **Run agent**. Hold on the audit trail as events arrive: *payment request issued → payee and amount verified → transaction built → signed and submitted → Status: paid*.

> Now the real invoice — eight thousand four hundred and fifty dollars. All eight rules pass. The bursar issues a payment request in Canadian dollars and GoBTC locks the Bitcoin price. The agent checks the payee and amount from the payer's side, signs its half locally, and submits.
>
> Seconds later: paid. GoBTC has co-signed, so these coins can't be spent anywhere else. The deadline is met.

### 3:10 – 3:25 · Proof
**Screen:** **View receipt**. Then `/bursar` showing *Paid · committed*. Then last night's receipt showing **Settled on Bitcoin**, and click through to mempool.space.

> The family and the school get the same receipt — payment ID, locked rate, network fee, timestamps. "Paid" takes seconds; final settlement on Bitcoin takes about twelve hours. Here's yesterday's payment, confirmed on-chain.

### 3:25 – 3:35 · Never twice
**Screen:** upload the same invoice again, run it. Show **Refused · duplicate**.

> Double-click, retry, or upload the same invoice again — the order key is the same, so there's never a second payment.

### 3:35 – 3:50 · Close
**Screen:** deck slide 12.

> TuitionPilot isn't a cheaper wire. It's a payment that goes through when a wire can't, guardrails the model can't talk its way past, and proof both sides can read. Thanks to Agnic AI and to GoBTC Pay.

---

## On-screen disclosure (last 3 seconds, or a caption under the demo)

> **Real:** Bitcoin mainnet payment on GoBTC Pay's instant rail · the agent's 2-of-3 wallet · invoice reading with Claude · rules enforced in code · pay-once protection.
> **Mocked:** the university is our own GoBTC merchant account · amounts scaled 1 : 5,000 · CAD conversion simulated.

Keep this in. Judges notice a demo that declares its own limits, and it costs three seconds.

---

## If you have to fit 3:00

Cut in this order:

1. Section 1:15–1:35, the flow slide (–20s) — the demo shows the same thing happening
2. Section 3:25–3:35, never twice (–10s)
3. Trim the problem section to the parent and the student (–12s)

Do not cut 2:30–3:25. That is the purchase and the proof the submission asks for.
