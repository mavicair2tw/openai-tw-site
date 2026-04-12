import type { CollectionReference, DocumentData } from '@google-cloud/firestore';
import { getFirestore, getMediaBucket, getSignedMediaUrl, isGoogleCloudConfigError } from '@/lib/google-cloud';
import type { GeneratedImage, GeneratedVideo, MediaGalleryData } from '@/lib/media-types';

const IMAGE_LIMIT = 40;
const VIDEO_LIMIT = 30;

function getImagesCollection() {
  return getFirestore().collection('mediaGalleryImages') as CollectionReference<GeneratedImage>;
}

function getVideosCollection() {
  return getFirestore().collection('mediaGalleryVideos') as CollectionReference<GeneratedVideo>;
}

async function trimCollection<T extends DocumentData>(collection: CollectionReference<T>, limit: number) {
  const snapshot = await collection.orderBy('timestamp', 'desc').get();
  const extraDocs = snapshot.docs.slice(limit);

  if (!extraDocs.length) {
    return;
  }

  const batch = getFirestore().batch();
  for (const doc of extraDocs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

function sortByTimestampDesc<T extends { timestamp: number }>(items: T[]) {
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

function isFirestoreUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('NOT_FOUND') || message.includes('The database') || message.includes('5 NOT_FOUND');
}

async function hydrateImage(image: GeneratedImage): Promise<GeneratedImage> {
  if (!image.objectPath) {
    return image;
  }

  try {
    return {
      ...image,
      imageUrl: await getSignedMediaUrl(image.objectPath),
    };
  } catch {
    return image;
  }
}

async function hydrateVideo(video: GeneratedVideo): Promise<GeneratedVideo> {
  if (!video.objectPath) {
    return video;
  }

  try {
    return {
      ...video,
      src: await getSignedMediaUrl(video.objectPath),
    };
  } catch {
    return video;
  }
}

export async function getMediaGallery(): Promise<MediaGalleryData> {
  try {
    const [imagesSnapshot, videosSnapshot] = await Promise.all([
      getImagesCollection().orderBy('timestamp', 'desc').limit(IMAGE_LIMIT).get(),
      getVideosCollection().orderBy('timestamp', 'desc').limit(VIDEO_LIMIT).get(),
    ]);

    const [images, videos] = await Promise.all([
      Promise.all(imagesSnapshot.docs.map((doc) => hydrateImage(doc.data()))),
      Promise.all(videosSnapshot.docs.map((doc) => hydrateVideo(doc.data()))),
    ]);

    return {
      images: sortByTimestampDesc(images),
      videos: sortByTimestampDesc(videos),
    };
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return { images: [], videos: [] };
    }
    throw error;
  }
}

export async function addImageRecord(image: GeneratedImage) {
  try {
    await getImagesCollection().doc(image.id).set(image);
    await trimCollection(getImagesCollection(), IMAGE_LIMIT);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return image;
}

export async function addVideoRecord(video: GeneratedVideo) {
  try {
    await getVideosCollection().doc(video.id).set(video);
    await trimCollection(getVideosCollection(), VIDEO_LIMIT);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return video;
}

async function deleteObjectIfPresent(objectPath?: string) {
  if (!objectPath) {
    return;
  }

  try {
    await getMediaBucket().file(objectPath).delete({ ignoreNotFound: true });
  } catch (error) {
    if (isGoogleCloudConfigError(error)) {
      throw error;
    }
  }
}

export async function deleteImageRecord(id: string) {
  const ref = getImagesCollection().doc(id);
  const snapshot = await ref.get();
  const image = snapshot.exists ? snapshot.data() : null;
  await ref.delete();
  await deleteObjectIfPresent(image?.objectPath);
  return image;
}

export async function deleteVideoRecord(id: string) {
  const ref = getVideosCollection().doc(id);
  const snapshot = await ref.get();
  const video = snapshot.exists ? snapshot.data() : null;
  await ref.delete();
  await deleteObjectIfPresent(video?.objectPath);
  return video;
}

export { isGoogleCloudConfigError as isMediaDatabaseConfigError };
