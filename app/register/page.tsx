'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

interface DocType {
  id: string;
  label: string;
  purpose: 'fintrac_photo_id' | 'fintrac_source' | 'eligibility';
  fintrac: boolean;
}
interface Consent {
  id: string;
  label: string;
  required: boolean;
  text: string;
}
interface DocEntry {
  doc_type: string;
  issuer: string;
  number_last4: string;
  expires_on: string;
  file: File | null;
}

const STEPS = ['Payer', 'Student', 'Rules', 'Documents', 'Consent'];
const emptyDoc = (doc_type: string): DocEntry => ({ doc_type, issuer: '', number_last4: '', expires_on: '', file: null });

export default function RegisterPage() {
  const [meta, setMeta] = useState<{ docTypes: DocType[]; consents: Consent[] } | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ studentId: string; privacyCode: string } | null>(null);

  const [payer, setPayer] = useState({
    full_name: '', date_of_birth: '', email: '', phone: '', address_line: '', city: '', region: '', postal_code: '', country: '',
    occupation: '', third_party: 'no', third_party_detail: '', pep_declared: false,
  });
  const [selfPaying, setSelfPaying] = useState(false);
  const [student, setStudent] = useState({ name: '', university: '', student_number: '', email: '', date_of_birth: '' });
  const [mandate, setMandate] = useState({ max_per_term: '9000', pay_window_days: '21', autopay: true });
  const [payerDocs, setPayerDocs] = useState<DocEntry[]>([emptyDoc('passport'), emptyDoc('utility_bill')]);
  const [studentDocs, setStudentDocs] = useState<DocEntry[]>([emptyDoc('study_permit')]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/register').then((r) => r.json()).then((j) => {
      setMeta(j);
      setConsents(Object.fromEntries(j.consents.map((c: Consent) => [c.id, c.required])));
    });
  }, []);

  const photoIds = payerDocs.filter((d) => meta?.docTypes.find((t) => t.id === d.doc_type)?.purpose === 'fintrac_photo_id');
  const sources = payerDocs.filter((d) => meta?.docTypes.find((t) => t.id === d.doc_type)?.purpose === 'fintrac_source');
  const fintracOk = photoIds.length >= 1 || new Set(sources.map((s) => s.doc_type)).size >= 2;

  const stepValid = [
    payer.full_name.trim() && payer.date_of_birth && payer.email.includes('@') && payer.address_line.trim() && payer.country.trim(),
    (selfPaying || student.name.trim()) && student.university.trim() && student.student_number.trim(),
    Number(mandate.max_per_term) > 0 && Number(mandate.pay_window_days) >= 0,
    fintracOk && payerDocs.every((d) => d.file) && studentDocs.every((d) => d.file),
    meta?.consents.filter((c) => c.required).every((c) => consents[c.id]),
  ];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append(
        'form',
        JSON.stringify({
          payer: { ...payer, third_party: payer.third_party === 'yes' ? payer.third_party_detail || 'yes' : 'no' },
          student,
          selfPaying,
          mandate,
          payerDocs: payerDocs.map(({ file, ...d }) => d),
          studentDocs: studentDocs.map(({ file, ...d }) => d),
          consents: Object.entries(consents).filter(([, v]) => v).map(([k]) => k),
        }),
      );
      payerDocs.forEach((d, i) => d.file && fd.append(`payer_${i}`, d.file));
      studentDocs.forEach((d, i) => d.file && fd.append(`student_${i}`, d.file));
      const r = await fetch('/api/register', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDone(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="tp-wrap py-10 max-w-[760px]">
        <Card accent size="lg" eyebrow="Registered" title="Welcome to TuitionPilot">
          <p className="mb-4">
            Thank you. Your documents are with our compliance officer. The agent can pay for {student.name} once the payer’s identity is marked
            verified — you’ll see the status on the Parent page.
          </p>
          <div className="rounded-[var(--radius-md)] bg-[var(--navy-900)] text-white p-5 mb-4">
            <div className="tp-label-dark mb-1">Your privacy access code — shown once</div>
            <div className="font-[family-name:var(--font-mono)] text-[26px] tracking-[.12em]">{done.privacyCode}</div>
            <p className="text-sm text-[var(--navy-300)] mt-2 m-0">
              With your email and this code you can see, export, or erase everything we hold about your family at any time on the{' '}
              <a href="/privacy" className="text-white underline">My data</a> page. Keep it somewhere safe; we can’t show it again.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a className="tp-btn primary" href={`/parent?student=${done.studentId}`}>Open the Parent page</a>
            <a className="tp-btn outline" href={`/demo`}>Go to the agent console</a>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="tp-wrap py-8 max-w-[860px]">
      <div className="mb-6">
        <div className="tp-eyebrow">New family</div>
        <h1 className="tp-h1 text-[32px] mt-3 mb-2">Register a student</h1>
        <p className="tp-muted max-w-[68ch] m-0">
          Five short steps. We verify the <strong>payer</strong> (the person funding tuition) the way Canadian anti-money-laundering rules require,
          and record the <strong>student</strong> so invoices can be matched. Nothing is shared with the university except payment references.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 mb-6" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`tp-mono text-[11px] tracking-[.1em] uppercase px-3 py-1.5 rounded-full border ${
              i === step ? 'bg-[var(--navy-900)] text-white border-[var(--navy-900)]' : i < step ? 'bg-[var(--success-100)] text-[#12734F] border-[#BEE4D6]' : 'bg-white text-[var(--slate-500)] border-[var(--border-subtle)]'
            }`}
          >
            {i + 1} · {s}
          </li>
        ))}
      </ol>

      <Card size="lg">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 mb-1">
              <h2 className="tp-h2 !mt-0">Who is paying?</h2>
              <p className="text-[13.5px] tp-muted m-0">This person is our client under FINTRAC rules. Details must match the identity documents exactly.</p>
            </div>
            <label className="sm:col-span-2 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--slate-50)] p-3 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--red-500)]" checked={selfPaying} onChange={(e) => setSelfPaying(e.target.checked)} />
              <span>
                <span className="block font-semibold text-[var(--text-strong)]">I am the student and I’m paying my own tuition</span>
                <span className="block tp-hint">You’ll be verified as the payer. If you’re already in Canada, a Canadian driver’s licence or provincial ID works as well as a passport.</span>
              </span>
            </label>
            <Field label="Full legal name" value={payer.full_name} onChange={(v) => setPayer({ ...payer, full_name: v })} required />
            <Field label="Date of birth" type="date" value={payer.date_of_birth} onChange={(v) => setPayer({ ...payer, date_of_birth: v })} required />
            <Field label="Email" type="email" value={payer.email} onChange={(v) => setPayer({ ...payer, email: v })} required hint="Used for receipts and for your privacy access" />
            <Field label="Phone" value={payer.phone} onChange={(v) => setPayer({ ...payer, phone: v })} />
            <div className="sm:col-span-2">
              <Field label="Home address" value={payer.address_line} onChange={(v) => setPayer({ ...payer, address_line: v })} required />
            </div>
            <Field label="City" value={payer.city} onChange={(v) => setPayer({ ...payer, city: v })} />
            <Field label="Region / state" value={payer.region} onChange={(v) => setPayer({ ...payer, region: v })} />
            <Field label="Postal code" value={payer.postal_code} onChange={(v) => setPayer({ ...payer, postal_code: v })} />
            <Field label="Country" value={payer.country} onChange={(v) => setPayer({ ...payer, country: v })} required />
            <Field label="Occupation" value={payer.occupation} onChange={(v) => setPayer({ ...payer, occupation: v })} hint="Required for money services businesses" />
            <div className="tp-field">
              <label htmlFor="third_party">Are you paying on behalf of someone else?</label>
              <select id="third_party" className="tp-input" value={payer.third_party} onChange={(e) => setPayer({ ...payer, third_party: e.target.value })}>
                <option value="no">No — these are my own funds for my family</option>
                <option value="yes">Yes — a third party is providing the funds</option>
              </select>
              <span className="tp-hint">FINTRAC third-party determination</span>
            </div>
            {payer.third_party === 'yes' && (
              <div className="sm:col-span-2">
                <Field label="Who, and what is their relationship to you?" value={payer.third_party_detail} onChange={(v) => setPayer({ ...payer, third_party_detail: v })} required />
              </div>
            )}
            <label className="sm:col-span-2 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--red-500)]" checked={payer.pep_declared} onChange={(e) => setPayer({ ...payer, pep_declared: e.target.checked })} />
              <span>
                I am, or a close associate or family member of mine is, a politically exposed person or head of an international organization.
                <span className="block tp-hint">Answering yes doesn’t block registration; it adds a review step.</span>
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 mb-1">
              <h2 className="tp-h2 !mt-0">Who is the student?</h2>
              <p className="text-[13.5px] tp-muted m-0">We match every invoice against this student number, so it must be exactly as the university prints it.</p>
            </div>
            {selfPaying ? (
              <p className="sm:col-span-2 text-sm rounded-[var(--radius-sm)] bg-[var(--success-100)] text-[#12734F] p-3 m-0">
                Student: <strong>{payer.full_name}</strong> (you). We only need the school and your student number.
              </p>
            ) : (
              <>
                <Field label="Student’s full name" value={student.name} onChange={(v) => setStudent({ ...student, name: v })} required />
                <Field label="Date of birth" type="date" value={student.date_of_birth} onChange={(v) => setStudent({ ...student, date_of_birth: v })} />
              </>
            )}
            <Field label="University" value={student.university} onChange={(v) => setStudent({ ...student, university: v })} required hint="Demo: every family is pinned to our demo bursar" />
            <Field label="Student number" value={student.student_number} onChange={(v) => setStudent({ ...student, student_number: v })} required />
            {!selfPaying && (
              <Field label="Student’s email (optional)" type="email" value={student.email} onChange={(v) => setStudent({ ...student, email: v })} hint="Only used if you allow receipts to be shared" />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 mb-1">
              <h2 className="tp-h2 !mt-0">Payment rules</h2>
              <p className="text-[13.5px] tp-muted m-0">These run in code on every invoice. You can change them later on the Parent page.</p>
            </div>
            <Field label="Maximum per term (CAD)" type="number" value={mandate.max_per_term} onChange={(v) => setMandate({ ...mandate, max_per_term: v })} required />
            <Field label="Pay no earlier than (days before due)" type="number" value={mandate.pay_window_days} onChange={(v) => setMandate({ ...mandate, pay_window_days: v })} required />
            <label className="sm:col-span-2 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--red-500)]" checked={mandate.autopay} onChange={(e) => setMandate({ ...mandate, autopay: e.target.checked })} />
              <span>Let the agent pay invoices that pass every rule without asking me each time.</span>
            </label>
          </div>
        )}

        {step === 3 && meta && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="tp-h2 !mt-0">Payer’s identity documents</h2>
              <p className="text-[13.5px] tp-muted m-0 max-w-[70ch]">
                FINTRAC accepts <strong>one government photo ID</strong> (passport, driver’s licence, provincial ID, PR card — foreign passports included),
                <strong> or two independent sources</strong> such as a utility bill and a bank statement. A study permit is not photo ID.
                We recommend passport + one bill.
              </p>
              <p className={`tp-mono text-[11px] tracking-[.08em] uppercase mt-2 ${fintracOk ? 'text-[#12734F]' : 'text-[var(--red-600)]'}`}>
                {fintracOk ? '✓ FINTRAC requirement met' : '✗ Add a photo ID, or two different sources'}
              </p>
            </div>
            <DocList docs={payerDocs} setDocs={setPayerDocs} types={meta.docTypes.filter((t) => t.fintrac)} addLabel="Add another payer document" />
            <div className="tp-divider" />
            <div>
              <h2 className="tp-h2 !mt-0">{selfPaying ? 'Your eligibility documents' : 'Student’s eligibility documents'}</h2>
              <p className="text-[13.5px] tp-muted m-0 max-w-[70ch]">
                A study permit or enrolment letter shows the student is enrolled at the school we will pay. These are for eligibility, not identity.
              </p>
            </div>
            <DocList docs={studentDocs} setDocs={setStudentDocs} types={meta.docTypes.filter((t) => t.purpose === 'eligibility')} addLabel="Add another student document" />
            <p className="text-xs tp-muted m-0">
              Files: PDF, PNG, JPEG or WebP, 10 MB max. Images are deleted as soon as you ask for erasure; the review record is kept 5 years as the law requires.
            </p>
          </div>
        )}

        {step === 4 && meta && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="tp-h2 !mt-0">Consent</h2>
              <p className="text-[13.5px] tp-muted m-0 max-w-[70ch]">
                Under Canada’s privacy law (PIPEDA) we collect only what each purpose needs. You can see, export or erase your data at any time on the My data page.
              </p>
            </div>
            {meta.consents.map((c) => (
              <label key={c.id} className={`flex items-start gap-3 rounded-[var(--radius-sm)] border p-4 ${consents[c.id] ? 'border-[var(--red-500)]' : 'border-[var(--border-subtle)]'}`}>
                <input type="checkbox" className="mt-1 accent-[var(--red-500)]" checked={!!consents[c.id]} onChange={(e) => setConsents({ ...consents, [c.id]: e.target.checked })} />
                <span>
                  <span className="block font-semibold text-[var(--text-strong)]">
                    {c.label} {c.required && <span className="tp-mono text-[10.5px] text-[var(--red-600)] ml-1">REQUIRED</span>}
                  </span>
                  <span className="block text-[13.5px] tp-muted mt-1">{c.text}</span>
                </span>
              </label>
            ))}
            <p className="text-xs tp-muted m-0">
              Privacy officer: privacy@novalycs.ai · Access requests answered within 30 days · Records kept in Canada.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-[var(--radius-md)] border border-[var(--red-200)] bg-[var(--red-50)] p-3 text-sm text-[var(--red-700)]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-[var(--border-subtle)]">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button arrow onClick={() => setStep(step + 1)} disabled={!stepValid[step]}>
              Continue
            </Button>
          ) : (
            <Button arrow onClick={submit} disabled={!stepValid[step] || busy}>
              {busy ? 'Submitting…' : 'Create the family account'}
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', required, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; hint?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="tp-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="text-[var(--red-500)]"> *</span>}
      </label>
      <input id={id} className="tp-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
      {hint && <span className="tp-hint">{hint}</span>}
    </div>
  );
}

function DocList({ docs, setDocs, types, addLabel }: { docs: DocEntry[]; setDocs: (d: DocEntry[]) => void; types: DocType[]; addLabel: string }) {
  const update = (i: number, patch: Partial<DocEntry>) => setDocs(docs.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="flex flex-col gap-3">
      {docs.map((d, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--slate-50)] p-3">
          <div className="tp-field">
            <label htmlFor={`type-${i}`}>Document</label>
            <select id={`type-${i}`} className="tp-input" value={d.doc_type} onChange={(e) => update(i, { doc_type: e.target.value })}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="tp-field">
            <label htmlFor={`issuer-${i}`}>Issuer</label>
            <input id={`issuer-${i}`} className="tp-input" value={d.issuer} onChange={(e) => update(i, { issuer: e.target.value })} placeholder="e.g. Canada, Ontario" />
          </div>
          <div className="tp-field">
            <label htmlFor={`last4-${i}`}>Number (last 4)</label>
            <input id={`last4-${i}`} className="tp-input" maxLength={4} value={d.number_last4} onChange={(e) => update(i, { number_last4: e.target.value })} />
          </div>
          <div className="tp-field">
            <label htmlFor={`exp-${i}`}>Expires</label>
            <input id={`exp-${i}`} className="tp-input" type="date" value={d.expires_on} onChange={(e) => update(i, { expires_on: e.target.value })} />
          </div>
          <div className="sm:col-span-4 flex items-center gap-3 flex-wrap">
            <input id={`file-${i}`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => update(i, { file: e.target.files?.[0] ?? null })} />
            {docs.length > 1 && (
              <button type="button" className="text-sm text-[var(--red-600)] ml-auto" onClick={() => setDocs(docs.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="tp-upload" onClick={() => setDocs([...docs, { ...docs[docs.length - 1], doc_type: types[0].id, file: null, number_last4: '' }])}>
        + {addLabel}
      </button>
    </div>
  );
}
