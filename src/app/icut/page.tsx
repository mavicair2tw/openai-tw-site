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

const panelStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.92)',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: '18px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,23,0.85)',
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
    <div style={{ color: '#e5eefb', display: 'grid', gap: '14px', minHeight: 'calc(100vh - 180px)' }}>
      <section style={{ ...panelStyle, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: '4px' }}>Professional editor layout</div>
          <h1 style={{ margin: 0, fontSize: '26px' }}>iCut Editor</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{status}</div>
          <label style={{ display: 'inline-block', borderRadius: '10px', padding: '10px 12px', background: isUploading ? '#475569' : '#2563eb', color: '#fff', cursor: isUploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}>
            {isUploading ? 'Uploading...' : 'Import'}
            <input type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} disabled={isUploading} />
          </label>
          <button onClick={handleExport} disabled={isExporting} style={{ border: 'none', borderRadius: '10px', padding: '10px 12px', background: isExporting ? '#475569' : '#22c55e', color: '#04130a', fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer' }}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) 320px', gap: '14px', flex: 1 }}>
        <aside style={{ ...panelStyle, padding: '14px', display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: '620px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#93c5fd', marginBottom: '6px' }}>Media</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Clip Bin</div>
          </div>
          <div style={{ display: 'grid', gap: '10px', alignContent: 'start', overflow: 'auto' }}>
            {clips.map((clip) => (
              <button
                key={clip.id}
                onClick={() => setActiveId(clip.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: '14px',
                  padding: '12px',
                  background: activeId === clip.id ? 'rgba(37,99,235,0.18)' : 'rgba(2,6,23,0.42)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  color: '#e5eefb',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{clip.title}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Trim {clip.trimStart}s → {clip.trimEnd}s</div>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ display: 'grid', gridTemplateRows: '1fr 220px', gap: '14px', minHeight: '620px' }}>
          <div style={{ ...panelStyle, padding: '14px', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#c4b5fd', marginBottom: '6px' }}>Preview</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{activeClip?.title || 'No clip selected'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ border: 'none', borderRadius: '10px', padding: '8px 10px', background: '#1e293b', color: '#fff' }}>⏮</button>
                <button style={{ border: 'none', borderRadius: '10px', padding: '8px 12px', background: '#2563eb', color: '#fff' }}>▶</button>
                <button style={{ border: 'none', borderRadius: '10px', padding: '8px 10px', background: '#1e293b', color: '#fff' }}>⏭</button>
              </div>
            </div>
            <div style={{ borderRadius: '18px', background: '#000', border: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
              {activeClip ? (
                <video key={activeClip.src} src={activeClip.src} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
              ) : (
                <div style={{ color: '#94a3b8' }}>Preview monitor</div>
              )}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: '14px', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#f9a8d4', marginBottom: '6px' }}>Timeline</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>Track view</div>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>00:00:00</div>
            </div>
            <div style={{ borderRadius: '16px', background: 'rgba(2,6,23,0.55)', border: '1px solid rgba(148,163,184,0.1)', padding: '12px', overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Video 1</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {clips.map((clip, index) => (
                      <div key={clip.id} style={{ minWidth: '140px', padding: '12px', borderRadius: '12px', background: activeId === clip.id ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#334155', color: '#fff', position: 'relative' }}>
                        <div style={{ fontSize: '11px', opacity: 0.75, marginBottom: '4px' }}>Clip {index + 1}</div>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{clip.title}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => moveClip(clip.id, 'up')} style={{ border: 'none', borderRadius: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer' }}>←</button>
                          <button onClick={() => moveClip(clip.id, 'down')} style={{ border: 'none', borderRadius: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer' }}>→</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside style={{ ...panelStyle, padding: '14px', minHeight: '620px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#fda4af', marginBottom: '6px' }}>Inspector</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>Properties</div>

          {activeClip ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Trim Start</label>
                <input type="number" value={activeClip.trimStart} onChange={(e) => updateClip(activeClip.id, { trimStart: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Trim End</label>
                <input type="number" value={activeClip.trimEnd} onChange={(e) => updateClip(activeClip.id, { trimEnd: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Fade In</label>
                <input type="number" step="0.1" value={activeClip.fadeIn} onChange={(e) => updateClip(activeClip.id, { fadeIn: Number(e.target.value) })} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>Fade Out</label>
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
        </aside>
      </div>
    </div>
  );
}
