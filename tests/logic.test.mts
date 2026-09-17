// Offline checks for the mandate rules and the refusal / duplicate paths (no network, no BTC).
// Run: npm run test:logic
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

process.chdir(join(import.meta.dirname, '..'));
const TEST_DIR = join(process.cwd(), '.test-data');
rmSync(TEST_DIR, { recursive: true, force: true });
mkdirSync(TEST_DIR, { recursive: true });
process.env.TUITIONPILOT_DB = join(TEST_DIR, 'test.db');
process.env.TUITIONPILOT_UPLOADS = join(TEST_DIR, 'uploads');
process.env.GOBTC_MERCHANT_ID = 'merchant-approved';
process.env.PAYMENTS_ENABLED = 'false';

const { getDb, getMandate } = await import('../lib/db');
const { checkMandate } = await import('../lib/mandate');
const { payInvoice, externalIdFor } = await import('../lib/payments');
const { createInvoice } = await import('../lib/samples');

const db = getDb();
db.exec("DELETE FROM events; DELETE FROM payments; DELETE FROM invoices; UPDATE mandates SET approved_payee_merchant_id='merchant-approved', max_per_term=9000, pay_window_days=21, autopay=1;");

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function invoice(fields: Record<string, unknown>) {
  const id = createInvoice({ name: 'test.txt', mediaType: 'text/plain', data: Buffer.from('test') });
  const base = {
    payee_name: 'Northshore University Bursar',
    payee_merchant_id: 'merchant-approved',
    student_number: 'NSU-2026-48213',
    term: 'Fall 2026',
    amount: 8450,
    currency: 'CAD',
    due_date: inDays(10),
    reference: 'REF-1',
    ...fields,
  };
  db.prepare(
    `UPDATE invoices SET payee_name=@payee_name, payee_merchant_id=@payee_merchant_id, student_number=@student_number, term=@term,
       amount=@amount, currency=@currency, due_date=@due_date, reference=@reference, status='extracted' WHERE id=@id`,
  ).run({ ...base, id });
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
}

const mandate = getMandate('stu_demo');
const failed = (inv: any) => checkMandate(inv, mandate).checks.filter((c) => !c.passed).map((c) => c.rule);

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed++;
    console.log(`✓ ${name}`);
  });
}

await test('valid invoice passes every rule', () => assert.deepEqual(failed(invoice({})), []));
await test('wrong payee is refused', () => assert.deepEqual(failed(invoice({ payee_merchant_id: 'evil', reference: 'R2' })), ['approved_payee']));
await test('over the term cap is refused', () => assert.deepEqual(failed(invoice({ amount: 12400, reference: 'R3' })), ['term_cap']));
await test('too early is refused', () => assert.deepEqual(failed(invoice({ due_date: inDays(40), reference: 'R4' })), ['pay_window']));
await test('past due needs a human', () => assert.deepEqual(failed(invoice({ due_date: inDays(-1), reference: 'R5' })), ['pay_window']));
await test('wrong currency is refused', () => assert.deepEqual(failed(invoice({ currency: 'USD', reference: 'R6' })), ['currency']));
await test('other student is refused', () => assert.deepEqual(failed(invoice({ student_number: 'NSU-1', reference: 'R7' })), ['student_match']));
await test('unreadable due date is refused', () => assert.deepEqual(failed(invoice({ due_date: 'Oct 1', reference: 'R9' })), ['pay_window']));
await test('missing fields are refused', () => assert.deepEqual(failed(invoice({ amount: null, reference: 'R8' })), ['invoice_complete']));

await test('externalId is stable for the same invoice content', () => {
  const a = invoice({ reference: 'SAME' });
  const b = invoice({ reference: 'SAME' });
  assert.equal(externalIdFor(a), externalIdFor(b));
  assert.notEqual(externalIdFor(a), externalIdFor(invoice({ reference: 'SAME', amount: 8451 })));
});

await test('payInvoice refuses a wrong payee without creating a payment', async () => {
  const inv = invoice({ payee_merchant_id: 'evil', reference: 'P1' });
  const r = await payInvoice(inv.id);
  assert.equal(r.status, 'refused');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments WHERE invoice_id = ?').get(inv.id).n, 0);
});

await test('payInvoice reports a duplicate upload instead of paying again', async () => {
  const first = invoice({ reference: 'DUP' });
  db.prepare(
    `INSERT INTO payments (id, invoice_id, base_key, external_id, invoice_amount, pay_amount, currency, status)
     VALUES ('pay_x', ?, ?, ?, 8450, 1.69, 'CAD', 'paid')`,
  ).run(first.id, externalIdFor(first), `${externalIdFor(first)}-a1`);
  const second = invoice({ reference: 'DUP' });
  const r = await payInvoice(second.id);
  assert.equal(r.status, 'duplicate');
});

await test('the mandate check itself reports a re-uploaded paid invoice as a duplicate', () => {
  const again = invoice({ reference: 'DUP' });
  const result = checkMandate(again, mandate);
  assert.equal(result.ok, false);
  assert.ok(failed(again).includes('not_duplicate'));
  assert.match(result.reasons[0], /^Duplicate/);
});

await test('term cap counts payments already committed this term', () => {
  const inv = invoice({ amount: 1000, reference: 'CAP2' });
  assert.deepEqual(failed(inv), ['term_cap']); // 8450 already paid for "DUP" + 1000 > 9000
});

await test('a claimed payment is never paid twice', async () => {
  const inv = invoice({ reference: 'CLAIM', term: 'Winter 2027' });
  db.prepare(
    `INSERT INTO payments (id, invoice_id, base_key, external_id, invoice_amount, pay_amount, currency, status)
     VALUES ('pay_y', ?, ?, ?, 8450, 1.69, 'CAD', 'submitted')`,
  ).run(inv.id, externalIdFor(inv), `${externalIdFor(inv)}-a1`);
  const r = await payInvoice(inv.id);
  assert.equal(r.status, 'submitted');
  assert.match(r.message, /no second payment/);
});

console.log(`\n${passed} passed`);
db.exec("DELETE FROM events; DELETE FROM payments; DELETE FROM invoices;");
