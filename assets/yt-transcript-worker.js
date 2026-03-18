// yt-transcript Worker
// Fetches YouTube transcripts server-side via Innertube API
// Flow: fetch /watch HTML → extract playerResponse → get timedtext URL → parse XML

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

// Parse YouTube timedtext XML into segments [{start, duration, text}]
function parseTimedTextXml(xml) {
  const segments = [];
  const re = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const duration = parseFloat(m[2]);
    const text = m[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, "") // strip any inline tags
      .trim();
    if (text) segments.push({ start, duration, text });
  }
  return segments;
}

async function fetchTranscript(videoId) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  // Step 1: Fetch video page HTML to get ytInitialPlayerResponse
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const htmlRes = await fetch(watchUrl, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!htmlRes.ok) throw new Error(`Failed to fetch video page: ${htmlRes.status}`);
  const html = await htmlRes.text();

  // Step 2: Extract ytInitialPlayerResponse JSON from HTML
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!playerMatch) throw new Error("Could not find ytInitialPlayerResponse in page HTML");

  let playerResponse;
  try {
    playerResponse = JSON.parse(playerMatch[1]);
  } catch {
    throw new Error("Failed to parse ytInitialPlayerResponse JSON");
  }

  // Step 3: Find caption tracks
  const tracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks || tracks.length === 0) {
    throw new Error("No captions available for this video");
  }

  // Prefer English, fallback to first available
  const track =
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];

  const baseUrl = track.baseUrl;
  if (!baseUrl) throw new Error("No baseUrl found for caption track");

  // Step 4: Fetch the timedtext XML
  const xmlRes = await fetch(baseUrl + "&fmt=srv3", {
    headers: { "User-Agent": UA },
  });
  if (!xmlRes.ok) throw new Error(`Failed to fetch transcript XML: ${xmlRes.status}`);
  const xml = await xmlRes.text();

  const segments = parseTimedTextXml(xml);
  if (segments.length === 0) throw new Error("Transcript parsed but no segments found");

  // Extract video title
  const title = playerResponse?.videoDetails?.title || "";
  const availableLangs = tracks.map((t) => ({
    code: t.languageCode,
    name: t.name?.simpleText || t.languageCode,
    kind: t.kind || "standard",
  }));

  return { videoId, title, lang: track.languageCode, segments, availableLangs };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/transcript") {
      const videoId = url.searchParams.get("v");
      if (!videoId || videoId.length < 5) {
        return json({ error: "Missing or invalid video ID. Use ?v=VIDEO_ID" }, 400);
      }

      try {
        const result = await fetchTranscript(videoId);
        return json({ ok: true, ...result });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    return json({ error: "Not found. Use GET /transcript?v=VIDEO_ID" }, 404);
  },
};
