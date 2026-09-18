import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDb, newId } from './db';

/**
 * Client onboarding that a FINTRAC-registered MSB would need, scaled to the demo:
 * - The FINTRAC client is the PAYER (the person requesting a CAD 1,000+ virtual-currency transfer),
 *   identified by the government photo-ID method or the dual-process method.
 * - The student is the beneficiary; we keep enough to match invoices and prove enrolment.
 * - PIPEDA: purpose-specific consent, access/export on request, erasure of everything not under a
 *   legal hold. Identity records stay 5 years after the relationship ends (FINTRAC), then are purged.
 */

export const CONSENT_VERSION = '2026-09-17';
export const RETENTION_YEARS = 5;

export const DOC_TYPES = {
  // FINTRAC government-issued photo ID (federal/provincial/territorial or foreign equivalent; not municipal)
  passport: { label: 'Passport', purpose: 'fintrac_photo_id', fintrac: true },
  drivers_licence: { label: 'Canadian driver’s licence', purpose: 'fintrac_photo_id', fintrac: true },
  provincial_id: { label: 'Provincial / territorial photo ID card', purpose: 'fintrac_photo_id', fintrac: true },
  pr_card: { label: 'Permanent resident card', purpose: 'fintrac_photo_id', fintrac: true },
  // Dual-process sources (name + address / name + date of birth / name + financial account)
  utility_bill: { label: 'Utility bill (name + address)', purpose: 'fintrac_source', fintrac: true },
  bank_statement: { label: 'Bank statement (name + account)', purpose: 'fintrac_source', fintrac: true },
  cra_notice: { label: 'CRA notice of assessment (name + address)', purpose: 'fintrac_source', fintrac: true },
  birth_certificate: { label: 'Birth certificate (name + date of birth)', purpose: 'fintrac_source', fintrac: true },
  // Eligibility only — a study permit is an IRCC document without a photo; FINTRAC does not list it as photo ID.
  study_permit: { label: 'Study permit (eligibility, not FINTRAC ID)', purpose: 'eligibility', fintrac: false },
  enrolment_letter: { label: 'Enrolment letter / fee invoice', purpose: 'eligibility', fintrac: false },
} as const;
export type DocType = keyof typeof DOC_TYPES;

export const CONSENT_PURPOSES: { id: string; label: string; required: boolean; text: string }[] = [
  {
    id: 'identity_verification',
    label: 'Verify my identity',
    required: true,
    text: 'TuitionPilot may collect and keep my identity documents and personal details to verify who I am, as required of a money services business by Canadian law (PCMLTFA/FINTRAC). These records are kept for 5 years after our relationship ends, even if I ask for my other data to be deleted.',
  },
  {
    id: 'payment_processing',
    label: 'Pay tuition on my behalf',
    required: true,
    text: 'TuitionPilot may use my details, the student’s details and the invoices I upload to pay the approved university from the family wallet, and may share the payment reference with the university and GoBTC Pay.',
  },
  {
    id: 'receipts_to_student',
    label: 'Share receipts with the student',
    required: false,
    text: 'The student may see the status of each invoice and the receipt, but not my identity documents or wallet balance.',
  },
  {
    id: 'product_updates',
    label: 'Product updates by email',
    required: false,
    text: 'TuitionPilot may email me about new features. I can withdraw this at any time.',
  },
];

const KYC_DIR = join(process.cwd(), 'uploads', 'kyc');

export function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function newPrivacyCode() {
  // 10 characters, no ambiguous glyphs. Shown once at registration.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('').replace(/(.{5})(.{5})/, '$1-$2');
}

export interface PersonInput {
  full_name: string;
  date_of_birth?: string;
  email?: string;
  phone?: string;
  address_line?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  occupation?: string;
  third_party?: string;
  pep_declared?: boolean;
}

export interface DocInput {
  doc_type: DocType;
  issuer?: string;
  number_last4?: string;
  expires_on?: string;
  file?: { name: string; mediaType: string; data: Buffer };
}

export interface RegistrationInput {
  student: { name: string; university: string; student_number: string; email?: string; date_of_birth?: string };
  payer: PersonInput;
  mandate: { max_per_term: number; pay_window_days: number; autopay: boolean; currency?: string };
  payerDocs: DocInput[];
  studentDocs: DocInput[];
  consents: string[];
  /** The student funds their own tuition: one person is both client (FINTRAC) and beneficiary. */
  selfPaying?: boolean;
}

/** Creates the family, the two persons, the documents and the consents in one transaction. */
export function registerFamily(input: RegistrationInput) {
  const db = getDb();
  const required = CONSENT_PURPOSES.filter((c) => c.required).map((c) => c.id);
  const missing = required.filter((r) => !input.consents.includes(r));
  if (missing.length) throw new Error(`Required consent not given: ${missing.join(', ')}`);
  if (input.selfPaying) input.student = { ...input.student, name: input.payer.full_name, date_of_birth: input.payer.date_of_birth, email: input.payer.email };
  if (!input.payer.full_name || !input.student.name || !input.student.student_number || !input.student.university) {
    throw new Error('Payer name, student name, student number and university are required.');
  }
  const photoIds = input.payerDocs.filter((d) => DOC_TYPES[d.doc_type].purpose === 'fintrac_photo_id');
  const sources = input.payerDocs.filter((d) => DOC_TYPES[d.doc_type].purpose === 'fintrac_source');
  if (photoIds.length === 0 && sources.length < 2) {
    throw new Error('FINTRAC identification needs either one government photo ID, or two independent sources (dual-process method).');
  }

  const studentId = newId('stu');
  const payerId = newId('per');
  const studentPersonId = newId('per');
  const privacyCode = newPrivacyCode();
  const merchant = process.env.GOBTC_MERCHANT_ID ?? 'unset';

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO students (id, name, university, student_number, parent_name, country_from, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
    ).run(studentId, input.student.name, input.student.university, input.student.student_number, input.selfPaying ? `${input.payer.full_name} (self)` : input.payer.full_name, input.payer.country ?? '');

    // The demo pins every family to the one merchant we control; production would pick the verified school.
    db.prepare(
      `INSERT INTO mandates (id, student_id, approved_payee_merchant_id, approved_payee_name, currency, max_per_term, pay_window_days, autopay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId('man'), studentId, merchant, `${input.student.university} Bursar`, input.mandate.currency ?? 'CAD', input.mandate.max_per_term, input.mandate.pay_window_days, input.mandate.autopay ? 1 : 0);

    const insertPerson = db.prepare(
      `INSERT INTO persons (id, student_id, role, full_name, date_of_birth, email, phone, address_line, city, region, postal_code, country, occupation, third_party, pep_declared, privacy_code_hash)
       VALUES (@id, @student_id, @role, @full_name, @date_of_birth, @email, @phone, @address_line, @city, @region, @postal_code, @country, @occupation, @third_party, @pep_declared, @privacy_code_hash)`,
    );
    const p = input.payer;
    insertPerson.run({
      id: payerId, student_id: studentId, role: 'payer', full_name: p.full_name, date_of_birth: p.date_of_birth ?? null, email: p.email ?? null,
      phone: p.phone ?? null, address_line: p.address_line ?? null, city: p.city ?? null, region: p.region ?? null, postal_code: p.postal_code ?? null,
      country: p.country ?? null, occupation: p.occupation ?? null, third_party: p.third_party || 'no', pep_declared: p.pep_declared ? 1 : 0,
      privacy_code_hash: hashCode(privacyCode),
    });
    if (!input.selfPaying) insertPerson.run({
      id: studentPersonId, student_id: studentId, role: 'student', full_name: input.student.name, date_of_birth: input.student.date_of_birth ?? null,
      email: input.student.email ?? null, phone: null, address_line: null, city: null, region: null, postal_code: null, country: 'CA',
      occupation: 'Student', third_party: null, pep_declared: 0, privacy_code_hash: hashCode(privacyCode),
    });

    const insertDoc = db.prepare(
      `INSERT INTO identity_documents (id, person_id, purpose, doc_type, issuer, number_last4, expires_on, file_path, media_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const store = (personId: string, d: DocInput) => {
      let path: string | null = null;
      if (d.file) {
        mkdirSync(KYC_DIR, { recursive: true });
        const id = newId('doc');
        path = join(KYC_DIR, `${id}-${d.file.name.replace(/[^\w.\-]+/g, '_').slice(0, 60)}`);
        writeFileSync(path, d.file.data);
        insertDoc.run(id, personId, DOC_TYPES[d.doc_type].purpose, d.doc_type, d.issuer ?? null, d.number_last4?.slice(-4) ?? null, d.expires_on ?? null, path, d.file.mediaType);
      } else {
        insertDoc.run(newId('doc'), personId, DOC_TYPES[d.doc_type].purpose, d.doc_type, d.issuer ?? null, d.number_last4?.slice(-4) ?? null, d.expires_on ?? null, null, null);
      }
    };
    input.payerDocs.forEach((d) => store(payerId, d));
    // Eligibility documents belong to whoever is the student — the payer themselves when self-paying.
    input.studentDocs.forEach((d) => store(input.selfPaying ? payerId : studentPersonId, d));

    const insertConsent = db.prepare('INSERT INTO consents (person_id, purpose, version) VALUES (?, ?, ?)');
    for (const c of input.consents) insertConsent.run(payerId, c, CONSENT_VERSION);
  });
  tx();

  return { studentId, payerId, privacyCode };
}

// ---------- compliance review (admin) ----------

export function complianceQueue() {
  const db = getDb();
  const persons = db
    .prepare(
      `SELECT p.*, s.name AS student_name, s.university, s.student_number
       FROM persons p JOIN students s ON s.id = p.student_id
       WHERE p.erased_at IS NULL ORDER BY p.created_at DESC`,
    )
    .all() as any[];
  const docs = db.prepare('SELECT * FROM identity_documents ORDER BY uploaded_at').all() as any[];
  const consents = db.prepare('SELECT * FROM consents ORDER BY granted_at').all() as any[];
  return persons.map((p) => ({
    ...p,
    privacy_code_hash: undefined,
    documents: docs.filter((d) => d.person_id === p.id).map(({ file_path, ...d }) => ({ ...d, has_file: !!file_path })),
    consents: consents.filter((c) => c.person_id === p.id),
  }));
}

/** Records the reviewer's decision. Verification = one accepted photo ID, or two accepted independent sources. */
export function reviewDocument(docId: string, decision: 'accepted' | 'rejected', note: string, reviewer: string) {
  const db = getDb();
  db.prepare('UPDATE identity_documents SET review_status = ?, review_note = ? WHERE id = ?').run(decision, note || null, docId);
  const doc = db.prepare('SELECT person_id FROM identity_documents WHERE id = ?').get(docId) as { person_id: string };
  const accepted = db
    .prepare("SELECT purpose, doc_type FROM identity_documents WHERE person_id = ? AND review_status = 'accepted'")
    .all(doc.person_id) as { purpose: string; doc_type: string }[];
  const photo = accepted.some((d) => d.purpose === 'fintrac_photo_id');
  const distinctSources = new Set(accepted.filter((d) => d.purpose === 'fintrac_source').map((d) => d.doc_type)).size;
  const method = photo ? 'photo_id' : distinctSources >= 2 ? 'dual_process' : null;
  const anyRejected = db.prepare("SELECT 1 FROM identity_documents WHERE person_id = ? AND review_status = 'rejected' AND purpose != 'eligibility'").get(doc.person_id);
  const status = method ? 'verified' : anyRejected ? 'rejected' : 'pending';
  db.prepare(
    "UPDATE persons SET verification_status = ?, verification_method = ?, verified_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE NULL END, verified_by = ? WHERE id = ?",
  ).run(status, method, status, reviewer, doc.person_id);
  return { personId: doc.person_id, status, method };
}

// ---------- privacy (PIPEDA access / export / erasure) ----------

export function findPersonByCode(email: string, code: string) {
  return getDb()
    .prepare("SELECT * FROM persons WHERE lower(email) = lower(?) AND privacy_code_hash = ? AND erased_at IS NULL")
    .get(email.trim(), hashCode(code)) as any | undefined;
}

/** Everything we hold about a family, in plain JSON (PIPEDA access request). */
export function personalDataExport(studentId: string) {
  const db = getDb();
  const strip = (rows: any[]) => rows.map(({ privacy_code_hash, file_path, source_path, ...r }) => ({ ...r, ...(file_path !== undefined ? { file_stored: !!file_path } : {}) }));
  return {
    exported_at: new Date().toISOString(),
    family: db.prepare('SELECT * FROM students WHERE id = ?').get(studentId),
    persons: strip(db.prepare('SELECT * FROM persons WHERE student_id = ?').all(studentId) as any[]),
    identity_documents: strip(
      db.prepare('SELECT d.* FROM identity_documents d JOIN persons p ON p.id = d.person_id WHERE p.student_id = ?').all(studentId) as any[],
    ),
    consents: db.prepare('SELECT c.* FROM consents c JOIN persons p ON p.id = c.person_id WHERE p.student_id = ?').all(studentId),
    mandates: db.prepare('SELECT * FROM mandates WHERE student_id = ?').all(studentId),
    invoices: strip(db.prepare('SELECT * FROM invoices WHERE student_id = ?').all(studentId) as any[]),
    payments: db.prepare('SELECT p.* FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.student_id = ?').all(studentId),
    agent_events: db.prepare('SELECT e.* FROM events e JOIN invoices i ON i.id = e.invoice_id WHERE i.student_id = ?').all(studentId),
    privacy_requests: db.prepare('SELECT r.* FROM privacy_requests r JOIN persons p ON p.id = r.person_id WHERE p.student_id = ?').all(studentId),
  };
}

/**
 * Erase everything we are allowed to erase. What stays, and why:
 * - Identity-verification records and payment records: FINTRAC requires 5 years after the relationship ends.
 *   They are minimised (names replaced, images deleted once reviewed), locked, and dated for purge.
 * - Everything else (contact details, addresses, invoices not tied to a payment, agent transcripts) is deleted now.
 */
export function eraseFamily(studentId: string, requesterPersonId: string) {
  const db = getDb();
  const retainUntil = new Date();
  retainUntil.setFullYear(retainUntil.getFullYear() + RETENTION_YEARS);
  const until = retainUntil.toISOString().slice(0, 10);
  const kept: string[] = [];
  const deleted: string[] = [];

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO privacy_requests (person_id, kind, note) VALUES (?, 'erase', ?)").run(requesterPersonId, `retention hold until ${until}`);

    const persons = db.prepare('SELECT id, role, verification_status FROM persons WHERE student_id = ?').all(studentId) as any[];
    const hasPayments = !!db
      .prepare("SELECT 1 FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.student_id = ? AND p.status IN ('paid','settled','submitted','unknown')")
      .get(studentId);
    const verifiedPayer = persons.some((p) => p.role === 'payer' && p.verification_status === 'verified');
    const legalHold = hasPayments || verifiedPayer;

    // Documents: images are deleted now in every case; metadata stays only under legal hold.
    const docs = db.prepare('SELECT d.id, d.file_path FROM identity_documents d JOIN persons p ON p.id = d.person_id WHERE p.student_id = ?').all(studentId) as any[];
    for (const d of docs) if (d.file_path) rmSync(d.file_path, { force: true });
    if (legalHold) {
      db.prepare(
        `UPDATE identity_documents SET file_path = NULL, media_type = NULL, retain_until = ?
         WHERE person_id IN (SELECT id FROM persons WHERE student_id = ?)`,
      ).run(until, studentId);
      kept.push(`Identity-verification record (document type, issuer, last 4 digits, review result) until ${until} — FINTRAC record-keeping`);
      deleted.push('Identity document images');
    } else {
      db.prepare('DELETE FROM identity_documents WHERE person_id IN (SELECT id FROM persons WHERE student_id = ?)').run(studentId);
      deleted.push('Identity documents and their images');
    }

    // Payments: keep the ledger rows under hold, drop invoice files and agent transcripts.
    const invoices = db.prepare('SELECT id, source_path FROM invoices WHERE student_id = ?').all(studentId) as any[];
    for (const i of invoices) rmSync(i.source_path, { force: true });
    db.prepare('DELETE FROM events WHERE invoice_id IN (SELECT id FROM invoices WHERE student_id = ?)').run(studentId);
    deleted.push('Uploaded invoice files and agent transcripts');
    if (legalHold) {
      db.prepare(
        `UPDATE invoices SET source_path = '', source_name = 'erased', decision = NULL
         WHERE student_id = ? AND id IN (SELECT invoice_id FROM payments WHERE status IN ('paid','settled','submitted','unknown'))`,
      ).run(studentId);
      db.prepare(
        `DELETE FROM invoices WHERE student_id = ? AND id NOT IN (SELECT invoice_id FROM payments WHERE status IN ('paid','settled','submitted','unknown'))`,
      ).run(studentId);
      db.prepare('DELETE FROM payments WHERE invoice_id NOT IN (SELECT id FROM invoices)').run();
      kept.push(`Payment records (amounts, payment IDs, dates) until ${until} — FINTRAC record-keeping`);
    } else {
      db.prepare('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE student_id = ?)').run(studentId);
      db.prepare('DELETE FROM invoices WHERE student_id = ?').run(studentId);
      deleted.push('Invoices and payment attempts');
    }

    // Consents: withdrawn, kept as proof of what was agreed (needed to defend past processing).
    db.prepare("UPDATE consents SET withdrawn_at = datetime('now') WHERE person_id IN (SELECT id FROM persons WHERE student_id = ?) AND withdrawn_at IS NULL").run(studentId);
    kept.push('The record that consent was given and withdrawn (dates and version only)');

    // Persons: contact and address data erased; name kept only under hold (it is part of the identity record).
    db.prepare(
      `UPDATE persons SET full_name = CASE WHEN ? THEN full_name ELSE 'erased' END, date_of_birth = NULL, email = NULL, phone = NULL,
         address_line = NULL, city = NULL, region = NULL, postal_code = NULL, occupation = NULL, privacy_code_hash = NULL,
         erased_at = datetime('now') WHERE student_id = ?`,
    ).run(legalHold ? 1 : 0, studentId);
    deleted.push('Contact details, addresses, dates of birth and the privacy access code');

    db.prepare("UPDATE mandates SET active = 0 WHERE student_id = ?").run(studentId);
    db.prepare("UPDATE students SET status = 'erased', parent_name = 'erased', name = CASE WHEN ? THEN name ELSE 'erased' END WHERE id = ?").run(legalHold ? 1 : 0, studentId);
    db.prepare("UPDATE privacy_requests SET completed_at = datetime('now') WHERE person_id = ? AND kind = 'erase' AND completed_at IS NULL").run(requesterPersonId);
  });
  tx();
  return { deleted, kept, retainUntil: until };
}
