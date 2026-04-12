import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));

  return NextResponse.json(
    {
      error:
        'Google image-to-video requires Vertex AI Veo image-to-video wiring. GOOGLE_API_KEY alone is not enough.',
      provider: 'google',
      modelFamily: 'veo',
      location,
      projectId: projectId || null,
      needsVertexAI: true,
      received: body,
    },
    { status: 501 },
  );
}
