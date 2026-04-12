'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type VideoItem = {
  id: string;
  title: string;
  src: string;
  duration: string;
  thumbnail?: string;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videos] = useState<VideoItem[]>(sampleVideos);
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string>(sampleVideos[0]?.id ?? '');
  const [isPlaylistMode, setIsPlaylistMode] = useState(false);
  const [playlistCursor, setPlaylistCursor] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState('');

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

  const handleClearPlaylist = () => {
    setPlaylist([]);
    setIsPlaylistMode(false);
    setPlaylistCursor(0);
    setMergeProgress('');
  };

  const handlePlayPlaylist = () => {
    if (playlistVideos.length === 0) return;
    setActiveVideoId(playlistVideos[0].id);
    setPlaylistCursor(0);
    setIsPlaylistMode(true);
  };

  const handlePrev = () => {
    if (playlistCursor === 0) return;
    setPlaylistCursor((cursor) => cursor - 1);
  };

  const handleNext = () => {
    if (playlistCursor >= currentQueue.length - 1) return;
    setPlaylistCursor((cursor) => cursor + 1);
  };

  const handleMergeAndDownload = async () => {
    if (playlistVideos.length === 0) return;

    setIsMerging(true);
    setMergeProgress('Sending playlist to merge service...');

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
      setMergeProgress('Merge complete. Download started.');
    } catch (error) {
      console.error('Merge failed:', error);
      setMergeProgress(error instanceof Error ? error.message : 'Merge failed');
      alert(error instanceof Error ? error.message : 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', background: '#020617', color: '#e2e8f0', padding: '20px 20px 100px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.9fr)', gap: '20px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Now Playing</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{currentQueueItem?.title ?? 'No video selected'}</div>
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

          <div style={{ marginTop: '18px', color: '#94a3b8', fontSize: '13px' }}>
            {isMerging ? mergeProgress : 'Select clips on the right to build a playlist.'}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>Video Gallery</h2>
            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '13px' }}>
              Click a card to preview. Use Add / Remove to manage the playlist.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {videos.map((video) => {
              const badge = getBadgeNumber(video.id);
              const isActive = activeVideoId === video.id;
              const inPlaylist = badge !== null;

              return (
                <div
                  key={video.id}
                  onClick={() => handleSelectVideo(video.id)}
                  style={{
                    border: isActive ? '2px solid #2563eb' : '1px solid #1e293b',
                    borderRadius: '16px',
                    padding: '14px',
                    cursor: 'pointer',
                    background: isActive ? '#0f172a' : '#111827',
                    color: '#e2e8f0',
                    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>{video.title}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{video.duration}</div>
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

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
                  </div>
                </div>
              );
            })}
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
