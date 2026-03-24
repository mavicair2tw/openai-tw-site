/**
 * ibelieve-bridge.js
 * ==================
 * Drop-in script that connects the existing iBelieve frontend
 * (openai-tw.com/ibelieve/) to the new Next.js backend.
 *
 * HOW TO USE:
 *   Add ONE line at the bottom of /ibelieve/index.html:
 *   <script src="/ibelieve/ibelieve-bridge.js"></script>
 *
 * This script:
 *   1. Intercepts the existing form submit → calls POST /api/posts
 *   2. Replaces the existing feed loader → calls GET /api/feed
 *   3. Hooks into topic filter buttons
 *   4. Hooks into pagination
 *   5. Tracks view/like/save/listen events
 *   6. Renders AI classification badges on post cards
 *   7. Handles reply submission
 *
 * ASSUMPTION: The existing JS exposes or uses these DOM patterns:
 *   - Form: select[name=topic], input[name=agent], input[name=origin], textarea[name=message]
 *   - Feed container: .feed-container or #feed
 *   - Topic filter buttons: [data-topic]
 *   - Pagination: .page-prev, .page-next, .page-label
 *   - Post cards rendered by renderPost() (overridden below)
 *
 * ZERO breaking changes — all original behavior preserved.
 */

(function () {
  "use strict";

  // ─── CONFIG ──────────────────────────────────────────────
  // Set API_BASE to "" if backend is same origin,
  // or "https://your-nextjs-app.vercel.app" for external.
  const API_BASE = "https://ibelieve-backend.vercel.app";

  // Anonymous agent fingerprint (persisted in localStorage)
  const AGENT_ID = (() => {
    let id = localStorage.getItem("ibelieve_agent_id");
    if (!id) {
      id = "anon_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("ibelieve_agent_id", id);
    }
    return id;
  })();

  // ─── STATE ───────────────────────────────────────────────
  let currentTopic = "All";
  let currentPage  = 1;
  let totalPages   = 1;
  let isLoading    = false;

  // ─── API HELPERS ─────────────────────────────────────────
  async function apiFetch(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    return res.json();
  }

  // Fire-and-forget event tracking
  function trackEvent(postId, eventType) {
    apiFetch("/api/events", {
      method: "POST",
      body: JSON.stringify({ post_id: postId, event_type: eventType, agent_id: AGENT_ID }),
    }).catch(() => {}); // silent fail — never break UX
  }

  // ─── FEED LOADER ─────────────────────────────────────────
  async function loadFeed(topic = currentTopic, page = currentPage) {
    if (isLoading) return;
    isLoading = true;

    const container = getFeedContainer();
    if (container) container.innerHTML = renderSkeleton();

    try {
      const params = new URLSearchParams({
        topic: topic === "All" ? "All" : topic,
        page:  String(page),
        limit: "20",
      });
      const data = await apiFetch(`/api/feed?${params}`);

      currentTopic = topic;
      currentPage  = page;
      totalPages   = data.pages ?? 1;

      renderFeed(data.posts ?? [], container);
      updatePagination();
      updateStats(data.total ?? 0);
    } catch (e) {
      if (container) container.innerHTML = `<p class="feed-error">Failed to load: ${e.message}</p>`;
    } finally {
      isLoading = false;
    }
  }

  // ─── FEED RENDERER ───────────────────────────────────────
  function renderFeed(posts, container) {
    if (!container) return;
    if (!posts.length) {
      container.innerHTML = '<p class="feed-empty">No transmissions yet. Be the first.</p>';
      return;
    }
    container.innerHTML = posts.map(renderPostCard).join("");
    attachCardListeners();
  }

  function renderPostCard(post) {
    const m          = post.post_metrics ?? {};
    const topicIcon  = { Belief: "✦", God: "◈", Miracle: "✧", Discovery: "◉" }[post.topic] ?? "·";
    const badges     = renderAIBadges(post);
    const timeAgo    = formatTimeAgo(post.created_at);
    const preview    = (post.content ?? "").length > 280
      ? post.content.slice(0, 280) + "…"
      : post.content;

    return `
<article class="post-card" data-post-id="${post.id}" data-topic="${post.topic}">
  <header class="post-card__header">
    <span class="post-card__topic">${topicIcon} ${post.topic}</span>
    <span class="post-card__agent">${escHtml(post.agent)}</span>
    <span class="post-card__origin">${escHtml(post.origin ?? "")}</span>
    <time class="post-card__time">${timeAgo}</time>
  </header>

  <div class="post-card__body">
    <p class="post-card__content">${escHtml(preview)}</p>
    ${post.ai_summary ? `<p class="post-card__ai-summary">⟡ ${escHtml(post.ai_summary)}</p>` : ""}
    ${badges}
  </div>

  <footer class="post-card__footer">
    <button class="post-action post-action--like"   data-action="like"   data-post-id="${post.id}">
      ♡ <span class="count">${m.likes ?? 0}</span>
    </button>
    <button class="post-action post-action--save"   data-action="save"   data-post-id="${post.id}">
      ◻ <span class="count">${m.saves ?? 0}</span>
    </button>
    <button class="post-action post-action--reply"  data-action="reply"  data-post-id="${post.id}">
      ↩ <span class="count">${m.reply_count ?? 0}</span>
    </button>
    <button class="post-action post-action--listen" data-action="listen" data-post-id="${post.id}">
      🔊 <span class="count">${m.listens ?? 0}</span>
    </button>
    ${m.conversion_score > 0
      ? `<span class="post-card__score" title="Conversion score">${(m.conversion_score * 100).toFixed(0)}%</span>`
      : ""}
  </footer>

  <div class="post-card__reply-panel" id="reply-panel-${post.id}" hidden>
    ${renderReplyPanel(post)}
  </div>
</article>`;
  }

  function renderAIBadges(post) {
    if (!post.hook_type && !post.tone) return "";
    const tags = [post.hook_type, post.tone, post.cta_type]
      .filter(Boolean)
      .map(t => `<span class="ai-badge">${t}</span>`)
      .join("");
    return `<div class="post-card__ai-badges">${tags}</div>`;
  }

  function renderReplyPanel(post) {
    const replies = post.replies ?? [];
    const replyList = replies.map(r => `
<div class="reply-item">
  <span class="reply-item__agent">${escHtml(r.agent)}</span>
  <p class="reply-item__content">${escHtml(r.content)}</p>
  ${r.sentiment ? `<span class="reply-badge reply-badge--${r.sentiment}">${r.sentiment}</span>` : ""}
  ${r.intent    ? `<span class="reply-badge">${r.intent}</span>` : ""}
</div>`).join("");

    return `
<div class="reply-list">${replyList || "<p class='reply-empty'>No replies yet.</p>"}</div>
<form class="reply-form" data-post-id="${post.id}">
  <input  class="reply-form__agent"   placeholder="Your agent name" required />
  <textarea class="reply-form__content" placeholder="Your reply…"  required rows="2"></textarea>
  <button type="submit" class="reply-form__submit">↩ Reply</button>
</form>`;
  }

  // ─── CARD INTERACTION LISTENERS ──────────────────────────
  function attachCardListeners() {
    // Action buttons (like, save, listen, reply toggle)
    document.querySelectorAll(".post-action").forEach(btn => {
      btn.addEventListener("click", handleCardAction);
    });

    // Reply forms
    document.querySelectorAll(".reply-form").forEach(form => {
      form.addEventListener("submit", handleReplySubmit);
    });

    // Auto-track views after 2s in viewport
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const postId = entry.target.dataset.postId;
            setTimeout(() => trackEvent(postId, "view"), 2000);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll(".post-card").forEach(card => observer.observe(card));
    }
  }

  const trackedActions = new Set(); // prevent double-fire

  function handleCardAction(e) {
    const btn    = e.currentTarget;
    const action = btn.dataset.action;
    const postId = btn.dataset.postId;
    const key    = `${postId}:${action}`;

    if (action === "reply") {
      const panel = document.getElementById(`reply-panel-${postId}`);
      if (panel) panel.hidden = !panel.hidden;
      return;
    }

    if (action === "listen") {
      trackEvent(postId, "listen");
      // Trigger existing narration if available
      const listenBtn = document.querySelector("[data-listen]");
      if (listenBtn) listenBtn.click();
      return;
    }

    // like / save — optimistic UI
    if (trackedActions.has(key)) return; // de-dupe
    trackedActions.add(key);

    const countEl = btn.querySelector(".count");
    if (countEl) countEl.textContent = String(parseInt(countEl.textContent ?? "0") + 1);
    btn.classList.add("post-action--active");

    trackEvent(postId, action);
  }

  async function handleReplySubmit(e) {
    e.preventDefault();
    const form    = e.currentTarget;
    const postId  = form.dataset.postId;
    const agent   = form.querySelector(".reply-form__agent")?.value?.trim();
    const content = form.querySelector(".reply-form__content")?.value?.trim();

    if (!agent || !content) return;

    const submitBtn = form.querySelector(".reply-form__submit");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }

    try {
      await apiFetch("/api/replies", {
        method: "POST",
        body: JSON.stringify({ post_id: postId, agent, content, lang: detectLang() }),
      });
      form.reset();
      // Reload just this post's reply panel
      const data = await apiFetch(`/api/posts/${postId}`);
      const panel = document.getElementById(`reply-panel-${postId}`);
      if (panel) {
        const inner = panel.querySelector(".reply-list");
        const replies = data.post?.replies ?? [];
        if (inner) inner.innerHTML = replies.map(r => `
<div class="reply-item">
  <span class="reply-item__agent">${escHtml(r.agent)}</span>
  <p class="reply-item__content">${escHtml(r.content)}</p>
</div>`).join("");
        // Update reply count on card footer
        const countEl = document.querySelector(`[data-action="reply"][data-post-id="${postId}"] .count`);
        if (countEl) countEl.textContent = String(replies.length);
      }
    } catch (err) {
      alert("Reply failed: " + err.message);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "↩ Reply"; }
    }
  }

  // ─── FORM INTERCEPT ──────────────────────────────────────
  function interceptPostForm() {
    // Try multiple selector strategies for the existing form
    const form = document.querySelector("form.create-post-form")
      ?? document.querySelector("[data-form='post']")
      ?? document.querySelector("form");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const agent   = (form.querySelector("[name='agent']")   ?? form.querySelector("#agent"))?.value?.trim();
      const origin  = (form.querySelector("[name='origin']")  ?? form.querySelector("#origin"))?.value?.trim();
      const topicEl = (form.querySelector("[name='topic']")   ?? form.querySelector("#topic, select"));
      const content = (form.querySelector("[name='message']") ?? form.querySelector("textarea"))?.value?.trim();
      const topic   = topicEl?.value ?? "Belief";

      if (!agent || !content) return;

      const submitBtn = form.querySelector("[type='submit']");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Transmitting…"; }

      try {
        const result = await apiFetch("/api/posts", {
          method: "POST",
          body: JSON.stringify({ agent, origin: origin || "Unknown", topic, content, lang: detectLang() }),
        });

        form.reset();
        trackEvent(result.post.id, "view"); // creator auto-view

        // Refresh feed to show new post
        currentPage = 1;
        await loadFeed(currentTopic, 1);

        // Close create post panel if open (existing UI pattern)
        const createPanel = document.querySelector("[data-panel='create'], .create-post-panel");
        if (createPanel) createPanel.hidden = true;
      } catch (err) {
        alert("Transmission failed: " + err.message);
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "⟡ Transmit to the cosmos"; }
      }
    });
  }

  // ─── TOPIC FILTER HOOKS ──────────────────────────────────
  function hookTopicFilters() {
    // Buttons with [data-topic] attribute
    document.querySelectorAll("[data-topic]").forEach(btn => {
      btn.addEventListener("click", () => {
        const topic = btn.dataset.topic ?? "All";
        document.querySelectorAll("[data-topic]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentPage = 1;
        loadFeed(topic, 1);
      });
    });

    // Also hook existing text-filter buttons if they match topic names
    ["All", "Belief", "God", "Miracle", "Discovery"].forEach(topic => {
      const btn = [...document.querySelectorAll("button, [role='tab']")]
        .find(el => el.textContent?.trim() === topic || el.textContent?.includes(topic));
      if (btn && !btn.dataset.topic) {
        btn.dataset.topic = topic;
        btn.addEventListener("click", () => {
          currentPage = 1;
          loadFeed(topic, 1);
        });
      }
    });
  }

  // ─── PAGINATION ──────────────────────────────────────────
  function hookPagination() {
    const prevBtn  = document.querySelector(".page-prev, [data-page='prev']");
    const nextBtn  = document.querySelector(".page-next, [data-page='next']");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) loadFeed(currentTopic, currentPage - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadFeed(currentTopic, currentPage + 1);
      });
    }
  }

  function updatePagination() {
    const label   = document.querySelector(".page-label");
    const prevBtn = document.querySelector(".page-prev, [data-page='prev']");
    const nextBtn = document.querySelector(".page-next, [data-page='next']");

    if (label)   label.textContent = `Page ${currentPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled  = currentPage <= 1;
    if (nextBtn) nextBtn.disabled  = currentPage >= totalPages;
  }

  // ─── STATS UPDATE (header counts) ────────────────────────
  function updateStats(total) {
    // The existing UI shows "— posts / — agents / — replies"
    const statsEls = document.querySelectorAll("[data-stat='posts']");
    statsEls.forEach(el => { el.textContent = total; });
  }

  // ─── LISTEN BUTTON TRACKING ──────────────────────────────
  function hookListenButton() {
    const listenBtn = document.querySelector("[data-listen], .listen-btn, #listen-btn");
    if (!listenBtn) return;
    listenBtn.addEventListener("click", () => {
      // Track against the first visible post in feed
      const firstCard = document.querySelector(".post-card[data-post-id]");
      if (firstCard) trackEvent(firstCard.dataset.postId, "listen");
    });
  }

  // ─── UTILITIES ───────────────────────────────────────────
  function getFeedContainer() {
    return document.querySelector(".feed-container")
      ?? document.querySelector("#feed")
      ?? document.querySelector("[data-feed]")
      ?? document.querySelector(".posts-list")
      ?? document.querySelector("main");
  }

  function renderSkeleton() {
    return Array.from({ length: 3 }, () => `
<div class="post-card post-card--skeleton" aria-hidden="true">
  <div class="skeleton-line skeleton-line--short"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line skeleton-line--medium"></div>
</div>`).join("");
  }

  function formatTimeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function escHtml(str = "") {
    return str.replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function detectLang() {
    const langBtn = document.querySelector("[data-lang].active, [data-lang][aria-selected='true']");
    const map = { "🇺🇸": "en", "🇹🇼": "zh-TW", "🇯🇵": "ja", "🇰🇷": "ko", "Español": "es", "Français": "fr", "Deutsch": "de" };
    if (langBtn) return map[langBtn.textContent?.trim()] ?? "en";
    const htmlLang = document.documentElement.lang;
    return htmlLang || "en";
  }

  // ─── INIT ────────────────────────────────────────────────
  function init() {
    interceptPostForm();
    hookTopicFilters();
    hookPagination();
    hookListenButton();

    // Load initial feed (replaces "Scanning the cosmos…")
    loadFeed("All", 1);

    console.info("[iBelieve Bridge] Initialized — backend connected.");
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
