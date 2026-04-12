import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '16:9';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        'Google video generation requires Vertex AI Veo setup, not just GOOGLE_API_KEY. Configure GOOGLE_CLOUD_PROJECT and Vertex AI auth for real video generation.',
      provider: 'google',
      modelFamily: 'veo',
      location,
      projectId: projectId || null,
      needsVertexAI: true,
      aspectRatio,
    },
    { status: 501 },
  );
}
