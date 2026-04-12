import { NextResponse } from 'next/server';

const API_URL = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.6/image-to-video-flash';

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
  }

  const body = await req.json();

  return NextResponse.json(
    {
      error:
        'Google image-to-video route is selected, but the exact Google endpoint is not wired yet. Remove old WaveSpeed usage before production.',
      provider: 'google',
      needsImplementation: true,
      received: body,
    },
    { status: 501 },
  );
}
