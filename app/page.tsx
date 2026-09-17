import Link from 'next/link';
import { Arrow } from '@/components/ui';

const PROBLEMS = [
  { title: 'Money can’t always leave', body: 'Some banks ration or refuse foreign exchange for study abroad. Where wires work, they take days and hide a 2–4% margin.' },
  { title: 'Deadlines are unforgiving', body: 'A missed due date means late fees, a registration hold and study-permit stress.' },
  { title: 'Fraud targets families', body: 'Tuition scams against international students are on the rise in Canada, and a parent far away can’t easily tell a real invoice from a fake.' },
];

const STEPS = [
  { title: 'Student uploads the invoice', body: 'PDF, photo or text. The agent reads the amount, term, due date, reference and payee.' },
  { title: 'Family rules are checked in code', body: 'Approved payee only, a cap per term, a payment window. The agent cannot override them.' },
  { title: 'The agent pays from its own wallet', body: 'A 2-of-3 Bitcoin wallet on GoBTC Pay. It verifies the request, signs its half, and GoBTC co-signs.' },
  { title: 'Proof in seconds, CAD for the school', body: 'Committed as soon as GoBTC co-signs. Settlement on Bitcoin follows, and the school converts to CAD at a rate everyone can see.' },
];

export default function Home() {
  return (
    <main>
      <section className="bg-[var(--navy-950)] text-white border-b-[3px] border-b-[var(--red-500)]">
        <div className="tp-wrap pt-12 pb-16">
          <div className="max-w-[760px]">
            <div className="tp-eyebrow !text-[var(--red-400)] mb-4">Agentic Commerce Pioneers · Track 2 · GoBTC Pay</div>
            <h1 className="font-[family-name:var(--font-display)] font-bold tracking-[-0.035em] leading-[1.02] text-[clamp(40px,6vw,64px)] text-balance m-0">
              Tuition that pays itself — on time, to the right school, never twice.
            </h1>
            <p className="text-[19px] leading-relaxed text-[var(--navy-300)] mt-5 max-w-[58ch]">
              TuitionPilot is an AI agent for families whose bank can’t reliably get tuition to a Canadian school. It reads the fee invoice, checks it
              against the parent’s rules, and pays from its own wallet — refusing anything that doesn’t match. The school receives CAD.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/demo" className="tp-btn primary">
                Open the agent console
                <Arrow />
              </Link>
              <Link href="/parent" className="tp-btn ondark">
                Parent view
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="tp-wrap py-14">
        <div className="tp-eyebrow">The problem</div>
        <div className="grid gap-3.5 mt-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="tp-card accent">
              <div className="font-semibold text-[15px] text-[var(--text-strong)] mb-1.5">{p.title}</div>
              <p className="text-[14.5px] tp-muted m-0">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="tp-eyebrow mt-14">How it works</div>
        <h2 className="tp-h1 text-[32px] mt-3 mb-6">Four steps, one agent, no second payment.</h2>
        <ol className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="tp-card">
              <div className="tp-mono text-xs tracking-[.14em] text-[var(--red-500)] mb-3">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="font-semibold text-[var(--text-strong)] mb-1">{s.title}</h3>
              <p className="text-sm tp-muted m-0">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-14 text-xs tp-muted max-w-[80ch]">
          Not a cheaper wire, and not a promise of the best exchange rate: TuitionPilot is about access, guardrails and proof. Demo: payments are real Bitcoin
          mainnet transactions on GoBTC Pay’s instant rail, scaled down from the invoice amount. The “university” is our own GoBTC merchant account;
          conversion to CAD is simulated. Production would add a stablecoin rail, which is what families in our first corridor already use.
        </p>
      </section>
    </main>
  );
}
