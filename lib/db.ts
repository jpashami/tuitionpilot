import 'server-only';
import Database from 'better-sqlite3';
import { join } from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(process.env.TUITIONPILOT_DB || join(process.cwd(), 'tuitionpilot.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initDatabase(db);
  return db;
}

function initDatabase(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      university TEXT NOT NULL,
      student_number TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      country_from TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mandates (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      approved_payee_merchant_id TEXT NOT NULL,
      approved_payee_name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      max_per_term REAL NOT NULL,
      pay_window_days INTEGER NOT NULL,
      autopay INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      source_name TEXT NOT NULL,
      source_media_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      -- fields extracted by the agent
      payee_name TEXT,
      payee_merchant_id TEXT,
      student_number TEXT,
      term TEXT,
      amount REAL,
      currency TEXT,
      due_date TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | extracted | approved | refused | paying | paid | settled | failed | needs_review
      decision TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      base_key TEXT NOT NULL UNIQUE,
      attempt INTEGER NOT NULL DEFAULT 1,
      external_id TEXT NOT NULL UNIQUE,
      invoice_amount REAL NOT NULL,
      pay_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      gobtc_payment_id TEXT,
      job_id TEXT,
      payment_tx_id TEXT,
      amount_sats INTEGER,
      fee_sats INTEGER,
      status TEXT NOT NULL, -- planned | paying | submitted | paid | settled | unknown | failed | dry_run
      error TEXT,
      paid_seen_at TEXT,
      settled_at INTEGER,
      txids TEXT,
      rate_at_request REAL,
      request_expires_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      invoice_id TEXT,
      kind TEXT NOT NULL,   -- agent_text | tool_call | tool_result | decision | payment | error
      title TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_invoice ON events(invoice_id, id);

    -- Onboarding & compliance (FINTRAC client identification, PIPEDA consent/access/deletion)
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      role TEXT NOT NULL,                -- payer | student
      full_name TEXT NOT NULL,
      date_of_birth TEXT,
      email TEXT,
      phone TEXT,
      address_line TEXT,
      city TEXT,
      region TEXT,
      postal_code TEXT,
      country TEXT,
      occupation TEXT,
      third_party TEXT,                  -- payer only: 'no' | description of the third party
      pep_declared INTEGER NOT NULL DEFAULT 0,
      verification_status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | rejected
      verification_method TEXT,          -- photo_id | dual_process | credit_file
      verified_at TEXT,
      verified_by TEXT,
      privacy_code_hash TEXT,            -- lets the person open /privacy without an account
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      erased_at TEXT
    );

    CREATE TABLE IF NOT EXISTS identity_documents (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id),
      purpose TEXT NOT NULL,             -- fintrac_photo_id | fintrac_source | eligibility
      doc_type TEXT NOT NULL,            -- passport | drivers_licence | provincial_id | pr_card | utility_bill | bank_statement | cra_notice | study_permit | enrolment_letter
      issuer TEXT,
      number_last4 TEXT,
      expires_on TEXT,
      file_path TEXT,                    -- NULL once the image is purged
      media_type TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
      review_note TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      retain_until TEXT                  -- FINTRAC: 5 years after the relationship ends
    );

    CREATE TABLE IF NOT EXISTS consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL REFERENCES persons(id),
      purpose TEXT NOT NULL,             -- identity_verification | payment_processing | receipts_to_student | product_updates
      version TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      withdrawn_at TEXT
    );

    CREATE TABLE IF NOT EXISTS privacy_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL,
      kind TEXT NOT NULL,                -- access | export | erase | withdraw_consent
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      note TEXT
    );
  `);
  // Columns added after the first release of the schema.
  const cols = (database.prepare('PRAGMA table_info(payments)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('rate_at_request')) database.exec('ALTER TABLE payments ADD COLUMN rate_at_request REAL');
  if (!cols.includes('request_expires_at')) database.exec('ALTER TABLE payments ADD COLUMN request_expires_at INTEGER');
  const scols = (database.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map((c) => c.name);
  if (!scols.includes('status')) database.exec("ALTER TABLE students ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  if (!scols.includes('created_at')) database.exec("ALTER TABLE students ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
  seed(database);
}

// One demo family. The approved payee is our own GoBTC merchant account, acting as the bursar.
function seed(database: Database.Database) {
  const exists = database.prepare('SELECT 1 FROM students WHERE id = ?').get('stu_demo');
  if (!exists) {
    database
    .prepare(
      `INSERT INTO students (id, name, university, student_number, parent_name, country_from)
       VALUES ('stu_demo', 'Leila Ahmadi', 'Northshore University (demo)', 'NSU-2026-48213', 'Reza Ahmadi', 'Abroad')`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO mandates (id, student_id, approved_payee_merchant_id, approved_payee_name, currency, max_per_term, pay_window_days)
       VALUES ('man_demo', 'stu_demo', ?, 'Northshore University Bursar', 'CAD', 9000, 21)`,
    )
    .run(process.env.GOBTC_MERCHANT_ID ?? 'unset');
  }
  // The demo family's payer counts as verified so the sample invoices can run; real families go through /register.
  database
    .prepare(
      `INSERT OR IGNORE INTO persons (id, student_id, role, full_name, country, third_party, verification_status, verification_method, verified_at, verified_by)
       VALUES ('per_demo_payer', 'stu_demo', 'payer', 'Reza Ahmadi', 'Abroad', 'no', 'verified', 'photo_id', datetime('now'), 'demo seed'),
              ('per_demo_student', 'stu_demo', 'student', 'Leila Ahmadi', 'CA', NULL, 'verified', 'photo_id', datetime('now'), 'demo seed')`,
    )
    .run();
}

export function logEvent(e: {
  runId?: string;
  invoiceId?: string;
  kind: string;
  title: string;
  detail?: unknown;
}) {
  getDb()
    .prepare('INSERT INTO events (run_id, invoice_id, kind, title, detail) VALUES (?, ?, ?, ?, ?)')
    .run(
      e.runId ?? null,
      e.invoiceId ?? null,
      e.kind,
      e.title,
      e.detail === undefined ? null : typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail),
    );
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export interface StudentRow {
  id: string;
  name: string;
  university: string;
  student_number: string;
  parent_name: string;
  country_from: string;
  status: string;
}

export interface MandateRow {
  id: string;
  student_id: string;
  approved_payee_merchant_id: string;
  approved_payee_name: string;
  currency: string;
  max_per_term: number;
  pay_window_days: number;
  autopay: number;
  active: number;
}

export interface InvoiceRow {
  id: string;
  student_id: string;
  source_name: string;
  source_media_type: string;
  source_path: string;
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
}

export interface PaymentRow {
  id: string;
  invoice_id: string;
  base_key: string;
  attempt: number;
  external_id: string;
  invoice_amount: number;
  pay_amount: number;
  currency: string;
  gobtc_payment_id: string | null;
  job_id: string | null;
  payment_tx_id: string | null;
  amount_sats: number | null;
  fee_sats: number | null;
  status: string;
  error: string | null;
  paid_seen_at: string | null;
  settled_at: number | null;
  txids: string | null;
  rate_at_request: number | null;
  request_expires_at: number | null;
  created_at: string;
  updated_at: string;
}

export function getMandate(studentId: string): MandateRow | undefined {
  const m = getDb()
    .prepare('SELECT * FROM mandates WHERE student_id = ? AND active = 1')
    .get(studentId) as MandateRow | undefined;
  // Keep the demo payee pinned to the configured merchant once it exists.
  if (m && m.approved_payee_merchant_id === 'unset' && process.env.GOBTC_MERCHANT_ID) {
    getDb()
      .prepare('UPDATE mandates SET approved_payee_merchant_id = ? WHERE id = ?')
      .run(process.env.GOBTC_MERCHANT_ID, m.id);
    m.approved_payee_merchant_id = process.env.GOBTC_MERCHANT_ID;
  }
  return m;
}
