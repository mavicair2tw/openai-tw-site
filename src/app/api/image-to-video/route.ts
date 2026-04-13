import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return NextResponse.json(
    {
      error:
        'Image-to-video is not wired to a non-Google provider yet. Cloudflare R2 + D1 is now the target storage path, but generation still needs a replacement backend.',
      provider: 'openai',
      backend: 'pending-provider-migration',
      needsProviderMigration: true,
      received: body,
    },
    { status: 501 },
  );
}
