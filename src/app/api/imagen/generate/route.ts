import { NextResponse } from 'next/server';

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';

function mapAspectRatioToSize(aspectRatio: string) {
  if (aspectRatio === '16:9') return '1536x1024';
  if (aspectRatio === '9:16') return '1024x1536';
  return '1024x1024';
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: mapAspectRatioToSize(aspectRatio),
      }),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Image generation failed' },
        { status: upstream.status },
      );
    }

    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image returned from provider' }, { status: 502 });
    }

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64}`,
      provider: 'openai',
      model: 'gpt-image-1',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
