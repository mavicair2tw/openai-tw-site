import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

class GoogleCloudConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCloudConfigError';
  }
}

let firestoreInstance: Firestore | null = null;
let storageInstance: Storage | null = null;

export function normalizePrivateKey(value: string) {
  return value.replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').trim();
}

export function normalizeEnvValue(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getGoogleCloudConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() || '';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim() || '';
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '');
  const mediaBucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim() || '';
  const mediaPrefix = (process.env.GOOGLE_CLOUD_STORAGE_PREFIX?.trim() || 'media-gallery').replace(/^\/+|\/+$/g, '');

  if (!projectId || !clientEmail || !privateKey) {
    throw new GoogleCloudConfigError(
      'Missing Google Cloud service-account credentials. Set GOOGLE_CLOUD_PROJECT, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY.',
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    mediaBucket,
    mediaPrefix,
  };
}

function getCredentials() {
  const { projectId, clientEmail, privateKey } = getGoogleCloudConfig();
  return {
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  };
}

export function getFirestore() {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore(getCredentials());
  }

  return firestoreInstance;
}

export function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage(getCredentials());
  }

  return storageInstance;
}

export function getMediaBucket() {
  const { mediaBucket } = getGoogleCloudConfig();
  if (!mediaBucket) {
    throw new GoogleCloudConfigError('Missing GOOGLE_CLOUD_STORAGE_BUCKET for generated media uploads.');
  }

  return getStorage().bucket(mediaBucket);
}

export function buildMediaObjectPath(kind: 'images' | 'videos', filename: string) {
  const { mediaPrefix } = getGoogleCloudConfig();
  return `${mediaPrefix}/${kind}/${filename}`;
}

export function buildPublicMediaUrl(bucketName: string, objectPath: string) {
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

export async function getSignedMediaUrl(objectPath: string, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const [url] = await getMediaBucket().file(objectPath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMs,
  });

  return url;
}

export function isGoogleCloudConfigError(error: unknown) {
  return error instanceof GoogleCloudConfigError;
}
