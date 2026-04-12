'use client';

import { ChangeEvent, useMemo, useState } from 'react';

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

const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.72)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(15,23,42,0.85)',
  color: '#e2e8f0',
  fontSize: '13px',
  boxSizing: 'border-box',
};

export default function ICutPage() {
  const [clips, setClips] = useState<Clip[]>(sampleClips);
  const [activeId, setActiveId] = useState<string>(sampleClips[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('Ready');

  const activeClip = useMemo(() => clips.find((clip) => clip.id === activeId) ?? clips[0], [clips, activeId]);

  const updateClip = (id: string, updates: Partial<Clip>) => {
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, ...updates } : clip)));
  };

  const moveClip = (id: string, direction: 'up' | 'down') => {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === id);
      if (index < 0) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
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
    setStatus(`Uploading ${file.name}...`);

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
      setStatus(`Uploaded ${data.title}`);
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
    setStatus('Exporting sequence...');

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
      setStatus('Export complete. Download started.');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Export failed');
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ color: '#e5eefb', display: 'grid', gap: '24px' }}>
      <section style={{ ...cardStyle, background: 'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 26%), rgba(15,23,42,0.78)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: '8px' }}>Dedicated Video Editor</div>
            <h1 style={{ margin: 0, fontSize: '32px', lineHeight: 1.05 }}>iCut</h1>
            <p style={{ margin: '10px 0 0', maxWidth: '760px', fontSize: '15px', color: '#94a3b8' }}>
              Trim, sequence, merge, fade, zoom, upload, and export clips in one focused workspace.
            </p>
          </div>
          <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{status}</div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.9fr', gap: '24px' }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>Assets</div>
              <h2 style={{ margin: 0, fontSize: '22px' }}>Clip bin</h2>
            </div>
            <label style={{ display: 'inline-block', borderRadius: '12px', padding: '10px 12px', background: isUploading ? '#475569' : '#2563eb', color: '#fff', cursor: isUploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}>
              {isUploading ? 'Uploading...' : 'Upload Video'}
              <input type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} disabled={isUploading} />
            </label>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {clips.map((clip) => (
              <button
                key={clip.id}
                onClick={() => setActiveId(clip.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: '18px',
                  padding: '16px',
                  background: activeId === clip.id ? 'rgba(37,99,235,0.18)' : 'rgba(2,6,23,0.42)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  color: '#e5eefb',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>{clip.title}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Trim {clip.trimStart}s → {clip.trimEnd}s · Zoom in {clip.zoomIn} · Zoom out {clip.zoomOut}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: '8px' }}>Timeline</div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '22px' }}>Sequence</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {clips.map((clip, index) => (
              <div key={clip.id} style={{ borderRadius: '18px', padding: '16px', background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#93c5fd' }}>Clip {index + 1}</div>
                    <div style={{ fontWeight: 700 }}>{clip.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => moveClip(clip.id, 'up')} style={{ border: 'none', borderRadius: '10px', padding: '6px 10px', background: '#334155', color: '#fff', cursor: 'pointer' }}>↑</button>
                    <button onClick={() => moveClip(clip.id, 'down')} style={{ border: 'none', borderRadius: '10px', padding: '6px 10px', background: '#334155', color: '#fff', cursor: 'pointer' }}>↓</button>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Fade in {clip.fadeIn}s · Fade out {clip.fadeOut}s · Zoom in {clip.zoomIn} · Zoom out {clip.zoomOut}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f9a8d4', marginBottom: '8px' }}>Inspector</div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '22px' }}>Clip controls</h2>

          {activeClip ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Trim Start (s)</label>
                <input type="number" value={activeClip.trimStart} onChange={(e) => updateClip(activeClip.id, { trimStart: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Trim End (s)</label>
                <input type="number" value={activeClip.trimEnd} onChange={(e) => updateClip(activeClip.id, { trimEnd: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Fade In (s)</label>
                <input type="number" step="0.1" value={activeClip.fadeIn} onChange={(e) => updateClip(activeClip.id, { fadeIn: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Fade Out (s)</label>
                <input type="number" step="0.1" value={activeClip.fadeOut} onChange={(e) => updateClip(activeClip.id, { fadeOut: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Zoom In</label>
                <input type="number" step="0.05" value={activeClip.zoomIn} onChange={(e) => updateClip(activeClip.id, { zoomIn: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Zoom Out</label>
                <input type="number" step="0.05" value={activeClip.zoomOut} onChange={(e) => updateClip(activeClip.id, { zoomOut: Number(e.target.value) })} style={fieldStyle} />
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>Select a clip to edit.</div>
          )}

          <button onClick={handleExport} disabled={isExporting} style={{ marginTop: '18px', width: '100%', border: 'none', borderRadius: '14px', padding: '12px 14px', background: isExporting ? '#475569' : '#2563eb', color: '#fff', fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer' }}>
            {isExporting ? 'Exporting...' : 'Export Sequence'}
          </button>
        </section>
      </div>
    </div>
  );
}
