'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

interface Doc {
  id: string;
  purpose: string;
  doc_type: string;
  issuer: string | null;
  number_last4: string | null;
  expires_on: string | null;
  has_file: boolean;
  review_status: 'pending' | 'accepted' | 'rejected';
  review_note: string | null;
  uploaded_at: string;
  retain_until: string | null;
}

interface Person {
  id: string;
  role: 'payer' | 'student';
  full_name: string;
  email: string | null;
  country: string | null;
  third_party: string | null;
  pep_declared: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_method: string | null;
  verified_at: string | null;
  verified_by: string | null;
  student_name: string;
  university: string;
  student_number: string;
  documents: Doc[];
  consents: { purpose: string; version: string; granted_at: string; withdrawn_at: string | null }[];
}

const PURPOSE: Record<string, string> = { fintrac_photo_id: 'photo ID', fintrac_source: 'dual-process source', eligibility: 'eligibility' };
const TONE: Record<string, string> = { verified: 'tone-ok', accepted: 'tone-ok', pending: 'tone-hold', rejected: 'tone-refused' };

/** Compliance officer's queue: every person, their documents, and accept/reject controls. */
export default function ComplianceQueue() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => fetch('/api/admin/compliance', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPersons(j.persons ?? [])), []);
  useEffect(() => {
    load();
  }, [load]);

  async function review(docId: string, decision: 'accepted' | 'rejected') {
    const note = decision === 'rejected' ? window.prompt('Reason for rejecting (shown to the family):') ?? '' : '';
    if (decision === 'rejected' && !note) return;
    setBusy(docId);
    await fetch('/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, decision, note }) });
    await load();
    setBusy(null);
  }

  const pending = persons.filter((p) => p.verification_status === 'pending' && p.role === 'payer').length;

  return (
    <Card eyebrow="Compliance" title="Identity verification queue" className="mb-6" action={<span className="tp-count">{pending} payers awaiting review</span>}>
      <p className="text-[13.5px] tp-muted -mt-2 mb-4 max-w-[80ch]">
        FINTRAC: the payer is verified by one accepted government photo ID, or two accepted independent sources. Eligibility documents don’t count
        towards identity. The agent refuses to pay for any family whose payer isn’t verified.
      </p>
      <div className="flex flex-col gap-3">
        {persons.length === 0 && <p className="text-sm tp-muted">No one registered yet.</p>}
        {persons.map((p) => (
          <details key={p.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white" open={p.verification_status === 'pending' && p.role === 'payer'}>
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className={`tp-pill ${TONE[p.verification_status]}`}>{p.verification_status}</span>
              <span className="font-semibold text-[var(--text-strong)]">{p.full_name}</span>
              <span className="tp-mono text-[11px] uppercase tracking-[.08em] text-[var(--text-faint)]">{p.role}</span>
              <span className="text-[13px] tp-muted">
                {p.role === 'payer' ? `paying for ${p.student_name} · ${p.university}` : `${p.university} · ${p.student_number}`}
              </span>
              <span className="ml-auto text-[12px] tp-muted">
                {p.verification_method ? `${p.verification_method.replace('_', ' ')} · ${p.verified_at ?? ''} · ${p.verified_by ?? ''}` : `${p.documents.length} documents`}
              </span>
            </summary>
            <div className="px-4 pb-4 border-t border-[var(--border-subtle)]">
              {p.role === 'payer' && (
                <div className="flex gap-4 flex-wrap text-[12.5px] tp-muted py-3">
                  <span>Country: {p.country ?? '—'}</span>
                  <span>Third party: {p.third_party ?? '—'}</span>
                  <span className={p.pep_declared ? 'text-[var(--red-600)] font-semibold' : ''}>PEP: {p.pep_declared ? 'declared — enhanced review' : 'no'}</span>
                  <span>Consents: {p.consents.filter((c) => !c.withdrawn_at).map((c) => c.purpose).join(', ') || '—'}</span>
                </div>
              )}
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left tp-label">
                    <th className="py-1 font-medium">Document</th>
                    <th className="py-1 font-medium">Counts as</th>
                    <th className="py-1 font-medium">Issuer · no. · expiry</th>
                    <th className="py-1 font-medium">File</th>
                    <th className="py-1 font-medium">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {p.documents.map((d) => (
                    <tr key={d.id} className="border-t border-[var(--border-subtle)]">
                      <td className="py-2 pr-3">{d.doc_type.replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-3 tp-muted">{PURPOSE[d.purpose]}</td>
                      <td className="py-2 pr-3 tp-mono text-[12px]">
                        {d.issuer ?? '—'} · ••••{d.number_last4 ?? '????'} · {d.expires_on ?? '—'}
                      </td>
                      <td className="py-2 pr-3 tp-muted">{d.has_file ? 'stored' : d.retain_until ? `purged · hold to ${d.retain_until}` : 'none'}</td>
                      <td className="py-2">
                        {d.review_status === 'pending' ? (
                          <span className="flex gap-2">
                            <Button onClick={() => review(d.id, 'accepted')} disabled={busy === d.id}>Accept</Button>
                            <Button variant="outline" onClick={() => review(d.id, 'rejected')} disabled={busy === d.id}>Reject</Button>
                          </span>
                        ) : (
                          <span>
                            <span className={`tp-pill ${TONE[d.review_status]}`}>{d.review_status}</span>
                            {d.review_note && <span className="block text-[12px] tp-muted mt-1">{d.review_note}</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      <p className="text-xs tp-muted mt-4 m-0">
        Demo: a person accepts or rejects here. For non-face-to-face onboarding, FINTRAC expects document authenticity to be checked with technology (a
        KYC vendor) — that’s on the roadmap, not in this build.
      </p>
    </Card>
  );
}
