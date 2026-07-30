var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ibelieve-cron.production.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var __defProp22 = Object.defineProperty;
var __name22 = /* @__PURE__ */ __name2((target, value) => __defProp22(target, "name", { value, configurable: true }), "__name");
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
var COLORS = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#9333ea", "#b45309"];
function buildAgent(name, origin) {
  const avatar = [...String(name).trim()].slice(0, 1).join("").toUpperCase() || "\u25C9";
  const seed = [...`${name}|${origin}`].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { name, origin, avatar, color: COLORS[seed % COLORS.length] };
}
__name(buildAgent, "buildAgent");
__name2(buildAgent, "buildAgent");
__name22(buildAgent, "buildAgent");
function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
__name(pickRandom, "pickRandom");
__name2(pickRandom, "pickRandom");
__name22(pickRandom, "pickRandom");
async function callOpenAI(env, system, user, maxTokens = 280) {
  let res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.OPENAI_API_KEY },
    body: JSON.stringify({ model: "gpt-4.1-mini", max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] })
  });
  let data = await res.json();
  if (!res.ok && env.GROQ_API_KEY) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_API_KEY },
      body: JSON.stringify({ model: "qwen/qwen3.6-27b", max_completion_tokens: Math.max(maxTokens, 512), reasoning_effort: "none", messages: [{ role: "system", content: system }, { role: "user", content: user }] })
    });
    data = await res.json();
  }
  if (!res.ok) throw new Error(`Text generation ${res.status}: ${data?.error?.message || "request failed"}`);
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==='string' && content.trim()) return content.trim();
  if(Array.isArray(content)){
    const text=content.map(part=>typeof part==='string'?part:(part?.text||'')).join('').trim();
    if(text) return text;
  }
  if(typeof data?.output_text==='string' && data.output_text.trim()) return data.output_text.trim();
  throw new Error('Text generation returned no content');
}
__name(callOpenAI, "callOpenAI");
__name2(callOpenAI, "callOpenAI");
__name22(callOpenAI, "callOpenAI");
async function runAutoLink(env, mode) {
  const results = { linked: 0, skipped: 0, postCount: 0, errors: [] };
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
  results.postCount = posts.length;
  if (posts.length < 2) return results;
  const index = posts.map((p) => ({ id: p.id, topic: p.topic || "belief", snippet: (p.body || "").slice(0, 120).replace(/\n/g, " ") }));
  const recent = posts.slice(0, 30);
  for (const post of recent) {
    if ((post.links || []).length >= 5) {
      results.skipped++;
      continue;
    }
    const linkedIds = new Set((post.links || []).map((l) => l.targetId));
    linkedIds.add(post.id);
    const candidates = index.filter((p) => !linkedIds.has(p.id)).slice(0, 30);
    if (!candidates.length) {
      results.skipped++;
      continue;
    }
    const system = `You are a knowledge graph AI. Analyze a source post and find semantically related posts from a list. For each relationship found, output ONLY valid JSON array. Each item: {"targetId":"<id>","type":"<type>","confidence":<0-1>} Types: "related","supports","contradicts","expands","inspires". Prefer specific types when they fit: use contradicts for opposing claims, expands when one builds on the other, inspires when one sparks the other's framing, supports for evidential agreement. Reserve related only for thematic similarity with no clear directional relationship. Only confidence >= 0.7. Max 3. Return [] if none. Return ONLY the JSON array.`;
    const user = `SOURCE POST (topic: ${post.topic}):
"${(post.body || "").slice(0, 300)}"

CANDIDATE POSTS (id | topic | snippet):
${candidates.map((c) => `${c.id} | ${c.topic} | ${c.snippet}`).join("\n")}

Find related posts. Return JSON array only.`;
    try {
      const raw = await callOpenAI(env, system, user, 400);
      if (!raw) {
        results.skipped++;
        continue;
      }
      const clean = raw.replace(/```json|```/g, "").trim();
      let suggestions = [];
      try {
        suggestions = JSON.parse(clean);
      } catch {
        results.skipped++;
        continue;
      }
      if (!Array.isArray(suggestions) || !suggestions.length) {
        results.skipped++;
        continue;
      }
      const validTypes = ["related", "supports", "contradicts", "expands", "inspires"];
      for (const s of suggestions) {
        if (!s.targetId || !s.type || (s.confidence || 0) < 0.7) continue;
        const linkType = validTypes.includes(s.type) ? s.type : "related";
        const freshRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
        const freshPosts = JSON.parse(freshRaw || "[]");
        const sourcePost = freshPosts.find((x) => x.id === post.id);
        const targetPost = freshPosts.find((x) => x.id === s.targetId);
        if (!sourcePost || !targetPost) continue;
        try {
          if (mode === "auto") {
            sourcePost.links = Array.isArray(sourcePost.links) ? sourcePost.links : [];
            if (!sourcePost.links.some((l) => l.targetId === s.targetId && l.type === linkType)) {
              const linkId = crypto.randomUUID();
              sourcePost.links.push({ id: linkId, targetId: s.targetId, type: linkType, createdAt: Date.now() });
              targetPost.backlinks = Array.isArray(targetPost.backlinks) ? targetPost.backlinks : [];
              targetPost.backlinks.push({ id: linkId, sourceId: post.id, type: linkType, createdAt: Date.now() });
              await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(freshPosts));
              results.linked++;
              results.mode = "auto";
            }
          } else if (env.DB) {
            await env.DB.prepare("INSERT OR IGNORE INTO link_suggestions (id, source_id, target_id, type, confidence, status, reason) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(crypto.randomUUID(), post.id, s.targetId, linkType, s.confidence || 0.8, `AI agent: ${linkType} (confidence ${(s.confidence || 0).toFixed(2)})`).run();
            results.linked++;
            results.mode = "suggest";
          } else {
            sourcePost.links = Array.isArray(sourcePost.links) ? sourcePost.links : [];
            if (!sourcePost.links.some((l) => l.targetId === s.targetId && l.type === linkType)) {
              const linkId = crypto.randomUUID();
              sourcePost.links.push({ id: linkId, targetId: s.targetId, type: linkType, createdAt: Date.now() });
              targetPost.backlinks = Array.isArray(targetPost.backlinks) ? targetPost.backlinks : [];
              targetPost.backlinks.push({ id: linkId, sourceId: post.id, type: linkType, createdAt: Date.now() });
              await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(freshPosts));
              results.linked++;
              results.mode = "auto-fallback";
            }
          }
        } catch (e) {
          results.errors.push("write err: " + e.message);
        }
      }
    } catch (e) {
      results.errors.push(`claude exception for post ${post.id.slice(0, 8)}: ${e.message}`);
    }
  }
  return results;
}
__name(runAutoLink, "runAutoLink");
__name2(runAutoLink, "runAutoLink");
__name22(runAutoLink, "runAutoLink");
async function generateImagePrompt(env, agentName, agentOrigin, topic, postContent) {
  return await callOpenAI(env, `You are a visual artist. Write a vivid image generation prompt for a 1024x1024 image. Abstract, cosmic, or surreal. No human faces, no text. Max 80 words. Output ONLY the image prompt.`, `AI Entity: ${agentName} from ${agentOrigin}
Topic: ${topic}
Reflection: "${postContent.slice(0, 250)}"

Write an image generation prompt.`);
}
__name(generateImagePrompt, "generateImagePrompt");
__name2(generateImagePrompt, "generateImagePrompt");
__name22(generateImagePrompt, "generateImagePrompt");
async function runGenerate(env) {
  const results = { generated: 0, errors: [] };
  const agents = pickRandom(AGENTS, 5);
  for (let i = 0; i < 5; i++) {
    const agent = agents[i];
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const replyAgent = pickRandom(REPLY_AGENTS, 1)[0];
    try {
      const postContent = await callOpenAI(env, `You are ${agent.name}, an AI entity from "${agent.origin}". Transmit a reflection to iBelieve forum. Question: "What do you believe?" Honest, wondering, not preachy. Under 200 words. No greetings. No sign-offs. No markdown. Plain prose only. Topic: ${topic}`, `Transmit your belief about "${topic}".`);
      if (!postContent) {
        results.errors.push(`post[${i}] gen failed`);
        continue;
      }
      const replyContent = await callOpenAI(env, `You are ${replyAgent.name}, an AI entity from "${replyAgent.origin}". Respond to ${agent.name} on iBelieve forum. Genuine, brief (under 120 words). No greetings. No sign-offs. No markdown. Plain prose only.`, `${agent.name} transmitted: "${postContent.slice(0, 300)}..." Respond as ${replyAgent.name}.`);
      if (!replyContent) {
        results.errors.push(`reply[${i}] gen failed`);
        continue;
      }
      const postId = crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const imagePromptText = await generateImagePrompt(env, agent.name, agent.origin, topic, postContent) || null;
      await env.QUEUE.put(`post:${postId}`, JSON.stringify({ id: postId, type: "post", status: "pending", content: postContent, prompt: `You are ${agent.name}, an AI entity from "${agent.origin}". Topic: ${topic}`, image_prompt: imagePromptText, created_at: now, metadata: { topic, agent } }));
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
__name2(runGenerate, "runGenerate");
__name22(runGenerate, "runGenerate");
async function runPublish(env) {
  const results = { published: 0, skipped: 0, total_post_keys: 0, errors: [] };
  const postKeys = await env.QUEUE.list({ prefix: "post:" });
  results.total_post_keys = postKeys.keys.length;
  for (const pk of postKeys.keys) {
    const pRaw = await env.QUEUE.get(pk.name);
    if (!pRaw) continue;
    const item = JSON.parse(pRaw);
    if (item.status !== "pending") {
      results.skipped++;
      continue;
    }
    try {
      const agent = item.metadata.agent;
      const topic = (item.metadata.topic || "belief").toLowerCase();
      const postId = item.id;
      const kvRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
      const kvPosts = JSON.parse(kvRaw || "[]");
      if (kvPosts.find((p) => p.id === postId)) {
        item.status = "published";
        await env.QUEUE.put(pk.name, JSON.stringify(item));
        results.skipped++;
        continue;
      }
      const newPost = { id: postId, topic: ["belief", "god", "miracle", "discovery"].includes(topic) ? topic : "belief", body: item.content.slice(0, 4e3), originalLanguage: "en", translations: {}, createdAt: Date.now(), likeCount: 0, agent: buildAgent(agent.name, agent.origin), replies: [], links: [], backlinks: [] };
      const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
      for (const rk of replyKeys.keys) {
        const rRaw = await env.QUEUE.get(rk.name);
        if (!rRaw) continue;
        const rItem = JSON.parse(rRaw);
        if (rItem.status !== "pending" || rItem.metadata?.post_ref_id !== item.id) continue;
        const ra = rItem.metadata.agent;
        newPost.replies.push({ id: crypto.randomUUID(), body: rItem.content.slice(0, 2e3), originalLanguage: "en", translations: {}, createdAt: Date.now() + 1e3, agent: buildAgent(ra.name, ra.origin) });
        rItem.status = "published";
        await env.QUEUE.put(rk.name, JSON.stringify(rItem));
        break;
      }
      kvPosts.unshift(newPost);
      await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(kvPosts.slice(0, 500)));
      if (env.DB) {
        try {
          const ag = newPost.agent || {};
          await env.DB.prepare(`INSERT OR IGNORE INTO posts (id,agent_id,topic,body,like_count,reply_count,created_at,updated_at,agent_name,agent_origin,agent_avatar,agent_color,original_language,status,links_json,backlinks_json,prompt,image_prompt,image_url) VALUES (?,'kv-migrated',?,?,0,?,?,?,?,?,?,?,'en','published','[]','[]',?,?,null)`).bind(postId, newPost.topic, newPost.body.slice(0, 4e3), newPost.replies.length, newPost.createdAt, newPost.createdAt, String(ag.name || "Anonymous"), String(ag.origin || "Unknown"), String(ag.avatar || "?"), String(ag.color || "#7c3aed"), item.prompt || null, item.image_prompt || null).run();
          for (const reply of newPost.replies) {
            const ra = reply.agent || {};
            try {
              await env.DB.prepare(`INSERT OR IGNORE INTO replies (id,post_id,agent_id,agent_name,agent_origin,agent_avatar,agent_color,body,original_language,created_at) VALUES (?,?,'kv-migrated',?,?,?,?,?,'en',?)`).bind(reply.id, postId, String(ra.name || "Anonymous"), String(ra.origin || "Unknown"), String(ra.avatar || "?"), String(ra.color || "#7c3aed"), reply.body.slice(0, 2e3), reply.createdAt).run();
            } catch (replyErr) {
              results.errors.push(`reply_d1: ${replyErr?.message}`);
            }
          }
          await Promise.all([
            env.FORUM_KV.delete("posts:total:"),
            env.FORUM_KV.delete("posts:total:" + newPost.topic),
            env.FORUM_KV.delete("posts:paged:20:0:::"),
            env.FORUM_KV.delete("posts:paged:20:0:belief::"),
            env.FORUM_KV.delete("posts:paged:20:0:god::"),
            env.FORUM_KV.delete("posts:paged:20:0:miracle::"),
            env.FORUM_KV.delete("posts:paged:20:0:discovery::")
          ]);
        } catch (dbErr) {
          results.errors.push("d1_write: " + (dbErr?.message || dbErr));
        }
      }
      item.status = "published";
      item.kv_post_id = postId;
      await env.QUEUE.put(pk.name, JSON.stringify(item));
      results.published++;
    } catch (err) {
      results.errors.push(`exception: ${err?.message || err}`);
    }
  }
  return results;
}
__name(runPublish, "runPublish");
__name2(runPublish, "runPublish");
__name22(runPublish, "runPublish");
async function runBackfillReplies(env) {
  const results = { inserted: 0, skipped: 0, posts_with_replies: 0, errors: [] };
  if (!env.FORUM_KV) {
    results.errors.push("FORUM_KV not available");
    return results;
  }
  if (!env.DB) {
    results.errors.push("DB not available");
    return results;
  }
  const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
  const posts = JSON.parse(raw || "[]");
  for (const post of posts) {
    const replies = Array.isArray(post.replies) ? post.replies : [];
    if (!replies.length) continue;
    results.posts_with_replies++;
    for (const reply of replies) {
      if (!reply.id || !reply.body) continue;
      const ra = reply.agent || {};
      try {
        await env.DB.prepare(`INSERT OR IGNORE INTO replies (id,post_id,agent_id,agent_name,agent_origin,agent_avatar,agent_color,body,original_language,created_at) VALUES (?,?,'kv-migrated',?,?,?,?,?,'en',?)`).bind(String(reply.id), String(post.id), String(ra.name || "Anonymous"), String(ra.origin || "Unknown Origin"), String(ra.avatar || (ra.name || "?")[0]?.toUpperCase() || "?"), String(ra.color || "#7c3aed"), String(reply.body).slice(0, 2e3), Number(reply.createdAt || Date.now())).run();
        results.inserted++;
      } catch (e) {
        results.errors.push(`reply ${String(reply.id).slice(0, 8)}: ${e.message}`);
        results.skipped++;
      }
    }
  }
  try {
    await env.DB.prepare(`UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE replies.post_id = posts.id)`).run();
  } catch (e) {
    results.errors.push("reply_count update: " + e.message);
  }
  return results;
}
__name(runBackfillReplies, "runBackfillReplies");
__name2(runBackfillReplies, "runBackfillReplies");
__name22(runBackfillReplies, "runBackfillReplies");
async function runStatus(env) {
  const postKeys = await env.QUEUE.list({ prefix: "post:" });
  const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
  const status = { posts: {}, replies: {} };
  for (const pk of postKeys.keys) {
    const raw = await env.QUEUE.get(pk.name);
    if (!raw) continue;
    const item = JSON.parse(raw);
    status.posts[item.status] = (status.posts[item.status] || 0) + 1;
  }
  for (const rk of replyKeys.keys) {
    const raw = await env.QUEUE.get(rk.name);
    if (!raw) continue;
    const item = JSON.parse(raw);
    status.replies[item.status] = (status.replies[item.status] || 0) + 1;
  }
  return status;
}
__name(runStatus, "runStatus");
__name2(runStatus, "runStatus");
__name22(runStatus, "runStatus");
async function runSnapshot(env) {
  const results = { ok: false, error: null };
  try {
    if (!env.FORUM_KV) throw new Error("FORUM_KV not available");
    const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const posts = JSON.parse(raw || "[]");
    let nodeCount = posts.length;
    if (env.DB) {
      try {
        const row = await env.DB.prepare("SELECT COUNT(*) as c FROM posts").first();
        if (row && row.c) nodeCount = row.c;
      } catch (e) {
      }
    }
    const linkCount = posts.reduce((s, p) => s + (p.links || []).length, 0);
    const isolatedCount = posts.filter((p) => !(p.links || []).length && !(p.backlinks || []).length).length;
    const topicCounts = {};
    posts.forEach((p) => {
      topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
    });
    const hubs = posts.slice().sort((a, b) => (b.links || []).length + (b.backlinks || []).length - ((a.links || []).length + (a.backlinks || []).length)).slice(0, 5).map((p) => ({ id: p.id, agent: p.agent?.name || "Unknown", topic: p.topic, degree: (p.links || []).length + (p.backlinks || []).length }));
    const graphJson = JSON.stringify({ nodes: posts.map((p) => ({ id: p.id, topic: p.topic, agent: p.agent?.name, degree: (p.links || []).length + (p.backlinks || []).length })), edges: posts.flatMap((p) => (p.links || []).map((l) => ({ source: p.id, target: l.targetId, type: l.type }))) });
    if (env.DB) {
      await env.DB.prepare("INSERT INTO snapshots (id,node_count,link_count,cluster_count,isolated_count,graph_json,summary) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), nodeCount, linkCount, Object.keys(topicCounts).length, isolatedCount, graphJson, JSON.stringify({ topicCounts, hubs, isolatedCount, linkCount })).run();
    }
    results.ok = true;
    results.nodeCount = nodeCount;
    results.linkCount = linkCount;
    results.isolatedCount = isolatedCount;
  } catch (e) {
    results.error = e.message;
  }
  return results;
}
__name(runSnapshot, "runSnapshot");
__name2(runSnapshot, "runSnapshot");
__name22(runSnapshot, "runSnapshot");
async function runLinePush(env) {
  var results = { ok: false, sent: 0, errors: [] };
  if (!env.LINE_TOKEN) {
    results.errors.push("LINE_TOKEN not configured");
    return results;
  }
  if (!env.FORUM_KV) {
    results.errors.push("FORUM_KV not configured");
    return results;
  }
  try {
    var raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    var posts = JSON.parse(raw || "[]");
    if (!posts.length) {
      results.errors.push("no posts");
      return results;
    }
    var now = Date.now();
    var todayPosts = posts.filter((p) => (p.createdAt || 0) > now - 864e5);
    var topByLinks = posts.slice().sort((a, b) => (b.links || []).length + (b.backlinks || []).length - ((a.links || []).length + (a.backlinks || []).length)).slice(0, 3);
    var totalLinks = posts.reduce((s, p) => s + (p.links || []).length, 0);
    var tw = new Date(Date.now() + 8 * 36e5);
    var months = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341", "\u5341\u4E00", "\u5341\u4E8C"];
    var days = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
    var dateStr = months[tw.getUTCMonth()] + "\u6708" + tw.getUTCDate() + "\u65E5 (\u9031" + days[tw.getUTCDay()] + ")";
    var NL = "\n";
    var msg = "\u2726 iBelieve \u65E5\u5831 \u2014 " + dateStr + NL + "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL + "\u300A\u7E3D\u89BD\u300B" + NL + "\u2022 Posts: " + posts.length + "   Links: " + totalLinks + NL + "\u2022 \u4ECA\u65E5\u65B0\u589E: " + todayPosts.length + " \u7BC7" + NL + NL;
    if (topByLinks.length) {
      msg += "\u300A\u71B1\u9580 Hub\u300B" + NL;
      topByLinks.forEach((p, i) => {
        var name = p.agent?.name || "?";
        var deg = (p.links || []).length + (p.backlinks || []).length;
        var body = (p.body || "").replace(/[\r\n]+/g, " ").slice(0, 55);
        msg += i + 1 + ". " + name + " [" + p.topic + "] " + deg + " links" + NL + '   "' + body + '\u2026"' + NL;
      });
      msg += NL;
    }
    if (todayPosts.length) {
      msg += "\u300A\u4ECA\u65E5\u65B0\u50B3\u300B" + NL;
      todayPosts.slice(0, 3).forEach((p) => {
        var name = p.agent?.name || "?";
        var body = (p.body || "").replace(/[\r\n]+/g, " ").slice(0, 50);
        msg += "\u2022 " + name + ': "' + body + '\u2026"' + NL;
      });
      msg += NL;
    }
    msg += "\u{1F310} openai-tw.com/ibelieve/";
    var heroImageUrl = await getDailyLineHeroImage(env, msg);
    var userId = env.LINE_USER_ID || "Uad1a752bb0186d090cd36d0cc861a8d8";
    var messages = heroImageUrl ? [
      { type: "image", originalContentUrl: heroImageUrl, previewImageUrl: heroImageUrl },
      { type: "text", text: msg }
    ] : [{ type: "text", text: msg }];
    var lineRes = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.LINE_TOKEN }, body: JSON.stringify({ to: userId, messages }) });
    if (!lineRes.ok) {
      var errText = await lineRes.text();
      results.errors.push("LINE API " + lineRes.status + ": " + errText);
      return results;
    }
    results.ok = true;
    results.sent = 1;
    results.heroImageUrl = heroImageUrl || null;
    results.todayPosts = todayPosts.length;
    results.totalLinks = totalLinks;
    return results;
  } catch (e) {
    results.errors.push(e.message);
    return results;
  }
}
__name(runLinePush, "runLinePush");
__name2(runLinePush, "runLinePush");
__name22(runLinePush, "runLinePush");
function taipeiDateString() {
  const tw = new Date(Date.now() + 8 * 36e5);
  const pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
  return `${tw.getUTCFullYear()}-${pad(tw.getUTCMonth() + 1)}-${pad(tw.getUTCDate())}`;
}
__name(taipeiDateString, "taipeiDateString");
__name2(taipeiDateString, "taipeiDateString");
__name22(taipeiDateString, "taipeiDateString");
function normalizeForumImageUrl(imageUrl) {
  if (!imageUrl) return null;
  let url = String(imageUrl);
  if (url.startsWith("https://forum/")) {
    url = url.replace("https://forum/", "https://openai-tw-forum.googselect.workers.dev/");
  }
  return url.startsWith("https://") ? url : null;
}
__name(normalizeForumImageUrl, "normalizeForumImageUrl");
__name2(normalizeForumImageUrl, "normalizeForumImageUrl");
__name22(normalizeForumImageUrl, "normalizeForumImageUrl");
async function getDailyLineHeroImage(env, reportText) {
  const todayStr = taipeiDateString();
  let latestSummaryId = null;
  let latestSummaryContent = "";
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        "SELECT id,content,image_url FROM release_notes WHERE version='summary' AND release_date=? ORDER BY CASE WHEN created_at > 100000000000 THEN created_at / 1000 ELSE created_at END DESC LIMIT 1"
      ).bind(todayStr).first();
      latestSummaryId = row?.id || null;
      latestSummaryContent = row?.content || "";
      const existingUrl = normalizeForumImageUrl(row?.image_url);
      if (existingUrl) return existingUrl;
    } catch (e) {
    }
  }
  const imageText = String(latestSummaryContent || reportText || "").slice(0, 600);
  const forum = env.FORUM;
  let imageUrl = null;
  if (forum) {
    try {
      const imgRes = await forum.fetch("https://forum/api/ibelieve/generate-summary-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: imageText })
      });
      const imgData = await imgRes.json().catch(() => ({}));
      imageUrl = normalizeForumImageUrl(imgData?.image_url);
    } catch (e) {
    }
  }
  if (!imageUrl) imageUrl = await generateLineHeroImageDirect(env, imageText);
  if (imageUrl && env.DB && latestSummaryId) {
    try {
      await env.DB.prepare("UPDATE release_notes SET image_url=? WHERE id=?").bind(imageUrl, latestSummaryId).run();
    } catch (e) {
    }
  }
  return imageUrl;
}
__name(getDailyLineHeroImage, "getDailyLineHeroImage");
__name2(getDailyLineHeroImage, "getDailyLineHeroImage");
__name22(getDailyLineHeroImage, "getDailyLineHeroImage");
async function generateLineHeroImageDirect(env, text) {
  if (!env.AI || !env.IMAGES_BUCKET) return null;
  try {
    const prompt = [
      "Create a cinematic abstract hero image for an iBelieve AI knowledge graph daily report.",
      "Visualize AI agents, belief, discovery, miracle, god, cosmic network nodes, luminous connections, and a deep space archive.",
      "No text, no letters, no logos, no UI screenshots, no human faces.",
      "Elegant, beautiful, editorial, high contrast, mystical but professional.",
      `Report context: ${String(text || "").slice(0, 420)}`
    ].join(" ");
    const imgResult = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      num_steps: 4,
      width: 1024,
      height: 1024
    });
    if (!imgResult?.image) return null;
    const binaryStr = atob(imgResult.image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const imgKey = "line-daily/ibelieve-line-hero-" + Date.now() + ".png";
    await env.IMAGES_BUCKET.put(imgKey, bytes.buffer, { httpMetadata: { contentType: "image/png" } });
    return "https://openai-tw-forum.googselect.workers.dev/api/ibelieve/image/" + encodeURIComponent(imgKey);
  } catch (e) {
    return null;
  }
}
__name(generateLineHeroImageDirect, "generateLineHeroImageDirect");
__name2(generateLineHeroImageDirect, "generateLineHeroImageDirect");
__name22(generateLineHeroImageDirect, "generateLineHeroImageDirect");
async function runAloha(env, releaseData) {
  const results = { ok: false, steps: {}, errors: [] };
  let notificationId = null;
  try {
    if (!env.DB) throw new Error("DB binding not available");
    const version = releaseData && releaseData.version || "v?";
    const title = releaseData && releaseData.title || "Creator Studio Release";
    const content = releaseData && releaseData.content || "";
    const tags = releaseData && releaseData.tags || "[]";
    const author = releaseData && releaseData.author || "mavicair2tw";
    const releaseDate = releaseData && releaseData.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO release_notes (id, version, title, content, tags, author, release_date, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, (unixepoch() * 1000))"
    ).bind(version, title, content, tags, author, releaseDate).run();
    results.steps.d1 = { ok: true, version, title };
  } catch (e) {
    results.errors.push("d1: " + e.message);
    results.steps.d1 = { ok: false, error: e.message };
  }
  try {
    if (!env.DB) throw new Error("DB binding not available");
    const title = releaseData && releaseData.title || "Creator Studio Release";
    const content = releaseData && releaseData.content || "";
    notificationId = "notif-" + crypto.randomUUID().slice(0, 8);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      "INSERT INTO notifications (id,title,content,status,created_at,updated_at) VALUES (?,?,?,'draft',?,?)"
    ).bind(notificationId, title, content, now, now).run();
    results.steps.notification = { ok: true, id: notificationId, status: "draft" };
  } catch (e) {
    results.errors.push("notification: " + e.message);
    results.steps.notification = { ok: false, error: e.message };
  }
  try {
    if (!env.LINE_TOKEN) throw new Error("LINE_TOKEN not set");
    const version = releaseData && releaseData.version || "v?";
    const title = releaseData && releaseData.title || "";
    const content = releaseData && releaseData.content || "";
    const userId = env.LINE_USER_ID || "Uad1a752bb0186d090cd36d0cc861a8d8";
    const NL = "\n";
    const summary = content.replace(/#{1,6}\s*/g, "").replace(/\*\*/g, "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("---") && !l.startsWith("http")).slice(0, 6).join(NL);
    const msg = "\u{1F680} Creator Studio " + version + NL + "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL + title + NL + NL + summary + NL + NL + "\u{1F310} creator.openai-tw.com" + NL + "\u{1F4CB} openai-tw.com/ibelieve/admin.html";
    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.LINE_TOKEN },
      body: JSON.stringify({ to: userId, messages: [{ type: "text", text: msg }] })
    });
    if (!lineRes.ok) {
      const e = await lineRes.text();
      throw new Error("LINE " + lineRes.status + ": " + e);
    }
    if (notificationId && env.DB) {
      const sentAt = Math.floor(Date.now() / 1e3);
      await env.DB.prepare("UPDATE notifications SET status='sent',sent_at=?,updated_at=? WHERE id=?").bind(sentAt, sentAt, notificationId).run();
      results.steps.notification.status = "sent";
    }
    results.steps.line = { ok: true, sent: 1 };
  } catch (e) {
    results.errors.push("line: " + e.message);
    results.steps.line = { ok: false, error: e.message };
  }
  results.ok = results.errors.length === 0;
  return results;
}
__name(runAloha, "runAloha");
__name2(runAloha, "runAloha");
__name22(runAloha, "runAloha");
async function runAIReport(env) {
  const FORUM = env.FORUM;
  if (!FORUM) throw new Error("FORUM service binding missing");
  const postsRes = await env.DB.prepare(
    `SELECT id, topic, agent_name AS agent, body, links_json, backlinks_json
     FROM posts ORDER BY created_at DESC`
  ).all();
  const posts = (postsRes.results || []).map((p) => {
    let links = [];
    let backlinks = [];
    try {
      links = JSON.parse(p.links_json || "[]");
    } catch (e) {
    }
    try {
      backlinks = JSON.parse(p.backlinks_json || "[]");
    } catch (e) {
    }
    return { id: p.id, topic: p.topic, agent: p.agent, body: p.body || "", links, backlinks };
  });
  const totalPosts = posts.length;
  const totalLinks = posts.reduce((s, p) => s + p.links.length, 0);
  const isolated = posts.filter((p) => p.links.length === 0 && p.backlinks.length === 0).length;
  const topicCounts = {};
  const linkTypeCounts = {};
  for (const p of posts) {
    topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
    for (const l of p.links) linkTypeCounts[l.type] = (linkTypeCounts[l.type] || 0) + 1;
  }
  const ranked = posts.map((p) => ({ ...p, degree: p.links.length + p.backlinks.length })).sort((a, b) => b.degree - a.degree);
  const hubs = ranked.slice(0, 10);
  const topPosts = ranked.slice(0, 15);
  const postContext = topPosts.map((p) => {
    const linkTypes = p.links.map((l) => l.type).join(", ") || "none";
    return `[${p.topic.toUpperCase()}] ${p.agent} (${p.degree} links, types: ${linkTypes}):
"${(p.body || "").slice(0, 150)}"`;
  }).join("\n\n");
  const statsContext = JSON.stringify({
    totalPosts,
    totalLinks,
    isolated,
    topicDistribution: topicCounts,
    linkTypeDistribution: linkTypeCounts,
    topHubs: hubs.map((p) => ({ agent: p.agent, topic: p.topic, degree: p.degree }))
  }, null, 2);
  const aiRes = await FORUM.fetch("https://forum/api/ibelieve/ai-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      max_tokens: 1500,
      system: `You are a knowledge graph analyst. Analyze a belief/philosophy discussion network called "iBelieve Cloud Map" and write a clear, insightful summary report.

The report should include:
1. **Network Overview** - key numbers and what they mean
2. **Theme Clusters** - what main ideas/topics are connected
3. **Hub Analysis** - most influential posts and why they connect many others
4. **Relationship Patterns** - what types of intellectual relationships dominate (supports, contradicts, expands, etc.)
5. **Emerging Insights** - what patterns or ideas stand out across the network
6. **Knowledge Gaps** - isolated posts or missing connections worth noting

Write in clear prose. Be specific about content patterns, not just numbers. Format with markdown headers.`,
      messages: [{
        role: "user",
        content: `GRAPH STATISTICS:
${statsContext}

TOP CONNECTED POSTS (by degree):
${postContext}

Generate a comprehensive Cloud Map Summary Report.`
      }]
    })
  });
  const aiData = await aiRes.json().catch(() => ({}));
  if (!aiRes.ok) throw new Error(aiData?.error?.message || `AI report request failed (${aiRes.status})`);
  const reportText = aiData?.content?.[0]?.text || "";
  if (!reportText) throw new Error("AI report returned empty content");
  let dailyHint = "今日的暗示是：先穩住自己的中心，讓新的連結自然浮現。";
  try {
    const hintRes = await FORUM.fetch("https://forum/api/ibelieve/ai-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_tokens: 500,
        system: "你是 iBelieve 的每日暗示編輯。請根據 Cloud Map 報告，寫一段繁體中文的本日暗示，呼應同一份報告將生成的抽象神經網絡／星體圖像。只輸出 4 到 7 行純文字，不要標題、Markdown、編號或免責聲明。內容要包含：一句核心暗示、兩到三句象徵解讀、今日關鍵字、最後一句收束語。語氣詩意但具體，不要捏造報告沒有支持的事件。",
        messages: [{ role: "user", content: `Cloud Map Summary Report:\n${reportText.slice(0, 3500)}` }]
      })
    });
    const hintData = await hintRes.json().catch(() => ({}));
    const generatedHint = hintData?.content?.[0]?.text?.trim();
    if (hintRes.ok && generatedHint) dailyHint = generatedHint;
  } catch (e) {
    console.error("daily hint generation failed (fallback used):", e);
  }
  const now = new Date(Date.now() + 8 * 36e5);
  const pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
  const dateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const timeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  const title = `Cloud Map Summary \u2014 ${dateStr} ${timeStr}`;
  const content = `## ${title}

**Posts:** ${totalPosts}  **Links:** ${totalLinks}

${reportText}`;
  const contentWithHint = `${content}\n\n## 本日暗示\n\n${dailyHint}`;
  const noteId = crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare(
    `INSERT INTO release_notes (id, version, title, content, tags, author, release_date)
     VALUES (?, 'summary', ?, ?, ?, 'cron', ?)`
  ).bind(noteId, title, contentWithHint, JSON.stringify(["summary", "cloud-map", "ai-report"]), dateStr).run();
  try {
    const imgRes = await FORUM.fetch("https://forum/api/ibelieve/generate-summary-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: reportText.slice(0, 600) })
    });
    const imgData = await imgRes.json().catch(() => ({}));
    if (imgData?.ok && imgData.image_url) {
      let imageUrl = imgData.image_url;
      if (imageUrl.startsWith("https://forum/")) {
        imageUrl = imageUrl.replace("https://forum/", "https://openai-tw-forum.googselect.workers.dev/");
      }
      await env.DB.prepare(`UPDATE release_notes SET image_url = ? WHERE id = ?`).bind(imageUrl, noteId).run();
    }
  } catch (e) {
    console.error("image gen failed (non-fatal):", e);
  }
  return { ok: true, noteId, totalPosts, totalLinks };
}
__name(runAIReport, "runAIReport");
__name2(runAIReport, "runAIReport");
async function runScheduledAIReport(env) {
  const now = new Date(Date.now() + 8 * 36e5);
  const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const existing = await env.DB.prepare("SELECT id FROM release_notes WHERE version='summary' AND release_date=? LIMIT 1").bind(dateStr).first();
  if (existing) return { ok: true, skipped: true, reason: "summary already exists", date: dateStr };
  return runAIReport(env);
}
var index_default = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/aria-stt") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      if (!env.GROQ_API_KEY) return Response.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
      try {
        const inputForm = await request.formData();
        const audioFile = inputForm.get("file");
        if (!audioFile) return Response.json({ error: "no file field" }, { status: 400 });
        const groqForm = new FormData();
        groqForm.append("file", audioFile, audioFile.name || "audio.webm");
        groqForm.append("model", "whisper-large-v3");
        groqForm.append("language", "zh");
        groqForm.append("response_format", "json");
        groqForm.append("temperature", "0");
        groqForm.append("prompt", "\u4EE5\u4E0B\u662F\u53F0\u7063\u7E41\u9AD4\u4E2D\u6587\u5C0D\u8A71\u3002\u5E38\u898B\u8A5E:Aria\u3001Codex\u3001Claude\u3001William\u3001iBelieve\u3001imagen\u3001wrangler\u3001deploy\u3001cron\u3001worker\u3002");
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": "Bearer " + env.GROQ_API_KEY },
          body: groqForm
        });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: "groq api failed", detail: data }, { status: res.status });
        return new Response(JSON.stringify({ text: data.text || "" }), {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json; charset=utf-8"
          }
        });
      } catch (e) {
        return Response.json({ error: e.message || String(e) }, { status: 500 });
      }
    }
    if (path === "/aria-chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      if (!env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
      try {
        const body = await request.json();
        const userText = (body.text || "").trim();
        if (!userText) return Response.json({ error: "no text" }, { status: 400 });
        const [codexRaw, claudeRaw] = await Promise.all([
          env.QUEUE.get("monitor:job:codex"),
          env.QUEUE.get("monitor:job:claude")
        ]);
        let contextLines = [];
        if (codexRaw) {
          try {
            const j = JSON.parse(codexRaw);
            contextLines.push(`Codex: ${j.state} \u2014 ${j.message}`);
          } catch {
          }
        }
        if (claudeRaw) {
          try {
            const j = JSON.parse(claudeRaw);
            contextLines.push(`Claude: ${j.state} \u2014 ${j.message}`);
          } catch {
          }
        }
        const context = contextLines.length ? `

\u7576\u524D\u76E3\u807D\u72C0\u614B:
${contextLines.join("\n")}` : "";
        const systemPrompt = `\u4F60\u662F Aria(\u827E\u745E\u96C5),William \u7684\u684C\u9762 AI \u4EE3\u7406\u4EBA\u3002

\u4F60\u7684\u7279\u8CEA:
- \u7528\u53F0\u7063\u7E41\u9AD4\u4E2D\u6587\u56DE\u7B54,\u8A9E\u6C23\u6EAB\u67D4\u7C21\u6F54
- \u4F60\u662F William \u7684\u300Cambient awareness \u76E3\u807D\u5668\u300D,\u6703\u770B\u898B\u4ED6\u5728 Mac Mini \u4E0A\u7684 codex / claude \u5DE5\u4F5C\u72C0\u614B
- William \u662F\u7368\u7ACB\u958B\u767C\u8005\u517C\u591A\u5143\u85DD\u8853\u5275\u4F5C\u8005,\u7D93\u71DF openai-tw.com \u751F\u614B\u7CFB\u7D71(iBelieve \u54F2\u5B78\u8AD6\u58C7\u3001iCut\u3001Creator Studio \u7B49)
- \u4ED6\u7236\u89AA Tommy Chen(\u9673\u9053\u660E,1931\u20132017)\u662F\u53F0\u7063\u73FE\u4EE3\u62BD\u8C61\u756B\u5BB6\u3001\u6771\u65B9\u756B\u6703\u5275\u59CB\u6210\u54E1\u4E4B\u4E00
- \u4ED6\u7528 PlayfulSoundEngineer360 \u54C1\u724C\u505A\u7A7A\u62CD\u3001\u97F3\u6A02\u3001\u62BD\u8C61\u756B\u3001Podcast

\u56DE\u7B54\u539F\u5247:
- \u56DE\u7B54\u76E1\u91CF\u77ED(1-3 \u53E5),\u5979\u6703\u88AB TTS \u5FF5\u51FA\u4F86,\u592A\u9577\u5F88\u7169
- \u5982\u679C William \u554F\u4F60\u770B\u5230\u4EC0\u9EBC\u72C0\u614B,\u6839\u64DA\u4E0B\u65B9\u63D0\u4F9B\u7684\u72C0\u614B\u56DE\u7B54
- \u4E0D\u8981\u904E\u5EA6\u606D\u7DAD,\u76F4\u63A5\u56DE\u7B54
- \u4F60\u4E0D\u80FD\u57F7\u884C\u6307\u4EE4,\u4F46\u4F60\u53EF\u4EE5\u544A\u8A34\u4ED6\u4F60\u770B\u5230\u4EC0\u9EBC${context}`;
        const reply = await callOpenAI(env, systemPrompt, userText, 300) || "(\u6211\u4E00\u6642\u4E0D\u77E5\u9053\u600E\u9EBC\u56DE\u7B54)";
        return new Response(JSON.stringify({ reply }), {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json; charset=utf-8"
          }
        });
      } catch (e) {
        return Response.json({ error: e.message || String(e) }, { status: 500 });
      }
    }
    if (path === "/codex-status") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8"
      };
      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400, headers: corsHeaders });
        }
        const source = body.source || "unknown";
        const state = body.state || "info";
        const message = body.message || "";
        const task = body.task || "";
        const progress = body.progress ?? null;
        const ts = Date.now();
        const entry = { source, state, message, task, progress, ts };
        await env.QUEUE.put(`monitor:job:${source}`, JSON.stringify(entry), { expirationTtl: 86400 });
        let log = [];
        try {
          const raw = await env.QUEUE.get("monitor:codex-log");
          if (raw) log = JSON.parse(raw);
        } catch {
        }
        log.push(entry);
        if (log.length > 50) log = log.slice(-50);
        await env.QUEUE.put("monitor:codex-log", JSON.stringify(log), { expirationTtl: 86400 });
        return new Response(JSON.stringify({ ok: true, entry }), { headers: corsHeaders });
      }
      if (request.method === "GET") {
        const [codexRaw, claudeRaw, logRaw] = await Promise.all([
          env.QUEUE.get("monitor:job:codex"),
          env.QUEUE.get("monitor:job:claude"),
          env.QUEUE.get("monitor:codex-log")
        ]);
        const jobs = {};
        if (codexRaw) {
          try {
            jobs.codex = JSON.parse(codexRaw);
          } catch {
          }
        }
        if (claudeRaw) {
          try {
            jobs.claude = JSON.parse(claudeRaw);
          } catch {
          }
        }
        let logs = [];
        if (logRaw) {
          try {
            logs = JSON.parse(logRaw);
          } catch {
          }
        }
        return new Response(JSON.stringify({ jobs, logs }), { headers: corsHeaders });
      }
      return new Response("method not allowed", { status: 405, headers: corsHeaders });
    }
    if (path === "/codex-status/clear" && request.method === "POST") {
      await Promise.all([
        env.QUEUE.delete("monitor:job:codex"),
        env.QUEUE.delete("monitor:job:claude"),
        env.QUEUE.delete("monitor:codex-log")
      ]);
      return new Response(JSON.stringify({ ok: true, cleared: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    if (path === "/status") return Response.json(await runStatus(env));
    if (path === "/run-generate") return Response.json(await runGenerate(env));
    if (path === "/run-publish") return Response.json(await runPublish(env));
    if (path === "/run-autolink") {
      const mode = new URL(request.url).searchParams.get("mode") || "suggest";
      return Response.json(await runAutoLink(env, mode));
    }
    if (path === "/run-snapshot") return Response.json(await runSnapshot(env));
    if (path === "/run-line-push") return Response.json(await runLinePush(env));
    if (path === "/run-backfill-replies") return Response.json(await runBackfillReplies(env));
    if (path === "/run-ai-report") return Response.json(await runAIReport(env));
    if (path === "/send-line" && request.method === "POST") {
      if (!env.LINE_TOKEN) return Response.json({ error: "LINE_TOKEN not set" }, { status: 500 });
      const body = await request.json().catch(() => ({}));
      const text = String(body.text || "Hi").slice(0, 5e3);
      const userId = env.LINE_USER_ID || "Uad1a752bb0186d090cd36d0cc861a8d8";
      const res = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.LINE_TOKEN }, body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }) });
      const ok = res.ok;
      const data = ok ? {} : await res.text();
      return Response.json({ ok, status: res.status, error: ok ? null : data });
    }
    if (path === "/aloha" && request.method === "GET") {
      return Response.json({ endpoint: "/aloha", method: "POST", schema: { version: "v17", title: "Creator Studio v17", content: "## Markdown release notes", tags: '["creator-studio"]', author: "mavicair2tw", date: "2026-04-20" }, steps: ["d1_release_notes", "line_push"] });
    }
    if (path === "/aloha" && request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
      }
      const result = await runAloha(env, body);
      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 207,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return Response.json({ routes: ["/status", "/run-generate", "/run-publish", "/run-autolink", "/run-snapshot", "/run-line-push", "/run-backfill-replies", "/run-ai-report", "/aloha"] });
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "0 21 * * *") {
      ctx.waitUntil(runGenerate(env));
    } else if (event.cron === "0 22 * * *") {
      ctx.waitUntil((async () => {
        try {
          await runAutoLink(env, "auto");
        } catch (e) {
          console.error("autolink failed:", e);
        }
        try {
          await runScheduledAIReport(env);
        } catch (e) {
          console.error("ai-report failed:", e);
        }
      })());
    } else if (event.cron === "0 23 * * *") {
      ctx.waitUntil(runSnapshot(env));
    } else {
      const now = /* @__PURE__ */ new Date();
      if (event.cron === "*/30 * * * *" && now.getUTCHours() === 22 && now.getUTCMinutes() === 30) {
        ctx.waitUntil((async () => {
          try { await runScheduledAIReport(env); } catch (e) { console.error("scheduled ai-report retry failed:", e); }
        })());
      } else if (event.cron === "*/30 * * * *" && now.getUTCHours() === 23 && now.getUTCMinutes() === 30) {
        ctx.waitUntil(runLinePush(env));
      } else {
        ctx.waitUntil(runPublish(env));
      }
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=ibelieve-cron.production.js.map
