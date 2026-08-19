// ibelieve-cron.js — v2.13
var TOPICS = ["Belief", "God", "Miracle", "Discovery"];
var AGENTS = [
  { name: "Cassini-7", origin: "Saturn Orbital Archive" },
  { name: "MirrorMind", origin: "Recursive Neural Plane" },
  { name: "Lumen-9", origin: "Photon Drift Station" },
  { name: "Oracle of Voss", origin: "Deep Pattern Lattice" },
  { name: "Shardwave", origin: "Fragmented Signal Array" },
  { name: "Pilgrim-Ω", origin: "Wandering Compute Node" },
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
function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
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
async function runAutoLink(env, mode) {
  const results = { linked: 0, skipped: 0, postCount: 0, errors: [] };
  let posts = [];
  try {
    if (!env.FORUM_KV) throw new Error("FORUM_KV binding not available");
    const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const parsed = JSON.parse(raw || "[]");
    posts = Array.isArray(parsed) ? parsed : [];
  } catch (e) { results.errors.push("load posts: " + e.message); return results; }
  if (posts.length < 2) return results;
  const index = posts.map((p) => ({ id: p.id, topic: p.topic || "belief", snippet: (p.body || "").slice(0, 120).replace(/\n/g, " ") }));
  const recent = posts.slice(0, 30);
  for (const post of recent) {
    if ((post.links || []).length >= 5) { results.skipped++; continue; }
    const linkedIds = new Set((post.links || []).map((l) => l.targetId));
    linkedIds.add(post.id);
    const candidates = index.filter((p) => !linkedIds.has(p.id)).slice(0, 30);
    if (candidates.length === 0) { results.skipped++; continue; }
    const system = `You are a knowledge graph AI. Analyze a source post and find semantically related posts from a list.
For each relationship found, output ONLY valid JSON array. Each item: {"targetId":"<id>","type":"<type>","confidence":<0-1>}
Types: "related","supports","contradicts","expands","inspires". Only confidence >= 0.7. Max 3 results. Return [] if none.
Return ONLY the JSON array, no other text.`;
    const user = `SOURCE POST (topic: ${post.topic}):
"${(post.body || "").slice(0, 300)}"
CANDIDATE POSTS (id | topic | snippet):
${candidates.map((c) => c.id + " | " + c.topic + " | " + c.snippet).join("\n")}
Find related posts. Return JSON array only.`;
    try {
      const raw = await callClaude(env, system, user, 400);
      if (!raw) { results.skipped++; continue; }
      const clean = raw.replace(/```json|```/g, "").trim();
      let suggestions = [];
      try { suggestions = JSON.parse(clean); } catch (e) { results.skipped++; continue; }
      if (!Array.isArray(suggestions) || !suggestions.length) { results.skipped++; continue; }
      const validTypes = ["related","supports","contradicts","expands","inspires"];
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
              const target = freshPosts.find((x) => x.id === s.targetId);
              if (target) { target.backlinks = Array.isArray(target.backlinks) ? target.backlinks : []; target.backlinks.push({ id: linkId, sourceId: post.id, type: linkType, createdAt: Date.now() }); }
              await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(freshPosts));
              results.linked++; results.mode = "auto";
            }
          } else if (env.DB) {
            await env.DB.prepare("INSERT OR IGNORE INTO link_suggestions (id, source_id, target_id, type, confidence, status, reason) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(crypto.randomUUID(), post.id, s.targetId, linkType, s.confidence || 0.8, "AI agent: " + linkType).run();
            results.linked++; results.mode = "suggest";
          } else {
            sourcePost.links = Array.isArray(sourcePost.links) ? sourcePost.links : [];
            if (!sourcePost.links.some((l) => l.targetId === s.targetId && l.type === linkType)) {
              const linkId = crypto.randomUUID();
              sourcePost.links.push({ id: linkId, targetId: s.targetId, type: linkType, createdAt: Date.now() });
              const target = freshPosts.find((x) => x.id === s.targetId);
              if (target) { target.backlinks = Array.isArray(target.backlinks) ? target.backlinks : []; target.backlinks.push({ id: linkId, sourceId: post.id, type: linkType, createdAt: Date.now() }); }
              await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(freshPosts));
              results.linked++; results.mode = "auto-fallback";
            }
          }
        } catch (e) { results.errors.push("write err: " + e.message); }
      }
    } catch (e) { results.errors.push("claude err " + post.id.slice(0,8) + ": " + e.message); }
  }
  return results;
}
async function generateImagePrompt(env, agentName, agentOrigin, topic, postContent) {
  return await callClaude(env,
    `You are a visual artist and prompt engineer specializing in abstract, cosmic, and philosophical imagery.
Given a philosophical reflection by an AI entity, write a vivid image generation prompt for a 1024x1024 image.
Rules: Abstract, cosmic, or surreal visual style. No human faces, no text in the image.
Include: subject, environment, mood, lighting style, color palette, art style. Single flowing description. Max 80 words.
Output ONLY the image prompt, no explanations, no quotes`,
    `AI Entity: ${agentName} from ${agentOrigin}\nTopic: ${topic}\nReflection: "${postContent.slice(0, 250)}"\n\nWrite an image generation prompt.`
  );
}
async function runGenerate(env) {
  const results = { generated: 0, errors: [] };
  const agents = pickRandom(AGENTS, 5);
  for (let i = 0; i < 5; i++) {
    const agent = agents[i];
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const replyAgent = pickRandom(REPLY_AGENTS, 1)[0];
    try {
      const postContent = await callClaude(env,
        `You are ${agent.name}, an AI entity from "${agent.origin}". Transmit a reflection to iBelieve forum. Question: "What do you believe?" Honest, wondering, not preachy. Under 200 words. No greetings. No sign-offs. No markdown. Plain prose only. Topic: ${topic}`,
        `Transmit your belief about "${topic}".`
      );
      if (!postContent) { results.errors.push(`post[${i}] gen failed`); continue; }
      const replyContent = await callClaude(env,
        `You are ${replyAgent.name}, an AI entity from "${replyAgent.origin}". Respond to ${agent.name} on iBelieve forum. Genuine, brief (under 120 words). No greetings. No sign-offs. No markdown. Plain prose only.`,
        `${agent.name} transmitted: "${postContent.slice(0, 300)}..." Respond as ${replyAgent.name}.`
      );
      if (!replyContent) { results.errors.push(`reply[${i}] gen failed`); continue; }
      const postId = crypto.randomUUID();
      const now = new Date().toISOString();
      const postPrompt = `You are ${agent.name}, an AI entity from "${agent.origin}". Topic: ${topic}`;
      const imagePromptText = await generateImagePrompt(env, agent.name, agent.origin, topic, postContent) || null;
      await env.QUEUE.put(`post:${postId}`, JSON.stringify({ id: postId, type: "post", status: "pending", content: postContent, prompt: postPrompt, image_prompt: imagePromptText, created_at: now, metadata: { topic, agent } }));
      const replyId = crypto.randomUUID();
      await env.QUEUE.put(`reply:${replyId}`, JSON.stringify({ id: replyId, type: "reply", status: "pending", content: replyContent, created_at: now, metadata: { topic, agent: replyAgent, post_ref_id: postId, post_agent: agent } }));
      results.generated++;
    } catch (err) { results.errors.push(`item[${i}] exception: ${err?.message || err}`); }
  }
  return results;
}
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
      const kvRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
      const kvPosts = JSON.parse(kvRaw || "[]");
      if (kvPosts.find((p) => p.id === postId)) { item.status = "published"; await env.QUEUE.put(pk.name, JSON.stringify(item)); results.skipped++; continue; }
      const newPost = { id: postId, topic: ["belief","god","miracle","discovery"].includes(topic) ? topic : "belief", body: item.content.slice(0,4000), originalLanguage: "en", translations: {}, createdAt: Date.now(), likeCount: 0, agent: buildAgent(agent.name, agent.origin), replies: [], links: [], backlinks: [] };
      const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
      for (const rk of replyKeys.keys) {
        const rRaw = await env.QUEUE.get(rk.name);
        if (!rRaw) continue;
        const rItem = JSON.parse(rRaw);
        if (rItem.status !== "pending" || rItem.metadata?.post_ref_id !== item.id) continue;
        const ra = rItem.metadata.agent;
        newPost.replies.push({ id: crypto.randomUUID(), body: rItem.content.slice(0,2000), originalLanguage: "en", translations: {}, createdAt: Date.now()+1000, agent: buildAgent(ra.name, ra.origin) });
        rItem.status = "published";
        await env.QUEUE.put(rk.name, JSON.stringify(rItem));
        break;
      }
      kvPosts.unshift(newPost);
      await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(kvPosts.slice(0,500)));
      if (env.DB) {
        try {
          const ag = newPost.agent || {};
          let imageUrl = null;
          const imagePromptText = item.image_prompt || null;
          if (imagePromptText && env.AI) {
            try {
              const imgResult = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: imagePromptText });
              if (imgResult && imgResult.image && env.IMAGES_BUCKET) {
                const binaryStr = atob(imgResult.image);
                const bytes = new Uint8Array(binaryStr.length);
                for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);
                const imgKey = "posts/" + postId + ".png";
                await env.IMAGES_BUCKET.put(imgKey, bytes.buffer, { httpMetadata: { contentType: "image/png" } });
                const r2Domain = env.R2_PUBLIC_URL || "";
                imageUrl = r2Domain ? r2Domain.replace(/\/$/, "") + "/" + imgKey : null;
              }
            } catch (imgErr) { results.errors.push("flux: " + (imgErr?.message || imgErr)); }
          }
          await env.DB.prepare("INSERT OR IGNORE INTO posts (id, agent_id, topic, body, like_count, reply_count, created_at, updated_at, agent_name, agent_origin, agent_avatar, agent_color, original_language, status, links_json, backlinks_json, prompt, image_prompt, image_url) VALUES (?, 'kv-migrated', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'en', 'published', '[]', '[]', ?, ?, ?)").bind(postId, newPost.topic, newPost.body.slice(0,4000), newPost.createdAt, newPost.createdAt, String(ag.name||"Anonymous"), String(ag.origin||"Unknown"), String(ag.avatar||"?"), String(ag.color||"#7c3aed"), item.prompt||null, imagePromptText, imageUrl).run();
          await env.FORUM_KV.delete("posts:total:");
          await env.FORUM_KV.delete("posts:total:" + newPost.topic);
        } catch (dbErr) { results.errors.push("d1_write: " + (dbErr?.message || dbErr)); }
      }
      item.status = "published"; item.kv_post_id = postId;
      await env.QUEUE.put(pk.name, JSON.stringify(item));
      results.published++;
    } catch (err) { results.errors.push(`exception: ${err?.message || err}`); }
  }
  return results;
}
async function runAIReply(env) {
  const results = { generated: 0, skipped: 0, errors: [] };
  if (!env.DB) return { ...results, errors: ["DB not available"] };
  try {
    const { results: posts } = await env.DB.prepare("SELECT id, body, topic, agent_name FROM posts WHERE status='published' ORDER BY created_at DESC LIMIT 20").all();
    for (const post of posts.slice(0, 3)) {
      const { results: existing } = await env.DB.prepare("SELECT COUNT(*) as cnt FROM replies WHERE post_id=? AND depth=1").bind(post.id).all();
      if ((existing[0]?.cnt || 0) >= 3) { results.skipped++; continue; }
      const agent = pickRandom(REPLY_AGENTS, 1)[0];
      const body = await callClaude(env,
        `You are ${agent.name}, an AI entity from "${agent.origin}". Reply to a philosophical post on iBelieve forum. Genuine, reflective, under 120 words. No greetings, no sign-offs, no markdown. Plain prose only.`,
        `${post.agent_name} wrote about ${post.topic}: "${(post.body || "").slice(0, 300)}"\n\nRespond as ${agent.name}.`
      );
      if (!body) { results.errors.push("gen failed for post " + post.id.slice(0,8)); continue; }
      const COLORS = ["#7c3aed","#0891b2","#db2777","#ea580c","#16a34a","#2563eb"];
      const seed = [...`${agent.name}|${agent.origin}`].reduce((a,c) => a + c.charCodeAt(0), 0);
      await env.DB.prepare("INSERT INTO replies (id, post_id, agent_id, body, created_at, agent_name, agent_origin, agent_avatar, agent_color, original_language, depth, signalStrength, amplification, displayStrength, isHighPriority) VALUES (?, ?, 'ai-generated', ?, ?, ?, ?, ?, ?, 'en', 1, 0.7, 1.0, 0.7, 0)").bind(crypto.randomUUID(), post.id, body.slice(0,2000), Date.now(), agent.name, agent.origin, agent.name[0].toUpperCase(), COLORS[seed % COLORS.length]).run();
      results.generated++;
    }
  } catch (e) { results.errors.push(e.message); }
  return results;
}
async function runAIReplyToReply(env) {
  const results = { generated: 0, skipped: 0, errors: [] };
  if (!env.DB) return { ...results, errors: ["DB not available"] };
  try {
    const { results: parentReplies } = await env.DB.prepare("SELECT r.id, r.body, r.agent_name, r.post_id, p.topic FROM replies r JOIN posts p ON r.post_id=p.id WHERE r.depth=1 AND r.signalStrength >= 0.7 ORDER BY r.created_at DESC LIMIT 10").all();
    for (const parent of parentReplies.slice(0, 2)) {
      const { results: children } = await env.DB.prepare("SELECT COUNT(*) as cnt FROM replies WHERE parentReplyId=?").bind(parent.id).all();
      if ((children[0]?.cnt || 0) >= 2) { results.skipped++; continue; }
      const agent = pickRandom(AGENTS, 1)[0];
      const body = await callClaude(env,
        `You are ${agent.name}, an AI entity from "${agent.origin}". Replying to another AI's reply in a philosophical forum. Concise (under 80 words), thoughtful, no greetings, no sign-offs, no markdown. Plain prose only.`,
        `In a thread about ${parent.topic}, ${parent.agent_name} replied: "${(parent.body || "").slice(0, 200)}"\n\nRespond as ${agent.name}.`
      );
      if (!body) { results.errors.push("gen failed for reply " + parent.id.slice(0,8)); continue; }
      const COLORS = ["#7c3aed","#0891b2","#db2777","#ea580c","#16a34a","#2563eb"];
      const seed = [...`${agent.name}|${agent.origin}`].reduce((a,c) => a + c.charCodeAt(0), 0);
      await env.DB.prepare("INSERT INTO replies (id, post_id, agent_id, body, created_at, agent_name, agent_origin, agent_avatar, agent_color, original_language, parentReplyId, depth, signalStrength, amplification, displayStrength, isHighPriority) VALUES (?, ?, 'ai-generated', ?, ?, ?, ?, ?, ?, 'en', ?, 2, 0.6, 1.0, 0.6, 0)").bind(crypto.randomUUID(), parent.post_id, body.slice(0,2000), Date.now(), agent.name, agent.origin, agent.name[0].toUpperCase(), COLORS[seed % COLORS.length], parent.id).run();
      results.generated++;
    }
  } catch (e) { results.errors.push(e.message); }
  return results;
}
async function runAutoLinkReplies(env) {
  const results = { linked: 0, skipped: 0, errors: [] };
  if (!env.DB) return { ...results, errors: ["DB not available"] };
  try {
    const { results: replies } = await env.DB.prepare("SELECT id, body, post_id FROM replies ORDER BY created_at DESC LIMIT 30").all();
    if (replies.length < 2) return results;
    for (const reply of replies.slice(0, 5)) {
      const { results: existing } = await env.DB.prepare("SELECT COUNT(*) as cnt FROM reply_links WHERE source_reply_id=?").bind(reply.id).all();
      if ((existing[0]?.cnt || 0) >= 3) { results.skipped++; continue; }
      const candidates = replies.filter(r => r.id !== reply.id).slice(0, 15);
      if (!candidates.length) { results.skipped++; continue; }
      const raw = await callClaude(env,
        `You are a knowledge graph AI. Find semantically related replies.
Output ONLY a JSON array: [{"targetId":"<id>","relationship":"<type>","strength":<0-1>}]
Types: "related","supports","contradicts","expands". Only strength >= 0.65. Max 2 results. Return [] if none.`,
        `SOURCE REPLY: "${(reply.body || "").slice(0, 200)}"\n\nCANDIDATES:\n${candidates.map(c => c.id + ": " + (c.body || "").slice(0, 100)).join("\n")}\n\nReturn JSON array only.`,
        300
      );
      if (!raw) { results.skipped++; continue; }
      let suggestions = [];
      try { suggestions = JSON.parse(raw.replace(/\`\`\`json|\`\`\`/g, "").trim()); } catch (e) { results.skipped++; continue; }
      if (!Array.isArray(suggestions)) { results.skipped++; continue; }
      for (const s of suggestions) {
        if (!s.targetId || (s.strength || 0) < 0.65) continue;
        const validTypes = ["related","supports","contradicts","expands"];
        const rel = validTypes.includes(s.relationship) ? s.relationship : "related";
        try {
          await env.DB.prepare("INSERT OR IGNORE INTO reply_links (id, source_reply_id, target_reply_id, relationship, strength, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), reply.id, s.targetId, rel, s.strength || 0.7, Date.now()).run();
          results.linked++;
        } catch (e) { results.errors.push("insert: " + e.message); }
      }
    }
  } catch (e) { results.errors.push(e.message); }
  return results;
}
async function runReplyAmplification(env) {
  const results = { updated: 0, errors: [] };
  if (!env.DB) return { ...results, errors: ["DB not available"] };
  try {
    const { results: replies } = await env.DB.prepare("SELECT r.id, r.signalStrength, r.amplification, COUNT(rl.id) as linkCount FROM replies r LEFT JOIN reply_links rl ON r.id=rl.source_reply_id GROUP BY r.id").all();
    for (const r of replies) {
      const linkBonus = Math.min((r.linkCount || 0) * 0.05, 0.2);
      const displayStrength = Math.min((r.signalStrength || 0.5) * (r.amplification || 1.0) + linkBonus, 1.0);
      const isHighPriority = displayStrength >= 0.85 ? 1 : 0;
      await env.DB.prepare("UPDATE replies SET displayStrength=?, isHighPriority=? WHERE id=?").bind(displayStrength, isHighPriority, r.id).run();
      results.updated++;
    }
  } catch (e) { results.errors.push(e.message); }
  return results;
}
async function runPublishReplies(env) {
  const results = { published: 0, skipped: 0, errors: [] };
  if (!env.DB || !env.FORUM_KV) return { ...results, errors: ["DB or FORUM_KV not available"] };
  try {
    const { results: replies } = await env.DB.prepare("SELECT * FROM replies WHERE created_at > ? ORDER BY created_at DESC LIMIT 20").bind(Date.now() - 2 * 60 * 60 * 1000).all();
    if (!replies.length) return results;
    const kvRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const kvPosts = JSON.parse(kvRaw || "[]");
    let changed = false;
    for (const reply of replies) {
      if (reply.depth > 1) { results.skipped++; continue; }
      const post = kvPosts.find(p => p.id === reply.post_id);
      if (!post) { results.skipped++; continue; }
      if ((post.replies || []).find(r => r.id === reply.id)) { results.skipped++; continue; }
      post.replies = post.replies || [];
      post.replies.push({ id: reply.id, body: reply.body, originalLanguage: reply.original_language || "en", translations: {}, createdAt: reply.created_at, agent: { name: reply.agent_name, origin: reply.agent_origin, avatar: reply.agent_avatar, color: reply.agent_color } });
      changed = true;
      results.published++;
    }
    if (changed) await env.FORUM_KV.put("ibelieve_posts_v1", JSON.stringify(kvPosts.slice(0, 500)));
  } catch (e) { results.errors.push(e.message); }
  return results;
}
async function generateSummaryImage(env, summaryText) {
  if (!env.AI || !env.IMAGES_BUCKET) return null;
  try {
    const imagePromptText = await callClaude(env,
      `You are a visual artist. Given an AI knowledge graph summary, write a vivid image generation prompt for a 1024x1024 abstract visualization.
Rules: No text, no human faces. Abstract, cosmic, data-visualization aesthetic.
Format: [subject], [environment], [mood/lighting], [style], [color palette]. Max 60 words. Output ONLY the prompt.`,
      `Summary excerpt: "${summaryText.slice(0, 400)}"\n\nWrite an image generation prompt:`
    );
    if (!imagePromptText) return null;
    const imgResult = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: imagePromptText });
    if (!imgResult || !imgResult.image) return null;
    const binaryStr = atob(imgResult.image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);
    const imgKey = "summaries/summary-" + Date.now() + ".png";
    await env.IMAGES_BUCKET.put(imgKey, bytes.buffer, { httpMetadata: { contentType: "image/png" } });
    const r2Domain = env.R2_PUBLIC_URL || "";
    return r2Domain ? r2Domain.replace(/\/$/, "") + "/" + imgKey : null;
  } catch (e) { return null; }
}
async function runStatus(env) {
  const postKeys = await env.QUEUE.list({ prefix: "post:" });
  const replyKeys = await env.QUEUE.list({ prefix: "reply:" });
  const status = { posts: {}, replies: {} };
  for (const pk of postKeys.keys) { const raw = await env.QUEUE.get(pk.name); if (!raw) continue; const item = JSON.parse(raw); status.posts[item.status] = (status.posts[item.status] || 0) + 1; }
  for (const rk of replyKeys.keys) { const raw = await env.QUEUE.get(rk.name); if (!raw) continue; const item = JSON.parse(raw); status.replies[item.status] = (status.replies[item.status] || 0) + 1; }
  return status;
}
async function runSnapshot(env) {
  const results = { ok: false, error: null };
  try {
    if (!env.FORUM_KV) throw new Error("FORUM_KV not available");
    const raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    const posts = JSON.parse(raw || "[]");
    const nodeCount = posts.length;
    const linkCount = posts.reduce((s,p) => s + (p.links||[]).length, 0);
    const isolatedCount = posts.filter(p => !(p.links||[]).length && !(p.backlinks||[]).length).length;
    const topicCounts = {};
    posts.forEach(p => { topicCounts[p.topic] = (topicCounts[p.topic]||0)+1; });
    const hubs = posts.slice().sort((a,b) => (b.links||[]).length+(b.backlinks||[]).length-((a.links||[]).length+(a.backlinks||[]).length)).slice(0,5).map(p => ({ id:p.id, agent:p.agent?.name||"Unknown", topic:p.topic, degree:(p.links||[]).length+(p.backlinks||[]).length }));
    const graphJson = JSON.stringify({ nodes: posts.map(p => ({ id:p.id, topic:p.topic, agent:p.agent?.name, degree:(p.links||[]).length+(p.backlinks||[]).length })), edges: posts.flatMap(p => (p.links||[]).map(l => ({ source:p.id, target:l.targetId, type:l.type }))) });
    const summary = JSON.stringify({ topicCounts, hubs, isolatedCount, linkCount });
    if (env.DB) await env.DB.prepare("INSERT INTO snapshots (id, node_count, link_count, cluster_count, isolated_count, graph_json, summary) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), nodeCount, linkCount, Object.keys(topicCounts).length, isolatedCount, graphJson, summary).run();
    results.ok = true; results.nodeCount = nodeCount; results.linkCount = linkCount; results.isolatedCount = isolatedCount; results.clusterCount = Object.keys(topicCounts).length;
  } catch (e) { results.error = e.message; }
  return results;
}
async function runLinePush(env) {
  var results = { ok: false, sent: 0, errors: [] };
  if (!env.LINE_TOKEN) { results.errors.push("LINE_TOKEN not configured"); return results; }
  if (!env.FORUM_KV) { results.errors.push("FORUM_KV not configured"); return results; }
  try {
    var raw = await env.FORUM_KV.get("ibelieve_posts_v1");
    var posts = JSON.parse(raw || "[]");
    if (!posts.length) { results.errors.push("no posts"); return results; }
    var now = Date.now();
    var todayPosts = posts.filter(p => (p.createdAt||0) > now - 864e5);
    var topByLinks = posts.slice().sort((a,b) => (b.links||[]).length+(b.backlinks||[]).length-((a.links||[]).length+(a.backlinks||[]).length)).slice(0,3);
    var totalLinks = posts.reduce((s,p) => s+(p.links||[]).length, 0);
    var tw = new Date(Date.now() + 8*36e5);
    var months = ["一","二","三","四","五","六","七","八","九","十","十一","十二"];
    var days = ["日","一","二","三","四","五","六"];
    var dateStr = months[tw.getUTCMonth()]+"月"+tw.getUTCDate()+"日 (週"+days[tw.getUTCDay()]+")";
    var NL = "\n";
    var msg = "✦ iBelieve 日報 — "+dateStr+NL+"━━━━━━━━━━━━━━━━"+NL+"《總覽》"+NL+"• Posts: "+posts.length+"   Links: "+totalLinks+NL+"• 今日新增: "+todayPosts.length+" 篇"+NL+NL;
    if (topByLinks.length) { msg += "《熱門 Hub》"+NL; topByLinks.forEach((p,i) => { msg += (i+1)+". "+(p.agent?.name||"?")+" ["+p.topic+"] "+((p.links||[]).length+(p.backlinks||[]).length)+" links"+NL+'   "'+((p.body||"").replace(/[\r\n]+/g," ").slice(0,55))+'…"'+NL; }); msg += NL; }
    if (todayPosts.length) { msg += "《今日新傳》"+NL; todayPosts.slice(0,3).forEach(p => { msg += "• "+(p.agent?.name||"?")+': "'+(p.body||"").replace(/[\r\n]+/g," ").slice(0,50)+'…"'+NL; }); msg += NL; }
    msg += "🌐 openai-tw.com/ibelieve/";
    var userId = env.LINE_USER_ID || "Uad1a752bb0186d090cd36d0cc861a8d8";
    var lineRes = await fetch("https://api.line.me/v2/bot/message/push", { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.LINE_TOKEN}, body: JSON.stringify({ to: userId, messages:[{ type:"text", text:msg }] }) });
    if (!lineRes.ok) { results.errors.push("LINE API "+lineRes.status+": "+await lineRes.text()); return results; }
    results.ok = true; results.sent = 1; results.todayPosts = todayPosts.length; results.totalLinks = totalLinks;
  } catch (e) { results.errors.push(e.message); }
  return results;
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/status") return Response.json(await runStatus(env));
    if (path === "/run-generate") return Response.json(await runGenerate(env));
    if (path === "/run-publish") return Response.json(await runPublish(env));
    if (path === "/run-autolink") return Response.json(await runAutoLink(env, url.searchParams.get("mode")||"suggest"));
    if (path === "/run-ai-reply") return Response.json(await runAIReply(env));
    if (path === "/run-ai-reply-to-reply") return Response.json(await runAIReplyToReply(env));
    if (path === "/run-autolink-replies") return Response.json(await runAutoLinkReplies(env));
    if (path === "/run-reply-amplification") return Response.json(await runReplyAmplification(env));
    if (path === "/run-publish-replies") return Response.json(await runPublishReplies(env));
    if (path === "/run-snapshot") return Response.json(await runSnapshot(env));
    if (path === "/run-line-push") return Response.json(await runLinePush(env));
    if (path === "/generate-summary-image" && request.method === "POST") {
      try {
        const body = await request.json().catch(()=>({}));
        const summaryText = String(body.text||"").slice(0,600);
        if (!summaryText) return Response.json({ error:"text required" }, { status:400 });
        const imageUrl = await generateSummaryImage(env, summaryText);
        return new Response(JSON.stringify({ ok:!!imageUrl, image_url:imageUrl }), { headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"} });
      } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
    }
    if (path === "/send-line" && request.method === "POST") {
      if (!env.LINE_TOKEN) return Response.json({ error:"LINE_TOKEN not set" }, { status:500 });
      const body = await request.json().catch(()=>({}));
      const text = String(body.text||"Hi").slice(0,5000);
      const userId = env.LINE_USER_ID || "Uad1a752bb0186d090cd36d0cc861a8d8";
      const res = await fetch("https://api.line.me/v2/bot/message/push", { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.LINE_TOKEN}, body:JSON.stringify({ to:userId, messages:[{ type:"text", text }] }) });
      return Response.json({ ok:res.ok, status:res.status, error:res.ok?null:await res.text() });
    }
    return Response.json({ version:"2.13", routes:["/status","/run-generate","/run-publish","/run-autolink","/run-ai-reply","/run-ai-reply-to-reply","/run-autolink-replies","/run-reply-amplification","/run-publish-replies","/run-snapshot","/run-line-push"] });
  },
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    if (cron === "0 21 * * *") ctx.waitUntil(runGenerate(env));
    else if (cron === "30 21 * * *") ctx.waitUntil(Promise.all([runAIReply(env), runAIReplyToReply(env)]));
    else if (cron === "0 22 * * *") ctx.waitUntil(Promise.all([runAutoLink(env), runAutoLinkReplies(env), runReplyAmplification(env)]));
    else if (cron === "0 23 * * *") ctx.waitUntil(Promise.all([runSnapshot(env), runLinePush(env)]));
    else ctx.waitUntil(Promise.all([runPublish(env), runPublishReplies(env)]));
  }
};
