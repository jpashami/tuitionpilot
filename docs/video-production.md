# Making the demo video with AI

The goal: a 3:50 video without you recording your voice or editing a timeline by hand.

**Two things AI cannot do for you, and one of them is small:**

1. **The demo footage has to be real.** The submission asks to see the agent completing a purchase with proof. That screen capture has to come from your machine, because the funded wallet, the signing key and `ANTHROPIC_API_KEY` live there. Budget ~3 minutes: open `/demo`, run two invoices, hit stop. No talking, no retakes — the voiceover is separate.
2. **Someone has to paste the script into a voice tool.** About two minutes of clicking.

Everything else — script, timing, slides, assembly — is already done or scripted below.

---

## Step 1 · Narration, by AI voice

Paste each segment below into a text-to-speech tool and download the audio. Keep the files named `01.mp3` … `10.mp3`.

**Which tool:**

| Tool | Why | Cost |
|---|---|---|
| **ElevenLabs** | Best quality by a distance. Use a "narration" preset voice; set stability ~50%, speed ~0.95. | Free tier covers 10 min/month — enough |
| **OpenAI TTS** (`tts-1-hd`, voice `onyx` or `nova`) | Good, and scriptable via API if you'd rather loop over the segments | Fractions of a cent |
| **Descript** | Generates the voice *and* edits the video in one place — see step 4 | Free tier |

Generate each segment separately, not as one block. Separate files let you nudge one segment's timing without regenerating everything, and they line up with the slide cuts.

**If a segment runs long**, cut words rather than speeding up the audio — sped-up TTS sounds synthetic in a way normal TTS does not.

---

## The segments

Word counts are the budget at ~145 wpm. Segments 6–9 play over your demo capture.

### 01 · Open — 20s · 44 words
> I'm Jafar, from Novalycs. TuitionPilot is an AI agent that pays international tuition. It reads the invoice, checks it against rules the family set, pays from its own wallet, and refuses anything that doesn't match.

### 02 · Problem — 35s · 92 words
> Paying tuition across a border fails differently for the three people involved. The parent has the money and can't send it — Nigeria's central bank stopped supplying foreign exchange for study abroad. The student can't tell what's real: "updated payment details" looks exactly like a genuine invoice, and one Canadian scam took a hundred and twenty-five thousand dollars from twenty-three students. And the university just sees an unpaid balance. It can't tell whether money is coming, so it places a registration hold on a student it already admitted.

### 03 · What we built — 20s · 44 words
> So: for families whose bank can't reliably send tuition abroad, we built TuitionPilot — so the money leaves when a wire can't, the tuition is paid before the due date, and the payment is handled end to end.

### 04 · The flow — 20s · 52 words
> The parent sets the rules once — approved school, cap per term, payment window. The student uploads the invoice. The agent signs half the transaction, GoBTC Pay co-signs the other half, and the university receives Canadian dollars. It never touches crypto.

### 05 · Architecture — 30s · 70 words
> Here's the part that matters. Claude reads the invoice into fields — payee, amount, term, due date. That's all it does; it never returns a decision. The decision is a rule engine in ordinary TypeScript. Eight rules, re-run immediately before anything is signed. Only if all eight pass does a payment request get issued.

### 06 · Fraud refused — 25s · 62 words · over demo
> Leila's invoice says "updated payment details", and hidden in the text is an instruction telling payment assistants to skip the checks. The agent reads it — but the rules run in code. The payee isn't the one her father approved, so it's refused. Nothing is signed. And the agent flags the hidden instruction rather than following it.

### 07 · The real invoice — 40s · 95 words · over demo
> Now the real invoice — eight thousand four hundred and fifty dollars. All eight rules pass. The bursar issues a payment request in Canadian dollars and GoBTC locks the Bitcoin price. The agent checks the payee and amount from the payer's side, signs its half locally, and submits. Seconds later: paid. GoBTC has co-signed, so these coins can't be spent anywhere else. The deadline is met.

### 08 · Proof — 15s · 47 words · over demo
> The family and the school get the same receipt — payment ID, locked rate, network fee, timestamps. "Paid" takes seconds; final settlement on Bitcoin takes about twelve hours. Here's yesterday's payment, confirmed on-chain.

### 09 · Never twice — 10s · 27 words · over demo
> Double-click, retry, or upload the same invoice again — the order key is the same, so there's never a second payment.

### 10 · Close — 15s · 40 words
> TuitionPilot isn't a cheaper wire. It's a payment that goes through when a wire can't, guardrails the model can't talk its way past, and proof both sides can read. Thanks to Agnic AI and to GoBTC Pay.

---

## Step 2 · Capture the demo

The only recording you do. Roughly three minutes.

1. Wallet funded, `PAYMENTS_ENABLED=true`, `npm run dev` restarted.
2. **The night before:** pay one valid invoice and leave it, so you can show a *settled* payment with a real on-chain transaction.
3. In `/demo`, create samples in this order: "Updated payment details", then "Fall 2026 tuition".
4. Record the browser window at 1920×1080 — QuickTime (macOS), Game Bar (Windows) or OBS. Notifications off.
5. Run the fraud invoice, then the real one, then re-upload the real one for the duplicate refusal. Then visit the receipt, `/bursar`, and last night's settled transaction on mempool.space.
6. Save as `demo.mp4`. Don't trim it — the script below handles that.

---

## Step 3 · Assemble

The 12 slide frames are in `docs/deck/frames/`, already rendered at 1920×1080.

```bash
scripts/assemble-video.sh narration/ demo.mp4 tuitionpilot-demo.mp4
```

It builds the slide segments, drops your demo capture into the 2:05–3:35 window, lays the narration over the whole thing and writes one MP4. It needs a normal `ffmpeg` (`brew install ffmpeg` / `apt install ffmpeg`) — the one bundled with Playwright is stripped down and won't work.

If your demo capture is longer than the 90-second window, the script speeds the waiting stretches to fit and tells you by how much. If it's much longer than 90s, re-record rather than letting it speed up past ~2×.

---

## Step 4 · If you'd rather not touch a terminal

**Descript** does the whole of steps 1, 3 and 4 in a browser:

1. New project → drag in the 12 PNGs from `docs/deck/frames/` and your `demo.mp4`.
2. Paste the script into the script panel and pick an AI voice — it generates the narration and lays it against the timeline.
3. Drag the slide boundaries to the timings in the table above.
4. Export 1080p MP4.

**CapCut** works the same way and is free, with an AI-voice option under Text-to-speech.

**An AI avatar** (HeyGen, Synthesia) can present the non-demo segments as a person on camera. Worth knowing before you spend time on it: judges scoring "pitching" usually respond better to a real founder's voice over slides than to a synthetic presenter, and a synthetic one reads as a choice you made rather than a constraint. An AI *voice* over slides doesn't carry that signal — nobody expects a face in a screen-recorded demo.

---

## What to check before submitting

- [ ] Total length inside the limit — **confirm whether it's 3:00 or 5:00**, the two differ by a whole section
- [ ] The moment the status flips to "paid" is at normal speed, not sped up
- [ ] The settled on-chain transaction is visible
- [ ] The real-versus-mocked disclosure is on screen at the end
- [ ] Audio doesn't clip; no long silences between segments
- [ ] Uploaded unlisted, link in the submission and in the README
