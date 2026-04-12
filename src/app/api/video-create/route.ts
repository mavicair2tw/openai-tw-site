import { NextResponse } from 'next/server';

const API_URL = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.6/text-to-video';

export async function POST(req: Request) {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing WAVESPEED_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '16:9';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: aspectRatio,
      }),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? JSON.parse(text || '{}') : { raw: text };

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
