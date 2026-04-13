import { NextResponse } from 'next/server';
import { addImageRecord } from '@/lib/media-store';
import { buildMediaObjectPath, buildPublicMediaUrl, normalizeEnvValue, uploadMediaObject } from '@/lib/cloudflare';

type XaiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
};

class ImageGenerationError extends Error {
  status: number;
  provider: string;
  backend: string;
  reason?: string;

  constructor(message: string, options: { status?: number; provider: string; backend: string; reason?: string }) {
    super(message);
    this.name = 'ImageGenerationError';
    this.status = options.status ?? 500;
    this.provider = options.provider;
    this.backend = options.backend;
    this.reason = options.reason;
  }
}

const XAI_IMAGE_MODEL = 'grok-imagine-image';

function getImageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'png';
}

function serializeFailure(error: unknown) {
  if (error instanceof ImageGenerationError) {
    return {
      provider: error.provider,
      backend: error.backend,
      status: error.status,
      reason: error.reason || null,
      message: error.message,
    };
  }

  return {
    provider: 'xai',
    backend: 'imagine-api',
    status: 500,
    reason: null,
    message: error instanceof Error ? error.message : 'Unknown image generation error',
  };
}

async function resolveGeneratedImageAsset(data: XaiImageResponse) {
  const generated = data.data?.[0];
  if (!generated) {
    throw new ImageGenerationError('No image returned from xAI Imagine API.', {
      status: 502,
      provider: 'xai',
      backend: 'imagine-api',
      reason: 'EMPTY_IMAGE_RESPONSE',
    });
  }

  if (generated.b64_json) {
    return {
      bytes: Buffer.from(generated.b64_json, 'base64'),
      mimeType: 'image/png',
      revisedPrompt: generated.revised_prompt,
    };
  }

  if (generated.url) {
    const upstream = await fetch(generated.url);
    if (!upstream.ok) {
      throw new ImageGenerationError('xAI returned an image URL that could not be downloaded.', {
        status: 502,
        provider: 'xai',
        backend: 'imagine-api',
        reason: 'IMAGE_DOWNLOAD_FAILED',
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    return {
      bytes: Buffer.from(arrayBuffer),
      mimeType: upstream.headers.get('content-type') || 'image/png',
      revisedPrompt: generated.revised_prompt,
    };
  }

  throw new ImageGenerationError('xAI did not return image bytes or a downloadable URL.', {
    status: 502,
    provider: 'xai',
    backend: 'imagine-api',
    reason: 'EMPTY_IMAGE_RESPONSE',
  });
}

async function persistGeneratedImage(params: { bytes: Buffer; mimeType: string; prompt: string; aspectRatio: string }) {
  const { bytes, mimeType, prompt, aspectRatio } = params;
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extension = getImageExtension(mimeType);
  const filename = `${id}.${extension}`;
  const objectPath = buildMediaObjectPath('images', filename);
  const publicUrl = await uploadMediaObject({ objectPath, body: bytes, contentType: mimeType });

  const image = {
    id,
    imageUrl: buildPublicMediaUrl(objectPath) || publicUrl,
    prompt,
    aspectRatio,
    timestamp: Date.now(),
    objectPath,
  };

  await addImageRecord(image);
  return image;
}

async function generateWithXai(prompt: string, aspectRatio: string) {
  const apiKey = normalizeEnvValue(process.env.XAI_API_KEY);
  const upstream = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_IMAGE_MODEL,
      prompt,
      aspect_ratio: aspectRatio,
    }),
  });

  const data = (await upstream.json().catch(() => ({}))) as XaiImageResponse;
  if (!upstream.ok) {
    throw new ImageGenerationError('xAI image generation failed with status ' + upstream.status, {
      status: upstream.status || 500,
      provider: 'xai',
      backend: 'imagine-api',
      reason: 'API_ERROR',
    });
  }

  const asset = await resolveGeneratedImageAsset(data);
  const image = await persistGeneratedImage({
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    prompt: asset.revisedPrompt || prompt,
    aspectRatio,
  });

  return {
    image,
    imageUrl: image.imageUrl,
    provider: 'xai',
    model: XAI_IMAGE_MODEL,
    backend: 'imagine-api',
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  if (!normalizeEnvValue(process.env.XAI_API_KEY)) {
    return NextResponse.json(
      {
        error: 'Missing XAI_API_KEY for image generation.',
        provider: 'xai',
        backend: 'imagine-api',
        needsXaiCredentials: true,
      },
      { status: 501 },
    );
  }

  try {
    const result = await generateWithXai(prompt, aspectRatio);
    return NextResponse.json(result);
  } catch (error) {
    const failure = serializeFailure(error);
    return NextResponse.json(
      {
        error: failure.message,
        provider: 'xai',
        backend: 'imagine-api',
        failures: [failure],
        needsXaiCredentials: ['invalid_api_key', 'authentication_error'].includes(failure.reason || ''),
      },
      { status: failure.status },
    );
  }
}
