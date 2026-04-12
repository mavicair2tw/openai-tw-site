'use client';

import { ChangeEvent, CSSProperties, useMemo, useState } from 'react';

type Clip = {
  id: string;
  title: string;
  src: string;
  trimStart: number;
  trimEnd: number;
  fadeIn: number;
  fadeOut: number;
  zoomIn: number;
  zoomOut: number;
};

const sampleClips: Clip[] = [
  {
    id: 'clip-1',
    title: 'Aurora Walkthrough',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    trimStart: 0,
    trimEnd: 6,
    fadeIn: 0.4,
    fadeOut: 0.4,
    zoomIn: 0,
    zoomOut: 0,
  },
  {
    id: 'clip-2',
    title: 'Showcase Clip',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    trimStart: 0,
    trimEnd: 5,
    fadeIn: 0,
    fadeOut: 0.4,
    zoomIn: 0,
    zoomOut: 0,
  },
];

const quickTools = ['Split', 'Text', 'Beat Sync', 'Stabilize', 'Subtitles'];
const inspectorTabs = ['Video', 'Audio', 'Motion', 'Color'];
const assets = [
  { name: 'Brand Intro', type: 'Template', accent: '#60a5fa' },
  { name: 'Hero B-roll', type: '4K Clip', accent: '#34d399' },
  { name: 'Whoosh FX', type: 'Audio', accent: '#f59e0b' },
  { name: 'Lower Third', type: 'Graphic', accent: '#a78bfa' },
];
const rulers = Array.from({ length: 9 }, (_, index) => `${index * 5}s`);

const panelStyle: CSSProperties = {
  background: 'rgba(9,13,24,0.95)',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: '22px',
  boxShadow: '0 24px 80px rgba(2,6,23,0.45)',
};

const chipStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid rgba(148,163,184,0.16)',
  background: 'rgba(15,23,42,0.92)',
  color: '#e2e8f0',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const toolButtonStyle: CSSProperties = {
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.92)',
  color: '#f8fafc',
  padding: '10px 12px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const metricCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '14px',
  background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.92))',
  border: '1px solid rgba(148,163,184,0.1)',
};

const sliderStyle: CSSProperties = {
  width: '100%',
  accentColor: '#60a5fa',
  cursor: 'pointer',
};

export default function ICutPage() {
  const [clips, setClips] = useState<Clip[]>(sampleClips);
  const [activeId, setActiveId] = useState<string>(sampleClips[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('Sequence ready');
  const [zoomLevel, setZoomLevel] = useState(125);

  const activeClip = useMemo(() => clips.find((clip) => clip.id === activeId) ?? clips[0], [clips, activeId]);
  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + Math.max(0, clip.trimEnd - clip.trimStart), 0),
    [clips],
  );

  const updateClip = (id: string, updates: Partial<Clip>) => {
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, ...updates } : clip)));
  };

  const moveClip = (id: string, direction: 'left' | 'right') => {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === id);
      if (index < 0) return current;
      const target = direction === 'left' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus(`Importing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/icut-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Upload failed');
      }

      const data = await response.json();
      const newClip: Clip = {
        id: `clip-${Date.now()}`,
        title: data.title,
        src: data.src,
        trimStart: 0,
        trimEnd: 6,
        fadeIn: 0,
        fadeOut: 0,
        zoomIn: 0,
        zoomOut: 0,
      };

      setClips((current) => [...current, newClip]);
      setActiveId(newClip.id);
      setStatus(`Imported ${data.title}`);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    if (clips.length === 0) return;

    setIsExporting(true);
    setStatus('Rendering delivery file...');

    try {
      const response = await fetch('/api/icut-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `icut-export-${Date.now()}.mp4`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Export complete, download started.');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Export failed');
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 140px)',
        color: '#e5eefb',
        background:
          'radial-gradient(circle at top left, rgba(37,99,235,0.18), transparent 24%), radial-gradient(circle at top right, rgba(168,85,247,0.14), transparent 30%), linear-gradient(180deg, #020617 0%, #0b1120 100%)',
        borderRadius: '28px',
        padding: '18px',
        display: 'grid',
        gap: '16px',
      }}
    >
      <section
        style={{
          ...panelStyle,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px' }}>
            Creator workspace
          </div>
          <h1 style={{ margin: 0, fontSize: '30px' }}>iCut Studio</h1>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
            Preview-first editing with timeline, assets, and live inspector controls.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ ...chipStyle, background: 'rgba(14,165,233,0.12)', color: '#67e8f9' }}>{status}</span>
          <label
            style={{
              ...toolButtonStyle,
              background: isUploading ? 'rgba(71,85,105,0.9)' : 'linear-gradient(135deg, #2563eb, #38bdf8)',
              cursor: isUploading ? 'not-allowed' : 'pointer',
            }}
          >
            {isUploading ? 'Importing...' : '＋ Import media'}
            <input type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} disabled={isUploading} />
          </label>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              ...toolButtonStyle,
              background: isExporting ? 'rgba(71,85,105,0.9)' : 'linear-gradient(135deg, #22c55e, #86efac)',
              color: '#022c22',
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
          >
            {isExporting ? 'Rendering...' : 'Export MP4'}
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', gap: '16px' }}>
        <aside style={{ ...panelStyle, padding: '16px', display: 'grid', gap: '16px', alignContent: 'start' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#93c5fd', marginBottom: '6px' }}>Media bin</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>Assets</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...chipStyle, background: 'rgba(96,165,250,0.12)' }}>Video</span>
            <span style={chipStyle}>Audio</span>
            <span style={chipStyle}>Graphics</span>
            <span style={chipStyle}>Captions</span>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {assets.map((asset) => (
              <div
                key={asset.name}
                style={{
                  borderRadius: '16px',
                  padding: '12px',
                  border: '1px solid rgba(148,163,184,0.12)',
                  background: 'rgba(15,23,42,0.78)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '40px', borderRadius: '999px', background: asset.accent }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{asset.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{asset.type}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...metricCardStyle }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#f9a8d4', marginBottom: '8px' }}>
              Sequence stats
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: '#94a3b8' }}>Clips</span><strong>{clips.length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: '#94a3b8' }}>Runtime</span><strong>{totalDuration.toFixed(1)}s</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: '#94a3b8' }}>Canvas</span><strong>16:9 UHD</strong></div>
            </div>
          </div>
        </aside>

        <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(420px, 1fr) 260px', gap: '16px' }}>
          <div
            style={{
              ...panelStyle,
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {quickTools.map((tool) => (
                <button key={tool} style={chipStyle}>{tool}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Monitor zoom</span>
              <button style={chipStyle}>Fit</button>
              <button style={chipStyle}>50%</button>
              <button style={{ ...chipStyle, background: 'rgba(96,165,250,0.12)', color: '#dbeafe' }}>{zoomLevel}%</button>
            </div>
          </div>

          <section style={{ ...panelStyle, padding: '16px', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#c4b5fd', marginBottom: '6px' }}>Program monitor</div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{activeClip?.title || 'No clip selected'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button style={toolButtonStyle}>⏮</button>
                <button style={{ ...toolButtonStyle, background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>▶ Play</button>
                <button style={toolButtonStyle}>⏭</button>
              </div>
            </div>

            <div
              style={{
                borderRadius: '24px',
                padding: '18px',
                background: 'linear-gradient(180deg, rgba(2,6,23,0.98), rgba(15,23,42,0.94))',
                border: '1px solid rgba(148,163,184,0.12)',
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  boxShadow: 'inset 0 0 80px rgba(96,165,250,0.08)',
                }}
              />
              {activeClip ? (
                <div style={{ width: '100%', maxWidth: '980px', aspectRatio: '16 / 9', position: 'relative' }}>
                  <video
                    key={activeClip.src}
                    src={activeClip.src}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px', background: '#000' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '14px',
                      left: '14px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ ...chipStyle, background: 'rgba(15,23,42,0.78)' }}>REC 00:12:14</span>
                    <span style={{ ...chipStyle, background: 'rgba(59,130,246,0.18)' }}>1080p • 30fps</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#94a3b8' }}>Program monitor waiting for media</div>
              )}
            </div>
          </section>

          <section style={{ ...panelStyle, padding: '16px', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#f9a8d4', marginBottom: '6px' }}>Timeline</div>
                <div style={{ fontSize: '22px', fontWeight: 700 }}>Sequence A</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button style={chipStyle}>Snap</button>
                <button style={chipStyle}>Magnet</button>
                <button style={chipStyle}>Auto ripple</button>
                <span style={{ ...chipStyle, background: 'rgba(248,113,113,0.12)', color: '#fecaca' }}>{totalDuration.toFixed(1)}s</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(9, minmax(60px, 1fr))', gap: '8px', color: '#64748b', fontSize: '11px' }}>
                <div />
                {rulers.map((mark) => (
                  <div key={mark}>{mark}</div>
                ))}
              </div>

              <div
                style={{
                  borderRadius: '18px',
                  background: 'rgba(2,6,23,0.72)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  padding: '12px',
                  display: 'grid',
                  gap: '12px',
                  overflowX: 'auto',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', alignItems: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>V1</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', minHeight: '76px' }}>
                    {clips.map((clip, index) => {
                      const duration = Math.max(1, clip.trimEnd - clip.trimStart);
                      return (
                        <button
                          key={clip.id}
                          onClick={() => setActiveId(clip.id)}
                          style={{
                            minWidth: `${Math.max(150, duration * 36)}px`,
                            border: activeId === clip.id ? '1px solid rgba(191,219,254,0.8)' : '1px solid rgba(148,163,184,0.12)',
                            borderRadius: '16px',
                            background:
                              activeId === clip.id
                                ? 'linear-gradient(135deg, rgba(37,99,235,0.9), rgba(124,58,237,0.92))'
                                : 'linear-gradient(135deg, rgba(51,65,85,0.95), rgba(30,41,59,0.95))',
                            color: '#fff',
                            padding: '12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'grid',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '13px' }}>{clip.title}</strong>
                            <span style={{ fontSize: '11px', opacity: 0.82 }}>{duration.toFixed(1)}s</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ ...chipStyle, padding: '4px 8px', background: 'rgba(255,255,255,0.12)' }}>Fade {clip.fadeIn}/{clip.fadeOut}</span>
                            <span style={{ ...chipStyle, padding: '4px 8px', background: 'rgba(255,255,255,0.12)' }}>Zoom {clip.zoomIn}/{clip.zoomOut}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                moveClip(clip.id, 'left');
                              }}
                              style={{ ...chipStyle, padding: '4px 8px' }}
                            >
                              ←
                            </span>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                moveClip(clip.id, 'right');
                              }}
                              style={{ ...chipStyle, padding: '4px 8px' }}
                            >
                              →
                            </span>
                            <span style={{ ...chipStyle, padding: '4px 8px' }}>C{index + 1}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', alignItems: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>A1</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {clips.map((clip) => (
                      <div
                        key={`${clip.id}-audio`}
                        style={{
                          minWidth: `${Math.max(150, (clip.trimEnd - clip.trimStart) * 36)}px`,
                          minHeight: '44px',
                          borderRadius: '14px',
                          border: '1px solid rgba(125,211,252,0.16)',
                          background: 'linear-gradient(135deg, rgba(8,145,178,0.3), rgba(14,116,144,0.24))',
                          display: 'grid',
                          alignItems: 'center',
                          padding: '0 12px',
                          fontSize: '12px',
                          color: '#cffafe',
                        }}
                      >
                        Waveform bed • {clip.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside style={{ ...panelStyle, padding: '16px', display: 'grid', gap: '16px', alignContent: 'start' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#fda4af', marginBottom: '6px' }}>Inspector</div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{activeClip?.title || 'Properties'}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {inspectorTabs.map((tab, index) => (
              <span
                key={tab}
                style={{
                  ...chipStyle,
                  background: index === 0 ? 'rgba(244,114,182,0.16)' : chipStyle.background,
                  color: index === 0 ? '#fbcfe8' : '#e2e8f0',
                }}
              >
                {tab}
              </span>
            ))}
          </div>

          {activeClip ? (
            <>
              <div style={{ ...metricCardStyle, display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Selected duration</span>
                  <strong>{(activeClip.trimEnd - activeClip.trimStart).toFixed(1)}s</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Source</span>
                  <strong>Video layer</strong>
                </div>
              </div>

              <div style={{ ...metricCardStyle, display: 'grid', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Trim in</span>
                    <strong>{activeClip.trimStart.toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(activeClip.trimEnd, 12)}
                    step={0.1}
                    value={activeClip.trimStart}
                    onChange={(e) => updateClip(activeClip.id, { trimStart: Math.min(Number(e.target.value), activeClip.trimEnd - 0.1) })}
                    style={sliderStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Trim out</span>
                    <strong>{activeClip.trimEnd.toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    min={Math.max(activeClip.trimStart + 0.1, 0.1)}
                    max={12}
                    step={0.1}
                    value={activeClip.trimEnd}
                    onChange={(e) => updateClip(activeClip.id, { trimEnd: Math.max(Number(e.target.value), activeClip.trimStart + 0.1) })}
                    style={sliderStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Fade in</span>
                    <strong>{activeClip.fadeIn.toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={activeClip.fadeIn}
                    onChange={(e) => updateClip(activeClip.id, { fadeIn: Number(e.target.value) })}
                    style={sliderStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Fade out</span>
                    <strong>{activeClip.fadeOut.toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={activeClip.fadeOut}
                    onChange={(e) => updateClip(activeClip.id, { fadeOut: Number(e.target.value) })}
                    style={sliderStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Zoom in</span>
                    <strong>{activeClip.zoomIn.toFixed(2)}x</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={activeClip.zoomIn}
                    onChange={(e) => updateClip(activeClip.id, { zoomIn: Number(e.target.value) })}
                    style={sliderStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Zoom out</span>
                    <strong>{activeClip.zoomOut.toFixed(2)}x</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={activeClip.zoomOut}
                    onChange={(e) => updateClip(activeClip.id, { zoomOut: Number(e.target.value) })}
                    style={sliderStyle}
                  />
                </label>
              </div>

              <div style={{ ...metricCardStyle, display: 'grid', gap: '10px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#93c5fd' }}>Workspace controls</div>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Timeline zoom</span>
                    <strong>{zoomLevel}%</strong>
                  </span>
                  <input type="range" min={50} max={200} step={5} value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))} style={sliderStyle} />
                </label>
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8' }}>Select a clip to reveal editor controls.</div>
          )}
        </aside>
      </section>
    </div>
  );
}
