import { NextResponse } from 'next/server';
import { deleteImageRecord, isMediaDatabaseConfigError } from '@/lib/media-store';

const ALLOW_MEDIA_DELETE = process.env.MEDIA_DELETE_ENABLED === 'true';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!ALLOW_MEDIA_DELETE) {
    return NextResponse.json({ error: 'Media deletion is disabled.' }, { status: 403 });
  }

  try {
    await deleteImageRecord(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete image.';
    return NextResponse.json(
      {
        error: message,
        needsDatabaseConfig: isMediaDatabaseConfigError(error),
      },
      { status: isMediaDatabaseConfigError(error) ? 500 : 502 },
    );
  }
}
