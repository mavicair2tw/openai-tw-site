import { NextResponse } from 'next/server';

const IMAGEN_MODEL = 'imagen-4.0-generate-001';

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

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
          },
        }),
      },
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Google image generation failed' },
        { status: upstream.status },
      );
    }

    const imageBase64 =
      data?.predictions?.[0]?.bytesBase64Encoded ||
      data?.generatedImages?.[0]?.image?.imageBytes ||
      data?.generatedImages?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image returned from Google Imagen' }, { status: 502 });
    }

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64}`,
      provider: 'google',
      model: IMAGEN_MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
