import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Generated videos are now served from Google Cloud Storage URLs. Refresh the gallery to get the new media URL.',
    },
    { status: 410 },
  );
}
