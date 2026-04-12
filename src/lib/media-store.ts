import { createClient } from '@libsql/client';
import type { Client, InArgs, Row } from '@libsql/client';
import type { GeneratedImage, GeneratedVideo, MediaGalleryData } from '@/lib/media-types';

const IMAGE_LIMIT = 40;
const VIDEO_LIMIT = 30;
const REMOTE_PROTOCOLS = ['libsql:', 'https:', 'http:', 'wss:', 'ws:'];

class MediaDatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaDatabaseConfigError';
  }
}

let clientPromise: Promise<Client> | null = null;
let schemaPromise: Promise<void> | null = null;

function getDatabaseConfig() {
  const url = process.env.LIBSQL_URL?.trim() || '';
  const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim() || '';

  if (!url) {
    throw new MediaDatabaseConfigError(
      'Missing LIBSQL_URL. Set LIBSQL_URL to your Turso/LibSQL database URL, for example libsql://<database>-<org>.turso.io or file:./data/media-gallery.db.',
    );
  }

  const isRemote = REMOTE_PROTOCOLS.some((protocol) => url.startsWith(protocol)) && !url.startsWith('file:');
  if (isRemote && !authToken) {
    throw new MediaDatabaseConfigError('Missing LIBSQL_AUTH_TOKEN for remote Turso/LibSQL database access.');
  }

  return { url, authToken: authToken || undefined };
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve().then(() => createClient(getDatabaseConfig()));
  }

  return clientPromise;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const client = await getClient();
      await client.batch(
        [
          `
            CREATE TABLE IF NOT EXISTS generated_images (
              id TEXT PRIMARY KEY,
              image_url TEXT NOT NULL,
              prompt TEXT NOT NULL,
              aspect_ratio TEXT NOT NULL,
              timestamp INTEGER NOT NULL
            )
          `,
          `
            CREATE TABLE IF NOT EXISTS generated_videos (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              src TEXT NOT NULL,
              duration TEXT NOT NULL,
              prompt TEXT NOT NULL,
              aspect_ratio TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              demo INTEGER NOT NULL DEFAULT 0
            )
          `,
        ].map((sql) => ({ sql })),
        'write',
      );
    })();
  }

  await schemaPromise;
}

async function execute(sql: string, args?: InArgs) {
  await ensureSchema();
  const client = await getClient();
  return client.execute({ sql, args });
}

function asString(value: Row[string], fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: Row[string], fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

function asBoolean(value: Row[string]) {
  return value === 1 || value === '1';
}

function mapImageRow(row: Row): GeneratedImage {
  return {
    id: asString(row.id),
    imageUrl: asString(row.image_url),
    prompt: asString(row.prompt),
    aspectRatio: asString(row.aspect_ratio),
    timestamp: asNumber(row.timestamp),
  };
}

function mapVideoRow(row: Row): GeneratedVideo {
  return {
    id: asString(row.id),
    title: asString(row.title),
    src: asString(row.src),
    duration: asString(row.duration),
    prompt: asString(row.prompt),
    aspectRatio: asString(row.aspect_ratio),
    timestamp: asNumber(row.timestamp),
    demo: asBoolean(row.demo),
  };
}

async function trimTable(tableName: 'generated_images' | 'generated_videos', limit: number) {
  await execute(
    `
      DELETE FROM ${tableName}
      WHERE id IN (
        SELECT id FROM ${tableName}
        ORDER BY timestamp DESC
        LIMIT -1 OFFSET ?
      )
    `,
    [limit],
  );
}

export async function getMediaGallery(): Promise<MediaGalleryData> {
  const [imagesResult, videosResult] = await Promise.all([
    execute(
      `
        SELECT id, image_url, prompt, aspect_ratio, timestamp
        FROM generated_images
        ORDER BY timestamp DESC
      `,
    ),
    execute(
      `
        SELECT id, title, src, duration, prompt, aspect_ratio, timestamp, demo
        FROM generated_videos
        ORDER BY timestamp DESC
      `,
    ),
  ]);

  return {
    images: imagesResult.rows.map(mapImageRow),
    videos: videosResult.rows.map(mapVideoRow),
  };
}

export async function addImageRecord(image: GeneratedImage) {
  await execute(
    `
      INSERT INTO generated_images (id, image_url, prompt, aspect_ratio, timestamp)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        image_url = excluded.image_url,
        prompt = excluded.prompt,
        aspect_ratio = excluded.aspect_ratio,
        timestamp = excluded.timestamp
    `,
    [image.id, image.imageUrl, image.prompt, image.aspectRatio, image.timestamp],
  );

  await trimTable('generated_images', IMAGE_LIMIT);
  return image;
}

export async function addVideoRecord(video: GeneratedVideo) {
  await execute(
    `
      INSERT INTO generated_videos (id, title, src, duration, prompt, aspect_ratio, timestamp, demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        src = excluded.src,
        duration = excluded.duration,
        prompt = excluded.prompt,
        aspect_ratio = excluded.aspect_ratio,
        timestamp = excluded.timestamp,
        demo = excluded.demo
    `,
    [video.id, video.title, video.src, video.duration, video.prompt, video.aspectRatio, video.timestamp, video.demo ? 1 : 0],
  );

  await trimTable('generated_videos', VIDEO_LIMIT);
  return video;
}

export async function deleteImageRecord(id: string) {
  await execute('DELETE FROM generated_images WHERE id = ?', [id]);
}

export async function deleteVideoRecord(id: string) {
  await execute('DELETE FROM generated_videos WHERE id = ?', [id]);
}

export function isMediaDatabaseConfigError(error: unknown) {
  return error instanceof MediaDatabaseConfigError;
}
