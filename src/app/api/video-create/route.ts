import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { addVideoRecord } from '@/lib/media-store';

const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-fast-generate-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function buildTitle(prompt: string) {
  return prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY or GOOGLE_API_KEY.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '16:9';
  const durationSeconds = body?.durationSeconds === 6 || body?.durationSeconds === 8 ? body.durationSeconds : 4;

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  if (!['16:9', '9:16'].includes(aspectRatio)) {
    return NextResponse.json({ error: 'Veo currently supports only 16:9 and 9:16 in this UI.' }, { status: 400 });
  }

  try {
    const startResponse = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_VIDEO_MODEL}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio,
          durationSeconds,
          resolution: '720p',
        },
      }),
    });

    const startData = await startResponse.json().catch(() => ({}));
    if (!startResponse.ok || !startData?.name) {
      throw new Error(startData?.error?.message || 'Failed to start Veo video generation.');
    }

    let operation = startData;
    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      if (operation?.done) break;
      await sleep(POLL_INTERVAL_MS);

      const pollResponse = await fetch(`${GEMINI_API_BASE}/${startData.name}`, {
        headers: { 'x-goog-api-key': apiKey },
      });
      operation = await pollResponse.json().catch(() => ({}));

      if (!pollResponse.ok) {
        throw new Error(operation?.error?.message || 'Failed while polling Veo operation.');
      }
    }

    if (!operation?.done) {
      return NextResponse.json(
        {
          error: 'Video generation is still running. Try again in a moment, or increase the polling window.',
          operationName: startData.name,
          provider: 'google',
          model: GEMINI_VIDEO_MODEL,
          pending: true,
        },
        { status: 202 },
      );
    }

    if (operation?.error?.message) {
      throw new Error(operation.error.message);
    }

    const videoUri = operation?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error('Veo completed without returning a downloadable video URI.');
    }

    const downloadResponse = await fetch(videoUri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text().catch(() => '');
      throw new Error(errorText || 'Failed to download generated video from Google.');
    }

    const bytes = Buffer.from(await downloadResponse.arrayBuffer());
    const outputDir = path.join(process.cwd(), 'public', 'generated-videos');
    await mkdir(outputDir, { recursive: true });

    const filename = `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const outputPath = path.join(outputDir, filename);
    await writeFile(outputPath, bytes);

    const video = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: buildTitle(prompt) || 'Generated video',
      src: `/api/generated-video/${filename}`,
      duration: `${durationSeconds}s`,
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      demo: false,
    };

    await addVideoRecord(video);

    return NextResponse.json({
      video,
      videoUrl: video.src,
      title: video.title,
      duration: video.duration,
      aspectRatio,
      provider: 'google',
      model: GEMINI_VIDEO_MODEL,
      demo: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video generation failed.';
    return NextResponse.json({ error: message, provider: 'google', model: GEMINI_VIDEO_MODEL }, { status: 500 });
  }
}
