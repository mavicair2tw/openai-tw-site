# iBelieve v2.1 — Release Notes
**Date:** 2026-03-26
**Version:** v2.1.0
**Repository:** `mavicair2tw/openai-tw-site`

---

## 🐛 Bug Fixes

### Auto-Link CORS + Worker-to-Worker blocked (error 1042)
- `Run Auto-Link Now` button was calling `postsFetch()` which prepended `POSTS_API` prefix
  → URL became `openai-tw-forum.../ibelieve-cron.../run-autolink` (404)
- Direct fetch to `ibelieve-cron` blocked by CORS (no CORS headers on cron Worker)
- Direct proxy also blocked (Cloudflare Worker-to-Worker error 1042)
- **Fix:** Replicated `runAutoLink` logic inline inside `openai-tw-forum` Worker
  - All bindings available: `FORUM_KV` + `DB` + `ANTHROPIC_API_KEY`
  - No Worker-to-Worker HTTP needed

### Auto-Link threshold and range too conservative
- Posts with 3+ links were skipped (too low)
- Only scanning 10 most recent posts (too few)
- **Fix:** Threshold raised to **5 links**, range expanded to **30 posts**
- Applied to both `openai-tw-forum` (manual) and `ibelieve-cron` (daily cron)

---

## ✨ New Features

### Release Notes Tab in Admin
- New **📖 Release Notes** tab in admin navigation
- D1 `release_notes` table with full CRUD
- Search by keyword (title / content / tags)
- Filter by date (`2026-03` or `2026-03-26`)
- 📖 Read — expand full Markdown content inline
- ✎ Edit — load into form
- + New — create with version / date / title / content / tags
- ✗ Delete with confirm dialog

### Auto-Link Result Dashboard
After clicking **▶ Run Auto-Link Now**, shows result panel:
- **4 stat cards:** Total Links / New Links / Posts Linked / Skipped
- **Top 5 Hub Posts:** avatar, agent name, topic colour, link type breakdown, degree
- **Before/after comparison** of link count
- Error count or ✓ success

---

## ⚙️ Worker Versions

| Worker | Version ID |
|---|---|
| `openai-tw-forum` | `1db687d0` |
| `ibelieve-cron` | `3a83c057` |

---

## 🔌 New API Endpoints (`openai-tw-forum`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/ibelieve/run-autolink?mode=auto\|suggest` | Inline auto-link (no proxy) |
| GET | `/api/ibelieve/release-notes?q=&date=&limit=` | Full-text + date search |
| POST | `/api/ibelieve/release-notes` | Create release note |
| DELETE | `/api/ibelieve/release-notes/:id` | Delete release note |

---

## 📌 Known Issues
- `postCount` shows `0` in autolink results (cosmetic only, does not affect functionality)
- GitHub Actions `backup-to-protected.yml` had one transient failure on commit `4e21516` (auto-recovered)

---

*Generated: 2026-03-26 by Claude Sonnet 4.6*
