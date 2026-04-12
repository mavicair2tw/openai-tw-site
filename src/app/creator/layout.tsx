'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ReactNode } from 'react';

const tabs = [
  { label: 'Studio', path: '/creator' },
  { label: 'Image', path: '/creator/image' },
  { label: 'Video', path: '/creator/video' },
  { label: 'iCut', path: '/icut' },
];

export default function CreatorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at top right, rgba(168,85,247,0.16), transparent 24%), #020617',
        color: '#e5eefb',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(18px)',
          background: 'rgba(2,6,23,0.72)',
          borderBottom: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '22px 24px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>
              OpenAI TW
            </div>
            <h1 style={{ margin: 0, fontSize: '30px', lineHeight: 1.1 }}>Creator Studio</h1>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#94a3b8' }}>
              A clean creative workspace for prompts, images, video, and exports.
            </p>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '14px',
              background: 'rgba(15,23,42,0.78)',
              border: '1px solid rgba(148,163,184,0.16)',
              color: '#cbd5e1',
              fontSize: '12px',
            }}
          >
            Google-first creative pipeline
          </div>
        </div>

        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px 18px' }}>
          <nav style={{ display: 'flex', gap: '10px' }}>
            {tabs.map((tab) => {
              const active = pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '999px',
                    textDecoration: 'none',
                    color: active ? '#020617' : '#cbd5e1',
                    background: active ? '#e2e8f0' : 'rgba(15,23,42,0.75)',
                    border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(148,163,184,0.12)',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '28px 24px 56px' }}>{children}</main>
    </div>
  );
}
