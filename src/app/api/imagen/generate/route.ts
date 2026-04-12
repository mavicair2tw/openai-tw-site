import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        `Google image generation route is now Google-only, but the exact Imagen/Gemini image endpoint is not wired yet. Received aspectRatio=${aspectRatio}.`,
      provider: 'google',
      needsImplementation: true,
    },
    { status: 501 },
  );
}
