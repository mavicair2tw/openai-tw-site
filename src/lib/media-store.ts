import {
  buildPublicMediaUrl,
  d1Exec,
  d1Query,
  deleteMediaObject,
  ensureMediaTables,
  isCloudflareConfigError,
} from '@/lib/cloudflare';
import type { GeneratedImage, GeneratedVideo, MediaGalleryData } from '@/lib/media-types';

const IMAGE_LIMIT = 40;
const VIDEO_LIMIT = 30;

type ImageRow = {
  id: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  timestamp: number;
  object_path?: string | null;
};

type VideoRow = {
  id: string;
  title: string;
  src: string;
  duration: string;
  prompt: string;
  aspect_ratio: string;
  timestamp: number;
  demo?: number | boolean | null;
  object_path?: string | null;
};

function sortByTimestampDesc<T extends { timestamp: number }>(items: T[]) {
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

function hydrateImage(row: ImageRow): GeneratedImage {
  return {
    id: row.id,
    imageUrl: row.object_path ? buildPublicMediaUrl(row.object_path) : row.image_url,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio,
    timestamp: Number(row.timestamp),
    objectPath: row.object_path || undefined,
  };
}

function hydrateVideo(row: VideoRow): GeneratedVideo {
  return {
    id: row.id,
    title: row.title,
    src: row.object_path ? buildPublicMediaUrl(row.object_path) : row.src,
    duration: row.duration,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio,
    timestamp: Number(row.timestamp),
    demo: Boolean(row.demo),
    objectPath: row.object_path || undefined,
  };
}

async function trimTable(table: 'media_gallery_images' | 'media_gallery_videos', limit: number) {
  await d1Exec(
    `
      DELETE FROM ${table}
      WHERE id IN (
        SELECT id FROM ${table}
        ORDER BY timestamp DESC
        LIMIT -1 OFFSET ?
      )
    `,
    [limit],
  );
}

function isD1UnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('D1') || message.includes('database') || message.includes('CLOUDFLARE_');
}

export async function getMediaGallery(): Promise<MediaGalleryData> {
  try {
    await ensureMediaTables();
    const [imageRows, videoRows] = await Promise.all([
      d1Query<ImageRow>('SELECT * FROM media_gallery_images ORDER BY timestamp DESC LIMIT ?', [IMAGE_LIMIT]),
      d1Query<VideoRow>('SELECT * FROM media_gallery_videos ORDER BY timestamp DESC LIMIT ?', [VIDEO_LIMIT]),
    ]);

    return {
      images: sortByTimestampDesc(imageRows.map(hydrateImage)),
      videos: sortByTimestampDesc(videoRows.map(hydrateVideo)),
    };
  } catch (error) {
    if (isD1UnavailableError(error)) {
      return { images: [], videos: [] };
    }
    throw error;
  }
}

export async function addImageRecord(image: GeneratedImage) {
  await ensureMediaTables();
  await d1Exec(
    `
      INSERT OR REPLACE INTO media_gallery_images (id, image_url, prompt, aspect_ratio, timestamp, object_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [image.id, image.imageUrl, image.prompt, image.aspectRatio, image.timestamp, image.objectPath || null],
  );
  await trimTable('media_gallery_images', IMAGE_LIMIT);
  return image;
}

export async function addVideoRecord(video: GeneratedVideo) {
  await ensureMediaTables();
  await d1Exec(
    `
      INSERT OR REPLACE INTO media_gallery_videos (id, title, src, duration, prompt, aspect_ratio, timestamp, demo, object_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [video.id, video.title, video.src, video.duration, video.prompt, video.aspectRatio, video.timestamp, video.demo ? 1 : 0, video.objectPath || null],
  );
  await trimTable('media_gallery_videos', VIDEO_LIMIT);
  return video;
}

async function deleteObjectIfPresent(objectPath?: string) {
  if (!objectPath) {
    return;
  }

  try {
    await deleteMediaObject(objectPath);
  } catch (error) {
    if (isCloudflareConfigError(error)) {
      throw error;
    }
  }
}

export async function deleteImageRecord(id: string) {
  await ensureMediaTables();
  const [image] = await d1Query<ImageRow>('SELECT * FROM media_gallery_images WHERE id = ? LIMIT 1', [id]);
  await d1Exec('DELETE FROM media_gallery_images WHERE id = ?', [id]);
  await deleteObjectIfPresent(image?.object_path || undefined);
  return image ? hydrateImage(image) : null;
}

export async function deleteVideoRecord(id: string) {
  await ensureMediaTables();
  const [video] = await d1Query<VideoRow>('SELECT * FROM media_gallery_videos WHERE id = ? LIMIT 1', [id]);
  await d1Exec('DELETE FROM media_gallery_videos WHERE id = ?', [id]);
  await deleteObjectIfPresent(video?.object_path || undefined);
  return video ? hydrateVideo(video) : null;
}

export { isCloudflareConfigError as isMediaDatabaseConfigError };
