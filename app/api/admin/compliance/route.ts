import { NextRequest, NextResponse } from 'next/server';
import { complianceQueue, reviewDocument } from '@/lib/kyc';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ persons: complianceQueue() });
}

/** Compliance officer decision on one document. No sign-in in the demo — see the note on the Admin page. */
export async function POST(req: NextRequest) {
  const { docId, decision, note } = await req.json();
  if (!docId || !['accepted', 'rejected'].includes(decision)) return NextResponse.json({ error: 'docId and decision required' }, { status: 400 });
  return NextResponse.json(reviewDocument(String(docId), decision, String(note ?? ''), 'compliance officer (demo)'));
}
