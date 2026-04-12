import { NextResponse } from 'next/server';
import crypto from 'crypto';

type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getRequiredEnv() {
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
}

async function getAccessToken() {
  const { clientEmail, privateKey } = getRequiredEnv();
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const { projectId, location, clientEmail, privateKey } = getRequiredEnv();
  if (!projectId || !clientEmail || !privateKey) {
    return NextResponse.json(
      {
        error:
          'Missing Vertex AI credentials. Set GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY.',
        provider: 'google',
        modelFamily: 'imagen',
        needsVertexAI: true,
      },
      { status: 501 },
    );
  }

  try {
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
      return NextResponse.json(
        { error: data?.error?.message || 'Vertex AI Imagen request failed' },
        { status: upstream.status },
      );
    }

    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded || data?.generatedImages?.[0]?.bytesBase64Encoded;
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image returned from Vertex AI Imagen' }, { status: 502 });
    }

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64}`,
      provider: 'google',
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vertex AI Imagen request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
