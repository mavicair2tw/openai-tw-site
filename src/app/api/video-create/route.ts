import { NextResponse } from 'next/server';
import { normalizeEnvValue, d1Exec } from '@/lib/cloudflare';

const XAI_VIDEO_MODEL = 'grok-imagine-video';

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

  const apiKey = normalizeEnvValue(process.env.XAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Missing XAI_API_KEY for video generation.',
        provider: 'xai',
        backend: 'imagine-api',
        needsXaiCredentials: true,
      },
      { status: 501 },
    );
  }

  try {
    const response = await fetch('https://api.x.ai/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: XAI_VIDEO_MODEL,
        prompt,
        aspect_ratio: aspectRatio,
        duration: durationSeconds,
        resolution: '480p',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'xAI video generation failed.');
    }

    const requestId = data.request_id;
    if (!requestId) {
      throw new Error('No request_id returned from xAI.');
    }

    const jobId = `job-vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();

    await d1Exec(
      `
      INSERT INTO media_gallery_jobs (id, status, provider, model, request_id, prompt, aspect_ratio, duration_seconds, timestamp)
      VALUES (?, 'pending', 'xai', ?, ?, ?, ?, ?, ?)
    `,
      [jobId, XAI_VIDEO_MODEL, requestId, prompt, aspectRatio, durationSeconds, timestamp],
    );

    return NextResponse.json({
      jobId,
      status: 'pending',
      provider: 'xai',
      backend: 'imagine-api',
      model: XAI_VIDEO_MODEL,
      aspectRatio,
      durationSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video creation failed';
    return NextResponse.json(
      {
        error: message,
        provider: 'xai',
        backend: 'imagine-api',
      },
      { status: 500 },
    );
  }
}
