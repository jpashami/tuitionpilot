import { NextRequest, NextResponse } from 'next/server';
import { getDb, getMandate, type StudentRow } from '@/lib/db';

export const runtime = 'nodejs';

function studentIdFrom(req: NextRequest) {
  return req.nextUrl.searchParams.get('student') || 'stu_demo';
}

export async function GET(req: NextRequest) {
  const student = getDb().prepare('SELECT * FROM students WHERE id = ?').get(studentIdFrom(req)) as StudentRow | undefined;
  if (!student) return NextResponse.json({ error: 'Unknown family' }, { status: 404 });
  return NextResponse.json({ student, mandate: getMandate(student.id) });
}

// Parents can change the cap, window and autopay. The payee stays pinned to the verified bursar.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const max = Number(body.max_per_term);
  const days = Number(body.pay_window_days);
  if (!(max > 0) || !(days >= 0 && days <= 120)) {
    return NextResponse.json({ error: 'Invalid cap or window' }, { status: 400 });
  }
  getDb()
    .prepare(
      "UPDATE mandates SET max_per_term = ?, pay_window_days = ?, autopay = ?, updated_at = datetime('now') WHERE student_id = ?",
    )
    .run(max, Math.round(days), body.autopay ? 1 : 0, studentIdFrom(req));
  return NextResponse.json({ mandate: getMandate(studentIdFrom(req)) });
}
