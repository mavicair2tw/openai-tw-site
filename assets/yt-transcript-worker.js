// yt-transcript Cloudflare Worker v7
// Uses Supadata API — requests English, falls back to any available language

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
  // Try English first, then fall back to any language
  const langs = ["en", null];

  for (const lang of langs) {
    const url = lang
      ? `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=${lang}&text=false`
      : `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=false`;

    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) {
      const body = await res.text();
      // 404 means language not available, try next
      if (res.status === 404 && lang !== null) continue;
      throw new Error(`Supadata error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!data.content || data.content.length === 0) continue;

    // Normalize to {start (seconds), duration (seconds), text}
    const segments = data.content.map((c) => ({
      start: (c.offset || 0) / 1000,
      duration: (c.duration || 2000) / 1000,
      text: c.text,
    }));

    return {
      videoId,
      title: data.title || "",
      lang: data.lang || lang || "en",
      segments,
      availableLangs: (data.availableLangs || []).map((code) => ({ code, name: code })),
    };
  }

  throw new Error("No transcript available for this video");
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
