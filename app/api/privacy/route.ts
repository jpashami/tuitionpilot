import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { eraseFamily, findPersonByCode, personalDataExport } from '@/lib/kyc';

export const runtime = 'nodejs';

/** PIPEDA self-service: view, export, withdraw a consent, or erase. Authenticated by email + the privacy code shown at registration. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, code, action } = body as { email?: string; code?: string; action?: string };
  if (!email || !code) return NextResponse.json({ error: 'Email and privacy code are required.' }, { status: 400 });

  const person = findPersonByCode(email, code);
  // Same response for "no such person" and "wrong code", so the page can't be used to test emails.
  if (!person) return NextResponse.json({ error: 'No record matches that email and code.' }, { status: 404 });

  const db = getDb();
  switch (action) {
    case 'view':
    case 'export': {
      db.prepare("INSERT INTO privacy_requests (person_id, kind, completed_at) VALUES (?, ?, datetime('now'))").run(person.id, action === 'export' ? 'export' : 'access');
      return NextResponse.json({ data: personalDataExport(person.student_id) });
    }
    case 'withdraw_consent': {
      const purpose = String(body.purpose ?? '');
      if (!['receipts_to_student', 'product_updates'].includes(purpose)) {
        return NextResponse.json({ error: 'Only optional consents can be withdrawn while the service is in use. To withdraw the required ones, erase your data.' }, { status: 400 });
      }
      db.prepare("UPDATE consents SET withdrawn_at = datetime('now') WHERE person_id = ? AND purpose = ? AND withdrawn_at IS NULL").run(person.id, purpose);
      db.prepare("INSERT INTO privacy_requests (person_id, kind, completed_at, note) VALUES (?, 'withdraw_consent', datetime('now'), ?)").run(person.id, purpose);
      return NextResponse.json({ data: personalDataExport(person.student_id) });
    }
    case 'erase': {
      if (person.role !== 'payer') return NextResponse.json({ error: 'Only the payer (account holder) can erase the family’s data.' }, { status: 403 });
      return NextResponse.json(eraseFamily(person.student_id, person.id));
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
