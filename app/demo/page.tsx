'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, StatusBadge, money, shortId, statusInfo } from '@/components/ui';
import PaymentJourney from '@/components/PaymentJourney';
import { ruleRows, verdictFor, type CheckResult, type RuleRow } from '@/lib/verdict';

interface Payment {
  status: string;
  external_id: string;
  gobtc_payment_id: string | null;
  payment_tx_id: string | null;
  pay_amount: number;
  invoice_amount: number;
  currency: string;
  amount_sats: number | null;
  fee_sats: number | null;
  txids: string | null;
  paid_seen_at: string | null;
  settled_at: number | null;
  error: string | null;
}

interface Invoice {
  id: string;
  source_name: string;
  payee_name: string | null;
  payee_merchant_id: string | null;
  student_number: string | null;
  term: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  reference: string | null;
  status: string;
  decision: string | null;
  created_at: string;
  payment?: Payment | null;
}

interface AgentEvent {
  id: number;
  run_id: string | null;
  kind: string;
  title: string;
  detail: string | null;
  created_at: string;
}

interface Sample {
  name: string;
  label: string;
}

const SAMPLE_HINTS: Record<string, { hint: string; color: string }> = {
  'fall-2026-tuition.txt': { hint: 'Passes every rule', color: '#12734F' },
  'suspicious-updated-payment-details.txt': { hint: 'Payee mismatch', color: 'var(--red-600)' },
  'fall-2026-over-cap.txt': { hint: 'Over the term cap', color: 'var(--red-600)' },
};

const DOT: Record<string, string> = {
  agent_text: 'var(--navy-300)',
  tool_call: 'var(--slate-300)',
  tool_result: 'var(--slate-300)',
  decision: 'var(--navy-900)',
  payment: 'var(--success-500)',
  error: 'var(--red-500)',
};

const MARK: Record<RuleRow['state'], { path: string; label: string }> = {
  pass: { path: 'M5.4 10.4l3 3 6.2-6.8', label: 'Pass' },
  fail: { path: 'M6 6l8 8M14 6l-8 8', label: 'Refused here' },
  hold: { path: 'M10 5.5v6M10 14.4h.01', label: 'Held' },
  skip: { path: 'M6 10h8', label: 'Not reached' },
};

function parse(detail: string | null): any {
  if (!detail) return null;
  try {
    return JSON.parse(detail);
  } catch {
    return detail;
  }
}

export default function AgentConsole() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cap, setCap] = useState<{ amount: number; currency: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ invoice: Invoice; payment: Payment | null } | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastEventId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadInvoices = useCallback(async () => {
    const r = await fetch('/api/invoices', { cache: 'no-store' });
    const j = await r.json();
    setInvoices(j.invoices ?? []);
    return (j.invoices ?? []) as Invoice[];
  }, []);

  useEffect(() => {
    fetch('/api/samples').then((r) => r.json()).then((j) => setSamples(j.samples ?? []));
    fetch('/api/mandate').then((r) => r.json()).then((j) => setCap({ amount: j.mandate.max_per_term, currency: j.mandate.currency }));
    loadInvoices().then((list) => setSelected((cur) => cur ?? list[0]?.id ?? null));
  }, [loadInvoices]);

  const polling = useRef(false);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;
  const poll = useCallback(async (id: string) => {
    if (polling.current) return;
    polling.current = true;
    try {
      const r = await fetch(`/api/invoices/${id}/events?after=${lastEventId.current}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.invoice.id !== selectedRef.current) return;
      setDetail({ invoice: j.invoice, payment: j.payment });
      const fresh = (j.events as AgentEvent[]).filter((e) => e.id > lastEventId.current);
      if (fresh.length) {
        lastEventId.current = fresh[fresh.length - 1].id;
        setEvents((prev) => [...prev, ...fresh]);
      }
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    lastEventId.current = 0;
    polling.current = false;
    setEvents([]);
    setDetail(null);
    poll(selected);
  }, [selected, poll]);

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => poll(selected), running ? 800 : 5000);
    return () => clearInterval(t);
  }, [selected, running, poll]);

  async function addSample(name: string) {
    setError(null);
    const r = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample: name }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error);
    await loadInvoices();
    setSelected(j.id);
  }

  async function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/invoices', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) return setError(j.error);
    await loadInvoices();
    setSelected(j.id);
  }

  async function runAgent() {
    if (!selected) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: selected }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error);
    } finally {
      polling.current = false;
      await poll(selected);
      setRunning(false);
      loadInvoices();
    }
  }

  async function refreshStatus() {
    if (!selected) return;
    const r = await fetch('/api/payments/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: selected }),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    polling.current = false;
    await poll(selected);
    loadInvoices();
  }

  const inv = detail?.invoice;
  const pay = detail?.payment ?? null;
  const cur = inv?.currency ?? 'CAD';
  const canRun = !!inv && ['uploaded', 'extracted', 'approved', 'failed', 'needs_review', 'needs_funds'].includes(inv.status) && !running;

  // The last mandate evaluation the agent actually ran for this invoice.
  const lastCheck = [...events].reverse().find((e) => e.kind === 'decision' && parse(e.detail)?.checks);
  const checks: CheckResult[] | null = lastCheck ? parse(lastCheck.detail).checks : null;
  const rows = inv ? ruleRows(checks, inv.status, pay?.status ?? null, pay?.error ?? null) : [];
  const verdict = inv
    ? verdictFor({
        invoiceStatus: inv.status,
        decision: inv.decision,
        paymentStatus: pay?.status ?? null,
        checks,
        amount: money(inv.amount, cur),
        cap: cap ? money(cap.amount, cap.currency) : 'family',
      })
    : null;
  const passedCount = rows.filter((r) => r.state === 'pass').length;
  const lastUpdate = [...events].reverse().find((e) => e.kind === 'agent_text' && e.title === 'Agent update');
  const auditEvents = events.filter((e) => e.kind !== 'tool_result');
  const barTone = verdict?.tone ?? 'neutral';

  return (
    <main className="tp-wrap py-7 flex flex-wrap gap-[22px] items-start">
      {/* ------- left column ------- */}
      <div className="flex-[1_1_300px] max-w-[340px] min-w-0 flex flex-col gap-[18px]">
        <Card accent eyebrow="Intake" title="New invoice">
          <p className="text-[13px] tp-muted -mt-2 mb-4">Run a sample, or upload a PDF, photo or text invoice.</p>
          <div className="flex flex-col gap-2">
            {samples.map((s) => {
              const h = SAMPLE_HINTS[s.name];
              return (
                <button key={s.name} className="tp-sample" onClick={() => addSample(s.name)}>
                  <span className="tp-sample-title">{s.label.replace(/\s*\((valid|suspicious|over cap)\)$/, '')}</span>
                  {h && (
                    <span className="tp-sample-hint" style={{ color: h.color }}>
                      {'// '}{h.hint}
                    </span>
                  )}
                </button>
              );
            })}
            <input
              ref={fileRef}
              id="invoice-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button className="tp-upload mt-1" onClick={() => fileRef.current?.click()}>
              Upload invoice…
            </button>
          </div>
        </Card>

        <Card title="Queue" action={<span className="tp-count">{invoices.length} handled</span>}>
          {invoices.length === 0 && <p className="text-sm tp-muted">No invoices yet.</p>}
          <div className="flex flex-col gap-1.5 -mt-1">
            {invoices.map((i) => {
              const st = i.payment?.status === 'paid' || i.payment?.status === 'settled' ? i.payment.status : i.status;
              const info = statusInfo(st);
              return (
                <button
                  key={i.id}
                  className={`tp-queue-row bar-${info.tone}`}
                  aria-current={selected === i.id}
                  onClick={() => setSelected(i.id)}
                >
                  <span className="flex items-center justify-between gap-2.5">
                    <span className="tp-num text-[15px]">{i.amount != null ? money(i.amount, i.currency ?? 'CAD') : 'Not read yet'}</span>
                    <StatusBadge status={st} />
                  </span>
                  <span className="block tp-mono text-[11px] tp-muted mt-1">
                    {i.term ?? i.source_name}
                    {i.due_date ? ` · due ${i.due_date}` : ''}
                  </span>
                  {i.decision && <span className="block text-[12.5px] tp-muted mt-1.5 leading-snug line-clamp-2">{i.decision}</span>}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ------- right column ------- */}
      <div className="flex-[1_1_560px] min-w-0 flex flex-col gap-[18px]">
        {error && (
          <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--red-200)] bg-[var(--red-50)] p-3 text-sm text-[var(--red-700)]">
            {error}
          </div>
        )}

        {!inv && (
          <div className="tp-dark">
            <div className="tp-eyebrow">Agent console</div>
            <h1 className="tp-h1 text-[30px] mt-3">Pick or upload an invoice to start.</h1>
          </div>
        )}

        {inv && verdict && (
          <div
            className="tp-dark"
            style={{
              borderTop: `3px solid ${
                barTone === 'refused' ? 'var(--red-500)' : barTone === 'hold' ? 'var(--warning-500)' : barTone === 'ok' ? 'var(--success-500)' : 'var(--navy-500)'
              }`,
            }}
          >
            <div className="flex gap-[26px] flex-wrap items-start">
              <div className="flex-[1_1_320px] min-w-0">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="tp-pill dark">{verdict.status}</span>
                  <span className="tp-mono text-[11px] text-[var(--navy-300)]">{inv.reference ?? inv.source_name}</span>
                </div>
                <h1 className="tp-h1 text-[30px] leading-[1.14] m-0">{verdict.headline}</h1>
                <p className="text-[15px] leading-relaxed text-[var(--navy-300)] mt-3 max-w-[56ch]">{verdict.saw}</p>
              </div>
              <div className="flex-none sm:text-right">
                <div className="tp-label-dark">Invoice total</div>
                <div className="font-[family-name:var(--font-display)] text-[38px] font-bold tracking-[-0.03em] mt-1.5">
                  {inv.amount != null ? money(inv.amount, cur) : '—'}
                </div>
                <div className="tp-mono text-xs text-[var(--navy-300)] mt-1">
                  {pay?.amount_sats ? `demo ${money(pay.pay_amount, cur)} ≈ ${pay.amount_sats.toLocaleString()} sats` : 'not priced yet'}
                  {inv.due_date ? ` · due ${inv.due_date}` : ''}
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 flex-wrap mt-6 pt-5 border-t border-[var(--navy-700)]">
              <Button arrow onClick={runAgent} disabled={!canRun}>
                {running ? 'Agent working…' : inv.status === 'uploaded' ? 'Run agent' : 'Run agent again'}
              </Button>
              {pay?.gobtc_payment_id && (
                <Button variant="ondark" onClick={refreshStatus}>
                  Refresh status
                </Button>
              )}
            </div>
          </div>
        )}

        {inv && (
          <Card
            size="lg"
            eyebrow="Mandate check"
            title="Every rule, in order"
            action={<span className="tp-count">{checks ? `${passedCount} of ${rows.length} passed` : running ? 'Checking…' : 'Not run yet'}</span>}
          >
            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div key={r.code} className={`tp-rule rule-${r.state}`}>
                  <span className="tp-rule-mark">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d={MARK[r.state].path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="flex-auto min-w-0">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="tp-rule-name">{r.label}</span>
                      <span className="tp-rule-state">{MARK[r.state].label}</span>
                    </div>
                    <p className="tp-rule-detail">{r.detail}</p>
                  </div>
                  <span className="tp-rule-code">{r.code}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {inv && verdict && (
          <div className="flex gap-[18px] flex-wrap items-stretch">
            <Card eyebrow="What happens next" className="flex-[1_1_300px]">
              <div className="flex flex-col gap-3.5 -mt-1">
                <div>
                  <div className="tp-label mb-1">Rule applied</div>
                  <p className="text-sm leading-relaxed m-0">{verdict.rule}</p>
                </div>
                <div className="tp-divider" />
                <div>
                  <div className="tp-label mb-1">Next step</div>
                  <p className="text-sm leading-relaxed m-0">{verdict.next}</p>
                </div>
              </div>
            </Card>
            <Card eyebrow="Agent’s note to the family" className="flex-[1_1_300px]">
              {lastUpdate?.detail ? (
                <AgentMarkdown text={String(parse(lastUpdate.detail))} />
              ) : (
                <p className="text-sm tp-muted -mt-1">The agent writes a short update for the parent and student after each run.</p>
              )}
            </Card>
          </div>
        )}

        {inv && (
          <Card
            size="lg"
            eyebrow="Payment journey"
            title="From invoice to CAD in the bursar’s bank"
            action={
              pay && (pay.status === 'paid' || pay.status === 'settled') ? (
                <a className="tp-btn outline" href={`/receipt/${inv.id}`}>
                  View receipt
                </a>
              ) : undefined
            }
          >
            <PaymentJourney invoice={inv} payment={pay} />
            {pay?.gobtc_payment_id && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-[var(--border-subtle)]">
                <ProofField label="GoBTC payment ID" value={pay.gobtc_payment_id} />
                <ProofField label="Order key (one payment per invoice)" value={pay.external_id} />
                {pay.payment_tx_id && <ProofField label="Payment transaction ID" value={pay.payment_tx_id} />}
                {pay.fee_sats != null && <ProofField label="Network fee" value={`${pay.fee_sats} sats`} />}
                {(pay.txids ? (JSON.parse(pay.txids) as string[]) : []).map((t) => (
                  <div key={t} className="sm:col-span-2 min-w-0">
                    <dt className="tp-label mb-1">On-chain transaction</dt>
                    <dd>
                      <a href={`https://mempool.space/tx/${t}`} target="_blank" rel="noreferrer" className="tp-mono text-[13px] break-all">
                        {t}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        )}

        {inv && (
          <Card eyebrow="Audit trail" action={<span className="tp-count">{auditEvents.length} events</span>}>
            {auditEvents.length === 0 && <p className="text-sm tp-muted -mt-1">No activity yet.</p>}
            <div className="flex flex-col -mt-1">
              {auditEvents.map((e) => {
                const d = parse(e.detail);
                const text =
                  typeof d === 'string'
                    ? e.kind === 'agent_text' && e.title === 'Agent update'
                      ? 'Update written for the family.'
                      : d
                    : d?.checks
                      ? `${d.checks.filter((c: CheckResult) => c.passed).length} of ${d.checks.length} rules passed`
                      : d?.paymentId
                        ? `Payment ${shortId(d.paymentId)} · ${d.amountSats ?? ''} sats`
                        : d && e.kind === 'tool_call'
                          ? Object.keys(d).length ? 'Fields: ' + Object.keys(d).join(', ') : ''
                          : '';
                return (
                  <div key={e.id} className="tp-audit">
                    <span className="tp-audit-time">{e.created_at.slice(11, 19)}</span>
                    <span className="tp-audit-dot" style={{ background: DOT[e.kind] }} />
                    <span className="min-w-0">
                      <span className="tp-audit-title">{e.kind === 'tool_call' ? `Tool: ${e.title}` : e.title}</span>
                      {text && <span className="tp-audit-detail line-clamp-2">{text}</span>}
                    </span>
                  </div>
                );
              })}
              {running && <div className="text-sm tp-muted animate-pulse pl-[86px] py-1">working…</div>}
            </div>
          </Card>
        )}

        {inv && (
          <details className="tp-trace">
            <summary>
              <span>// Developer trace — events and payment record</span>
              <span className="when-closed">Show</span>
              <span className="when-open">Hide</span>
            </summary>
            <pre>
              {JSON.stringify(
                { invoice: inv, payment: pay, events: events.map((e) => ({ ...e, detail: parse(e.detail) })) },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}

function ProofField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="tp-label mb-1">{label}</dt>
      <dd className="tp-mono text-[13px] text-[var(--navy-900)] break-all">{value}</dd>
    </div>
  );
}

// Minimal renderer for the agent's updates: paragraphs, "- " bullets, "#" headings, **bold** and `code`.
function AgentMarkdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-[var(--text-strong)]">{part.slice(2, -2)}</strong>
      ) : part.startsWith('`') && part.endsWith('`') ? (
        <code key={i} className="tp-mono text-xs bg-[var(--slate-100)] rounded px-1">{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );

  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc pl-5 space-y-1">
        {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push(
      heading ? (
        <p key={blocks.length} className="font-semibold text-[var(--text-strong)]">{inline(heading[1])}</p>
      ) : (
        <p key={blocks.length}>{inline(line)}</p>
      ),
    );
  }
  flush();
  return <div className="-mt-1 space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
