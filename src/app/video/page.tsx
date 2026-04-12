'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePromptStore } from '@/store/usePromptStore';
import { useRouter } from 'next/navigation';

type VideoItem = {
  id: string;
  title: string;
  src: string;
  duration: string;
  thumbnail?: string;
  prompt?: string;
  aspectRatio?: string;
  demo?: boolean;
};

const sampleVideos: VideoItem[] = [
  {
    id: 'video-1',
    title: 'Aurora Walkthrough',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    duration: '0:30',
  },
  {
    id: 'video-2',
    title: 'Studio Motion Test',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
    duration: '0:12',
  },
  {
    id: 'video-3',
    title: 'Showcase Clip',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: '0:10',
  },
  {
    id: 'video-4',
    title: 'Landscape Sequence',
    src: 'https://www.w3schools.com/html/movie.mp4',
    duration: '0:09',
  },
];

const buttonBase: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '13px',
};

export default function CreatorVideoPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const galleryStripRef = useRef<HTMLDivElement | null>(null);

  const currentPrompt = usePromptStore((state) => state.currentPrompt);
  const setCurrentPrompt = usePromptStore((state) => state.setCurrentPrompt);
  const addToHistory = usePromptStore((state) => state.addToHistory);
  const generatedVideos = usePromptStore((state) => state.generatedVideos);
  const addGeneratedVideo = usePromptStore((state) => state.addGeneratedVideo);
  const deleteGeneratedVideo = usePromptStore((state) => state.deleteGeneratedVideo);

  const [editingPrompt, setEditingPrompt] = useState(currentPrompt);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string>('');
  const [isPlaylistMode, setIsPlaylistMode] = useState(false);
  const [playlistCursor, setPlaylistCursor] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Prompt from Studio can generate a video, add it to the gallery, and play it here.');
  const [errorMessage, setErrorMessage] = useState('');

  const videos = useMemo<VideoItem[]>(() => [...generatedVideos, ...sampleVideos], [generatedVideos]);

  useEffect(() => {
    if (currentPrompt) {
      setEditingPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  useEffect(() => {
    if (!videos.length) {
      setActiveVideoId('');
      return;
    }

    if (!activeVideoId || !videos.some((video) => video.id === activeVideoId)) {
      setActiveVideoId(videos[0].id);
    }
  }, [videos, activeVideoId]);

  useEffect(() => {
    setPlaylist((current) => current.filter((id) => videos.some((video) => video.id === id)));
  }, [videos]);

  const activeVideo = useMemo(
    () => videos.find((video) => video.id === activeVideoId) ?? videos[0],
    [activeVideoId, videos]
  );

  const playlistVideos = useMemo(
    () => playlist.map((id) => videos.find((video) => video.id === id)).filter(Boolean) as VideoItem[],
    [playlist, videos]
  );

  const currentQueue = isPlaylistMode && playlistVideos.length > 0 ? playlistVideos : activeVideo ? [activeVideo] : [];
  const currentQueueItem = currentQueue[playlistCursor] ?? activeVideo;
  const showPlaylistControls = playlistVideos.length > 1 && isPlaylistMode;

  useEffect(() => {
    if (!currentQueueItem || !videoRef.current) return;

    const player = videoRef.current;
    player.src = currentQueueItem.src;
    player.load();

    const autoplay = async () => {
      try {
        await player.play();
      } catch (error) {
        console.error('Autoplay failed:', error);
      }
    };

    autoplay();
  }, [currentQueueItem]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    const handleEnded = () => {
      if (!isPlaylistMode) return;

      if (playlistCursor < currentQueue.length - 1) {
        setPlaylistCursor((cursor) => cursor + 1);
        return;
      }

      setIsPlaylistMode(false);
      setPlaylistCursor(0);
    };

    player.addEventListener('ended', handleEnded);
    return () => player.removeEventListener('ended', handleEnded);
  }, [currentQueue.length, isPlaylistMode, playlistCursor]);

  const togglePlaylist = (videoId: string) => {
    setPlaylist((current) => {
      if (current.includes(videoId)) {
        const next = current.filter((id) => id !== videoId);
        if (activeVideoId === videoId && next.length > 0 && isPlaylistMode) {
          setActiveVideoId(next[0]);
        }
        return next;
      }
      return [...current, videoId];
    });
  };

  const getBadgeNumber = (videoId: string) => {
    const index = playlist.indexOf(videoId);
    return index >= 0 ? index + 1 : null;
  };

  const handleSelectVideo = (videoId: string) => {
    setActiveVideoId(videoId);
    setIsPlaylistMode(false);
    setPlaylistCursor(0);
  };

  const handleDeleteGeneratedVideo = (videoId: string) => {
    deleteGeneratedVideo(videoId);
    setPlaylist((current) => current.filter((id) => id !== videoId));
    setIsPlaylistMode(false);
    setPlaylistCursor(0);
    setStatusMessage('Generated video removed from the gallery.');
  };

  const handleScrollGallery = (direction: 'left' | 'right') => {
    const strip = galleryStripRef.current;
    if (!strip) return;

    const nextLeft = strip.scrollLeft + (direction === 'left' ? -360 : 360);
    strip.scrollTo({ left: nextLeft, behavior: 'smooth' });
  };

  const handleClearPlaylist = () => {
    setPlaylist([]);
    setIsPlaylistMode(false);
    setPlaylistCursor(0);
    setStatusMessage('Playlist cleared.');
  };

  const handlePlayPlaylist = () => {
    if (playlistVideos.length === 0) return;
    setActiveVideoId(playlistVideos[0].id);
    setPlaylistCursor(0);
    setIsPlaylistMode(true);
    setStatusMessage('Playing selected playlist.');
  };

  const handlePrev = () => {
    if (playlistCursor === 0) return;
    setPlaylistCursor((cursor) => cursor - 1);
  };

  const handleNext = () => {
    if (playlistCursor >= currentQueue.length - 1) return;
    setPlaylistCursor((cursor) => cursor + 1);
  };

  const handleGenerateVideo = async () => {
    if (!editingPrompt.trim()) {
      setErrorMessage('Please enter a prompt first.');
      return;
    }

    setIsGeneratingVideo(true);
    setErrorMessage('');
    setStatusMessage('Generating video from your Studio prompt...');

    try {
      setCurrentPrompt(editingPrompt);
      addToHistory(editingPrompt);

      const response = await fetch('/api/video-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editingPrompt, aspectRatio }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `API error: ${response.statusText}`);
      }

      if (!data?.videoUrl) {
        throw new Error(data?.error || 'Video generation is still processing. Please try again in a moment.');
      }

      const entry = addGeneratedVideo({
        title: data.title || 'Generated video',
        src: data.videoUrl,
        duration: data.duration || 'Generated',
        prompt: editingPrompt,
        aspectRatio,
        timestamp: Date.now(),
        demo: Boolean(data.demo),
      });

      setActiveVideoId(entry.id);
      setIsPlaylistMode(false);
      setPlaylistCursor(0);
      setStatusMessage(data.warning || 'Video generated, added to the gallery, and loaded into the player.');
    } catch (error) {
      console.error('Video generation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Video generation failed.');
      setStatusMessage('Video generation failed.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleMergeAndDownload = async () => {
    if (playlistVideos.length === 0) return;

    setIsMerging(true);
    setStatusMessage('Sending playlist to merge service...');

    try {
      const response = await fetch('/api/video-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: playlistVideos }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Merge failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `playlist-${Date.now()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage('Merge complete. Download started.');
    } catch (error) {
      console.error('Merge failed:', error);
      setStatusMessage(error instanceof Error ? error.message : 'Merge failed');
      alert(error instanceof Error ? error.message : 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', background: '#020617', color: '#e2e8f0', padding: '20px 20px 100px', overflowX: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
        <div>
          <div
            style={{
              background: '#0f172a',
              borderRadius: '18px',
              padding: '16px',
              color: '#fff',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Now Playing</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{currentQueueItem?.title ?? 'No video selected'}</div>
                {currentQueueItem?.demo && <div style={{ marginTop: '6px', fontSize: '12px', color: '#c4b5fd' }}>Demo generated clip</div>}
              </div>
              {isPlaylistMode && playlistVideos.length > 0 && (
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  Playlist {playlistCursor + 1} / {playlistVideos.length}
                </div>
              )}
            </div>

            <video
              ref={videoRef}
              controls
              playsInline
              style={{ width: '100%', borderRadius: '14px', background: '#000', maxHeight: '70vh' }}
            />

            {showPlaylistControls && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button
                  onClick={handlePrev}
                  disabled={playlistCursor === 0}
                  style={{
                    ...buttonBase,
                    background: playlistCursor === 0 ? '#334155' : '#1d4ed8',
                    color: '#fff',
                    opacity: playlistCursor === 0 ? 0.6 : 1,
                  }}
                >
                  ← Prev
                </button>
                <button
                  onClick={handleNext}
                  disabled={playlistCursor >= currentQueue.length - 1}
                  style={{
                    ...buttonBase,
                    background: playlistCursor >= currentQueue.length - 1 ? '#334155' : '#1d4ed8',
                    color: '#fff',
                    opacity: playlistCursor >= currentQueue.length - 1 ? 0.6 : 1,
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: '18px', color: errorMessage ? '#fecaca' : '#94a3b8', fontSize: '13px' }}>
            {errorMessage || (isMerging ? 'Merging playlist...' : statusMessage)}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
          <div style={{ background: 'rgba(15,23,42,0.86)', borderRadius: '18px', border: '1px solid rgba(148,163,184,0.12)', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '8px' }}>Generate video</div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#f8fafc' }}>Studio → Video flow</h2>
            <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '13px' }}>
              Use the current Studio prompt, generate a video, add it to the gallery, and load it into the player automatically.
            </p>

            <textarea
              value={editingPrompt}
              onChange={(event) => setEditingPrompt(event.target.value)}
              rows={6}
              placeholder="Describe the video you want to generate..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '14px', border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.9)', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '12px' }}>
              {['16:9', '9:16'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  style={{
                    ...buttonBase,
                    padding: '10px 12px',
                    background: aspectRatio === ratio ? '#8b5cf6' : 'rgba(30,41,59,0.95)',
                    color: '#fff',
                  }}
                >
                  {ratio}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo || !editingPrompt.trim()}
                style={{
                  ...buttonBase,
                  width: '100%',
                  padding: '12px',
                  background: isGeneratingVideo || !editingPrompt.trim() ? '#475569' : '#8b5cf6',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {isGeneratingVideo ? 'Generating Video...' : 'Generate Video'}
              </button>
              <button
                onClick={() => router.push('/')}
                style={{
                  ...buttonBase,
                  width: '100%',
                  padding: '12px',
                  background: '#334155',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Back to Studio
              </button>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>Video Gallery</h2>
                  <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                    Generated videos appear first. Click a card to play it on the left panel. Use the scroll buttons if your browser hides the native scrollbar.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleScrollGallery('left')}
                    style={{
                      ...buttonBase,
                      background: '#334155',
                      color: '#fff',
                      padding: '10px 12px',
                    }}
                  >
                    ← Scroll Left
                  </button>
                  <button
                    onClick={() => handleScrollGallery('right')}
                    style={{
                      ...buttonBase,
                      background: '#334155',
                      color: '#fff',
                      padding: '10px 12px',
                    }}
                  >
                    Scroll Right →
                  </button>
                  <button
                    onClick={() => setShowThumbnails((current) => !current)}
                    style={{
                      ...buttonBase,
                      background: showThumbnails ? '#0ea5e9' : '#334155',
                      color: '#fff',
                      padding: '10px 12px',
                    }}
                  >
                    Thumbnails {showThumbnails ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>

            <div ref={galleryStripRef} style={{ display: 'flex', gap: '12px', width: '100%', minWidth: 0, overflowX: 'scroll', overflowY: 'hidden', paddingRight: '24px', paddingBottom: '12px', boxSizing: 'border-box', scrollBehavior: 'smooth', scrollSnapType: 'x proximity' }}>
              {videos.map((video) => {
                const badge = getBadgeNumber(video.id);
                const isActive = activeVideoId === video.id;
                const inPlaylist = badge !== null;
                const isGenerated = generatedVideos.some((generated) => generated.id === video.id);

                return (
                  <div
                    key={video.id}
                    onClick={() => handleSelectVideo(video.id)}
                    style={{
                      minWidth: '320px',
                      maxWidth: '320px',
                      border: isActive ? '2px solid #8b5cf6' : '1px solid #1e293b',
                      borderRadius: '16px',
                      padding: '14px',
                      cursor: 'pointer',
                      background: isActive ? '#0f172a' : '#111827',
                      color: '#e2e8f0',
                      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.25)',
                      flex: '0 0 auto',
                      scrollSnapAlign: 'start',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>{video.title}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>{video.duration}</div>
                        {isGenerated && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: video.demo ? '#c4b5fd' : '#67e8f9', background: 'rgba(15,23,42,0.8)', borderRadius: '999px', padding: '4px 8px' }}>
                            {video.demo ? 'Demo generated' : 'Generated'}
                          </div>
                        )}
                      </div>
                      {badge && (
                        <div
                          style={{
                            minWidth: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            background: '#2563eb',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                          }}
                        >
                          {badge}
                        </div>
                      )}
                    </div>

                    {showThumbnails ? (
                      <div style={{ marginTop: '12px', marginBottom: '10px', display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }}>
                        <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#020617', border: '1px solid rgba(148,163,184,0.1)' }}>
                          <video
                            src={video.src}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ width: '120px', height: '72px', objectFit: 'cover', display: 'block', background: '#000' }}
                          />
                        </div>
                        {video.prompt ? (
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {video.prompt}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Small thumbnail preview</div>
                        )}
                      </div>
                    ) : video.prompt ? (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {video.prompt}
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePlaylist(video.id);
                        }}
                        style={{
                          ...buttonBase,
                          background: inPlaylist ? '#3f1d1d' : '#172554',
                          color: inPlaylist ? '#fecaca' : '#bfdbfe',
                          padding: '8px 12px',
                        }}
                      >
                        {inPlaylist ? 'Remove from Playlist' : 'Add to Playlist'}
                      </button>

                      {isGenerated && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteGeneratedVideo(video.id);
                          }}
                          style={{
                            ...buttonBase,
                            background: '#7f1d1d',
                            color: '#fff',
                            padding: '8px 12px',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: '20px',
          right: '20px',
          bottom: '20px',
          background: 'rgba(15, 23, 42, 0.94)',
          color: '#fff',
          borderRadius: '18px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>Playlist Bar</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{playlistVideos.length} selected</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClearPlaylist}
            disabled={playlistVideos.length === 0}
            style={{
              ...buttonBase,
              background: '#334155',
              color: '#fff',
              opacity: playlistVideos.length === 0 ? 0.6 : 1,
            }}
          >
            Clear
          </button>
          <button
            onClick={handlePlayPlaylist}
            disabled={playlistVideos.length === 0 || isMerging}
            style={{
              ...buttonBase,
              background: '#2563eb',
              color: '#fff',
              opacity: playlistVideos.length === 0 || isMerging ? 0.6 : 1,
            }}
          >
            Play Playlist
          </button>
          <button
            onClick={handleMergeAndDownload}
            disabled={playlistVideos.length === 0 || isMerging}
            style={{
              ...buttonBase,
              background: '#10b981',
              color: '#06281f',
              opacity: playlistVideos.length === 0 || isMerging ? 0.6 : 1,
            }}
          >
            {isMerging ? 'Recording...' : 'Merge & Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
