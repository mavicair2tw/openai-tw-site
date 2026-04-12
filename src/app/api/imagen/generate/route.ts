import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addImageRecord } from '@/lib/media-store';
import { normalizePrivateKey } from '@/lib/google-cloud';
import { buildMediaObjectPath, buildPublicMediaUrl, getMediaBucket } from '@/lib/google-cloud';

type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type GoogleApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      '@type'?: string;
      reason?: string;
      domain?: string;
      metadata?: Record<string, string>;
    }>;
  };
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

const VERTEX_IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'imagen-4.0-generate-001';

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getVertexEnv() {
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
    privateKey: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || ''),
  };
}

function extractGoogleReason(data: GoogleApiErrorPayload) {
  const details = data?.error?.details || [];
  return details.find((detail) => detail?.reason)?.reason || data?.error?.status;
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
    provider: 'google',
    backend: 'unknown',
    status: 500,
    reason: null,
    message: error instanceof Error ? error.message : 'Unknown image generation error',
  };
}

async function getAccessToken() {
  const { clientEmail, privateKey } = getVertexEnv();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<AccessTokenResponse> & GoogleApiErrorPayload & { error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new ImageGenerationError(data.error_description || data.error?.message || 'Failed to obtain Google access token', {
      status: response.status || 500,
      provider: 'google',
      backend: 'vertex-ai-auth',
      reason: extractGoogleReason(data),
    });
  }

  return data.access_token;
}

function getImageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'png';
}

async function persistGeneratedImage(params: { imageBase64: string; mimeType: string; prompt: string; aspectRatio: string }) {
  const { imageBase64, mimeType, prompt, aspectRatio } = params;
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extension = getImageExtension(mimeType);
  const filename = `${id}.${extension}`;
  const objectPath = buildMediaObjectPath('images', filename);
  const bucket = getMediaBucket();

  await bucket.file(objectPath).save(Buffer.from(imageBase64, 'base64'), {
    resumable: false,
    contentType: mimeType,
    public: true,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const image = {
    id,
    imageUrl: buildPublicMediaUrl(bucket.name, objectPath),
    prompt,
    aspectRatio,
    timestamp: Date.now(),
    objectPath,
  };

  await addImageRecord(image);
  return image;
}

async function generateWithVertex(prompt: string, aspectRatio: string) {
  const { projectId, location } = getVertexEnv();
  const accessToken = await getAccessToken();
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_IMAGE_MODEL}:predict`;

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    }),
  });

  const data = (await upstream.json().catch(() => ({}))) as GoogleApiErrorPayload & {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    generatedImages?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };

  if (!upstream.ok) {
    throw new ImageGenerationError(data?.error?.message || 'Vertex AI Imagen request failed', {
      status: upstream.status || 500,
      provider: 'google',
      backend: 'vertex-ai',
      reason: extractGoogleReason(data),
    });
  }

  const prediction = data?.predictions?.[0];
  const generatedImage = data?.generatedImages?.[0];
  const imageBase64 = prediction?.bytesBase64Encoded || generatedImage?.bytesBase64Encoded;
  const mimeType = prediction?.mimeType || generatedImage?.mimeType || 'image/png';

  if (!imageBase64) {
    throw new ImageGenerationError('No image returned from Vertex AI Imagen', {
      status: 502,
      provider: 'google',
      backend: 'vertex-ai',
      reason: 'EMPTY_IMAGE_RESPONSE',
    });
  }

  const image = await persistGeneratedImage({ imageBase64, mimeType, prompt, aspectRatio });

  return {
    image,
    imageUrl: image.imageUrl,
    provider: 'google',
    model: VERTEX_IMAGE_MODEL,
    backend: 'vertex-ai',
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const { projectId, clientEmail, privateKey } = getVertexEnv();
  const hasVertexConfig = Boolean(projectId && clientEmail && privateKey);

  if (!hasVertexConfig) {
    return NextResponse.json(
      {
        error:
          'Missing Vertex AI image credentials. Set GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY.',
        provider: 'google',
        backend: 'vertex-ai',
        needsGoogleCredentials: true,
      },
      { status: 501 },
    );
  }

  try {
    const result = await generateWithVertex(prompt, aspectRatio);
    return NextResponse.json(result);
  } catch (error) {
    const failure = serializeFailure(error);
    return NextResponse.json(
      {
        error: failure.message,
        provider: 'google',
        backend: 'vertex-ai',
        failures: [failure],
        needsGoogleCredentials: ['API_KEY_INVALID', 'PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(failure.reason || ''),
      },
      { status: failure.status },
    );
  }
}
