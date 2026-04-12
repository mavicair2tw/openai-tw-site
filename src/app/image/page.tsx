'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePromptStore, useCreatorGeneration } from '@/store/usePromptStore';
import { useRouter } from 'next/navigation';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.86)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: '22px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

const ALLOW_MEDIA_DELETE = process.env.NEXT_PUBLIC_ALLOW_MEDIA_DELETE === 'true';

export default function ImagenPage() {
  const router = useRouter();
  const currentPrompt = usePromptStore((state) => state.currentPrompt);
  const setCurrentPrompt = usePromptStore((state) => state.setCurrentPrompt);
  const addToHistory = usePromptStore((state) => state.addToHistory);
  const generatedImages = usePromptStore((state) => state.generatedImages);
  const selectedImageId = usePromptStore((state) => state.selectedImageId);
  const galleryView = usePromptStore((state) => state.galleryView);
  const setGeneratedImages = usePromptStore((state) => state.setGeneratedImages);
  const addGeneratedImage = usePromptStore((state) => state.addGeneratedImage);
  const selectGeneratedImage = usePromptStore((state) => state.selectGeneratedImage);
  const deleteGeneratedImage = usePromptStore((state) => state.deleteGeneratedImage);
  const setGalleryView = usePromptStore((state) => state.setGalleryView);

  const { isGenerating, setIsGenerating, setGenerationResult } = useCreatorGeneration();

  const [editingPrompt, setEditingPrompt] = useState(currentPrompt);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedImage = useMemo(
    () => generatedImages.find((image) => image.id === selectedImageId) ?? generatedImages[0] ?? null,
    [generatedImages, selectedImageId]
  );

  useEffect(() => {
    if (currentPrompt) {
      setEditingPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  useEffect(() => {
    const loadGallery = async () => {
      try {
        const response = await fetch('/api/media-gallery', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load image gallery.');
        }

        const data = await response.json();
        setGeneratedImages(Array.isArray(data?.images) ? data.images : []);
      } catch (error) {
        console.error('Failed to load image gallery:', error);
      }
    };

    loadGallery();
  }, [setGeneratedImages]);

  const handleGenerateImage = async () => {
    if (!editingPrompt.trim()) {
      setErrorMessage('Please enter a prompt.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    try {
      setCurrentPrompt(editingPrompt);
      addToHistory(editingPrompt);

      const response = await fetch('/api/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editingPrompt, aspectRatio, mode: 'text-to-image' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `API error: ${response.statusText}`);
      }

      const image = data?.image;
      const timestamp = image?.timestamp || Date.now();
      setGenerationResult({ imageUrl: data.imageUrl, timestamp });
      addGeneratedImage({
        id: image?.id,
        imageUrl: data.imageUrl,
        prompt: image?.prompt || editingPrompt,
        aspectRatio: image?.aspectRatio || aspectRatio,
        timestamp,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate image.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!selectedImage?.imageUrl) return;
    const link = document.createElement('a');
    link.href = selectedImage.imageUrl;
    link.download = `imagen-${selectedImage.timestamp}.png`;
    link.click();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!ALLOW_MEDIA_DELETE) return;

    try {
      const response = await fetch(`/api/media-gallery/images/${imageId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete image.');
      }

      deleteGeneratedImage(imageId);
    } catch (error) {
      console.error('Failed to delete image:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete image.');
    }
  };

  const previewMinHeight = galleryView === 'original' ? '620px' : '520px';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '18px', minHeight: 'calc(100vh - 180px)' }}>
      <aside style={{ ...panelStyle, padding: '18px' }}>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>Image generation</div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Image Studio</h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#94a3b8' }}>Generate still images, keep a gallery, and switch between thumbnail and larger preview cards.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#e2e8f0' }}>Prompt</label>
          <textarea
            value={editingPrompt}
            onChange={(e) => setEditingPrompt(e.target.value)}
            placeholder="Describe the image you want to create..."
            maxLength={4000}
            rows={8}
            style={{ width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.9)', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{editingPrompt.length} / 4000</div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#e2e8f0' }}>Aspect ratio</label>
          <div style={{ display: 'grid', gap: '8px' }}>
            {['1:1', '16:9', '9:16'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  padding: '10px 12px',
                  background: aspectRatio === ratio ? '#2563eb' : 'rgba(30,41,59,0.95)',
                  color: '#fff',
                  border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  fontWeight: 700,
                }}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#e2e8f0' }}>Gallery size</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => setGalleryView('thumbnail')}
              style={{
                padding: '10px 12px',
                background: galleryView === 'thumbnail' ? '#0ea5e9' : 'rgba(30,41,59,0.95)',
                color: '#fff',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              Small thumbnails
            </button>
            <button
              onClick={() => setGalleryView('original')}
              style={{
                padding: '10px 12px',
                background: galleryView === 'original' ? '#0ea5e9' : 'rgba(30,41,59,0.95)',
                color: '#fff',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              Original size
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <button onClick={handleGenerateImage} disabled={isGenerating || !editingPrompt.trim()} style={{ width: '100%', padding: '12px', background: isGenerating || !editingPrompt.trim() ? '#475569' : '#2563eb', color: '#fff', border: 'none', borderRadius: '14px', cursor: isGenerating || !editingPrompt.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>
          <button onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: '#334155', color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 }}>
            Back to Studio
          </button>
        </div>
      </aside>

      <section style={{ ...panelStyle, padding: '18px', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: '6px' }}>Output</div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Generated image</h2>
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>{generatedImages.length} image{generatedImages.length === 1 ? '' : 's'} in gallery</div>
          </div>
          {selectedImage?.imageUrl && !isGenerating && (
            <button onClick={handleDownload} style={{ padding: '10px 14px', background: '#22c55e', color: '#04130a', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>
              Download selected
            </button>
          )}
        </div>

        <div style={{ borderRadius: '18px', background: '#000', border: '1px solid rgba(148,163,184,0.12)', minHeight: previewMinHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: galleryView === 'original' ? '12px' : 0 }}>
          {isGenerating && (
            <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Generating…</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Waiting for the image provider response.</div>
            </div>
          )}

          {!isGenerating && selectedImage?.imageUrl && (
            <img
              src={selectedImage.imageUrl}
              alt="Generated"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: galleryView === 'original' ? 'auto' : undefined,
                display: 'block',
                objectFit: 'contain',
                borderRadius: galleryView === 'original' ? '14px' : 0,
              }}
            />
          )}

          {!isGenerating && !selectedImage?.imageUrl && (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Your image will appear here</div>
              <div style={{ fontSize: '13px' }}>Write a prompt, choose an aspect ratio, and generate.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          {errorMessage ? (
            <div style={{ padding: '14px', background: '#3b0a0a', color: '#fecaca', border: '1px solid #7f1d1d', borderRadius: '14px' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Image generation error</div>
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{errorMessage}</div>
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => {
                    setErrorMessage('');
                    setIsGenerating(false);
                  }}
                  style={{ padding: '8px 12px', background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Dismiss error
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px', background: 'rgba(2,6,23,0.55)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '14px', fontSize: '13px' }}>
              Click any gallery image to select it.{ALLOW_MEDIA_DELETE ? ' Use the delete button on a card to remove it.' : ' Deletion is disabled by default.'}
            </div>
          )}

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c4b5fd' }}>Gallery</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Mode: {galleryView === 'thumbnail' ? 'small thumbnails' : 'original size'}
              </div>
            </div>

            {generatedImages.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: galleryView === 'thumbnail' ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {generatedImages.map((image) => {
                  const isSelected = image.id === selectedImage?.id;
                  const previewHeight = galleryView === 'thumbnail' ? 120 : 220;

                  return (
                    <button
                      key={image.id}
                      onClick={() => selectGeneratedImage(image.id)}
                      style={{
                        textAlign: 'left',
                        border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,0.14)',
                        borderRadius: '16px',
                        padding: '10px',
                        background: isSelected ? 'rgba(14,165,233,0.12)' : 'rgba(2,6,23,0.5)',
                        cursor: 'pointer',
                        color: '#e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          height: `${previewHeight}px`,
                          borderRadius: '12px',
                          background: '#020617',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '10px',
                        }}
                      >
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: galleryView === 'thumbnail' ? 'cover' : 'contain',
                            display: 'block',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: isSelected ? '#67e8f9' : '#cbd5e1', fontWeight: 700 }}>
                          {isSelected ? 'Selected' : 'Select image'}
                        </div>
                        {ALLOW_MEDIA_DELETE && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteImage(image.id);
                            }}
                            style={{
                              border: 'none',
                              borderRadius: '10px',
                              background: '#7f1d1d',
                              color: '#fff',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>{image.aspectRatio}</div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: galleryView === 'thumbnail' ? 2 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {image.prompt}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8', fontSize: '13px' }}>
                No images yet. Generate one and it will be added to the gallery automatically.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
