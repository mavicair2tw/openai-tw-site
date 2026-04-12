import { NextResponse } from 'next/server';
import { deleteVideoRecord, isMediaDatabaseConfigError } from '@/lib/media-store';

const ALLOW_MEDIA_DELETE = process.env.MEDIA_DELETE_ENABLED === 'true';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!ALLOW_MEDIA_DELETE) {
    return NextResponse.json({ error: 'Media deletion is disabled.' }, { status: 403 });
  }

  try {
    await deleteVideoRecord(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete video.';
    return NextResponse.json(
      {
        error: message,
        needsDatabaseConfig: isMediaDatabaseConfigError(error),
      },
      { status: isMediaDatabaseConfigError(error) ? 500 : 502 },
    );
  }
}
