import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const body = await req.json();
  const mode = body.mode === 'image' ? 'image' : 'text';
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const image = typeof body.image === 'string' ? body.image : '';

  try {
    const video = mode === 'image'
      ? await client.videos.create({ model: 'sora-2', prompt, image })
      : await client.videos.create({ model: 'sora-2', prompt });

    return NextResponse.json({ data: video });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI video request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
