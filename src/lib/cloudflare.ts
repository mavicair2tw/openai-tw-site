import crypto from 'crypto';

type D1QueryResponse<T> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    results?: T[];
    meta?: Record<string, unknown>;
  }>;
};

class CloudflareConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareConfigError';
  }
}

let ensureMediaTablesPromise: Promise<void> | null = null;

export function normalizeEnvValue(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

function stripLeadingSlash(value: string) {
  return value.replace(/^\/+/, '');
}

export function getCloudflareConfig() {
  const accountId = normalizeEnvValue(process.env.CLOUDFLARE_ACCOUNT_ID);
  const apiToken = normalizeEnvValue(process.env.CLOUDFLARE_API_TOKEN);
  const d1DatabaseId = normalizeEnvValue(process.env.CLOUDFLARE_D1_DATABASE_ID);
  const r2Bucket = normalizeEnvValue(process.env.CLOUDFLARE_R2_BUCKET);
  const r2AccessKeyId = normalizeEnvValue(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const r2SecretAccessKey = normalizeEnvValue(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  const r2Endpoint = stripTrailingSlash(
    normalizeEnvValue(process.env.CLOUDFLARE_R2_ENDPOINT) || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
  );
  const r2PublicBaseUrl = stripTrailingSlash(normalizeEnvValue(process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL));
  const mediaPrefix = (normalizeEnvValue(process.env.CLOUDFLARE_R2_PREFIX) || 'media-gallery').replace(/^\/+|\/+$/g, '');

  return {
    accountId,
    apiToken,
    d1DatabaseId,
    r2Bucket,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2Endpoint,
    r2PublicBaseUrl,
    mediaPrefix,
  };
}

function requireCloudflareApiConfig() {
  const config = getCloudflareConfig();

  if (!config.accountId || !config.apiToken || !config.d1DatabaseId) {
    throw new CloudflareConfigError(
      'Missing Cloudflare D1 API credentials. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID.',
    );
  }

  return config;
}

function requireR2Config() {
  const config = getCloudflareConfig();

  if (!config.r2Bucket || !config.r2AccessKeyId || !config.r2SecretAccessKey || !config.r2Endpoint) {
    throw new CloudflareConfigError(
      'Missing Cloudflare R2 credentials. Set CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_ENDPOINT or CLOUDFLARE_ACCOUNT_ID.',
    );
  }

  if (!config.r2PublicBaseUrl) {
    throw new CloudflareConfigError('Missing CLOUDFLARE_R2_PUBLIC_BASE_URL for public media URLs.');
  }

  return config;
}

export function buildMediaObjectPath(kind: 'images' | 'videos', filename: string) {
  const { mediaPrefix } = getCloudflareConfig();
  return `${mediaPrefix}/${kind}/${stripLeadingSlash(filename)}`;
}

export function buildPublicMediaUrl(objectPath: string) {
  const { r2PublicBaseUrl } = requireR2Config();
  return `${stripTrailingSlash(r2PublicBaseUrl)}/${stripLeadingSlash(objectPath)}`;
}

function sha256Hex(input: Buffer | string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function encodeR2Path(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildSignedHeaders(headers: Record<string, string>) {
  return Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), value.trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
}

async function r2Request(method: 'PUT' | 'DELETE', objectPath: string, body?: Buffer, contentType?: string) {
  const { r2AccessKeyId, r2SecretAccessKey, r2Bucket, r2Endpoint } = requireR2Config();
  const url = new URL(`${r2Endpoint}/${r2Bucket}/${encodeR2Path(stripLeadingSlash(objectPath))}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);

  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  if (contentType) {
    headers['content-type'] = contentType;
  }

  const signedHeaders = buildSignedHeaders(headers);
  const canonicalHeaders = signedHeaders.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaderNames = signedHeaders.map(([key]) => key).join(';');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaderNames, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${r2SecretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const response = await fetch(url, {
    method,
    headers: {
      ...Object.fromEntries(signedHeaders),
      Authorization: `AWS4-HMAC-SHA256 Credential=${r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
    },
    body: body && method === 'PUT' ? new Uint8Array(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Cloudflare R2 ${method} failed with ${response.status}.`);
  }
}

export async function uploadMediaObject(params: { objectPath: string; body: Buffer; contentType: string }) {
  await r2Request('PUT', params.objectPath, params.body, params.contentType);
  return buildPublicMediaUrl(params.objectPath);
}

export async function deleteMediaObject(objectPath: string) {
  await r2Request('DELETE', objectPath);
}

export async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const { accountId, apiToken, d1DatabaseId } = requireCloudflareApiConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as D1QueryResponse<T>;
  if (!response.ok || !data.success || data.errors?.length || data.result?.[0]?.error) {
    const message = data.errors?.[0]?.message || data.result?.[0]?.error || `Cloudflare D1 query failed with ${response.status}.`;
    throw new Error(message);
  }

  return data.result?.[0]?.results || [];
}

export async function d1Exec(sql: string, params: unknown[] = []) {
  await d1Query(sql, params);
}

export async function ensureMediaTables() {
  if (!ensureMediaTablesPromise) {
    ensureMediaTablesPromise = (async () => {
      await d1Exec(`
        CREATE TABLE IF NOT EXISTS media_gallery_images (
          id TEXT PRIMARY KEY,
          image_url TEXT NOT NULL,
          prompt TEXT NOT NULL,
          aspect_ratio TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          object_path TEXT
        )
      `);
      await d1Exec(`
        CREATE TABLE IF NOT EXISTS media_gallery_videos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          src TEXT NOT NULL,
          duration TEXT NOT NULL,
          prompt TEXT NOT NULL,
          aspect_ratio TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          demo INTEGER DEFAULT 0,
          object_path TEXT
        )
      `);
      await d1Exec(`
        CREATE TABLE IF NOT EXISTS media_gallery_jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          request_id TEXT,
          prompt TEXT NOT NULL,
          aspect_ratio TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          video_id TEXT,
          error TEXT
        )
      `);
    })();
  }

  return ensureMediaTablesPromise;
}

export function isCloudflareConfigError(error: unknown) {
  return error instanceof CloudflareConfigError;
}
