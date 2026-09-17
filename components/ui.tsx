import type { ReactNode } from 'react';

export type Tone = 'refused' | 'hold' | 'ok' | 'neutral';

export function Card({
  eyebrow,
  title,
  action,
  children,
  accent,
  size,
  className = '',
}: {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  accent?: boolean;
  size?: 'lg';
  className?: string;
}) {
  return (
    <section className={`tp-card ${accent ? 'accent' : ''} ${size ?? ''} ${className}`}>
      {(eyebrow || title || action) && (
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            {eyebrow && <div className="tp-eyebrow">{eyebrow}</div>}
            {title && <h2 className="tp-h2 !mb-0">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  uploaded: { label: 'New', tone: 'neutral' },
  extracted: { label: 'Read', tone: 'neutral' },
  approved: { label: 'Cleared · dry run', tone: 'hold' },
  dry_run: { label: 'Cleared · dry run', tone: 'hold' },
  planned: { label: 'Planned', tone: 'neutral' },
  paying: { label: 'Paying', tone: 'hold' },
  submitted: { label: 'Submitted', tone: 'hold' },
  unknown: { label: 'Reconciling', tone: 'hold' },
  needs_funds: { label: 'Needs funds', tone: 'hold' },
  needs_review: { label: 'Needs review', tone: 'hold' },
  paid: { label: 'Paid · committed', tone: 'ok' },
  settled: { label: 'Settled', tone: 'ok' },
  refused: { label: 'Refused', tone: 'refused' },
  failed: { label: 'Failed', tone: 'refused' },
};

export function statusInfo(status: string) {
  return STATUS[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as Tone };
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = statusInfo(status);
  return <span className={`tp-pill tone-${s.tone}`}>{label ?? s.label}</span>;
}

export function Arrow() {
  return (
    <svg className="arr" width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  arrow,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ondark' | 'outline';
  type?: 'button' | 'submit';
  arrow?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`tp-btn ${variant}`}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function Field({ label, value, mono, dark }: { label: string; value: ReactNode; mono?: boolean; dark?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={dark ? 'tp-label-dark mb-1' : 'tp-label mb-1'}>{label}</dt>
      <dd className={`text-[14.5px] break-words ${mono ? 'tp-mono text-[13px]' : 'font-semibold'} ${dark ? 'text-white' : 'text-[var(--text-strong)]'}`}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function VerifiedIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#1F9D72" />
      <path d="M5.8 10.3l2.7 2.7 5.6-6" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function money(amount: number | null | undefined, currency = 'CAD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

export function shortId(id: string | null | undefined, head = 8, tail = 9) {
  if (!id) return '—';
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}
