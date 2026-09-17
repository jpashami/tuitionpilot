import { NextRequest, NextResponse } from 'next/server';
import { getDb, getMandate, type StudentRow } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const student = getDb().prepare("SELECT * FROM students WHERE id = 'stu_demo'").get() as StudentRow;
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
      "UPDATE mandates SET max_per_term = ?, pay_window_days = ?, autopay = ?, updated_at = datetime('now') WHERE student_id = 'stu_demo'",
    )
    .run(max, Math.round(days), body.autopay ? 1 : 0);
  return NextResponse.json({ mandate: getMandate('stu_demo') });
}
