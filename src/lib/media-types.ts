export type GeneratedImage = {
  id: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  timestamp: number;
  objectPath?: string;
};

export type GeneratedVideo = {
  id: string;
  title: string;
  src: string;
  duration: string;
  prompt: string;
  aspectRatio: string;
  timestamp: number;
  demo?: boolean;
  objectPath?: string;
};

export type MediaGalleryData = {
  images: GeneratedImage[];
  videos: GeneratedVideo[];
};
