import { NextResponse } from 'next/server';

const demoVideos = {
  '16:9': 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  '9:16': 'https://www.w3schools.com/html/movie.mp4',
  '1:1': 'https://www.w3schools.com/html/mov_bbb.mp4',
} as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '16:9';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const videoUrl = demoVideos[aspectRatio as keyof typeof demoVideos] || demoVideos['16:9'];
  const title = prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt;

  return NextResponse.json({
    videoUrl,
    title: title || 'Generated video',
    duration: 'Demo clip',
    aspectRatio,
    provider: 'demo',
    demo: true,
    warning: 'Vertex AI Veo is not configured yet, so a demo video clip was added to let you test the full Studio → Video Gallery → Player flow.',
  });
}
