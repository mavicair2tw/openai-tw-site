import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        `Google Imagen is not fully configured yet. This route needs Vertex AI setup (project, location, and cloud auth), not just a browser-side API call. Received aspectRatio=${aspectRatio}.`,
      provider: 'google',
      modelFamily: 'imagen',
      needsVertexAI: true,
    },
    { status: 501 },
  );
}
