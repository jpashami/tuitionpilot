import { NextRequest, NextResponse } from 'next/server';
import { CONSENT_PURPOSES, DOC_TYPES, registerFamily, type DocInput, type DocType } from '@/lib/kyc';

export const runtime = 'nodejs';

const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({
    docTypes: Object.entries(DOC_TYPES).map(([id, d]) => ({ id, ...d })),
    consents: CONSENT_PURPOSES,
  });
}

/** multipart/form-data: a JSON "form" field plus files named doc_<index> for each entry in form.docs. */
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const form = JSON.parse(String(fd.get('form') ?? '{}'));

    const readDocs = async (list: any[], prefix: string): Promise<DocInput[]> => {
      const out: DocInput[] = [];
      for (const [i, d] of (list ?? []).entries()) {
        if (!(d.doc_type in DOC_TYPES)) throw new Error(`Unknown document type ${d.doc_type}`);
        const file = fd.get(`${prefix}_${i}`);
        let fileInput: DocInput['file'];
        if (file instanceof File && file.size > 0) {
          if (!FILE_TYPES.includes(file.type)) throw new Error(`${file.name}: only PDF, PNG, JPEG or WebP`);
          if (file.size > MAX_BYTES) throw new Error(`${file.name}: 10 MB max`);
          fileInput = { name: file.name, mediaType: file.type, data: Buffer.from(await file.arrayBuffer()) };
        }
        out.push({ doc_type: d.doc_type as DocType, issuer: d.issuer, number_last4: d.number_last4, expires_on: d.expires_on, file: fileInput });
      }
      return out;
    };

    const result = registerFamily({
      student: form.student,
      payer: form.payer,
      mandate: { max_per_term: Number(form.mandate?.max_per_term), pay_window_days: Number(form.mandate?.pay_window_days), autopay: !!form.mandate?.autopay },
      payerDocs: await readDocs(form.payerDocs, 'payer'),
      studentDocs: await readDocs(form.studentDocs, 'student'),
      consents: form.consents ?? [],
      selfPaying: !!form.selfPaying,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
