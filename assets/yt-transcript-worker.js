// yt-transcript Cloudflare Worker
// Uses YouTube's Innertube API (POST) — more reliable than HTML scraping

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

function parseXml(xml) {
  const segments = [];
  const re = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = m[3]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, "").trim();
    if (text) segments.push({ start: parseFloat(m[1]), duration: parseFloat(m[2]), text });
  }
  return segments;
}

async function fetchTranscript(videoId) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  // Primary: Innertube POST API with ANDROID client
  const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "X-Youtube-Client-Name": "3",
      "X-Youtube-Client-Version": "19.09.37",
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "19.09.37",
          androidSdkVersion: 30,
          hl: "en",
          gl: "US",
          utcOffsetMinutes: 0,
        },
      },
      videoId,
    }),
  });

  if (!playerRes.ok) throw new Error(`Innertube failed: ${playerRes.status}`);
  const playerData = await playerRes.json();

  let tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  // Fallback: scrape HTML page
  if (!tracks || tracks.length === 0) {
    const htmlRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`);
    const html = await htmlRes.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/);
    if (!match) throw new Error("No captions found and ytInitialPlayerResponse missing");
    try {
      const scraped = JSON.parse(match[1]);
      tracks = scraped?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    } catch { throw new Error("Failed to parse scraped player response"); }
    if (!tracks || tracks.length === 0) throw new Error("No captions available for this video");
  }

  const track =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];

  if (!track?.baseUrl) throw new Error("No caption track URL found");

  const xmlRes = await fetch(track.baseUrl, { headers: { "User-Agent": UA } });
  if (!xmlRes.ok) throw new Error(`Timedtext fetch failed: ${xmlRes.status}`);
  const xml = await xmlRes.text();

  const segments = parseXml(xml);
  if (segments.length === 0) throw new Error("Transcript empty after parsing");

  return {
    videoId,
    title: playerData?.videoDetails?.title || "",
    lang: track.languageCode,
    segments,
    availableLangs: tracks.map((t) => ({
      code: t.languageCode,
      name: t.name?.simpleText || t.languageCode,
      kind: t.kind || "standard",
    })),
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/") return json({ ok: true, usage: "GET /transcript?v=VIDEO_ID" });
    if (url.pathname === "/transcript") {
      const videoId = url.searchParams.get("v");
      if (!videoId || videoId.length < 5) return json({ ok: false, error: "Missing ?v=VIDEO_ID" }, 400);
      try {
        return json({ ok: true, ...(await fetchTranscript(videoId)) });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }
    return json({ ok: false, error: "Not found" }, 404);
  },
};
