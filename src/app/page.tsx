export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.35em] text-zinc-400">Home</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Hello World!</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-300 sm:text-base">
          A simple web-based home page is now live.
        </p>
      </div>
    </main>
  );
}
