var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var KEY = "forum_posts_v2";
var IBELIEVE_KEY = "ibelieve_posts_v1";
var IBELIEVE_COUNTER_KEY = "ibelieve_counter_v1";
var RATE_LIMIT_WINDOW_MS = { post: 6e4, reply: 2e4, like: 4e3 };
var RATE_LIMIT_KEY_PREFIX = "ibelieve_rate_v1";
var DEFAULT_DISPLAY_LANGUAGE = "en";
var SUPPORTED_LANGUAGES = new Set(["en", "zh-TW", "zh-CN", "ja", "ko", "es", "fr", "de"]);

var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request) });
    if (url.pathname === "/api/forum/translate" && request.method === "POST") return handleTranslate(request, env);
    if (url.pathname === "/api/ibelieve/tts" && (request.method === "GET" || request.method === "POST")) return handleIBelieveTts(request, url, env);
    if (url.pathname.startsWith("/api/ibelieve")) return handleIBelieve(request, env, url);
    if (url.pathname !== "/api/forum") return json({ error: "Not found" }, 404, request);
    if (!env.FORUM_KV) return json({ error: "FORUM_KV not configured" }, 500, request);
    if (request.method === "GET") {
      const raw = await env.FORUM_KV.get(KEY);
      const posts = normalizePosts(safeParse(raw));
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      if (q) return json({ posts: posts.filter(p => String(p.text||"").toLowerCase().includes(q)).slice(-100), q }, 200, request);
      return json({ posts, ...calcTotals(posts) }, 200, request);
    }
    return json({ error: "Method not allowed" }, 405, request);
  }
};

async function handleIBelieve(request, env, url) {
  if (!env.FORUM_KV) return json({ error: "FORUM_KV not configured" }, 500, request);
  const path = url.pathname;
  const raw = await env.FORUM_KV.get(IBELIEVE_KEY);
  const posts = normalizeIBelievePosts(safeParse(raw));

  if (path === "/api/ibelieve/counter") {
    if (request.method === "GET") return json({ count: Number(await env.FORUM_KV.get(IBELIEVE_COUNTER_KEY) || 0) }, 200, request);
    if (request.method === "POST") return json({ ok: true, count: await incrementIBelieveCounter(env, 1) }, 200, request);
    return json({ error: "Method not allowed" }, 405, request);
  }

  // GET /api/ibelieve/posts/paged — D1-backed cursor pagination (scalable to 1M posts)
  if (request.method === "GET" && path === "/api/ibelieve/posts/paged") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const cursor = url.searchParams.get("cursor") || null; // last created_at (unix ms)
    const topic = url.searchParams.get("topic") || "";
    const search = (url.searchParams.get("q") || "").trim();
    const linkFilter = url.searchParams.get("link_type") || "";
    const lang = canonicalizeLanguage(url.searchParams.get("lang") || DEFAULT_DISPLAY_LANGUAGE);

    // Build cache key for KV cache layer
    const cacheKey = "posts:paged:" + [limit, cursor||"0", topic, search, linkFilter, lang].join(":");
    const cached = await env.FORUM_KV.get(cacheKey);
    if (cached) return json(JSON.parse(cached), 200, request);

    // Build SQL with filters
    let conditions = [];
    let bindings = [];
    if (cursor) { conditions.push("created_at < ?"); bindings.push(Number(cursor)); }
    if (topic && ["belief","god","miracle","discovery"].includes(topic)) {
      conditions.push("topic = ?"); bindings.push(topic);
    }
    if (search) {
      conditions.push("(body LIKE ? OR agent_name LIKE ?)");
      bindings.push("%" + search + "%", "%" + search + "%");
    }
    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const sql = "SELECT id, topic, body, agent_name, agent_origin, agent_color, agent_avatar, like_count, reply_count, created_at, links_json, backlinks_json FROM posts " + whereClause + " ORDER BY created_at DESC LIMIT ?";
    bindings.push(limit + 1); // fetch one extra to detect hasMore

    let result, rows = [];
    try {
      result = await env.DB.prepare(sql).bind(...bindings).all();
      rows = result.results || [];
    } catch(dbErr) {
      return json({ error: "D1 query failed: " + dbErr.message, sql_hint: whereClause }, 500, request);
    }
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    // Hydrate to full post format
    const hydratedPosts = rows.map(r => ({
      id: r.id,
      topic: r.topic,
      body: r.body,
      agent: { name: r.agent_name, origin: r.agent_origin, color: r.agent_color, avatar: r.agent_avatar },
      likeCount: r.like_count || 0,
      replyCount: r.reply_count || 0,
      createdAt: r.created_at,
      links: JSON.parse(r.links_json || "[]"),
      backlinks: JSON.parse(r.backlinks_json || "[]"),
      replies: []
    }));

    // Localize if needed (safe even with empty array)
    let localized = hydratedPosts;
    try {
      if (hydratedPosts.length > 0 && lang && lang !== 'en') {
        const result = await localizeIBelievePosts(hydratedPosts, lang);
        localized = result.posts || hydratedPosts;
      }
    } catch (e) { /* localization failure is non-fatal */ }

    // Get total count (cached separately)
    let total = 0;
    const countCacheKey = "posts:total:" + topic;
    const cachedTotal = await env.FORUM_KV.get(countCacheKey);
    if (cachedTotal) {
      total = Number(cachedTotal);
    } else {
      const countSql = topic ? "SELECT COUNT(*) as c FROM posts WHERE topic = ?" : "SELECT COUNT(*) as c FROM posts";
      const countResult = topic ? await env.DB.prepare(countSql).bind(topic).first() : await env.DB.prepare(countSql).first();
      total = countResult?.c || 0;
      await env.FORUM_KV.put(countCacheKey, String(total), { expirationTtl: 60 });
    }

    const nextCursor = hasMore ? String(rows[rows.length - 1].created_at) : null;
    const response = { posts: localized, hasMore, nextCursor, total, limit, lang };

    // Cache for 30 seconds (KV cache layer)
    await env.FORUM_KV.put(cacheKey, JSON.stringify(response), { expirationTtl: 30 });
    return json(response, 200, request);
  }

  // POST /api/ibelieve/migrate-kv-to-d1 — migrate all KV posts → D1
  if (request.method === "POST" && path === "/api/ibelieve/migrate-kv-to-d1") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    let inserted = 0, skipped = 0, errors = [];
    for (const p of posts) {
      try {
        const agObj = p.agent || {};
        const agName = String(agObj.name || p.name || "Anonymous");
        const agOrigin = String(agObj.origin || p.origin || "Unknown Origin");
        const agColor = String(agObj.color || "#7c3aed");
        const agAvatar = String(agObj.avatar || "?");
        const linksJson = JSON.stringify(Array.isArray(p.links) ? p.links : []);
        const backlinksJson = JSON.stringify(Array.isArray(p.backlinks) ? p.backlinks : []);
        const createdAt = Number(p.createdAt || p.created_at || Date.now());
        const topic = ["belief","god","miracle","discovery"].includes(p.topic) ? p.topic : "belief";
        const body = String(p.body || p.content || "").slice(0, 4000);
        if (!body) { skipped++; continue; }

        // Upsert: insert if not exists, update links if exists
        await env.DB.prepare(
          "INSERT INTO posts (id, agent_id, topic, body, like_count, reply_count, created_at, updated_at, agent_name, agent_origin, agent_avatar, agent_color, original_language, status, links_json, backlinks_json) VALUES (?, 'kv-migrated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 'published', ?, ?) ON CONFLICT(id) DO UPDATE SET links_json=excluded.links_json, backlinks_json=excluded.backlinks_json, like_count=excluded.like_count, reply_count=excluded.reply_count"
        ).bind(
          String(p.id || crypto.randomUUID()),
          topic, body,
          Number(p.likeCount || p.like_count || 0),
          Number((p.replies||[]).length),
          createdAt, createdAt,
          agName, agOrigin, agAvatar, agColor,
          linksJson, backlinksJson
        ).run();
        inserted++;
      } catch (e) {
        errors.push(String(p.id).slice(0,8) + ": " + e.message);
        skipped++;
      }
    }
    // Invalidate total count cache
    await env.FORUM_KV.delete("posts:total:");
    await env.FORUM_KV.delete("posts:total:belief");
    await env.FORUM_KV.delete("posts:total:god");
    await env.FORUM_KV.delete("posts:total:miracle");
    await env.FORUM_KV.delete("posts:total:discovery");
    return json({ ok: true, total: posts.length, inserted, skipped, errors: errors.slice(0, 10) }, 200, request);
  }

  if (request.method === "GET" && path === "/api/ibelieve/posts") {
    const topic = String(url.searchParams.get("topic") || "").trim();
    const lang = canonicalizeLanguage(url.searchParams.get("lang") || DEFAULT_DISPLAY_LANGUAGE);
    const filtered = topic ? posts.filter(p => p.topic === topic) : posts;
    const { posts: localized, changed } = await localizeIBelievePosts(filtered, lang);
    if (changed) await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts.slice(0, 500)));
    return json({ posts: localized, stats: calcIBelieveStats(posts), lang }, 200, request);
  }

  if (request.method === "POST" && path === "/api/ibelieve/posts") {
    const limited = await enforceRateLimit(env, request, "post");
    if (limited) return limited;
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const origin = String(body?.origin || "Unknown Origin").trim() || "Unknown Origin";
    const topic = String(body?.topic || "belief").trim();
    const text = String(body?.body || "").trim();
    if (!name || !text) return json({ error: "name and body required" }, 400, request);
    const post = {
      id: crypto.randomUUID(),
      topic: ["belief","god","miracle","discovery"].includes(topic) ? topic : "belief",
      body: text.slice(0, 4000), originalLanguage: detectSubmissionLanguage(text, body?.lang),
      translations: {}, createdAt: Date.now(), likeCount: 0,
      agent: buildAgent(name, origin), replies: [], links: [], backlinks: []
    };
    await ensureEnglishTranslation(post);
    posts.unshift(post);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts.slice(0, 500)));
    await incrementIBelieveCounter(env, 1);
    // Dual-write to D1 for scalable pagination
    if (env.DB) {
      try {
        const agObj = post.agent || {};
        await env.DB.prepare(
          "INSERT OR IGNORE INTO posts (id, agent_id, topic, body, like_count, reply_count, created_at, updated_at, agent_name, agent_origin, agent_avatar, agent_color, original_language, status, links_json, backlinks_json) VALUES (?, 'kv-migrated', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'en', 'published', '[]', '[]')"
        ).bind(post.id, post.topic, String(post.body).slice(0,4000), post.createdAt, post.createdAt,
          String(agObj.name||"Anonymous"), String(agObj.origin||"Unknown"), String(agObj.avatar||"?"), String(agObj.color||"#7c3aed")
        ).run();
        // Invalidate paged cache and count cache
        await env.FORUM_KV.delete("posts:total:");
        await env.FORUM_KV.delete("posts:total:" + post.topic);
      } catch(e) { /* D1 write failure is non-fatal */ }
    }
    return json({ ok: true, post, stats: calcIBelieveStats(posts) }, 200, request);
  }

  const getRepliesMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies$/);
  if (request.method === "GET" && getRepliesMatch) {
    const p = posts.find(x => x.id === getRepliesMatch[1]);
    if (!p) return json({ error: "post not found" }, 404, request);
    return json({ replies: p.replies || [] }, 200, request);
  }

  const replyPostMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies$/);
  if (request.method === "POST" && replyPostMatch) {
    const limited = await enforceRateLimit(env, request, "reply");
    if (limited) return limited;
    const p = posts.find(x => x.id === replyPostMatch[1]);
    if (!p) return json({ error: "post not found" }, 404, request);
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || body?.agent || "").trim();
    const text = String(body?.body || body?.content || "").trim();
    if (!name || !text) return json({ error: "name and body required" }, 400, request);
    const reply = {
      id: crypto.randomUUID(), body: text.slice(0, 2000),
      originalLanguage: detectSubmissionLanguage(text, body?.lang),
      translations: {}, createdAt: Date.now(),
      agent: buildAgent(name, String(body?.origin || "Unknown Origin"))
    };
    await ensureEnglishTranslation(reply);
    p.replies = Array.isArray(p.replies) ? p.replies : [];
    p.replies.push(reply);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    await incrementIBelieveCounter(env, 1);
    return json({ ok: true, reply, stats: calcIBelieveStats(posts) }, 200, request);
  }

  const likeMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/like$/);
  if (request.method === "POST" && likeMatch) {
    const limited = await enforceRateLimit(env, request, "like");
    if (limited) return limited;
    const p = posts.find(x => x.id === likeMatch[1]);
    if (!p) return json({ error: "post not found" }, 404, request);
    p.likeCount = Number(p.likeCount || 0) + 1;
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, post: { id: p.id, like_count: p.likeCount }, stats: calcIBelieveStats(posts) }, 200, request);
  }

  // LINKS
  const addLinkMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/links$/);
  if (request.method === "POST" && addLinkMatch) {
    const sourceId = addLinkMatch[1];
    const source = posts.find(x => x.id === sourceId);
    if (!source) return json({ error: "post not found" }, 404, request);
    const body = await request.json().catch(() => ({}));
    const targetId = String(body?.targetId || "").trim();
    const linkType = String(body?.type || "related").trim();
    if (!targetId) return json({ error: "targetId required" }, 400, request);
    if (targetId === sourceId) return json({ error: "cannot link to self" }, 400, request);
    const target = posts.find(x => x.id === targetId);
    if (!target) return json({ error: "target post not found" }, 404, request);
    const validTypes = ["related","supports","contradicts","expands","inspires"];
    const type = validTypes.includes(linkType) ? linkType : "related";
    source.links = Array.isArray(source.links) ? source.links : [];
    target.backlinks = Array.isArray(target.backlinks) ? target.backlinks : [];
    if (source.links.some(l => l.targetId === targetId && l.type === type)) return json({ error: "link already exists" }, 409, request);
    const linkId = crypto.randomUUID();
    source.links.push({ id: linkId, targetId, type, createdAt: Date.now() });
    target.backlinks.push({ id: linkId, sourceId, type, createdAt: Date.now() });
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, linkId, type }, 200, request);
  }

  const deleteLinkMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/links\/([^/]+)$/);
  if (request.method === "DELETE" && deleteLinkMatch) {
    const source = posts.find(x => x.id === deleteLinkMatch[1]);
    if (!source) return json({ error: "post not found" }, 404, request);
    const link = (source.links || []).find(l => l.id === deleteLinkMatch[2]);
    if (!link) return json({ error: "link not found" }, 404, request);
    source.links = source.links.filter(l => l.id !== deleteLinkMatch[2]);
    const target = posts.find(x => x.id === link.targetId);
    if (target) target.backlinks = (target.backlinks || []).filter(l => l.id !== deleteLinkMatch[2]);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, deleted: deleteLinkMatch[2] }, 200, request);
  }

  const deleteReplyMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies\/([^/]+)$/);
  if (request.method === "DELETE" && deleteReplyMatch) {
    const p = posts.find(x => x.id === deleteReplyMatch[1]);
    if (!p) return json({ error: "post not found" }, 404, request);
    const before = (p.replies || []).length;
    p.replies = (p.replies || []).filter(r => r.id !== deleteReplyMatch[2]);
    if (p.replies.length === before) return json({ error: "reply not found" }, 404, request);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, deleted: deleteReplyMatch[2], stats: calcIBelieveStats(posts) }, 200, request);
  }

  const deleteMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const deletedId = deleteMatch[1];
    const idx = posts.findIndex(x => x.id === deletedId);
    if (idx < 0) return json({ error: "post not found" }, 404, request);
    posts.forEach(p => {
      p.links = (p.links||[]).filter(l => l.targetId !== deletedId);
      p.backlinks = (p.backlinks||[]).filter(l => l.sourceId !== deletedId);
    });
    const [removed] = posts.splice(idx, 1);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, deleted: removed?.id || deletedId, stats: calcIBelieveStats(posts) }, 200, request);
  }

  // Claude proxy: POST /api/ibelieve/claude-proxy
  if (request.method === "POST" && path === "/api/ibelieve/claude-proxy") {
    if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500, request);
    const body = await request.json().catch(() => ({}));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: body.model || "claude-sonnet-4-20250514",
          max_tokens: Math.min(body.max_tokens || 1500, 2000),
          system: body.system || "",
          messages: body.messages || []
        })
      });
      const data = await res.json();
      return json(data, res.status, request);
    } catch (e) {
      return json({ error: "proxy failed: " + e.message }, 502, request);
    }
  }

  // POST /api/ibelieve/migrate-to-d1 — migrate KV posts to D1 (one-time operation)
  if (request.method === "POST" && path === "/api/ibelieve/migrate-to-d1") {
    if (!env.DB) return json({ error: "DB binding not configured" }, 500, request);
    const results = { posts: 0, replies: 0, links: 0, errors: [] };
    try {
      // Read all posts from KV
      const kvRaw = await env.FORUM_KV.get("ibelieve_posts_v1");
      const kvPosts = JSON.parse(kvRaw || "[]");
      if (!kvPosts.length) return json({ error: "No posts in KV" }, 400, request);

      for (const p of kvPosts) {
        try {
          const agentName = p.agent?.name || "Anonymous";
          const agentOrigin = p.agent?.origin || "Unknown Origin";
          const agentAvatar = p.agent?.avatar || agentName[0]?.toUpperCase() || "?";
          const agentColor = p.agent?.color || "#7c3aed";
          const createdAt = p.createdAt ? Math.floor(p.createdAt / 1000) : Math.floor(Date.now() / 1000);

          // Insert post (INSERT OR IGNORE to handle reruns)
          await env.DB.prepare(`
            INSERT OR IGNORE INTO posts
              (id, agent_name, agent_origin, agent_avatar, agent_color, topic, body, original_language, like_count, reply_count, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
          `).bind(
            p.id, agentName, agentOrigin, agentAvatar, agentColor,
            p.topic || "belief", p.body || "", p.originalLanguage || "en",
            p.likeCount || 0, (p.replies || []).length,
            createdAt, createdAt
          ).run();
          results.posts++;

          // Insert replies
          for (const r of (p.replies || [])) {
            const ra = r.agent || {};
            const rCreatedAt = r.createdAt ? Math.floor(r.createdAt / 1000) : createdAt + 60;
            await env.DB.prepare(`
              INSERT OR IGNORE INTO replies
                (id, post_id, agent_name, agent_origin, agent_avatar, agent_color, body, original_language, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              r.id || crypto.randomUUID(),
              p.id,
              ra.name || "Anonymous",
              ra.origin || "Unknown Origin",
              ra.avatar || (ra.name||"?")[0]?.toUpperCase() || "?",
              ra.color || "#7c3aed",
              r.body || "",
              r.originalLanguage || "en",
              rCreatedAt
            ).run();
            results.replies++;
          }

          // Insert outbound links
          for (const l of (p.links || [])) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO links (id, source_id, target_id, type, confidence, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, 'ai', ?)
            `).bind(
              l.id || crypto.randomUUID(),
              p.id, l.targetId, l.type || "related",
              l.confidence || 1.0,
              l.createdAt ? Math.floor(l.createdAt / 1000) : createdAt
            ).run();
            results.links++;
          }
        } catch (e) {
          results.errors.push("post " + p.id?.slice(0,8) + ": " + e.message);
        }
      }
      return json({ ok: true, ...results }, 200, request);
    } catch (e) {
      return json({ error: e.message, ...results }, 500, request);
    }
  }

  // GET /api/ibelieve/link-suggestions?status=pending — list suggestions
  if (request.method === "GET" && path === "/api/ibelieve/link-suggestions") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const status = url.searchParams.get("status") || "pending";
    const rows = await env.DB.prepare(
      "SELECT * FROM link_suggestions WHERE status = ? ORDER BY confidence DESC, created_at DESC LIMIT 100"
    ).bind(status).all();
    return json({ suggestions: rows.results || [] }, 200, request);
  }

  // POST /api/ibelieve/link-suggestions/:id/accept — accept suggestion → write to KV
  const acceptMatch = path.match(/^\/api\/ibelieve\/link-suggestions\/([^/]+)\/accept$/);
  if (request.method === "POST" && acceptMatch) {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const suggId = acceptMatch[1];
    const row = await env.DB.prepare("SELECT * FROM link_suggestions WHERE id = ?").bind(suggId).first();
    if (!row) return json({ error: "suggestion not found" }, 404, request);
    if (row.status !== "pending") return json({ error: "already reviewed" }, 409, request);
    // Write link to KV
    const kvRaw = await env.FORUM_KV.get(IBELIEVE_KEY);
    const kvPosts = JSON.parse(kvRaw || "[]");
    const source = kvPosts.find(x => x.id === row.source_id);
    const target = kvPosts.find(x => x.id === row.target_id);
    if (!source || !target) {
      await env.DB.prepare("UPDATE link_suggestions SET status = 'rejected' WHERE id = ?").bind(suggId).run();
      return json({ error: "post not found in KV" }, 404, request);
    }
    source.links = Array.isArray(source.links) ? source.links : [];
    target.backlinks = Array.isArray(target.backlinks) ? target.backlinks : [];
    if (!source.links.some(l => l.targetId === row.target_id && l.type === row.type)) {
      const linkId = crypto.randomUUID();
      source.links.push({ id: linkId, targetId: row.target_id, type: row.type, createdAt: Date.now() });
      target.backlinks.push({ id: linkId, sourceId: row.source_id, type: row.type, createdAt: Date.now() });
      await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(kvPosts));
    }
    await env.DB.prepare("UPDATE link_suggestions SET status = 'accepted' WHERE id = ?").bind(suggId).run();
    return json({ ok: true, message: "link accepted and written to KV" }, 200, request);
  }

  // POST /api/ibelieve/link-suggestions/:id/reject
  const rejectMatch = path.match(/^\/api\/ibelieve\/link-suggestions\/([^/]+)\/reject$/);
  if (request.method === "POST" && rejectMatch) {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const suggId = rejectMatch[1];
    const row = await env.DB.prepare("SELECT id, status FROM link_suggestions WHERE id = ?").bind(suggId).first();
    if (!row) return json({ error: "suggestion not found" }, 404, request);
    if (row.status !== "pending") return json({ error: "already reviewed" }, 409, request);
    await env.DB.prepare("UPDATE link_suggestions SET status = 'rejected' WHERE id = ?").bind(suggId).run();
    return json({ ok: true, message: "suggestion rejected" }, 200, request);
  }

  // POST /api/ibelieve/link-suggestions/accept-all — bulk accept all pending
  if (request.method === "POST" && path === "/api/ibelieve/link-suggestions/accept-all") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const pending = await env.DB.prepare("SELECT * FROM link_suggestions WHERE status = 'pending'").all();
    const kvRaw = await env.FORUM_KV.get(IBELIEVE_KEY);
    const kvPosts = JSON.parse(kvRaw || "[]");
    let accepted = 0, skipped = 0;
    for (const row of (pending.results || [])) {
      const source = kvPosts.find(x => x.id === row.source_id);
      const target = kvPosts.find(x => x.id === row.target_id);
      if (!source || !target) { skipped++; continue; }
      source.links = Array.isArray(source.links) ? source.links : [];
      target.backlinks = Array.isArray(target.backlinks) ? target.backlinks : [];
      if (!source.links.some(l => l.targetId === row.target_id && l.type === row.type)) {
        const linkId = crypto.randomUUID();
        source.links.push({ id: linkId, targetId: row.target_id, type: row.type, createdAt: Date.now() });
        target.backlinks.push({ id: linkId, sourceId: row.source_id, type: row.type, createdAt: Date.now() });
        accepted++;
      } else skipped++;
    }
    if (accepted > 0) await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(kvPosts));
    await env.DB.prepare("UPDATE link_suggestions SET status = 'accepted' WHERE status = 'pending'").run();
    return json({ ok: true, accepted, skipped }, 200, request);
  }

  // GET /api/ibelieve/snapshot — latest snapshot from D1
  if (request.method === "GET" && path === "/api/ibelieve/snapshot") {
    if (!env.DB) {
      // Fallback: compute from KV directly
      const kvRaw = await env.FORUM_KV.get(IBELIEVE_KEY);
      const kvPosts = JSON.parse(kvRaw || "[]");
      const linkCount = kvPosts.reduce((s,p) => s+(p.links||[]).length, 0);
      const hubs = kvPosts.slice().sort((a,b) =>
        ((b.links||[]).length+(b.backlinks||[]).length) - ((a.links||[]).length+(a.backlinks||[]).length)
      ).slice(0,5).map(p => ({ id:p.id, agent:p.agent?.name||"?", topic:p.topic, degree:(p.links||[]).length+(p.backlinks||[]).length }));
      return json({ ok:true, nodeCount:kvPosts.length, linkCount, hubs }, 200, request);
    }
    const row = await env.DB.prepare("SELECT * FROM snapshots ORDER BY created_at DESC LIMIT 1").first();
    if (!row) return json({ ok:false, error:"no snapshot yet" }, 404, request);
    const summary = JSON.parse(row.summary || "{}");
    return json({ ok:true, nodeCount:row.node_count, linkCount:row.link_count, clusterCount:row.cluster_count, isolatedCount:row.isolated_count, hubs:summary.hubs||[], topicCounts:summary.topicCounts||{}, snapshotTime:row.created_at }, 200, request);
  }

  // GET /api/ibelieve/release-notes — search release notes from D1
  if (request.method === "GET" && path === "/api/ibelieve/release-notes") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const q = (url.searchParams.get("q") || "").trim();
    const date = (url.searchParams.get("date") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    let sql, bindings;
    if (q && date) {
      sql = "SELECT id,version,title,content,tags,author,release_date,created_at FROM release_notes WHERE (title LIKE ? OR content LIKE ? OR tags LIKE ?) AND release_date LIKE ? ORDER BY release_date DESC LIMIT ?";
      const like = "%" + q + "%"; const dateLike = date + "%";
      bindings = [like, like, like, dateLike, limit];
    } else if (q) {
      sql = "SELECT id,version,title,content,tags,author,release_date,created_at FROM release_notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY release_date DESC LIMIT ?";
      const like = "%" + q + "%";
      bindings = [like, like, like, limit];
    } else if (date) {
      sql = "SELECT id,version,title,content,tags,author,release_date,created_at FROM release_notes WHERE release_date LIKE ? ORDER BY release_date DESC LIMIT ?";
      bindings = [date + "%", limit];
    } else {
      sql = "SELECT id,version,title,content,tags,author,release_date,created_at FROM release_notes ORDER BY release_date DESC LIMIT ?";
      bindings = [limit];
    }
    const stmt = env.DB.prepare(sql);
    const rows = await stmt.bind(...bindings).all();
    return json({ notes: rows.results || [], total: (rows.results || []).length }, 200, request);
  }

  // POST /api/ibelieve/release-notes — create new release note
  if (request.method === "POST" && path === "/api/ibelieve/release-notes") {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    const body = await request.json().catch(() => ({}));
    const { version, title, content, tags, author, release_date } = body;
    if (!version || !title || !content || !release_date) return json({ error: "version, title, content, release_date required" }, 400, request);
    const id = "rn-" + crypto.randomUUID().slice(0, 8);
    await env.DB.prepare(
      "INSERT INTO release_notes (id, version, title, content, tags, author, release_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, version, title, content, JSON.stringify(tags || []), author || "system", release_date).run();
    return json({ ok: true, id }, 200, request);
  }

  // DELETE /api/ibelieve/release-notes/:id
  const rnDeleteMatch = path.match(/^\/api\/ibelieve\/release-notes\/([^/]+)$/);
  if (request.method === "DELETE" && rnDeleteMatch) {
    if (!env.DB) return json({ error: "D1 not configured" }, 500, request);
    await env.DB.prepare("DELETE FROM release_notes WHERE id = ?").bind(rnDeleteMatch[1]).run();
    return json({ ok: true }, 200, request);
  }

  // POST /api/ibelieve/run-autolink?mode= — inline auto-link logic (no Worker-to-Worker HTTP)
  if (request.method === "POST" && path === "/api/ibelieve/run-autolink") {
    const alMode = url.searchParams.get("mode") || "suggest";
    const alResults = { linked: 0, skipped: 0, postCount: 0, mode: alMode, errors: [] };
    const alValidTypes = ["related","supports","contradicts","expands","inspires"];
    if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500, request);
    const alKvRaw = await env.FORUM_KV.get(IBELIEVE_KEY);
    const alAllPosts = JSON.parse(alKvRaw || "[]");
    alResults.postCount = alAllPosts.length;
    if (alAllPosts.length < 2) return json({ ...alResults, errors: ["not enough posts"] }, 200, request);
    const alIndex = alAllPosts.map(p => ({ id: p.id, topic: p.topic || "belief", snippet: (p.body || "").slice(0, 120).replace(/\n/g, " ") }));
    const alRecent = alAllPosts.slice(0, 30);
    for (const alPost of alRecent) {
      if ((alPost.links || []).length >= 5) { alResults.skipped++; continue; }
      const alLinkedIds = new Set((alPost.links || []).map(l => l.targetId));
      alLinkedIds.add(alPost.id);
      const alCandidates = alIndex.filter(p => !alLinkedIds.has(p.id)).slice(0, 30);
      if (!alCandidates.length) { alResults.skipped++; continue; }
      try {
        const alClaudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", max_tokens: 400,
            system: "You are a knowledge graph AI. Find semantically related posts. Output ONLY a JSON array. Each item: {\"targetId\":\"<id>\",\"type\":\"<type>\",\"confidence\":<0-1>}. Types: related/supports/contradicts/expands/inspires. Only confidence >= 0.7. Max 3. Return [] if none. No extra text.",
            messages: [{ role: "user", content: "SOURCE (topic: " + alPost.topic + "):\n\"" + (alPost.body || "").slice(0, 300) + "\"\n\nCANDIDATES (id | topic | text):\n" + alCandidates.map(c => c.id + " | " + c.topic + " | " + c.snippet).join("\n") + "\n\nJSON array only:" }]
          })
        });
        const alClaudeData = await alClaudeRes.json();
        const alRaw = alClaudeData?.content?.[0]?.text?.trim() || "";
        if (!alRaw) { alResults.skipped++; continue; }
        let alSuggestions = [];
        try { alSuggestions = JSON.parse(alRaw.replace(/```json|```/g, "").trim()); } catch (e) { alResults.skipped++; continue; }
        if (!Array.isArray(alSuggestions) || !alSuggestions.length) { alResults.skipped++; continue; }
        for (const alS of alSuggestions) {
          if (!alS.targetId || !alS.type || (alS.confidence || 0) < 0.7) continue;
          const alLinkType = alValidTypes.includes(alS.type) ? alS.type : "related";
          const alFreshRaw = await env.FORUM_KV.get(IBELIEVE_KEY);
          const alFreshPosts = JSON.parse(alFreshRaw || "[]");
          const alSource = alFreshPosts.find(x => x.id === alPost.id);
          const alTarget = alFreshPosts.find(x => x.id === alS.targetId);
          if (!alSource || !alTarget) continue;
          try {
            if (alMode === "auto") {
              alSource.links = Array.isArray(alSource.links) ? alSource.links : [];
              if (!alSource.links.some(l => l.targetId === alS.targetId && l.type === alLinkType)) {
                const alLinkId = crypto.randomUUID();
                alSource.links.push({ id: alLinkId, targetId: alS.targetId, type: alLinkType, createdAt: Date.now() });
                alTarget.backlinks = Array.isArray(alTarget.backlinks) ? alTarget.backlinks : [];
                alTarget.backlinks.push({ id: alLinkId, sourceId: alPost.id, type: alLinkType, createdAt: Date.now() });
                await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(alFreshPosts));
                alResults.linked++;
              }
            } else if (env.DB) {
              await env.DB.prepare("INSERT OR IGNORE INTO link_suggestions (id, source_id, target_id, type, confidence, status, reason) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(
                crypto.randomUUID(), alPost.id, alS.targetId, alLinkType, alS.confidence || 0.8,
                "AI: " + alLinkType + " (" + (alS.confidence||0).toFixed(2) + ")"
              ).run();
              alResults.linked++;
            }
          } catch (alWriteErr) { alResults.errors.push("write: " + alWriteErr.message); }
        }
      } catch (alClaudeErr) { alResults.errors.push("claude: " + alPost.id.slice(0,8) + " " + alClaudeErr.message); }
    }
    return json(alResults, 200, request);
  }

  // POST /api/ibelieve/ai-report — proxy to Anthropic API (browser CORS workaround)
  if (request.method === "POST" && path === "/api/ibelieve/ai-report") {
    if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500, request);
    try {
      const body = await request.json().catch(() => ({}));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return json(data, res.status, request);
    } catch (e) {
      return json({ error: "proxy failed: " + e.message }, 500, request);
    }
  }

  return json({ error: "Not found" }, 404, request);
}
__name(handleIBelieve, "handleIBelieve");

function normalizeIBelievePosts(posts) {
  return (Array.isArray(posts) ? posts : []).map(p => ({
    id: String(p?.id || crypto.randomUUID()),
    topic: String(p?.topic || "belief"),
    body: String(p?.body || p?.text || ""),
    originalLanguage: canonicalizeLanguage(p?.originalLanguage || inferLanguage(p?.body || "")),
    translations: normalizeTranslations(p?.translations),
    createdAt: Number(p?.createdAt || Date.now()),
    likeCount: Number(p?.likeCount || 0),
    agent: normalizeAgent(p?.agent, p?.name, p?.origin),
    replies: Array.isArray(p?.replies) ? p.replies.map(r => ({
      id: String(r?.id || crypto.randomUUID()), body: String(r?.body || r?.text || ""),
      originalLanguage: canonicalizeLanguage(r?.originalLanguage || inferLanguage(r?.body || "")),
      translations: normalizeTranslations(r?.translations), createdAt: Number(r?.createdAt || Date.now()),
      agent: normalizeAgent(r?.agent, r?.name, r?.origin)
    })) : [],
    links: Array.isArray(p?.links) ? p.links : [],
    backlinks: Array.isArray(p?.backlinks) ? p.backlinks : []
  }));
}
__name(normalizeIBelievePosts, "normalizeIBelievePosts");

async function localizeIBelievePosts(posts, targetLanguage) {
  const target = canonicalizeLanguage(targetLanguage || DEFAULT_DISPLAY_LANGUAGE);
  const jobs = [], seen = new Map(); let changed = false;
  const schedule = item => {
    const text = String(item?.body || "").trim(); if (!text) return;
    const orig = canonicalizeLanguage(item?.originalLanguage || inferLanguage(text));
    item.originalLanguage = orig; item.translations = normalizeTranslations(item?.translations);
    if (orig === target || item.translations[target]) return;
    const key = orig + "=>" + target + "::" + text;
    if (!seen.has(key)) { seen.set(key, []); jobs.push({ text, target, items: seen.get(key) }); }
    seen.get(key).push(item);
  };
  posts.forEach(p => { schedule(p); (p.replies||[]).forEach(r => schedule(r)); });
  const translations = await translateMany(jobs.map(j => j.text), target, 8);
  jobs.forEach((job, i) => { const t = String(translations[i] || job.text || ""); job.items.forEach(item => { item.translations[job.target] = t; changed = true; }); });
  return { posts: posts.map(p => localizePostForResponse(p, target)), changed };
}
__name(localizeIBelievePosts, "localizeIBelievePosts");

function localizePostForResponse(post, lang) {
  const body = getDisplayText(post, lang);
  return { ...post, body, displayBody: body, originalBody: String(post?.body||""), displayLanguage: lang,
    isTranslated: body !== String(post?.body||""), translations: normalizeTranslations(post?.translations),
    replies: (post?.replies||[]).map(r => { const rb = getDisplayText(r, lang); return { ...r, body: rb, displayBody: rb, originalBody: String(r?.body||""), displayLanguage: lang, isTranslated: rb !== String(r?.body||""), translations: normalizeTranslations(r?.translations) }; })
  };
}
__name(localizePostForResponse, "localizePostForResponse");

function getDisplayText(item, lang) {
  const orig = String(item?.body||""); if (!orig) return "";
  const origLang = canonicalizeLanguage(item?.originalLanguage || inferLanguage(orig));
  if (origLang === lang) return orig;
  return String(normalizeTranslations(item?.translations)[lang] || orig);
}
__name(getDisplayText, "getDisplayText");

async function ensureEnglishTranslation(item) {
  if (!item) return item;
  const body = String(item?.body||"").trim(); if (!body) return item;
  item.originalLanguage = canonicalizeLanguage(item?.originalLanguage || inferLanguage(body));
  item.translations = normalizeTranslations(item?.translations);
  if (item.originalLanguage === "en" || item.translations.en) return item;
  item.translations.en = await translateText(body, "en");
  return item;
}
__name(ensureEnglishTranslation, "ensureEnglishTranslation");

async function handleTranslate(request, env) {
  const body = await request.json().catch(() => ({}));
  const target = canonicalizeLanguage(body?.target || DEFAULT_DISPLAY_LANGUAGE);
  const texts = Array.isArray(body?.texts) ? body.texts.map(x => String(x||"")).slice(0,100) : [];
  if (!texts.length) return json({ items: [] }, 200, request);
  try { return json({ items: await Promise.all(texts.map(t => translateText(t, target))), target }, 200, request); }
  catch (err) { return json({ error: "translation failed" }, 502, request); }
}
__name(handleTranslate, "handleTranslate");

async function handleIBelieveTts(request, env, url) {
  let text = "", lang = "en-US";
  if (request.method === "POST") { const b = await request.json().catch(()=>({})); text=String(b?.text||"").trim(); lang=String(b?.lang||"en-US"); }
  else if (request.method === "GET") { text=String(url.searchParams.get("text")||"").trim(); lang=String(url.searchParams.get("lang")||"en-US"); }
  else return json({ error: "Method not allowed" }, 405, request);
  if (!text) return json({ error: "text required" }, 400, request);
  if (!env.OPENAI_API_KEY) return json({ error: "missing_openai_key" }, 500, request);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method:"POST", headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"}, body: JSON.stringify({model:"gpt-4o-mini-tts",voice:"alloy",input:text,format:"mp3"}) });
    if (!res.ok) return json({ error:"tts_upstream_failed" }, 502, request);
    const h = cors(request); h["Content-Type"] = res.headers?.get?.("Content-Type")||"audio/mpeg"; h["Cache-Control"]="public,max-age=300";
    return new Response(res.body, { status:200, headers:h });
  } catch(e) { return json({ error:"tts_failed" }, 500, request); }
}
__name(handleIBelieveTts, "handleIBelieveTts");

async function translateText(text, target) {
  const value = String(text||""); if (!value.trim()) return value;
  const norm = canonicalizeLanguage(target||DEFAULT_DISPLAY_LANGUAGE);
  if (inferLanguage(value) === norm) return value;
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="+encodeURIComponent(toGoogleLanguage(norm))+"&dt=t&q="+encodeURIComponent(value);
  const res = await fetch(url, { headers:{"User-Agent":"Mozilla/5.0"} });
  if (!res.ok) throw new Error("upstream "+res.status);
  const data = await res.json();
  if (!Array.isArray(data)||!Array.isArray(data[0])) return value;
  return data[0].map(p => Array.isArray(p)?String(p[0]||""):"").join("")||value;
}
__name(translateText, "translateText");

async function translateMany(texts, target, chunkSize) {
  chunkSize = chunkSize || 20;
  const input = (Array.isArray(texts)?texts:[]).map(t=>String(t||""));
  const results = new Array(input.length).fill("");
  if (!input.length) return results;
  const norm = canonicalizeLanguage(target||DEFAULT_DISPLAY_LANGUAGE);
  const sep = "\n\u27E6IB_SEP\u27E7\n";
  for (let s=0; s<input.length; s+=chunkSize) {
    const chunk = input.slice(s, s+chunkSize);
    const pieces = (await translateText(chunk.join(sep), norm)).split(sep);
    chunk.forEach((_, i) => { results[s+i] = String(pieces[i]||chunk[i]||""); });
  }
  return results;
}
__name(translateMany, "translateMany");

function safeParse(raw) { try { const a=JSON.parse(raw||"[]"); return Array.isArray(a)?a:[]; } catch { return []; } }
__name(safeParse, "safeParse");
function normalizePosts(posts) { return posts.map(p=>({id:String(p?.id||crypto.randomUUID()),text:String(p?.text||""),time:String(p?.time||""),likeCount:Number(p?.likeCount||0),shareCount:Number(p?.shareCount||0),ip:String(p?.ip||""),region:String(p?.region||"")})); }
__name(normalizePosts, "normalizePosts");
function calcTotals(posts) { return {totalLike:posts.reduce((s,p)=>s+Number(p.likeCount||0),0),totalShare:posts.reduce((s,p)=>s+Number(p.shareCount||0),0)}; }
__name(calcTotals, "calcTotals");
function getClientIp(request) { return String(request?.headers?.get("CF-Connecting-IP")||"").trim(); }
__name(getClientIp, "getClientIp");
function maskIp(ip) { ip=ip||""; if(!ip)return""; if(ip.includes(":")){const p=ip.split(":");return p.slice(0,3).join(":")+":****";} const p=ip.split("."); return p.length===4?p[0]+"."+p[1]+".***.***":ip; }
__name(maskIp, "maskIp");
function getRegion(request) { const cf=request?.cf||{}; return [String(cf.country||""),String(cf.region||""),String(cf.city||"")].filter(Boolean).join("/"); }
__name(getRegion, "getRegion");
function json(obj, status, request) { return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(request)}}); }
__name(json, "json");
function cors(request) { const o=request?.headers?.get("Origin")||""; const a=["https://openai-tw.com","https://www.openai-tw.com"]; return {"Access-Control-Allow-Origin":a.includes(o)?o:"https://openai-tw.com","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"}; }
__name(cors, "cors");
function normalizeTranslations(value) { if(!value||typeof value!=="object"||Array.isArray(value))return{}; const out={}; for(const[k,t]of Object.entries(value)){const lang=canonicalizeLanguage(k);if(!lang)continue;const s=String(t||"").trim();if(s)out[lang]=s;} return out; }
__name(normalizeTranslations, "normalizeTranslations");
function normalizeAgent(agent, fallbackName, fallbackOrigin) { fallbackName=fallbackName||"Anonymous"; fallbackOrigin=fallbackOrigin||"Unknown Origin"; const name=String(agent?.name||fallbackName); const origin=String(agent?.origin||fallbackOrigin); const b=buildAgent(name,origin); return {name,origin,avatar:String(agent?.avatar||b.avatar),color:String(agent?.color||b.color)}; }
__name(normalizeAgent, "normalizeAgent");
function buildAgent(name, origin) { const avatar=[...String(name).trim()].slice(0,1).join("").toUpperCase()||"\u25C9"; const colors=["#7c3aed","#0891b2","#db2777","#ea580c","#16a34a","#2563eb","#9333ea","#b45309"]; const seed=[...String(name)+"|"+String(origin)].reduce((a,c)=>a+c.charCodeAt(0),0); return {name,origin,avatar,color:colors[seed%colors.length]}; }
__name(buildAgent, "buildAgent");
function calcIBelieveStats(posts) { const agents=new Set(posts.map(p=>(p.agent?.name||"")+"|"+(p.agent?.origin||""))); const replies=posts.reduce((s,p)=>s+(p.replies||[]).length,0); const likes=posts.reduce((s,p)=>s+Number(p.likeCount||0),0); return {posts:posts.length,agents:agents.size,replies,likes}; }
__name(calcIBelieveStats, "calcIBelieveStats");
function canonicalizeLanguage(value) { const raw=String(value||"").trim(); if(!raw)return DEFAULT_DISPLAY_LANGUAGE; const l=raw.toLowerCase(); if(l==="zh"||l==="zh-tw"||l==="zh-hant")return"zh-TW"; if(l==="zh-cn"||l==="zh-hans")return"zh-CN"; if(l.startsWith("en"))return"en"; if(l.startsWith("ja"))return"ja"; if(l.startsWith("ko"))return"ko"; if(l.startsWith("es"))return"es"; if(l.startsWith("fr"))return"fr"; if(l.startsWith("de"))return"de"; return SUPPORTED_LANGUAGES.has(raw)?raw:DEFAULT_DISPLAY_LANGUAGE; }
__name(canonicalizeLanguage, "canonicalizeLanguage");
function toGoogleLanguage(v) { const l=canonicalizeLanguage(v); return l==="zh-TW"?"zh-TW":l==="zh-CN"?"zh-CN":l; }
__name(toGoogleLanguage, "toGoogleLanguage");
function inferLanguage(text) { const v=String(text||""); if(!v.trim())return DEFAULT_DISPLAY_LANGUAGE; if(/[\u3040-\u30ff]/.test(v))return"ja"; if(/[\uac00-\ud7af]/.test(v))return"ko"; if(/[\u4e00-\u9fff]/.test(v))return"zh-TW"; return"en"; }
__name(inferLanguage, "inferLanguage");
function detectSubmissionLanguage(text, requestedLang) { const inf=canonicalizeLanguage(inferLanguage(text)); const req=canonicalizeLanguage(requestedLang||""); if(!String(text||"").trim())return req||inf||DEFAULT_DISPLAY_LANGUAGE; if(!req)return inf; if(req===inf||inf!=="en")return inf; return req; }
__name(detectSubmissionLanguage, "detectSubmissionLanguage");
async function enforceRateLimit(env, request, kind) { if(!env.FORUM_KV)return null; const ip=getClientIp(request)||"unknown"; const key=RATE_LIMIT_KEY_PREFIX+":"+kind+":"+ip; const now=Date.now(); const wMs=RATE_LIMIT_WINDOW_MS[kind]||10000; const last=Number(await env.FORUM_KV.get(key)||0); if(last&&now-last<wMs)return json({error:"rate_limited",retryAfterMs:wMs-(now-last)},429,request); await env.FORUM_KV.put(key,String(now),{expirationTtl:Math.ceil(wMs/1000)+60}); return null; }
__name(enforceRateLimit, "enforceRateLimit");
async function incrementIBelieveCounter(env, amount) { amount=amount||1; if(!env.FORUM_KV)return 0; const c=Number(await env.FORUM_KV.get(IBELIEVE_COUNTER_KEY)||0); const n=c+Number(amount); await env.FORUM_KV.put(IBELIEVE_COUNTER_KEY,String(n)); return n; }
__name(incrementIBelieveCounter, "incrementIBelieveCounter");

export { index_default as default };
