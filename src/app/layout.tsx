import type { Metadata } from 'next';
import Link from 'next/link';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'iCut Studio',
  description: 'Creator and iCut workspace.',
};

const tabs = [
  { label: 'Studio', path: '/' },
  { label: 'Image', path: '/image' },
  { label: 'Video', path: '/video' },
  { label: 'iCut', path: '/icut' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#020617', color: '#e5eefb', fontFamily: 'Inter, Arial, sans-serif' }}>
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
          <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '22px 24px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>OpenAI TW</div>
              <h1 style={{ margin: 0, fontSize: '30px', lineHeight: 1.1 }}>iCut Studio</h1>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#94a3b8' }}>A creative workspace for prompts, generation, and editing.</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '14px', background: 'rgba(15,23,42,0.78)', border: '1px solid rgba(148,163,184,0.16)', color: '#cbd5e1', fontSize: '12px' }}>
              Google-first creative pipeline
            </div>
          </div>
          <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px 18px' }}>
            <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {tabs.map((tab) => (
                <Link
                  key={tab.path}
                  href={tab.path}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '999px',
                    textDecoration: 'none',
                    color: '#cbd5e1',
                    background: 'rgba(15,23,42,0.75)',
                    border: '1px solid rgba(148,163,184,0.12)',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '28px 24px 56px' }}>{children}</main>
      </body>
    </html>
  );
}
