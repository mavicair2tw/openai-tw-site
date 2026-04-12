import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addVideoRecord } from '@/lib/media-store';
import {
  buildMediaObjectPath,
  buildPublicMediaUrl,
  getGoogleCloudConfig,
  getMediaBucket,
  getSignedMediaUrl,
  normalizeEnvValue,
  normalizePrivateKey,
} from '@/lib/google-cloud';

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

const VERTEX_VIDEO_MODEL =
  normalizeEnvValue(process.env.VERTEX_VIDEO_MODEL) || normalizeEnvValue(process.env.GEMINI_VIDEO_MODEL) || 'veo-3.1-fast-generate-preview';
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

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
    location: normalizeEnvValue(process.env.GOOGLE_CLOUD_LOCATION) || 'us-central1',
    clientEmail: normalizeEnvValue(process.env.GOOGLE_CLIENT_EMAIL),
    privateKey: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || ''),
  };
}

function extractGoogleErrorMessage(data: GoogleApiErrorPayload, fallback: string) {
  return data?.error?.message || fallback;
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

  const data = (await response.json().catch(() => ({}))) as Partial<AccessTokenResponse> & GoogleApiErrorPayload & {
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || extractGoogleErrorMessage(data, 'Failed to obtain Google access token.'));
  }

  return data.access_token;
}

function buildTitle(prompt: string) {
  return prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt;
}

function parseGcsUri(uri: string) {
  if (!uri.startsWith('gs://')) {
    return null;
  }

  const withoutScheme = uri.slice('gs://'.length);
  const firstSlash = withoutScheme.indexOf('/');
  if (firstSlash === -1) {
    return null;
  }

  return {
    bucketName: withoutScheme.slice(0, firstSlash),
    objectPath: withoutScheme.slice(firstSlash + 1),
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  const { projectId, location, clientEmail, privateKey } = getVertexEnv();
  if (!projectId || !clientEmail || !privateKey) {
    return NextResponse.json(
      {
        error:
          'Missing Vertex AI credentials. Set GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY.',
        provider: 'google',
        backend: 'vertex-ai',
        needsGoogleCredentials: true,
      },
      { status: 500 },
    );
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
    const accessToken = await getAccessToken();
    const modelResource = `projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_VIDEO_MODEL}`;
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/${modelResource}:predictLongRunning`;
    const bucket = getMediaBucket();
    const { mediaPrefix } = getGoogleCloudConfig();
    const outputFolder = `${mediaPrefix}/videos/veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storageUri = `gs://${bucket.name}/${outputFolder}/`;

    const startResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio,
          durationSeconds,
          resolution: '720p',
          sampleCount: 1,
          storageUri,
        },
      }),
    });

    const startData = (await startResponse.json().catch(() => ({}))) as GoogleApiErrorPayload & { name?: string; done?: boolean };
    if (!startResponse.ok || !startData?.name) {
      throw new Error(extractGoogleErrorMessage(startData, 'Failed to start Veo video generation.'));
    }

    let operation = startData as GoogleApiErrorPayload & {
      name?: string;
      done?: boolean;
      response?: {
        videos?: Array<{
          gcsUri?: string;
          mimeType?: string;
        }>;
        generateVideoResponse?: {
          generatedSamples?: Array<{
            video?: { uri?: string };
          }>;
        };
      };
    };

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      if (operation?.done) break;
      await sleep(POLL_INTERVAL_MS);

      const pollResponse = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${modelResource}:fetchPredictOperation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ operationName: startData.name }),
      });
      operation = await pollResponse.json().catch(() => ({}));

      if (!pollResponse.ok) {
        throw new Error(extractGoogleErrorMessage(operation, 'Failed while polling Veo operation.'));
      }
    }

    if (!operation?.done) {
      return NextResponse.json(
        {
          error: 'Video generation is still running. Try again in a moment, or increase the polling window.',
          operationName: startData.name,
          provider: 'google',
          backend: 'vertex-ai',
          model: VERTEX_VIDEO_MODEL,
          pending: true,
        },
        { status: 202 },
      );
    }

    if (operation?.error?.message) {
      throw new Error(operation.error.message);
    }

    const generatedGcsUri = operation?.response?.videos?.[0]?.gcsUri;
    const parsedGcsUri = generatedGcsUri ? parseGcsUri(generatedGcsUri) : null;
    const previewVideoUri = operation?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    if (!parsedGcsUri?.objectPath && !previewVideoUri) {
      throw new Error('Veo completed without returning a usable video location.');
    }

    const objectPath = parsedGcsUri?.objectPath || buildMediaObjectPath('videos', `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
    const bucketName = parsedGcsUri?.bucketName || bucket.name;
    const signedUrl = parsedGcsUri?.objectPath ? await getSignedMediaUrl(parsedGcsUri.objectPath) : previewVideoUri;

    if (!signedUrl) {
      throw new Error('Veo completed but no signed video URL could be created.');
    }

    const video = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: buildTitle(prompt) || 'Generated video',
      src: buildPublicMediaUrl(bucketName, objectPath),
      duration: `${durationSeconds}s`,
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      demo: false,
      objectPath,
    };

    await addVideoRecord(video);

    return NextResponse.json({
      video: {
        ...video,
        src: signedUrl,
      },
      videoUrl: signedUrl,
      title: video.title,
      duration: video.duration,
      aspectRatio,
      provider: 'google',
      backend: 'vertex-ai',
      model: VERTEX_VIDEO_MODEL,
      demo: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video generation failed.';
    return NextResponse.json(
      { error: message, provider: 'google', backend: 'vertex-ai', model: VERTEX_VIDEO_MODEL },
      { status: 500 },
    );
  }
}
