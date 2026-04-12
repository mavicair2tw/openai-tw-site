import { NextResponse } from 'next/server';
import { deleteVideoRecord } from '@/lib/media-store';

const ALLOW_MEDIA_DELETE = process.env.NEXT_PUBLIC_ALLOW_MEDIA_DELETE === 'true';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!ALLOW_MEDIA_DELETE) {
    return NextResponse.json({ error: 'Media deletion is disabled.' }, { status: 403 });
  }

  await deleteVideoRecord(params.id);
  return NextResponse.json({ ok: true });
}
