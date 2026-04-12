'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#020617',
        color: '#e2e8f0',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '560px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '12px' }}>Something went wrong</h2>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
          The page hit a runtime error. Try refreshing, or click below to retry.
        </p>
        <button
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
