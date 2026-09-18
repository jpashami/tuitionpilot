'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';

interface Consent {
  purpose: string;
  version: string;
  granted_at: string;
  withdrawn_at: string | null;
}

export default function PrivacyPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [erased, setErased] = useState<{ deleted: string[]; kept: string[]; retainUntil: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, action, ...extra }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    const j = await call('view');
    if (j) setData(j.data);
  }

  async function exportJson() {
    const j = await call('export');
    if (!j) return;
    const blob = new Blob([JSON.stringify(j.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tuitionpilot-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function withdraw(purpose: string) {
    const j = await call('withdraw_consent', { purpose });
    if (j) setData(j.data);
  }

  async function erase() {
    const j = await call('erase');
    if (j) {
      setErased(j);
      setData(null);
    }
  }

  const persons: any[] = data?.persons ?? [];
  const payer = persons.find((p) => p.role === 'payer');
  const consents: Consent[] = data?.consents ?? [];

  return (
    <main className="tp-wrap py-8 max-w-[860px]">
      <div className="mb-6">
        <div className="tp-eyebrow">My data</div>
        <h1 className="tp-h1 text-[32px] mt-3 mb-2">See, export or erase what we hold about you</h1>
        <p className="tp-muted max-w-[70ch] m-0">
          Your rights under Canada’s privacy law (PIPEDA): access to your personal information, correction, withdrawal of consent, and deletion of
          anything we are not legally required to keep. Enter the email you registered with and the privacy access code you were shown.
        </p>
      </div>

      {!data && !erased && (
        <Card size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="tp-field">
              <label htmlFor="pv-email">Email</label>
              <input id="pv-email" className="tp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="tp-field">
              <label htmlFor="pv-code">Privacy access code</label>
              <input id="pv-code" className="tp-input tp-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX" />
            </div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[var(--red-700)]">{error}</p>}
          <div className="mt-5 flex gap-3 flex-wrap">
            <Button arrow onClick={view} disabled={busy || !email || !code}>Show my data</Button>
          </div>
          <p className="text-xs tp-muted mt-5 m-0">
            Lost your code? Email privacy@novalycs.ai from your registered address; we verify you and answer within 30 days, as PIPEDA requires.
          </p>
        </Card>
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <Card eyebrow="Family" title={data.family?.name ? `${payer?.full_name ?? 'Payer'} · for ${data.family.name}` : 'Family'} action={<Button variant="outline" onClick={exportJson} disabled={busy}>Export as JSON</Button>}>
            <dl className="grid gap-4 sm:grid-cols-3 text-sm">
              <Item label="People on file" value={persons.map((p) => `${p.full_name} (${p.role}, identity ${p.verification_status})`).join(' · ')} />
              <Item label="Identity documents" value={`${data.identity_documents.length} on file, ${data.identity_documents.filter((d: any) => d.file_stored).length} with images stored`} />
              <Item label="Invoices · payments" value={`${data.invoices.length} · ${data.payments.length}`} />
              <Item label="Agent transcripts" value={`${data.agent_events.length} events`} />
              <Item label="Privacy requests" value={`${data.privacy_requests.length}`} />
              <Item label="Exported" value={data.exported_at.slice(0, 19).replace('T', ' ') + ' UTC'} />
            </dl>
          </Card>

          <Card eyebrow="Consent" title="What you agreed to">
            <ul className="divide-y divide-[var(--border-subtle)] m-0 p-0 list-none">
              {consents.map((c) => (
                <li key={c.purpose} className="py-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                  <span>
                    <span className="font-semibold text-[var(--text-strong)]">{c.purpose.replace(/_/g, ' ')}</span>
                    <span className="block text-xs tp-muted">
                      given {c.granted_at} · version {c.version}
                      {c.withdrawn_at ? ` · withdrawn ${c.withdrawn_at}` : ''}
                    </span>
                  </span>
                  {!c.withdrawn_at && ['receipts_to_student', 'product_updates'].includes(c.purpose) && (
                    <Button variant="outline" onClick={() => withdraw(c.purpose)} disabled={busy}>Withdraw</Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Everything, in full" title="Raw record">
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Show the complete data we hold</summary>
              <pre className="mt-3 text-xs bg-[var(--slate-50)] border border-[var(--border-subtle)] rounded p-3 overflow-auto max-h-[420px]">{JSON.stringify(data, null, 2)}</pre>
            </details>
          </Card>

          <Card eyebrow="Erase" title="Delete my family’s data" className="border-[var(--red-200)]">
            <p className="text-sm m-0 mb-3 max-w-[70ch]">
              This deletes your contact details, addresses, document images, invoice files and agent transcripts now, withdraws every consent, and
              closes the account. <strong>What stays:</strong> if we verified your identity or paid an invoice for you, Canadian anti-money-laundering
              law (FINTRAC) requires us to keep the identity-verification record and payment ledger for 5 years. Those are minimised, locked, and
              purged automatically when the period ends.
            </p>
            {error && <p role="alert" className="text-sm text-[var(--red-700)]">{error}</p>}
            {!confirmErase ? (
              <Button variant="outline" onClick={() => setConfirmErase(true)} disabled={busy || payer === undefined}>Erase my data…</Button>
            ) : (
              <div className="flex gap-3 flex-wrap items-center">
                <Button onClick={erase} disabled={busy}>{busy ? 'Erasing…' : 'Yes, erase now'}</Button>
                <Button variant="outline" onClick={() => setConfirmErase(false)} disabled={busy}>Cancel</Button>
                <span className="text-xs tp-muted">This cannot be undone.</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {erased && (
        <Card accent size="lg" eyebrow="Erased" title="Done — here is exactly what happened">
          <div className="grid gap-5 sm:grid-cols-2 text-sm">
            <div>
              <div className="tp-label mb-2">Deleted now</div>
              <ul className="pl-5 m-0">{erased.deleted.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
            <div>
              <div className="tp-label mb-2">Kept under legal hold</div>
              <ul className="pl-5 m-0">{erased.kept.map((k) => <li key={k}>{k}</li>)}</ul>
              <p className="text-xs tp-muted mt-2 m-0">Purged automatically on {erased.retainUntil}. Nobody uses these records except to answer a lawful request.</p>
            </div>
          </div>
        </Card>
      )}
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="tp-label mb-1">{label}</dt>
      <dd className="m-0 break-words">{value}</dd>
    </div>
  );
}
