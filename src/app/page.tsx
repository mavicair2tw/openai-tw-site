export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.35em] text-zinc-400">Creator</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">OpenAI TW Creator</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-300 sm:text-base">
          This site points to the creator at <span className="text-cyan-300">https://openai-tw.com/creator</span>.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="https://openai-tw.com/creator"
            className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-zinc-950 transition hover:bg-cyan-300"
          >
            Open Creator
          </a>
          <a
            href="https://openai-tw.com/prompt-builder/"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-medium text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Prompt Builder
          </a>
          <a
            href="/"
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10"
          >
            Home
          </a>
        </div>
      </div>
    </main>
  );
}
