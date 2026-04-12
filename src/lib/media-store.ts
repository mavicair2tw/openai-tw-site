import type { CollectionReference, DocumentData } from '@google-cloud/firestore';
import { getFirestore, getMediaBucket, isGoogleCloudConfigError } from '@/lib/google-cloud';
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

export async function getMediaGallery(): Promise<MediaGalleryData> {
  const [imagesSnapshot, videosSnapshot] = await Promise.all([
    getImagesCollection().orderBy('timestamp', 'desc').limit(IMAGE_LIMIT).get(),
    getVideosCollection().orderBy('timestamp', 'desc').limit(VIDEO_LIMIT).get(),
  ]);

  return {
    images: sortByTimestampDesc(imagesSnapshot.docs.map((doc) => doc.data())),
    videos: sortByTimestampDesc(videosSnapshot.docs.map((doc) => doc.data())),
  };
}

export async function addImageRecord(image: GeneratedImage) {
  await getImagesCollection().doc(image.id).set(image);
  await trimCollection(getImagesCollection(), IMAGE_LIMIT);
  return image;
}

export async function addVideoRecord(video: GeneratedVideo) {
  await getVideosCollection().doc(video.id).set(video);
  await trimCollection(getVideosCollection(), VIDEO_LIMIT);
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
