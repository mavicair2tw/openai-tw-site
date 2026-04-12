import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { GeneratedImage, GeneratedVideo, MediaGalleryData } from '@/lib/media-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'media-gallery.json');

const EMPTY_GALLERY: MediaGalleryData = {
  images: [],
  videos: [],
};

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readGallery(): Promise<MediaGalleryData> {
  await ensureStore();

  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MediaGalleryData>;
    return {
      images: Array.isArray(parsed.images) ? parsed.images : [],
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return EMPTY_GALLERY;
    }

    throw error;
  }
}

async function writeGallery(data: MediaGalleryData) {
  await ensureStore();
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function getMediaGallery() {
  return readGallery();
}

export async function addImageRecord(image: GeneratedImage) {
  const gallery = await readGallery();
  const next = {
    ...gallery,
    images: [image, ...gallery.images.filter((entry) => entry.id !== image.id)].slice(0, 40),
  };

  await writeGallery(next);
  return image;
}

export async function addVideoRecord(video: GeneratedVideo) {
  const gallery = await readGallery();
  const next = {
    ...gallery,
    videos: [video, ...gallery.videos.filter((entry) => entry.id !== video.id)].slice(0, 30),
  };

  await writeGallery(next);
  return video;
}

export async function deleteImageRecord(id: string) {
  const gallery = await readGallery();
  const next = {
    ...gallery,
    images: gallery.images.filter((entry) => entry.id !== id),
  };

  await writeGallery(next);
}

export async function deleteVideoRecord(id: string) {
  const gallery = await readGallery();
  const next = {
    ...gallery,
    videos: gallery.videos.filter((entry) => entry.id !== id),
  };

  await writeGallery(next);
}
