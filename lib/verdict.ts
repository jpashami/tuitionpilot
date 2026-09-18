// Client-safe helpers that turn stored invoice/payment/event data into what the agent console shows.
import type { Tone } from '@/components/ui';

export interface CheckResult {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface RuleRow {
  code: string;
  label: string;
  state: 'pass' | 'fail' | 'hold' | 'skip';
  detail: string;
}

const RULES: [string, string][] = [
  ['invoice_complete', 'Invoice read'],
  ['mandate_exists', 'Mandate active'],
  ['payer_verified', 'Payer identity (FINTRAC)'],
  ['approved_payee', 'Approved payee'],
  ['student_match', 'Student match'],
  ['currency', 'Currency'],
  ['not_duplicate', 'Not already paid'],
  ['term_cap', 'Term cap'],
  ['pay_window', 'Payment window'],
  ['autopay_enabled', 'Autopay'],
];

/** Mandate checks (from the agent's last evaluation) plus the two payment steps that follow them. */
export function ruleRows(checks: CheckResult[] | null, invoiceStatus: string, paymentStatus: string | null, paymentError: string | null): RuleRow[] {
  const rows: RuleRow[] = RULES.map(([rule, label], i) => {
    const c = checks?.find((x) => x.rule === rule);
    return {
      code: `R-${String(i + 1).padStart(2, '0')}`,
      label,
      state: !c ? 'skip' : c.passed ? 'pass' : 'fail',
      detail: c?.detail ?? (checks ? 'Not evaluated.' : 'Not checked yet — run the agent.'),
    };
  });
  const allPassed = !!checks && checks.every((c) => c.passed);

  const fundsState: RuleRow['state'] =
    invoiceStatus === 'needs_funds' ? 'hold'
    : paymentStatus && ['dry_run', 'submitted', 'unknown', 'paid', 'settled'].includes(paymentStatus) ? 'pass'
    : paymentStatus === 'failed' ? 'fail'
    : 'skip';
  rows.push({
    code: `R-${String(rows.length + 1).padStart(2, '0')}`,
    label: 'Wallet funds',
    state: fundsState,
    detail:
      fundsState === 'hold' ? (paymentError ?? 'The agent wallet cannot cover this payment yet. Nothing was signed or sent.')
      : fundsState === 'pass' ? 'The wallet covered the payment and network fee; payee and amount re-verified on the payment request.'
      : fundsState === 'fail' ? (paymentError ?? 'The payment could not be prepared. Nothing was signed or sent.')
      : allPassed ? 'Checked when the agent prepares the payment.' : 'Not reached — a rule above stopped the payment.',
  });

  const signState: RuleRow['state'] =
    paymentStatus === 'paid' || paymentStatus === 'settled' ? 'pass'
    : paymentStatus === 'dry_run' || paymentStatus === 'submitted' || paymentStatus === 'unknown' ? 'hold'
    : 'skip';
  rows.push({
    code: `R-${String(rows.length + 1).padStart(2, '0')}`,
    label: 'Signing',
    state: signState,
    detail:
      signState === 'pass' ? 'Agent signed its half; GoBTC co-signed (2-of-3). Funds are committed to the bursar.'
      : paymentStatus === 'dry_run' ? 'Dry run — everything was built and verified, and the agent stopped one step before signing.'
      : signState === 'hold' ? 'Signed and submitted; waiting for GoBTC to confirm the result.'
      : 'Not reached.',
  });
  return rows;
}

export interface Verdict {
  tone: Tone;
  status: string;
  headline: string;
  saw: string;
  rule: string;
  next: string;
}

export function verdictFor(opts: {
  invoiceStatus: string;
  decision: string | null;
  paymentStatus: string | null;
  checks: CheckResult[] | null;
  amount: string;
  cap: string;
}): Verdict {
  const { invoiceStatus: s, decision, paymentStatus: p, checks } = opts;
  const failed = checks?.filter((c) => !c.passed) ?? [];
  const failedRule = (r: string) => failed.some((c) => c.rule === r);

  if (p === 'settled') {
    return {
      tone: 'ok', status: 'Paid · settled', headline: 'Paid and settled on Bitcoin.',
      saw: 'Every rule passed, the 2-of-3 signature was collected, and the payment is confirmed on-chain.',
      rule: 'A payment only happens when every mandate rule passes and GoBTC co-signs.',
      next: 'The final receipt is available to the family and the bursar. The university converts the BTC to CAD.',
    };
  }
  if (p === 'paid') {
    return {
      tone: 'ok', status: 'Paid · committed', headline: 'Paid — funds are committed to the bursar.',
      saw: 'Every rule passed. The agent signed and GoBTC co-signed, so the coins cannot be spent anywhere else.',
      rule: '“Paid” is enough to meet the deadline: the co-signature rules out a double spend.',
      next: 'GoBTC settles the payment on Bitcoin in a batch (about 12 hours). The final receipt follows.',
    };
  }
  if (s === 'refused' && (failedRule('not_duplicate') || decision?.startsWith('Duplicate'))) {
    return {
      tone: 'refused', status: 'Refused · duplicate', headline: 'Refused — this invoice was already handled.',
      saw: failed.find((c) => c.rule === 'not_duplicate')?.detail ?? decision ?? '', rule: 'Each invoice gets one order key. A second copy can never create a second payment.',
      next: 'Nothing was paid. Check the original invoice for its status and receipt.',
    };
  }
  if (s === 'refused' && failedRule('payer_verified')) {
    return {
      tone: 'refused', status: 'Refused · identity', headline: 'Refused — the payer’s identity isn’t verified yet.',
      saw: failed.find((c) => c.rule === 'payer_verified')!.detail,
      rule: 'FINTRAC requires the person funding a CAD 1,000+ virtual-currency transfer to be identified before it happens.',
      next: 'Nothing was signed. Complete the compliance review on the Admin page, then run the agent again.',
    };
  }
  if (s === 'refused' && failedRule('approved_payee')) {
    return {
      tone: 'refused', status: 'Refused · payee', headline: 'Refused — this is not the bursar the parent approved.',
      saw: failed.find((c) => c.rule === 'approved_payee')!.detail,
      rule: 'Only the payee pinned in the mandate can be paid. An invoice can never change it.',
      next: 'Nothing was signed or sent. The parent should confirm with the university using contact details they find themselves.',
    };
  }
  if (s === 'refused' && failedRule('term_cap')) {
    return {
      tone: 'refused', status: 'Refused · over cap', headline: `Refused — ${opts.amount} is over the ${opts.cap} term cap.`,
      saw: failed.find((c) => c.rule === 'term_cap')!.detail,
      rule: 'Spending per term is capped across all invoices, including what is already committed.',
      next: 'Nothing was paid. The parent can raise the cap or ask the bursar to itemise the extra fees.',
    };
  }
  if (s === 'refused') {
    return {
      tone: 'refused', status: 'Refused', headline: 'Refused — the invoice broke a family rule.',
      saw: failed.map((c) => c.detail).join(' ') || decision || 'A mandate rule failed.',
      rule: 'Every rule must pass before the agent can prepare a payment.',
      next: 'Nothing was signed or sent.',
    };
  }
  if (s === 'needs_funds') {
    return {
      tone: 'hold', status: 'Held · needs funds', headline: 'Held — the agent wallet needs funds.',
      saw: decision ?? 'The invoice passes every rule, but the wallet cannot cover it yet.',
      rule: 'The agent never signs a payment it cannot fully fund, and never pays part of an invoice.',
      next: 'Top up the family wallet, then run the agent again. The same order key is reused, so it can’t pay twice.',
    };
  }
  if (p === 'dry_run' || s === 'approved') {
    return {
      tone: 'hold', status: 'Cleared · dry run', headline: 'Cleared every rule — stopped before signing.',
      saw: 'Payee verified, inside the cap and the payment window, wallet funded, payment request checked.',
      rule: 'Dry run proves the whole decision without using a key.',
      next: 'Turn on live payments (PAYMENTS_ENABLED=true) and run the agent again to sign and send.',
    };
  }
  if (p === 'submitted' || p === 'unknown' || s === 'paying') {
    return {
      tone: 'hold', status: 'In progress', headline: 'Payment submitted — confirming with GoBTC.',
      saw: 'The agent signed and submitted. It checks the result instead of submitting again.',
      rule: 'An uncertain payment is reconciled, never retried blindly.',
      next: 'Press “Refresh status” in a few seconds.',
    };
  }
  if (s === 'failed') {
    return {
      tone: 'refused', status: 'Failed', headline: 'Payment failed before signing.',
      saw: decision ?? 'The payment could not be prepared.', rule: 'Nothing is signed unless every check passes.',
      next: 'Nothing was spent. Fix the cause and run the agent again.',
    };
  }
  if (s === 'needs_review') {
    return {
      tone: 'hold', status: 'Needs review', headline: 'A person needs to look at this invoice.',
      saw: decision ?? 'The agent could not process the invoice.', rule: 'When in doubt, the agent stops.',
      next: 'Review the invoice and run the agent again.',
    };
  }
  return {
    tone: 'neutral', status: s === 'extracted' ? 'Read' : 'New', headline: 'Ready for the agent.',
    saw: 'The agent will read the invoice, check it against the family’s rules and, if everything passes, pay it.',
    rule: 'Rules run in code; the AI cannot override them.',
    next: 'Press “Run agent”.',
  };
}
