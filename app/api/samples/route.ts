import { NextResponse } from 'next/server';
import { listSamples } from '@/lib/samples';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ samples: listSamples() });
}
