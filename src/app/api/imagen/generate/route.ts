import { NextResponse } from 'next/server';
import crypto from 'crypto';

type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';

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
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
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

  const data = (await response.json().catch(() => ({}))) as Partial<AccessTokenResponse> & { error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'Failed to obtain Google access token');
  }

  return data.access_token;
}

async function generateWithGemini(prompt: string, aspectRatio: string) {
  const apiKey = getGeminiApiKey();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: '1K',
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Gemini image generation failed');
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part?.inlineData?.data);
  const imageBase64 = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType || 'image/png';

  if (!imageBase64) {
    throw new Error('Gemini did not return an image');
  }

  return {
    imageUrl: `data:${mimeType};base64,${imageBase64}`,
    provider: 'google',
    model: GEMINI_IMAGE_MODEL,
    backend: 'gemini-api',
  };
}

async function generateWithVertex(prompt: string, aspectRatio: string) {
  const { projectId, location } = getVertexEnv();
  const accessToken = await getAccessToken();
  const model = 'imagen-4.0-generate-001';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

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

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    throw new Error(data?.error?.message || 'Vertex AI Imagen request failed');
  }

  const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded || data?.generatedImages?.[0]?.bytesBase64Encoded;
  if (!imageBase64) {
    throw new Error('No image returned from Vertex AI Imagen');
  }

  return {
    imageUrl: `data:image/png;base64,${imageBase64}`,
    provider: 'google',
    model,
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

  try {
    const geminiApiKey = getGeminiApiKey();
    if (geminiApiKey) {
      const result = await generateWithGemini(prompt, aspectRatio);
      return NextResponse.json(result);
    }

    const { projectId, clientEmail, privateKey } = getVertexEnv();
    if (projectId && clientEmail && privateKey) {
      const result = await generateWithVertex(prompt, aspectRatio);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        error:
          'Missing Google image credentials. Set GEMINI_API_KEY (or GOOGLE_API_KEY) for the Gemini image API, or configure Vertex AI with GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY.',
        provider: 'google',
        needsGoogleCredentials: true,
      },
      { status: 501 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
