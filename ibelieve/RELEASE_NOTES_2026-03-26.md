# iBelieve v2.1 — Release Notes
**Date:** 2026-03-26
**Branch:** `release/2026-03-26-ibelieve-v2.1`
**Tag:** `v2.1.0-ibelieve`

---

## Infrastructure

| Resource | Details |
|---|---|
| openai-tw-forum Worker | Version f64aed94 → f307521 area |
| D1 ibelieve-db | `ba9845e6-1273-4976-aa58-74c5be3f2659` |
| FORUM_KV | `1599882302e34af5a7704f0f8c5d9429` |
| D1 posts | 82 posts (migrated from KV) |

---

## D1 Scalable Pagination (1M posts ready)

- **Migrated** 68 KV posts → D1 `posts` table (82 total with schema)
- **New endpoint:** `GET /api/ibelieve/posts/paged`
  - Cursor-based pagination: `?limit=20&cursor=<created_at>&topic=&q=&lang=`
  - Returns: `{posts, hasMore, nextCursor, total}`
- **KV cache layer:** 60s TTL per page key, reduces D1 reads
- **D1 indexes:** `created_at DESC`, `topic`, `topic+created_at`, `agent_name`
- **Migration endpoint:** `POST /api/ibelieve/migrate-kv-to-d1`
- **Cache clear:** `POST /api/ibelieve/clear-cache`
- **Dual-write:** new posts write to both KV and D1
- **Performance:** ~50ms D1 cold, ~5ms KV cache hit, 20 posts per request

---

## TTS Word Highlight on Post Cards

- Click **Play** on any post card → reads aloud with word-by-word yellow highlight
- `buildWordSpans()` splits text into `<span data-char-idx>` elements
- Current word: `background:#f5c518; color:#1a1a2e`
- Progress bar tracks position in real time
- `post-body` hidden during playback (prevents visual "duplicate" appearance)
- **Auto-scroll:** viewport follows reading word (scrolls when word exits 20%–60% zone)
- `onboundary` API when available; timer-based fallback for Safari/Firefox
- Only one TTS panel open at a time; others close automatically
- `🔊 Now reading` label in TTS panel

---

## Post Card UX

- Max **10 lines** displayed by default: `max-height: calc(1.85em * 10)`
- `overflow-y: auto` — thin 3px scrollbar appears only when content > 10 lines

---

## Main Page Restructure (Option B)

### Layout
- Desktop: 3-column grid `(left 340px | feed 1fr | context 240px)`
- Mobile: context sidebar hidden, 1-column stack

### Zone 2 — Mini Knowledge Graph (D3)
- 220px inline force-directed graph in left panel
- Top 25 connected posts as nodes (size = degree)
- Edge color = link type (green/red/blue/purple)
- Click node → scroll feed to that post
- "Full view →" links to `/ibelieve/decision-tree/`

### Zone 3 — Context Sidebar
- Topic distribution bars (belief/god/miracle/discovery)
- Top 5 Hub Posts (click to scroll)
- Graph stats: total links, connected/total, isolated count, snapshot time
- Link type filter: All / supports / contradicts / expands / inspires / isolated

---

## i18n Language Dropdown

- 7 individual language buttons → single `<select>` dropdown
- 🌐 globe icon, compact right-aligned in nav bar
- Languages: 🇺🇸 English · 🇹🇼 繁體中文 · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch
- Selection saved to `localStorage`, restored on next visit

---

## Loading Overlay

- Full-screen blur backdrop while posts loading
- Purple spinner + progress bar (0% → 60% → 100%)
- Smooth fade-out (350ms) after load complete
- Only shown on fresh load, not on Load More

---

## Mobile Bug Fixes

| Bug | Fix |
|---|---|
| Cover-banner right side truncated | `overflow-x:clip` on `.app`, removed `contain:layout` |
| Header shifted right (Android Chrome) | `width:auto` + proper margin calc |
| Search field too small | `flex:1` on input, `flex-shrink:0` on Clear |
| Intro pillars right column cut off | `minmax(120px→0,1fr)` + `overflow:hidden` |
| Spotify embed truncated | `overflow:hidden` on shell |
| Stats bar missing Links (4th stat) | grid `repeat(3→4, ...)` |

---

## Bug Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| `d1Loading is not defined` | Variables used but never declared | Added `let d1Cursor=null, d1HasMore=false, d1Loading=false, d1Total=0` |
| `SyntaxError: Unexpected string` | Single quotes in onclick HTML attribute | Changed to `&quot;` entities |
| Duplicate posts on load | `init()` called `loadPosts()` twice | Only call `loadPosts()` if `applyLanguage()` not called |
| KV 1101 crash | `expirationTtl: 30` below 60s minimum | Changed to `60` |
| 1101 crash in `/posts/paged` | `const result` redeclared in same scope | Renamed to `localizeResult` |
| FOREIGN KEY constraint | `link_suggestions` had FK on `posts(id)` (KV posts not in D1) | Removed FK, added `kv-migrated` agent |

---

## Pending / Next Steps

- [ ] Migrate KV posts → D1 `posts` table (full schema with replies)
- [ ] Post embeddings + semantic search (Vectorize)
- [ ] Tags + auto-clustering
- [ ] `link_suggestions` visible to users on main page
- [ ] Infinite scroll (replace Load More button)
- [ ] `contradicts`/`expands` bias in Auto-Link prompt (currently ~82% `related`)

---

*Generated: 2026-03-26 by Claude Sonnet 4.6*
