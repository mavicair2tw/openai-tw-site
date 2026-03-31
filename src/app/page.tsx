"use client";

import { useMemo, useState } from 'react';

const sections = [
  {
    title: 'Cloud Map',
    body: 'A structured space for navigation, themes, and the idea map behind the site.',
    meta: 'Framework / routes / story',
    video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    label: 'Video Card 01',
  },
  {
    title: 'Daily Generated',
    body: 'A rotating content zone for fresh entries, updates, or surfaced reflections.',
    meta: 'Latest / live / current',
    video: 'https://www.youtube.com/embed/oHg5SJYRHA0',
    label: 'Video Card 02',
  },
  {
    title: 'Archive Notes',
    body: 'A quieter section for older material, references, and preserved context.',
    meta: 'History / memory / log',
    video: 'https://www.youtube.com/embed/9bZkp7q19f0',
    label: 'Video Card 03',
  },
];

const navItems = ['Home', 'Cloud Map', 'Daily Generated', 'Archive'];

export default function Home() {
  const [fullScreen, setFullScreen] = useState(true);
  const layoutClass = useMemo(
    () =>
      fullScreen
        ? 'fixed inset-0 z-50 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6'
        : 'relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8',
    [fullScreen],
  );

  return (
    <main className={`bg-[#050816] text-white ${layoutClass}`}>
      {!fullScreen ? (
        <div className="stars" aria-hidden="true">
          <span className="star star-1" />
          <span className="star star-2" />
          <span className="star star-3" />
          <span className="star star-4" />
          <span className="star star-5" />
          <span className="star star-6" />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.16),_transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_25%)]" />

      <div
        className={
          fullScreen
            ? 'relative flex min-h-[calc(100vh-1.5rem)] w-full flex-col justify-between border border-white/10 bg-white/[0.045] px-5 py-6 shadow-2xl shadow-black/30 backdrop-blur sm:px-8 sm:py-8 lg:px-12 lg:py-10'
            : 'relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col justify-between border border-white/10 bg-white/[0.045] px-5 py-6 shadow-2xl shadow-black/30 backdrop-blur sm:px-8 sm:py-8 lg:px-12 lg:py-10'
        }
      >
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.42em] text-sky-300/80">
              iBelieve-inspired
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>playfulsoundengineer360-web</span>
              <span className="hidden h-px w-12 bg-white/15 sm:block" />
              <span>Editorial migration framework</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <nav className="flex flex-wrap gap-2 text-sm text-slate-300">
              {navItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-sky-300/40 hover:bg-white/10 hover:text-white"
                >
                  {item}
                </a>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setFullScreen((value) => !value)}
              className="rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-300/20"
            >
              {fullScreen ? 'ON · full screen' : 'OFF · small view'}
            </button>
          </div>
        </header>

        <section className="grid gap-10 py-16 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:py-20">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-sky-300/80">
              Taipei · 2026
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl">
              A quiet, editorial home for the migration.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">
              This starter follows the mood of openai-tw.com: dark, minimal,
              spacious, and centered around calm presentation instead of heavy UI.
            </p>
          </div>

          <aside className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/20">
            <div className="h-40 bg-[linear-gradient(135deg,rgba(56,189,248,0.25),rgba(99,102,241,0.08),transparent)]" />
            <div className="space-y-4 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Current build
              </p>
              <p className="text-3xl font-semibold text-white">Starter v0.1</p>
              <p className="leading-7 text-slate-300">
                Ready for content, migration pages, and future data integration.
              </p>
            </div>
          </aside>
        </section>

        <div className="border-t border-white/10" />

        <section id="cloud-map" className="py-10 lg:py-12">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-300/80">
                Cloud Map
              </p>
              <h2 className="text-2xl font-medium text-white sm:text-3xl">
                A structured map of the site
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
              A more publication-like arrangement with disciplined spacing,
              section rhythm, and clear editorial hierarchy.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {sections.map((section, index) => (
              <article
                key={section.title}
                className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-sky-300/30 hover:bg-white/10"
              >
                <div className="border-b border-white/10 bg-black/30 p-4 text-xs uppercase tracking-[0.28em] text-slate-400">
                  {section.label}
                </div>
                <div className={fullScreen ? 'h-[360px] border-b border-white/10 bg-black' : 'aspect-video border-b border-white/10 bg-black'}>
                  <iframe
                    className="h-full w-full"
                    src={section.video}
                    title={section.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">
                    {section.meta}
                  </p>
                  <h3 className="mt-5 text-2xl font-medium text-white">
                    {section.title}
                  </h3>
                  <p className="mt-4 leading-8 text-slate-300">{section.body}</p>
                  <div className="mt-8 h-px bg-gradient-to-r from-white/20 via-white/8 to-transparent" />
                  <p className="mt-4 text-xs uppercase tracking-[0.28em] text-slate-500">
                    0{index + 1}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="border-t border-white/10" />

        <section id="daily-generated" className="py-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-300/80">
                Daily Generated
              </p>
              <h2 className="text-2xl font-medium text-white sm:text-3xl">
                Fresh content area
              </h2>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 sm:p-8">
              <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg sm:leading-9">
                This section can later rotate daily posts, featured updates, or
                generated fragments — like a living front page. The spacing and
                divider treatment now lean closer to publication design than a
                standard marketing landing page.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-white/10" />

        <footer
          id="archive"
          className="flex flex-col gap-3 pt-8 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between"
        >
          <p>Designed to feel close to the reference style, but unique to your site.</p>
          <p>Migration-ready · Next.js · Tailwind</p>
        </footer>
      </div>
    </main>
  );
}
