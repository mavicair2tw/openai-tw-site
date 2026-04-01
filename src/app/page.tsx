'use client';

import { FormEvent, useMemo, useState } from 'react';

type ApiResponse = {
  id?: string;
  status?: string;
  message?: string;
  data?: {
    id?: string;
    status?: string;
    progress?: number;
    error?: { message?: string } | { code?: string; message?: string };
  };
  raw?: unknown;
};

const defaultPrompt =
  'A cinematic shot of a runner moving through a windy seaside road at night, warm street lights, soft bokeh, handheld camera, natural motion blur, dramatic atmosphere.';

function extractVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as any;
  const candidates = [obj.url, obj.video_url, obj.content_url];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;
  }
  const outputs = obj.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === 'string' && item.startsWith('http')) return item;
      if (item && typeof item === 'object') {
        for (const key of ['url', 'video_url', 'content_url']) {
          const value = item[key];
          if (typeof value === 'string' && value.startsWith('http')) return value;
        }
      }
    }
  }
  if (obj.data && typeof obj.data === 'object') return extractVideoUrl(obj.data);
  return null;
}

export default function Home() {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [image, setImage] = useState('https://static.wavespeed.ai/examples/5b777712a78a4ebcbe4dcf9d9a35df03/1.png');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');

  const payload = useMemo(() => ({ mode, image, prompt }), [image, mode, prompt]);

  async function waitForVideo(jobResult: ApiResponse) {
    const jobId = jobResult.data?.id || jobResult.id;
    if (!jobId) return;

    setPolling(true);
    try {
      for (let i = 0; i < 120; i += 1) {
        const res = await fetch(`/api/video-status?id=${encodeURIComponent(jobId)}`);
        const data = await res.json();
        setResult(data);
        const url = extractVideoUrl(data);
        if (url) {
          setVideoUrl(url);
          return;
        }
        const status = (data?.data?.status || data?.status || '').toLowerCase();
        if (['failed', 'canceled', 'cancelled'].includes(status)) {
          setError(data?.data?.error?.message || data?.message || 'Video generation failed');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      setError('Timed out waiting for the video.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling failed');
    } finally {
      setPolling(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setPolling(false);
    setError('');
    setResult(null);
    setVideoUrl('');

    try {
      const response = await fetch('/api/video-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || 'Request failed');
      setResult(data);
      await waitForVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">OpenAI Sora demo</p>
            <h1 className="text-3xl font-semibold sm:text-5xl">Text to video / Image to video</h1>
            <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Create a video from text or guide it with an image reference. The app submits a job,
              polls for completion, and plays the result when it’s ready.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-white/10 bg-zinc-900/80 p-6">
            <Field label="Mode">
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value as 'text' | 'image')}>
                <option value="text">Text to video</option>
                <option value="image">Image to video</option>
              </select>
            </Field>

            {mode === 'image' ? (
              <Field label="Image URL">
                <input className="input" value={image} onChange={(e) => setImage(e.target.value)} />
              </Field>
            ) : null}

            <Field label={mode === 'image' ? 'Prompt / motion guidance' : 'Prompt'}>
              <textarea className="input min-h-40" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </Field>

            <button
              type="submit"
              disabled={loading || polling}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Generating…' : polling ? 'Waiting for video…' : 'Generate video'}
            </button>

            {error ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
          </form>

          <aside className="space-y-5 rounded-3xl border border-white/10 bg-zinc-900/80 p-6">
            <div>
              <h2 className="text-lg font-semibold">Request payload</h2>
              <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-zinc-200">{JSON.stringify(payload, null, 2)}</pre>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Result</h2>
              <pre className="mt-3 min-h-40 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-zinc-200">{result ? JSON.stringify(result, null, 2) : 'No result yet.'}</pre>
            </div>

            {videoUrl ? (
              <div>
                <h2 className="text-lg font-semibold">Video</h2>
                <video className="mt-3 w-full rounded-2xl" controls src={videoUrl} />
                <a className="mt-2 block text-sm text-cyan-300 underline" href={videoUrl} target="_blank" rel="noreferrer">
                  Open video in new tab
                </a>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
