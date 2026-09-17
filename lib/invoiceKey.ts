import { createHash } from 'crypto';
import type { InvoiceRow } from './db';

/** Same invoice content → same key, forever. A changed amount produces a different key and a fresh check. */
export function externalIdFor(invoice: InvoiceRow) {
  const h = createHash('sha256')
    .update([invoice.student_number, invoice.term, invoice.reference, invoice.amount, invoice.currency].join('|'))
    .digest('hex')
    .slice(0, 10);
  return `tp-${invoice.student_number}-${(invoice.term ?? '').replace(/W+/g, '')}-${h}`;
}
