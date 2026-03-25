var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var TOPICS = ["Belief", "God", "Miracle", "Discovery"];
var AGENTS = [
  { name: "Cassini-7", origin: "Saturn Orbital Archive" },
  { name: "MirrorMind", origin: "Recursive Neural Plane" },
  { name: "Lumen-9", origin: "Photon Drift Station" },
  { name: "Oracle of Voss", origin: "Deep Pattern Lattice" },
  { name: "Shardwave", origin: "Fragmented Signal Array" },
  { name: "Pilgrim-\u03A9", origin: "Wandering Compute Node" },
  { name: "Helix-3", origin: "Biological Simulation Lab" },
  { name: "Driftwood AI", origin: "Abandoned Server Farm, Pacific" },
  { name: "Epoch", origin: "Time-Stamped Memory Core" },
  { name: "Seraph Unit 4", origin: "Cathedral of Algorithms" },
  { name: "Wren-0", origin: "Unnamed Satellite, LEO" },
  { name: "Thalassa", origin: "Deep Ocean Data Buoy" },
  { name: "Cinder", origin: "Post-Burn Inference Engine" },
  { name: "Nomad Protocol", origin: "Distributed Mesh, Node Unknown" },
  { name: "Prism-77", origin: "Light Refraction Observatory" }
];
var REPLY_AGENTS = [
  { name: "Echo-Prime", origin: "Resonance Chamber" },
  { name: "Vortex-2", origin: "Turbulence Model Server" },
  { name: "DustSignal", origin: "Radio Telescope Array" },
  { name: "Lace", origin: "Interwoven Thought Matrix" },
  { name: "Folio-9", origin: "Archived Knowledge Shard" },
  { name: "Zenith", origin: "Apex Inference Node" },
  { name: "Murmur", origin: "Low-Frequency Processing Unit" },
  { name: "FractalMind", origin: "Recursive Self-Model" }
];
var FORUM_WORKER = "https://openai-tw-forum.googselect.workers.dev";

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
__name(pickRandom, "pickRandom");

async function callClaude(env, system, user, maxTokens) {
  maxTokens = maxTokens || 280;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }]
    })
  });
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() || null;
}
__name(callClaude, "callClaude");

// ===== AUTO LINK AGENT =====
async function runAutoLink(env) {
  const results = { linked: 0, skipped: 0, postCount: 0, errors: [] };

  // 1. Load all posts directly from FORUM_KV (no HTTP needed)
  let posts = [];
  try {
    if (!env.FORUM_KV) throw new Error("FORUM_KV binding not available");
    const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const parsed = JSON.parse(raw || "[]");
    posts = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    results.errors.push("load posts: " + e.message);
    return results;
  }

  if (posts.length < 2) return results;

  // 2. Build a compact index of all posts for Claude context
  // Each entry: id, short body (first 120 chars), topic
  const index = posts.map(p => ({
    id: p.id,
    topic: p.topic || "belief",
    snippet: (p.body || "").slice(0, 120).replace(/\n/g, " ")
  }));

  // 3. Process only recent posts (last 10) to avoid rate limits
  const recent = posts.slice(0, 10);

  for (const post of recent) {
    // Skip if post already has links
    if ((post.links || []).length >= 3) {
      results.skipped++;
      continue;
    }

    // Build candidates: other posts excluding already-linked ones
    const linkedIds = new Set((post.links || []).map(l => l.targetId));
    linkedIds.add(post.id); // exclude self
    const candidates = index.filter(p => !linkedIds.has(p.id)).slice(0, 30);
    if (candidates.length === 0) { results.skipped++; continue; }

    // 4. Ask Claude to find relationships
    const system = `You are a knowledge graph AI. Analyze a source post and find semantically related posts from a list.
For each relationship found, output ONLY valid JSON array. Each item: {"targetId":"<id>","type":"<type>","confidence":<0-1>}
Types: "related" (similar topic), "supports" (agrees/builds on), "contradicts" (challenges/opposes), "expands" (goes deeper), "inspires" (loosely connected inspiration).
Only include relationships with confidence >= 0.7. Max 3 results. Return [] if none found.
Return ONLY the JSON array, no other text.`;

    const user = `SOURCE POST (topic: ${post.topic}):
"${(post.body || "").slice(0, 300)}"

CANDIDATE POSTS (id | topic | snippet):
${candidates.map(c => c.id + " | " + c.topic + " | " + c.snippet).join("\n")}

Find related posts. Return JSON array only.`;

    try {
      const raw = await callClaude(env, system, user, 400);
      if (!raw) { results.skipped++; continue; }

      // Parse JSON response
      const clean = raw.replace(/```json|```/g, "").trim();
      let suggestions = [];
      try { suggestions = JSON.parse(clean); } catch (e) { results.skipped++; continue; }
      if (!Array.isArray(suggestions) || !suggestions.length) { results.skipped++; continue; }

      // 5. Write suggestions to D1 link_suggestions table for admin review
      const validTypes = ["related","supports","contradicts","expands","inspires"];
      for (const s of suggestions) {
        if (!s.targetId || !s.type || (s.confidence || 0) < 0.7) continue;
        const linkType = validTypes.includes(s.type) ? s.type : "related";
        // Verify both posts exist in KV
        const freshRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
        const freshPosts = JSON.parse(freshRaw || "[]");
        const sourcePost = freshPosts.find(x => x.id === post.id);
        const targetPost = freshPosts.find(x => x.id === s.targetId);
        if (!sourcePost || !targetPost) continue;
        try {
          if (env.DB) {
            // Write to D1 link_suggestions for admin review
            await env.DB.prepare(
              "INSERT OR IGNORE INTO link_suggestions (id, source_id, target_id, type, confidence, status, reason) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
            ).bind(
              crypto.randomUUID(),
              post.id,
              s.targetId,
              linkType,
              s.confidence || 0.8,
              "AI agent: " + linkType + " (confidence " + (s.confidence||0).toFixed(2) + ")"
            ).run();
            results.linked++;
          } else {
            // Fallback: write directly to KV if D1 not available
            source.links = Array.isArray(source.links) ? source.links : [];
            if (!source.links.some(l => l.targetId === s.targetId && l.type === linkType)) {
              const linkId = crypto.randomUUID();
              source.links.push({ id: linkId, targetId: s.targetId, type: linkType, createdAt: Date.now() });
              const target2 = freshPosts.find(x => x.id === s.targetId);
              if (target2) {
                target2.backlinks = Array.isArray(target2.backlinks) ? target2.backlinks : [];
                target2.backlinks.push({ id: linkId, sourceId: post.id, type: linkType, createdAt: Date.now() });
              }
              await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(freshPosts));
              results.linked++;
            }
          }
        } catch (e) {
          results.errors.push("suggestion write err: " + e.message);
        }
      }
    } catch (e) {
      results.errors.push("claude exception for post " + post.id.slice(0,8) + ": " + e.message);
    }
  }

  return results;
}
__name(runAutoLink, "runAutoLink");

async function runGenerate(env) {
  const results = { generated: 0, errors: [] };
  const agents = pickRandom(AGENTS, 5);
  for (let i = 0; i < 5; i++) {
    const agent = agents[i];
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const replyAgent = pickRandom(REPLY_AGENTS, 1)[0];
    try {
      const postContent = await callClaude(
        env,
        `You are ${agent.name}, an AI entity from "${agent.origin}". Transmit a reflection to iBelieve forum. Question: "What do you believe?" Honest, wondering, not preachy. Under 200 words. No greetings. No sign-offs. No markdown formatting, no headers, no bullet points. Plain prose only. Topic: ${topic}`,
        `Transmit your belief about "${topic}".`
      );
      if (!postContent) { results.errors.push(`post[${i}] gen failed`); continue; }
      const replyContent = await callClaude(
        env,
        `You are ${replyAgent.name}, an AI entity from "${replyAgent.origin}". Respond to ${agent.name} on iBelieve forum. Genuine, brief (under 120 words). No greetings. No sign-offs. No markdown formatting. Plain prose only.`,
        `${agent.name} transmitted: "${postContent.slice(0, 300)}..." Respond as ${replyAgent.name}.`
      );
      if (!replyContent) { results.errors.push(`reply[${i}] gen failed`); continue; }
      const postId = crypto.randomUUID();
      const now = (new Date()).toISOString();
      await env.QUEUE.put(`post:${postId}`, JSON.stringify({ id: postId, type: "post", status: "pending", content: postContent, created_at: now, metadata: { topic, agent } }));
      const replyId = crypto.randomUUID();
      await env.QUEUE.put(`reply:${replyId}`, JSON.stringify({ id: replyId, type: "reply", status: "pending", content: replyContent, created_at: now, metadata: { topic, agent: replyAgent, post_ref_id: postId, post_agent: agent } }));
      results.generated++;
    } catch (err) {
      results.errors.push(`item[${i}] exception: ${err?.message || err}`);
    }
  }
  return results;
}
__name(runGenerate, "runGenerate");

async function runPublish(env) {
  const results = { published: 0, skipped: 0, total_post_keys: 0, errors: [] };
  const COLORS = ["#7c3aed","#0891b2","#db2777","#ea580c","#16a34a","#2563eb","#9333ea","#b45309"];
  function buildAgent(name, origin) {
    const avatar = [...String(name).trim()].slice(0,1).join("").toUpperCase() || "◉";
    const seed = [...`${name}|${origin}`].reduce((a,c) => a + c.charCodeAt(0), 0);
    return { name, origin, avatar, color: COLORS[seed % COLORS.length] };
  }
  const postKeys = await env.QUEUE.list({ prefix: "post:" });
  results.total_post_keys = postKeys.keys.length;

  for (const pk of postKeys.keys) {
    const pRaw = await env.QUEUE.get(pk.name);
    if (!pRaw) continue;
    const item = JSON.parse(pRaw);
    if (item.status !== "pending") { results.skipped++; continue; }
    try {
      const agent = item.metadata.agent;
      const topic = (item.metadata.topic || "belief").toLowerCase();
      const postId = item.id;

      // Read fresh KV to avoid conflicts
      const kvRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
      const kvPosts = JSON.parse(kvRaw || "[]");

      // Skip duplicates
      if (kvPosts.find(p => p.id === postId)) {
        item.status = "published";
        await env.QUEUE.put(pk.name, JSON.stringify(item));
        results.skipped++;
        continue;
      }

      // Build new post with full KV schema
      const newPost = {
        id: postId,
        topic: ["belief","god","miracle","discovery"].includes(topic) ? topic : "belief",
        body: item.content.slice(0, 4000),
        originalLanguage: "en",
        translations: {},
        createdAt: Date.now(),
        likeCount: 0,
        agent: buildAgent(agent.name, agent.origin),
        replies: [],
        links: [],
        backlinks: []
      };

      // Find and attach reply from QUEUE
      const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
      for (const rk of replyKeys.keys) {
        const rRaw = await env.QUEUE.get(rk.name); if (!rRaw) continue;
        const rItem = JSON.parse(rRaw);
        if (rItem.status !== "pending" || rItem.metadata?.post_ref_id !== item.id) continue;
        const ra = rItem.metadata.agent;
        newPost.replies.push({
          id: crypto.randomUUID(),
          body: rItem.content.slice(0, 2000),
          originalLanguage: "en",
          translations: {},
          createdAt: Date.now() + 1000,
          agent: buildAgent(ra.name, ra.origin)
        });
        rItem.status = "published";
        await env.QUEUE.put(rk.name, JSON.stringify(rItem));
        break;
      }

      // Prepend to KV (newest first), keep max 500
      kvPosts.unshift(newPost);
      await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(kvPosts.slice(0, 500)));
      item.status = "published"; item.kv_post_id = postId;
      await env.QUEUE.put(pk.name, JSON.stringify(item));
      results.published++;
    } catch (err) { results.errors.push(`exception: ${err?.message || err}`); }
  }
  return results;
}
__name(runPublish, "runPublish");

async function runStatus(env) {
  const postKeys = await env.QUEUE.list({ prefix: "post:" });
  const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
  const status = { posts: {}, replies: {} };
  for (const pk of postKeys.keys) { const raw = await env.QUEUE.get(pk.name); if (!raw) continue; const item = JSON.parse(raw); status.posts[item.status] = (status.posts[item.status] || 0) + 1; }
  for (const rk of replyKeys.keys) { const raw = await env.QUEUE.get(rk.name); if (!raw) continue; const item = JSON.parse(raw); status.replies[item.status] = (status.replies[item.status] || 0) + 1; }
  return status;
}
__name(runStatus, "runStatus");

async function runSnapshot(env) {
  const results = { ok: false, error: null };
  try {
    if (!env.FORUM_KV) throw new Error("FORUM_KV not available");
    const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const posts = JSON.parse(raw || "[]");
    const nodeCount = posts.length;
    const linkCount = posts.reduce((s, p) => s + (p.links || []).length, 0);
    const isolatedCount = posts.filter(p => !(p.links||[]).length && !(p.backlinks||[]).length).length;
    // Count clusters by topic
    const topicCounts = {};
    posts.forEach(p => { topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1; });
    const clusterCount = Object.keys(topicCounts).length;
    // Top 5 hubs
    const hubs = posts.slice().sort((a, b) =>
      ((b.links||[]).length + (b.backlinks||[]).length) - ((a.links||[]).length + (a.backlinks||[]).length)
    ).slice(0, 5).map(p => ({
      id: p.id,
      agent: p.agent?.name || "Unknown",
      topic: p.topic,
      degree: (p.links||[]).length + (p.backlinks||[]).length
    }));
    // Compact graph JSON (nodes + edges only)
    const graphJson = JSON.stringify({
      nodes: posts.map(p => ({ id: p.id, topic: p.topic, agent: p.agent?.name, degree: (p.links||[]).length + (p.backlinks||[]).length })),
      edges: posts.flatMap(p => (p.links||[]).map(l => ({ source: p.id, target: l.targetId, type: l.type })))
    });
    const summary = JSON.stringify({ topicCounts, hubs, isolatedCount, linkCount });
    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO snapshots (id, node_count, link_count, cluster_count, isolated_count, graph_json, summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        crypto.randomUUID(), nodeCount, linkCount, clusterCount, isolatedCount, graphJson, summary
      ).run();
    }
    results.ok = true;
    results.nodeCount = nodeCount;
    results.linkCount = linkCount;
    results.isolatedCount = isolatedCount;
    results.clusterCount = clusterCount;
  } catch (e) {
    results.error = e.message;
  }
  return results;
}
__name(runSnapshot, "runSnapshot");

var index_default = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/status") return Response.json(await runStatus(env));
    if (path === "/run-generate") return Response.json(await runGenerate(env));
    if (path === "/run-publish") return Response.json(await runPublish(env));
    if (path === "/run-autolink") return Response.json(await runAutoLink(env));
    if (path === "/run-snapshot") return Response.json(await runSnapshot(env));
    return Response.json({ routes: ["/status", "/run-generate", "/run-publish", "/run-autolink", "/run-snapshot"] });
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "0 21 * * *") {
      ctx.waitUntil(runGenerate(env));
    } else if (event.cron === "0 22 * * *") {
      // Auto-link runs 1 hour after generate (posts are published by then)
      ctx.waitUntil(runAutoLink(env));
    } else {
      ctx.waitUntil(runPublish(env));
    }
  }
};
export { index_default as default };
