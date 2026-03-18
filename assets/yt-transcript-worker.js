// yt-transcript Cloudflare Worker v4
// Strategy: fetch /watch page → extract playerData → get caption URL → fetch XML
// With detailed debug info to diagnose issues

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
  const debug = [];

  // Step 1: Fetch watch page
  const htmlRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Cookie": "CONSENT=YES+; VISITOR_INFO1_LIVE=; GPS=1;",
    },
  });
  debug.push(`HTML fetch: ${htmlRes.status}`);
  if (!htmlRes.ok) throw new Error(`Page fetch failed: ${htmlRes.status}`);
  const html = await htmlRes.text();
  debug.push(`HTML length: ${html.length}`);

  // Check if we hit a consent page
  if (html.includes("consent.youtube.com") || html.includes("Before you continue")) {
    throw new Error("YouTube consent wall detected");
  }

  // Step 2: Find ytInitialPlayerResponse
  // Try to find it as a script variable
  const idx = html.indexOf("ytInitialPlayerResponse");
  debug.push(`ytInitialPlayerResponse index: ${idx}`);

  let playerData = null;

  // Method A: standard var assignment
  const matchA = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;(?:var |const |let |\n|<)/s);
  if (matchA) {
    try { playerData = JSON.parse(matchA[1]); debug.push("Parsed via method A"); } catch(e) { debug.push("Method A parse error: " + e.message); }
  }

  // Method B: look for it inside a script tag more broadly
  if (!playerData) {
    const scriptMatch = html.match(/<script[^>]*>\s*(?:var\s+)?ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?);\s*<\/script>/);
    if (scriptMatch) {
      try { playerData = JSON.parse(scriptMatch[1]); debug.push("Parsed via method B"); } catch(e) { debug.push("Method B parse error: " + e.message); }
    }
  }

  // Method C: find JSON start and use bracket counting
  if (!playerData && idx !== -1) {
    const start = html.indexOf("{", idx);
    if (start !== -1) {
      let depth = 0, i = start, inStr = false, escape = false;
      for (; i < html.length && i < start + 2000000; i++) {
        const c = html[i];
        if (escape) { escape = false; continue; }
        if (c === "\\" && inStr) { escape = true; continue; }
        if (c === '"') inStr = !inStr;
        if (!inStr) {
          if (c === "{") depth++;
          else if (c === "}") { depth--; if (depth === 0) break; }
        }
      }
      try {
        playerData = JSON.parse(html.slice(start, i + 1));
        debug.push("Parsed via method C (bracket counting)");
      } catch(e) { debug.push("Method C parse error: " + e.message.slice(0, 100)); }
    }
  }

  if (!playerData) throw new Error(`Could not parse player data. Debug: ${debug.join(" | ")}`);

  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  debug.push(`Tracks found: ${tracks?.length ?? 0}`);

  if (!tracks || tracks.length === 0) {
    throw new Error(`No captions available. Debug: ${debug.join(" | ")}`);
  }

  const track =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];

  if (!track?.baseUrl) throw new Error("No caption URL found");
  debug.push(`Using track: ${track.languageCode} (${track.kind || "manual"})`);

  const xmlRes = await fetch(track.baseUrl, {
    headers: { "User-Agent": UA, "Referer": "https://www.youtube.com/" },
  });
  if (!xmlRes.ok) throw new Error(`Timedtext fetch failed: ${xmlRes.status}`);
  const xml = await xmlRes.text();
  debug.push(`XML length: ${xml.length}`);

  const segments = parseXml(xml);
  if (segments.length === 0) throw new Error(`No segments parsed. XML snippet: ${xml.slice(0, 200)}`);

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
    debug,
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
