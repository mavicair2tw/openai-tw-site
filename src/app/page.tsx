'use client';

import { FormEvent, useMemo, useState } from 'react';

type ApiResponse = {
  id?: string;
  status?: string;
  message?: string;
  data?: unknown;
  raw?: unknown;
};

const defaultPrompt =
  'The runner continues jogging forward with subtle arm swing and steady cadence. Strong wind pushes the runner\'s hair and jacket fabric. Street lamps on the right glow warmly with soft bokeh and slight streaking. The ocean on the left surges with waves and mist. Camera: handheld, low-to-mid height, tracking alongside the runner, slight micro-shake, shallow depth of field, natural motion blur.';

export default function Home() {
  const [image, setImage] = useState('https://static.wavespeed.ai/examples/5b777712a78a4ebcbe4dcf9d9a35df03/1.png');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('720p');
  const [shotType, setShotType] = useState('single');
  const [enableAudio, setEnableAudio] = useState(true);
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [seed, setSeed] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');

  const payload = useMemo(
    () => ({
      duration,
      enable_audio: enableAudio,
      enable_prompt_expansion: enablePromptExpansion,
      image,
      prompt,
      resolution,
      seed,
      shot_type: shotType,
    }),
    [duration, enableAudio, enablePromptExpansion, image, prompt, resolution, seed, shotType],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Request failed');
      }
      setResult(data);
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
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Wavespeed demo</p>
            <h1 className="text-3xl font-semibold sm:text-5xl">Image to video generator</h1>
            <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Upload or paste an image URL, tune the motion prompt, and send the request through a
              server-side proxy so your API key stays private.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-white/10 bg-zinc-900/80 p-6">
            <Field label="Image URL">
              <input className="input" value={image} onChange={(e) => setImage(e.target.value)} />
            </Field>

            <Field label="Prompt">
              <textarea className="input min-h-40" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration">
                <input className="input" type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </Field>
              <Field label="Resolution">
                <select className="input" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </Field>
              <Field label="Shot type">
                <select className="input" value={shotType} onChange={(e) => setShotType(e.target.value)}>
                  <option value="single">single</option>
                  <option value="multi">multi</option>
                </select>
              </Field>
              <Field label="Seed">
                <input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={enableAudio} onChange={(e) => setEnableAudio(e.target.checked)} />
                Enable audio
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={enablePromptExpansion} onChange={(e) => setEnablePromptExpansion(e.target.checked)} />
                Enable prompt expansion
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate video'}
            </button>

            {error ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
          </form>

          <aside className="space-y-5 rounded-3xl border border-white/10 bg-zinc-900/80 p-6">
            <div>
              <h2 className="text-lg font-semibold">Request payload</h2>
              <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-zinc-200">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Result</h2>
              <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-zinc-200 min-h-40">
                {result ? JSON.stringify(result, null, 2) : 'No result yet.'}
              </pre>
            </div>
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
