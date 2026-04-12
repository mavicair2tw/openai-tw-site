'use client';

const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.72)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

const actionButton: React.CSSProperties = {
  border: 'none',
  borderRadius: '14px',
  padding: '12px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

export default function ICutPage() {
  return (
    <div style={{ color: '#e5eefb', display: 'grid', gap: '24px' }}>
      <section
        style={{
          ...cardStyle,
          background:
            'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 26%), rgba(15,23,42,0.78)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: '8px' }}>
              Dedicated Video Editor
            </div>
            <h1 style={{ margin: 0, fontSize: '32px', lineHeight: 1.05 }}>iCut</h1>
            <p style={{ margin: '10px 0 0', maxWidth: '760px', fontSize: '15px', color: '#94a3b8' }}>
              A focused editing workspace for trimming, sequencing, merging, fading, zooming, and exporting generated or uploaded clips.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ ...actionButton, background: '#2563eb', color: '#fff' }}>Import from Creator</button>
            <button style={{ ...actionButton, background: '#334155', color: '#fff' }}>Upload Video</button>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.35fr 0.9fr', gap: '24px' }}>
        <section style={cardStyle}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>
            Assets
          </div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '22px' }}>Source clips</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {['Uploaded clips', 'Creator gallery imports', 'Recent exports'].map((item) => (
              <div key={item} style={{ borderRadius: '18px', padding: '16px', background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>{item}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>This area will hold selectable source media for editing.</div>
              </div>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: '8px' }}>
            Timeline
          </div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '22px' }}>Sequence builder</h2>

          <div style={{ borderRadius: '20px', background: '#020617', border: '1px solid rgba(148,163,184,0.12)', padding: '20px', minHeight: '340px' }}>
            <div style={{ marginBottom: '18px', color: '#94a3b8', fontSize: '14px' }}>
              Drag clips into sequence, trim ranges, and apply transitions.
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                'Clip 1 · Trim start/end',
                'Clip 2 · Fade in/out',
                'Clip 3 · Zoom in/out',
              ].map((item, index) => (
                <div key={item} style={{ borderRadius: '16px', padding: '14px', background: index === 0 ? 'rgba(37,99,235,0.18)' : 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.14)' }}>
                  <div style={{ fontWeight: 700 }}>{item}</div>
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>Editable clip block placeholder for v1 timeline interactions.</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f9a8d4', marginBottom: '8px' }}>
            Inspector
          </div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '22px' }}>Edit controls</h2>

          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              ['Trim', 'Set in / out points'],
              ['Merge', 'Combine selected clips'],
              ['Fade', 'Apply fade in / fade out'],
              ['Zoom', 'Animate zoom in / zoom out'],
              ['Export', 'Render final downloadable file'],
            ].map(([title, desc]) => (
              <div key={title} style={{ borderRadius: '18px', padding: '14px', background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{title}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
            <button style={{ ...actionButton, background: '#2563eb', color: '#fff' }}>Export Sequence</button>
            <button style={{ ...actionButton, background: '#334155', color: '#fff' }}>Save Draft</button>
          </div>
        </section>
      </div>
    </div>
  );
}
