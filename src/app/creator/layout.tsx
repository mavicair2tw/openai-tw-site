'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ReactNode } from 'react';

export default function CreatorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { label: '✍ Prompt Builder', path: '/creator', active: pathname === '/creator' },
    { label: '◈ Image', path: '/creator/image', active: pathname === '/creator/image' },
    { label: '▶ Video', path: '/creator/video', active: pathname === '/creator/video' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #e0e0e0', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>Imagen — Creator</h1>
            <p style={{ margin: '0', fontSize: '14px', color: '#999' }}>
              Powered by Gemini & Veo 3.1
            </p>
          </div>
          <button style={{ padding: '8px 16px', cursor: 'pointer', background: '#f0f0f0', border: 'none', borderRadius: '6px' }}>
            Sign out
          </button>
        </div>
      </header>

      <nav style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            href={tab.path}
            style={{
              padding: '12px 24px',
              background: tab.active ? '#fff' : 'transparent',
              borderBottom: tab.active ? '2px solid #000' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: tab.active ? '600' : '400',
              textDecoration: 'none',
              color: '#000',
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer style={{ padding: '10px 20px', textAlign: 'center', fontSize: '12px', color: '#999', borderTop: '1px solid #e0e0e0' }}>
        <p>💡 Tip: Start in Prompt Builder to compose your prompt, then generate image</p>
      </footer>
    </div>
  );
}
