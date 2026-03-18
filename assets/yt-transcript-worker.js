// yt-transcript Cloudflare Worker v6
// Uses Supadata API to fetch real YouTube transcripts
// API key stored as Worker secret: SUPADATA_API_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function fetchTranscript(videoId, apiKey) {
  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=false`,
    { headers: { "x-api-key": apiKey } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supadata error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Supadata returns { content: [{text, offset, duration, lang}], lang, availableLangs }
  if (!data.content || data.content.length === 0) {
    throw new Error("No transcript content returned — video may not have captions");
  }

  // Normalize to our segment format: {start (seconds), duration (seconds), text}
  const segments = data.content.map((c) => ({
    start: (c.offset || 0) / 1000,
    duration: (c.duration || 2000) / 1000,
    text: c.text,
  }));

  return {
    videoId,
    title: data.title || "",
    lang: data.lang || "en",
    segments,
    availableLangs: (data.availableLangs || []).map((code) => ({ code, name: code })),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/") return json({ ok: true, usage: "GET /transcript?v=VIDEO_ID" });

    if (url.pathname === "/transcript") {
      const videoId = url.searchParams.get("v");
      if (!videoId || videoId.length < 5)
        return json({ ok: false, error: "Missing ?v=VIDEO_ID" }, 400);

      const apiKey = env.SUPADATA_API_KEY;
      if (!apiKey)
        return json({ ok: false, error: "SUPADATA_API_KEY secret not configured" }, 500);

      try {
        return json({ ok: true, ...(await fetchTranscript(videoId, apiKey)) });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};
