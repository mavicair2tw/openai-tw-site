import { NextResponse } from 'next/server';

const OPENAI_VIDEO_MODEL = process.env.OPENAI_VIDEO_MODEL?.trim() || 'sora';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '16:9';
  const durationSeconds = body?.durationSeconds === 6 || body?.durationSeconds === 8 ? body.durationSeconds : 4;

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  if (!['16:9', '9:16'].includes(aspectRatio)) {
    return NextResponse.json({ error: 'Video generation currently supports only 16:9 and 9:16 in this UI.' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        'Video generation has not been migrated to a non-Google provider yet. Media storage is now Cloudflare R2 + D1 ready, but the generation backend still needs a new provider wiring.',
      provider: 'openai',
      backend: 'pending-provider-migration',
      model: OPENAI_VIDEO_MODEL,
      aspectRatio,
      durationSeconds,
      pending: false,
      needsProviderMigration: true,
    },
    { status: 501 },
  );
}
