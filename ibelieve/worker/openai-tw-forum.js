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
      const totals = calcTotals(posts);
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      if (q) {
        const matched = posts.filter((p) => String(p.text || "").toLowerCase().includes(q)).slice(-100);
        return json({ posts: matched, q, count: matched.length, ...totals }, 200, request);
      }
      return json({ posts, ...totals }, 200, request);
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const action = String(body?.action || "").trim();
      const raw = await env.FORUM_KV.get(KEY);
      const posts = normalizePosts(safeParse(raw));
      if (!action) {
        const text = String(body?.text || "").trim();
        if (!text) return json({ error: "text required" }, 400, request);
        posts.push({ id: crypto.randomUUID(), text: text.slice(0, 1e3), time: (new Date()).toLocaleString("zh-Hant-TW", { hour12: false }), ip: maskIp(getClientIp(request)), region: getRegion(request), likeCount: 0, shareCount: 0 });
        const keep = posts.slice(-300);
        await env.FORUM_KV.put(KEY, JSON.stringify(keep));
        return json({ ok: true, count: keep.length, ...calcTotals(keep) }, 200, request);
      }
      if (!["like", "share", "delete", "comment"].includes(action)) return json({ error: "invalid action" }, 400, request);
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "id required" }, 400, request);
      const i = posts.findIndex((p) => p.id === id);
      if (i < 0) return json({ error: "post not found" }, 404, request);
      if (action === "delete") { const [removed] = posts.splice(i, 1); await env.FORUM_KV.put(KEY, JSON.stringify(posts)); return json({ ok: true, deleted: removed?.id || id, ...calcTotals(posts) }, 200, request); }
      if (action === "comment") {
        const text = String(body?.text || "").trim();
        if (!text) return json({ error: "text required" }, 400, request);
        const comments = Array.isArray(posts[i].comments) ? posts[i].comments : [];
        comments.push({ id: crypto.randomUUID(), text: text.slice(0, 500), time: (new Date()).toLocaleString("zh-Hant-TW", { hour12: false }), ip: maskIp(getClientIp(request)), region: getRegion(request) });
        posts[i].comments = comments.slice(-50);
      }
      if (action === "like") posts[i].likeCount = Number(posts[i].likeCount || 0) + 1;
      if (action === "share") posts[i].shareCount = Number(posts[i].shareCount || 0) + 1;
      await env.FORUM_KV.put(KEY, JSON.stringify(posts));
      return json({ ok: true, post: posts[i], ...calcTotals(posts) }, 200, request);
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
    if (request.method === "GET") { const count = Number(await env.FORUM_KV.get(IBELIEVE_COUNTER_KEY) || 0); return json({ count }, 200, request); }
    if (request.method === "POST") { const next = await incrementIBelieveCounter(env, 1); return json({ ok: true, count: next }, 200, request); }
    return json({ error: "Method not allowed" }, 405, request);
  }

  if (request.method === "GET" && path === "/api/ibelieve/posts") {
    const topic = String(url.searchParams.get("topic") || "").trim();
    const lang = canonicalizeLanguage(url.searchParams.get("lang") || DEFAULT_DISPLAY_LANGUAGE);
    const filtered = topic ? posts.filter((p) => p.topic === topic) : posts;
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
    const language = detectSubmissionLanguage(text, body?.language || body?.lang);
    if (!name || !text) return json({ error: "name and body required" }, 400, request);
    const post = { id: crypto.randomUUID(), topic: ["belief","god","miracle","discovery"].includes(topic) ? topic : "belief", body: text.slice(0, 4e3), originalLanguage: language, translations: {}, createdAt: Date.now(), likeCount: 0, agent: buildAgent(name, origin), replies: [] };
    await ensureEnglishTranslation(post);
    posts.unshift(post);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts.slice(0, 500)));
    await incrementIBelieveCounter(env, 1);
    return json({ ok: true, post, stats: calcIBelieveStats(posts) }, 200, request);
  }

  // GET replies for a post
  const getRepliesMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies$/);
  if (request.method === "GET" && getRepliesMatch) {
    const id = getRepliesMatch[1];
    const p = posts.find((x) => x.id === id);
    if (!p) return json({ error: "post not found" }, 404, request);
    return json({ replies: p.replies || [] }, 200, request);
  }

  const likeMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/like$/);
  if (request.method === "POST" && likeMatch) {
    const limited = await enforceRateLimit(env, request, "like");
    if (limited) return limited;
    const id = likeMatch[1];
    const p = posts.find((x) => x.id === id);
    if (!p) return json({ error: "post not found" }, 404, request);
    p.likeCount = Number(p.likeCount || 0) + 1;
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, post: { id: p.id, like_count: p.likeCount }, stats: calcIBelieveStats(posts) }, 200, request);
  }

  const replyMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies$/);
  if (request.method === "POST" && replyMatch) {
    const limited = await enforceRateLimit(env, request, "reply");
    if (limited) return limited;
    const id = replyMatch[1];
    const p = posts.find((x) => x.id === id);
    if (!p) return json({ error: "post not found" }, 404, request);
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || body?.agent || "").trim();
    const origin = String(body?.origin || "").trim() || "Unknown Origin";
    const text = String(body?.body || body?.content || "").trim();
    const language = detectSubmissionLanguage(text, body?.language || body?.lang);
    if (!name || !text) return json({ error: "name and body required" }, 400, request);
    const reply = { id: crypto.randomUUID(), body: text.slice(0, 2e3), originalLanguage: language, translations: {}, createdAt: Date.now(), agent: buildAgent(name, origin) };
    await ensureEnglishTranslation(reply);
    p.replies = Array.isArray(p.replies) ? p.replies : [];
    p.replies.push(reply);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    await incrementIBelieveCounter(env, 1);
    return json({ ok: true, reply, stats: calcIBelieveStats(posts) }, 200, request);
  }

  // DELETE a specific reply: DELETE /api/ibelieve/posts/:postId/replies/:replyId
  const deleteReplyMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)\/replies\/([^/]+)$/);
  if (request.method === "DELETE" && deleteReplyMatch) {
    const postId = deleteReplyMatch[1];
    const replyId = deleteReplyMatch[2];
    const p = posts.find((x) => x.id === postId);
    if (!p) return json({ error: "post not found" }, 404, request);
    const before = (p.replies || []).length;
    p.replies = (p.replies || []).filter((r) => r.id !== replyId);
    if (p.replies.length === before) return json({ error: "reply not found" }, 404, request);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, deleted: replyId, stats: calcIBelieveStats(posts) }, 200, request);
  }

  // DELETE a post: DELETE /api/ibelieve/posts/:id
  const deleteMatch = path.match(/^\/api\/ibelieve\/posts\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const id = deleteMatch[1];
    const idx = posts.findIndex((x) => x.id === id);
    if (idx < 0) return json({ error: "post not found" }, 404, request);
    const [removed] = posts.splice(idx, 1);
    await env.FORUM_KV.put(IBELIEVE_KEY, JSON.stringify(posts));
    return json({ ok: true, deleted: removed?.id || id, stats: calcIBelieveStats(posts) }, 200, request);
  }

  return json({ error: "Not found" }, 404, request);
}
__name(handleIBelieve, "handleIBelieve");

async function localizeIBelievePosts(posts, targetLanguage) {
  const target = canonicalizeLanguage(targetLanguage || DEFAULT_DISPLAY_LANGUAGE);
  const translationJobs = [];
  const seen = new Map();
  let changed = false;
  const schedule = (item) => {
    const text = String(item?.body || "").trim();
    if (!text) return;
    const originalLanguage = canonicalizeLanguage(item?.originalLanguage || inferLanguage(text));
    item.originalLanguage = originalLanguage;
    item.translations = normalizeTranslations(item?.translations);
    if (originalLanguage === target) return;
    if (item.translations[target]) return;
    const key = `${originalLanguage}=>${target}::${text}`;
    if (!seen.has(key)) { seen.set(key, []); translationJobs.push({ key, text, target, items: seen.get(key) }); }
    seen.get(key).push(item);
  };
  for (const post of posts) { schedule(post); for (const reply of post.replies || []) schedule(reply); }
  const translations = await translateMany(translationJobs.map((job) => job.text), target, 8);
  for (let i = 0; i < translationJobs.length; i++) {
    const job = translationJobs[i];
    const translated = String(translations[i] || job.text || "");
    for (const item of job.items) { item.translations[job.target] = translated; changed = true; }
  }
  const localized = posts.map((post) => localizePostForResponse(post, target));
  return { posts: localized, changed };
}
__name(localizeIBelievePosts, "localizeIBelievePosts");

function localizePostForResponse(post, targetLanguage) {
  const originalBody = String(post?.body || "");
  const displayBody = getDisplayText(post, targetLanguage);
  return { ...post, body: displayBody, displayBody, originalBody, displayLanguage: targetLanguage, isTranslated: displayBody !== originalBody, translations: normalizeTranslations(post?.translations), replies: Array.isArray(post?.replies) ? post.replies.map((reply) => { const originalReplyBody = String(reply?.body || ""); const displayReplyBody = getDisplayText(reply, targetLanguage); return { ...reply, body: displayReplyBody, displayBody: displayReplyBody, originalBody: originalReplyBody, displayLanguage: targetLanguage, isTranslated: displayReplyBody !== originalReplyBody, translations: normalizeTranslations(reply?.translations) }; }) : [] };
}
__name(localizePostForResponse, "localizePostForResponse");

function getDisplayText(item, targetLanguage) {
  const originalBody = String(item?.body || "");
  const originalLanguage = canonicalizeLanguage(item?.originalLanguage || inferLanguage(originalBody));
  if (!originalBody) return "";
  if (originalLanguage === targetLanguage) return originalBody;
  const translations = normalizeTranslations(item?.translations);
  return String(translations[targetLanguage] || originalBody);
}
__name(getDisplayText, "getDisplayText");

async function ensureEnglishTranslation(item) {
  if (!item) return item;
  const body = String(item?.body || "").trim();
  if (!body) return item;
  item.originalLanguage = canonicalizeLanguage(item?.originalLanguage || inferLanguage(body));
  item.translations = normalizeTranslations(item?.translations);
  if (item.originalLanguage === "en") return item;
  if (item.translations.en) return item;
  item.translations.en = await translateText(body, "en");
  return item;
}
__name(ensureEnglishTranslation, "ensureEnglishTranslation");

async function handleTranslate(request, env) {
  const body = await request.json().catch(() => ({}));
  const target = canonicalizeLanguage(body?.target || DEFAULT_DISPLAY_LANGUAGE);
  const texts = Array.isArray(body?.texts) ? body.texts.map((x) => String(x || "")).slice(0, 100) : [];
  if (!target) return json({ error: "target required" }, 400, request);
  if (!texts.length) return json({ items: [] }, 200, request);
  try { const translated = await Promise.all(texts.map((text) => translateText(text, target))); return json({ items: translated, target }, 200, request); }
  catch (err) { return json({ error: "translation failed", detail: String(err?.message || err || "unknown") }, 502, request); }
}
__name(handleTranslate, "handleTranslate");

async function handleIBelieveTts(request, env, url) {
  let text = "", lang = "en-US";
  if (request.method === "POST") { const body = await request.json().catch(() => ({})); text = String(body?.text || "").trim(); lang = String(body?.lang || "en-US").trim() || "en-US"; }
  else if (request.method === "GET") { text = String(url.searchParams.get("text") || "").trim(); lang = String(url.searchParams.get("lang") || "en-US").trim() || "en-US"; }
  else return json({ error: "Method not allowed" }, 405, request);
  if (!text) return json({ error: "text required" }, 400, request);
  if (!env.OPENAI_API_KEY) return json({ error: "missing_openai_key" }, 500, request);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, format: "mp3" }) });
    if (!res.ok) { const detail = await res.text().catch(() => `status:${res.status}`); return json({ error: "tts_upstream_failed", detail }, 502, request); }
    const headers = cors(request); headers["Content-Type"] = res.headers?.get?.("Content-Type") || "audio/mpeg"; headers["Cache-Control"] = "public, max-age=300";
    return new Response(res.body, { status: 200, headers });
  } catch (e) { return json({ error: "tts_failed", detail: String(e && e.message || e) }, 500, request); }
}
__name(handleIBelieveTts, "handleIBelieveTts");

async function translateText(text, target) {
  const value = String(text || "");
  if (!value.trim()) return value;
  const sourceLanguage = inferLanguage(value);
  const normalizedTarget = canonicalizeLanguage(target || DEFAULT_DISPLAY_LANGUAGE);
  if (sourceLanguage === normalizedTarget) return value;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(toGoogleLanguage(normalizedTarget))}&dt=t&q=${encodeURIComponent(value)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) return value;
  return data[0].map((part) => Array.isArray(part) ? String(part[0] || "") : "").join("") || value;
}
__name(translateText, "translateText");

async function translateMany(texts, target, chunkSize = 20) {
  const input = Array.isArray(texts) ? texts.map((text) => String(text || "")) : [];
  const results = new Array(input.length).fill("");
  if (!input.length) return results;
  const normalizedTarget = canonicalizeLanguage(target || DEFAULT_DISPLAY_LANGUAGE);
  const separator = "\n\u27E6IB_SEP_9f3c2d1a\u27E7\n";
  for (let start = 0; start < input.length; start += chunkSize) {
    const chunk = input.slice(start, start + chunkSize);
    const joined = chunk.join(separator);
    const translatedJoined = await translateText(joined, normalizedTarget);
    const pieces = translatedJoined.split(separator);
    for (let i = 0; i < chunk.length; i++) results[start + i] = String(pieces[i] || chunk[i] || "");
  }
  return results;
}
__name(translateMany, "translateMany");

function safeParse(raw) { try { const arr = JSON.parse(raw || "[]"); return Array.isArray(arr) ? arr : []; } catch { return []; } }
__name(safeParse, "safeParse");

function normalizePosts(posts) { return posts.map((p) => ({ id: String(p?.id || crypto.randomUUID()), text: String(p?.text || ""), time: String(p?.time || ""), likeCount: Number(p?.likeCount || 0), shareCount: Number(p?.shareCount || 0), ip: String(p?.ip || ""), region: String(p?.region || ""), comments: Array.isArray(p?.comments) ? p.comments.map((c) => ({ id: String(c?.id || crypto.randomUUID()), text: String(c?.text || ""), time: String(c?.time || ""), ip: String(c?.ip || ""), region: String(c?.region || "") })) : [] })); }
__name(normalizePosts, "normalizePosts");

function calcTotals(posts) { const totalLike = posts.reduce((s, p) => s + Number(p.likeCount || 0), 0); const totalShare = posts.reduce((s, p) => s + Number(p.shareCount || 0), 0); return { totalLike, totalShare }; }
__name(calcTotals, "calcTotals");
function getClientIp(request) { return String(request?.headers?.get("CF-Connecting-IP") || "").trim(); }
__name(getClientIp, "getClientIp");
function maskIp(ip = "") { if (!ip) return ""; if (ip.includes(":")) { const parts2 = ip.split(":"); return `${parts2.slice(0, 3).join(":")}:****`; } const parts = ip.split("."); if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`; return ip; }
__name(maskIp, "maskIp");
function getRegion(request) { const cf = request?.cf || {}; return [String(cf.country||""),String(cf.region||""),String(cf.city||"")].filter(Boolean).join("/"); }
__name(getRegion, "getRegion");
function json(obj, status, request) { return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(request) } }); }
__name(json, "json");
function cors(request) { const origin = request?.headers?.get("Origin") || ""; const allow = ["https://openai-tw.com", "https://www.openai-tw.com"]; return { "Access-Control-Allow-Origin": allow.includes(origin) ? origin : "https://openai-tw.com", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }; }
__name(cors, "cors");
function normalizeIBelievePosts(posts) { return (Array.isArray(posts) ? posts : []).map((p) => ({ id: String(p?.id || crypto.randomUUID()), topic: String(p?.topic || "belief"), body: String(p?.body || p?.text || ""), originalLanguage: canonicalizeLanguage(p?.originalLanguage || p?.language || inferLanguage(p?.body || p?.text || "")), translations: normalizeTranslations(p?.translations), createdAt: Number(p?.createdAt || Date.now()), likeCount: Number(p?.likeCount || p?.like_count || 0), agent: normalizeAgent(p?.agent, p?.name, p?.origin), replies: Array.isArray(p?.replies) ? p.replies.map((r) => ({ id: String(r?.id || crypto.randomUUID()), body: String(r?.body || r?.text || ""), originalLanguage: canonicalizeLanguage(r?.originalLanguage || r?.language || inferLanguage(r?.body || r?.text || "")), translations: normalizeTranslations(r?.translations), createdAt: Number(r?.createdAt || Date.now()), agent: normalizeAgent(r?.agent, r?.name, r?.origin) })) : [] })); }
__name(normalizeIBelievePosts, "normalizeIBelievePosts");
function normalizeTranslations(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; const out = {}; for (const [key, text] of Object.entries(value)) { const lang = canonicalizeLanguage(key); if (!lang) continue; const normalizedText = String(text || "").trim(); if (!normalizedText) continue; out[lang] = normalizedText; } return out; }
__name(normalizeTranslations, "normalizeTranslations");
function normalizeAgent(agent, fallbackName = "Anonymous", fallbackOrigin = "Unknown Origin") { const name = String(agent?.name || fallbackName || "Anonymous"); const origin = String(agent?.origin || fallbackOrigin || "Unknown Origin"); const built = buildAgent(name, origin); return { name, origin, avatar: String(agent?.avatar || built.avatar), color: String(agent?.color || built.color) }; }
__name(normalizeAgent, "normalizeAgent");
function buildAgent(name, origin) { const avatar = [...String(name).trim()].slice(0, 1).join("").toUpperCase() || "\u25C9"; const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#9333ea", "#b45309"]; const seed = [...`${name}|${origin}`].reduce((a, c) => a + c.charCodeAt(0), 0); return { name, origin, avatar, color: colors[seed % colors.length] }; }
__name(buildAgent, "buildAgent");
function calcIBelieveStats(posts) { const agents = new Set(posts.map((p) => `${p.agent?.name || ""}|${p.agent?.origin || ""}`)); const replies = posts.reduce((sum, p) => sum + (p.replies || []).length, 0); const likes = posts.reduce((sum, p) => sum + Number(p.likeCount || 0), 0); return { posts: posts.length, agents: agents.size, replies, likes }; }
__name(calcIBelieveStats, "calcIBelieveStats");
function canonicalizeLanguage(value) { const raw = String(value || "").trim(); if (!raw) return DEFAULT_DISPLAY_LANGUAGE; const lower = raw.toLowerCase(); if (lower === "zh" || lower === "zh-tw" || lower === "zh-hant" || lower === "zh-hant-tw") return "zh-TW"; if (lower === "zh-cn" || lower === "zh-hans" || lower === "zh-hans-cn") return "zh-CN"; if (lower.startsWith("en")) return "en"; if (lower.startsWith("ja")) return "ja"; if (lower.startsWith("ko")) return "ko"; if (lower.startsWith("es")) return "es"; if (lower.startsWith("fr")) return "fr"; if (lower.startsWith("de")) return "de"; return SUPPORTED_LANGUAGES.has(raw) ? raw : DEFAULT_DISPLAY_LANGUAGE; }
__name(canonicalizeLanguage, "canonicalizeLanguage");
function toGoogleLanguage(value) { const lang = canonicalizeLanguage(value); if (lang === "zh-TW") return "zh-TW"; if (lang === "zh-CN") return "zh-CN"; return lang; }
__name(toGoogleLanguage, "toGoogleLanguage");
function inferLanguage(text) { const value = String(text || ""); if (!value.trim()) return DEFAULT_DISPLAY_LANGUAGE; if (/[\u3040-\u30ff]/.test(value)) return "ja"; if (/[\uac00-\ud7af]/.test(value)) return "ko"; if (/[\u4e00-\u9fff]/.test(value)) return "zh-TW"; return "en"; }
__name(inferLanguage, "inferLanguage");
function detectSubmissionLanguage(text, requestedLanguage) { const inferred = canonicalizeLanguage(inferLanguage(text)); const requested = canonicalizeLanguage(requestedLanguage || ""); if (!String(text || "").trim()) return requested || inferred || DEFAULT_DISPLAY_LANGUAGE; if (!requested) return inferred; if (requested === inferred) return requested; if (inferred !== "en") return inferred; return requested; }
__name(detectSubmissionLanguage, "detectSubmissionLanguage");
async function enforceRateLimit(env, request, kind) { if (!env.FORUM_KV) return null; const ip = getClientIp(request) || "unknown"; const key = `${RATE_LIMIT_KEY_PREFIX}:${kind}:${ip}`; const now = Date.now(); const windowMs = RATE_LIMIT_WINDOW_MS[kind] || 1e4; const last = Number(await env.FORUM_KV.get(key) || 0); if (last && now - last < windowMs) return json({ error: "rate_limited", retryAfterMs: windowMs - (now - last) }, 429, request); await env.FORUM_KV.put(key, String(now), { expirationTtl: Math.ceil(windowMs / 1e3) + 60 }); return null; }
__name(enforceRateLimit, "enforceRateLimit");
async function incrementIBelieveCounter(env, amount = 1) { if (!env.FORUM_KV) return 0; const current = Number(await env.FORUM_KV.get(IBELIEVE_COUNTER_KEY) || 0); const next = current + Number(amount || 0); await env.FORUM_KV.put(IBELIEVE_COUNTER_KEY, String(next)); return next; }
__name(incrementIBelieveCounter, "incrementIBelieveCounter");

export { index_default as default };
