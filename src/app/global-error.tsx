'use client';

export default function GlobalError() {
  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#e2e8f0',
          fontFamily: 'Arial, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '560px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '12px' }}>Application error</h2>
          <p style={{ color: '#94a3b8' }}>
            A fatal rendering error occurred. Please refresh the page.
          </p>
        </div>
      </body>
    </html>
  );
}
