import { NextResponse } from 'next/server';
import { getMediaGallery, isMediaDatabaseConfigError } from '@/lib/media-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gallery = await getMediaGallery();
    return NextResponse.json(gallery);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load media gallery.';
    return NextResponse.json(
      {
        error: message,
        needsDatabaseConfig: isMediaDatabaseConfigError(error),
      },
      { status: isMediaDatabaseConfigError(error) ? 500 : 502 },
    );
  }
}
