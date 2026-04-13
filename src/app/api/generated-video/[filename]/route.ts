import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Generated videos are now expected to be served from Cloudflare R2 URLs. Refresh the gallery to get the latest media URL.',
    },
    { status: 410 },
  );
}
