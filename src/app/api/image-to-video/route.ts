import { NextResponse } from 'next/server';

const API_URL = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.6/image-to-video-flash';

export async function POST(req: Request) {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing WAVESPEED_API_KEY' }, { status: 500 });
  }

  const body = await req.json();

  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? JSON.parse(text || '{}') : { raw: text };

  return NextResponse.json(data, { status: upstream.status });
}
