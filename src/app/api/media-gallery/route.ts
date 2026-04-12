import { NextResponse } from 'next/server';
import { getMediaGallery } from '@/lib/media-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gallery = await getMediaGallery();
  return NextResponse.json(gallery);
}
