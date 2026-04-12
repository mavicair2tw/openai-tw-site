export type GeneratedImage = {
  id: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  timestamp: number;
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
};

export type MediaGalleryData = {
  images: GeneratedImage[];
  videos: GeneratedVideo[];
};
