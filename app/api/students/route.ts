import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

/** Active families, for the family selector on the agent console. */
export async function GET() {
  const students = getDb()
    .prepare(
      `SELECT s.id, s.name, s.university, s.student_number, s.parent_name,
              (SELECT verification_status FROM persons p WHERE p.student_id = s.id AND p.role = 'payer' AND p.erased_at IS NULL) AS payer_status
       FROM students s WHERE s.status = 'active' ORDER BY s.created_at, s.name`,
    )
    .all();
  return NextResponse.json({ students });
}
