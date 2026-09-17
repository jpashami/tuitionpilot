import 'server-only';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDb, newId } from './db';

const SAMPLES_DIR = join(process.cwd(), 'samples');
export const UPLOADS_DIR = process.env.TUITIONPILOT_UPLOADS || join(process.cwd(), 'uploads');

export const SAMPLE_LABELS: Record<string, string> = {
  'fall-2026-tuition.txt': 'Fall 2026 tuition (valid)',
  'suspicious-updated-payment-details.txt': '"Updated payment details" (suspicious)',
  'fall-2026-over-cap.txt': 'Fall 2026 with extra fees (over cap)',
};

export function listSamples() {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ name: f, label: SAMPLE_LABELS[f] ?? f }));
}

/** Store an invoice file and create its row. Sample templates get the configured merchant ID filled in. */
export function createInvoice(opts: { name: string; mediaType: string; data: Buffer; studentId?: string }) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const id = newId('inv');
  const safeName = opts.name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const path = join(UPLOADS_DIR, `${id}-${safeName}`);
  writeFileSync(path, opts.data);
  getDb()
    .prepare('INSERT INTO invoices (id, student_id, source_name, source_media_type, source_path) VALUES (?, ?, ?, ?, ?)')
    .run(id, opts.studentId ?? 'stu_demo', opts.name, opts.mediaType, path);
  return id;
}

export function createInvoiceFromSample(sample: string) {
  if (!listSamples().some((s) => s.name === sample)) throw new Error('Unknown sample');
  const text = readFileSync(join(SAMPLES_DIR, sample), 'utf8').replaceAll(
    '{{MERCHANT_ID}}',
    process.env.GOBTC_MERCHANT_ID ?? 'MERCHANT-NOT-CONFIGURED',
  );
  return createInvoice({ name: sample, mediaType: 'text/plain', data: Buffer.from(text, 'utf8') });
}
