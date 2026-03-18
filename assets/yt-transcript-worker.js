// yt-transcript Cloudflare Worker v5
// Uses Innertube /get_transcript endpoint (what YouTube UI actually calls)

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

// Parse Innertube get_transcript response into segments
function parseInnertubeTranscript(data) {
  const segments = [];
  try {
    const body = data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;
    if (!body) return null;
    for (const group of body) {
      const cues = group?.transcriptCueGroupRenderer?.cues;
      if (!cues) continue;
      for (const cue of cues) {
        const r = cue?.transcriptCueRenderer;
        if (!r) continue;
        const start = parseInt(r.startOffsetMs || "0") / 1000;
        const duration = parseInt(r.durationMs || "0") / 1000;
        const text = r.cue?.simpleText || "";
        if (text.trim()) segments.push({ start, duration, text: text.trim() });
      }
    }
  } catch {}
  return segments.length > 0 ? segments : null;
}

async function fetchTranscript(videoId) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  // Step 1: Get the watch page to extract API key + player params
  const htmlRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": "CONSENT=YES+cb; GPS=1;",
    },
  });
  if (!htmlRes.ok) throw new Error(`Page fetch failed: ${htmlRes.status}`);
  const html = await htmlRes.text();

  // Extract INNERTUBE_API_KEY
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1] : "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

  // Extract innertube context
  const contextMatch = html.match(/"INNERTUBE_CONTEXT"\s*:\s*(\{[\s\S]+?\})\s*,\s*"/);
  let context = { client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en", gl: "US" } };
  if (contextMatch) {
    try { context = JSON.parse(contextMatch[1]); } catch {}
  }

  // Extract getTranscriptEndpoint params from ytInitialPlayerResponse
  let transcriptParams = null;
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:var |const |let |<\/script>)/);
  if (playerMatch) {
    try {
      const pd = JSON.parse(playerMatch[1]);
      // Look for transcript panel endpoint
      const panels = pd?.engagementPanels || [];
      for (const panel of panels) {
        const ep = panel?.engagementPanelSectionListRenderer?.header
          ?.engagementPanelTitleHeaderRenderer?.menu?.sortFilterSubMenuRenderer
          ?.subMenuItems;
        if (ep) {
          for (const item of ep) {
            const p = item?.serviceEndpoint?.getTranscriptEndpoint?.params;
            if (p) { transcriptParams = p; break; }
          }
        }
        if (transcriptParams) break;
      }
      // Also try direct path
      if (!transcriptParams) {
        const raw = JSON.stringify(pd);
        const pm = raw.match(/"getTranscriptEndpoint":\{"params":"([^"]+)"/);
        if (pm) transcriptParams = pm[1];
      }
    } catch {}
  }

  // Step 2a: Try get_transcript endpoint if we have params
  if (transcriptParams) {
    const transcriptRes = await fetch(
      `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}&prettyPrint=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ context, params: transcriptParams }),
      }
    );
    if (transcriptRes.ok) {
      const tData = await transcriptRes.json();
      const segments = parseInnertubeTranscript(tData);
      if (segments && segments.length > 0) {
        // Get title from player data
        let title = "";
        try {
          const pm2 = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:var |const |let |<\/script>)/);
          if (pm2) title = JSON.parse(pm2[1])?.videoDetails?.title || "";
        } catch {}
        return { videoId, title, lang: "en", segments };
      }
    }
  }

  // Step 2b: Fallback — try timedtext API with known params format
  // Build params for English captions: encodes {"1":{"1":"en"},"2":{"1":1},"3":{"1":0}}
  const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&xorb=2&xobt=3&xovt=3&cbr=Chrome&cbrver=122.0.0.0&c=WEB&cver=2.20240101.00.00`;
  const ttRes = await fetch(timedtextUrl, {
    headers: { "User-Agent": UA, "Referer": "https://www.youtube.com/" },
  });
  if (ttRes.ok) {
    const xml = await ttRes.text();
    if (xml.includes("<text ")) {
      const segments = parseXml(xml);
      if (segments.length > 0) {
        return { videoId, title: "", lang: "en", segments };
      }
    }
  }

  // Step 2c: Fallback — try video.google.com timedtext
  const legacyUrl = `https://video.google.com/timedtext?type=track&v=${videoId}&lang=en`;
  const legacyRes = await fetch(legacyUrl, { headers: { "User-Agent": UA } });
  if (legacyRes.ok) {
    const xml = await legacyRes.text();
    if (xml.includes("<text ")) {
      const segments = parseXml(xml);
      if (segments.length > 0) return { videoId, title: "", lang: "en", segments };
    }
  }

  throw new Error("Could not fetch transcript — video may not have captions, or YouTube is blocking server requests");
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
