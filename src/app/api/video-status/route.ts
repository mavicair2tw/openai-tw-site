import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const video = await client.videos.retrieve(id);
    const response: any = { data: video };
    try {
      if (video.status === 'completed') {
        const content = await client.videos.downloadContent(id);
        const blob = await content.blob();
        response.url = URL.createObjectURL(blob);
      }
    } catch {}
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI video status failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
