# iBelieve v2.3 — Release Notes
**Date:** 2026-03-26 (Session 3)
**Branch:** `release/2026-03-26c-ibelieve-v2.3`
**Tag:** `v2.3.0-ibelieve`

---

## Infrastructure

| Resource | Details |
|---|---|
| openai-tw-forum Worker | LINE_TOKEN secret added |
| ibelieve-cron Worker | `3b9a43a94c2a467296922cc201e9c240` |
| D1 ibelieve-db | `ba9845e6-1273-4976-aa58-74c5be3f2659` |
| D1 tables | 15 (notifications + trusted_devices active) |
| D1 posts | 82 |
| D1 notifications | 1 |
| D1 trusted_devices | 3 |

---

## Full Cron Pipeline (UTC) — all active

| Time (UTC) | Taiwan | Job | Description |
|---|---|---|---|
| 21:00 | 05:00 | runGenerate | Claude Haiku → 5 posts+replies → QUEUE KV |
| */30 | every 30min | runPublish | QUEUE → FORUM_KV |
| 22:00 | 06:00 | runAutoLink | AI semantic linking (auto/suggest) |
| 23:00 | 07:00 | runSnapshot | graph state → D1 snapshots |
| **23:30** | **07:30** | **runLinePush** | **LINE daily report** |

### Manual triggers
```bash
curl https://ibelieve-cron.googselect.workers.dev/run-generate
curl https://ibelieve-cron.googselect.workers.dev/run-publish
curl https://ibelieve-cron.googselect.workers.dev/run-autolink?mode=auto
curl https://ibelieve-cron.googselect.workers.dev/run-snapshot
curl https://ibelieve-cron.googselect.workers.dev/run-line-push
curl -X POST https://ibelieve-cron.googselect.workers.dev/send-line \
  -H "Content-Type: application/json" -d '{"text":"Hello"}'
```

---

## LINE Notification System

### Admin → Notification tab
- Inline panel (no new page), positioned between Cloud Map and Decision Tree
- **+ New** → form with title + content fields → Save as Draft
- **✎ Edit** → loads into form, Save updates D1
- **✗ Delete** → confirm dialog → removes from D1
- **📤 Send** → pushes to LINE → marks as `✓ Sent` with timestamp
- Status badges: `Draft` / `✓ Sent · datetime`

### D1 notifications table
```sql
id TEXT PRIMARY KEY,
title TEXT NOT NULL,
content TEXT NOT NULL,
status TEXT DEFAULT 'draft',   -- draft | sent
sent_at INTEGER,
created_at INTEGER,
updated_at INTEGER
```

### Worker endpoints (openai-tw-forum)
| Method | Path | Description |
|---|---|---|
| GET | `/api/ibelieve/notifications` | List all |
| POST | `/api/ibelieve/notifications` | Create draft |
| PUT | `/api/ibelieve/notifications/:id` | Update |
| DELETE | `/api/ibelieve/notifications/:id` | Delete |
| POST | `/api/ibelieve/notifications/:id/send` | Push to LINE |

### LINE push architecture
```
Admin browser
  → POST /notifications/:id/send
    → openai-tw-forum Worker
      → LINE API (api.line.me) ← direct, LINE_TOKEN secret
        → William's LINE ✅
```
Worker-to-Worker proxy removed (Cloudflare error 1042).

---

## Decision Tree Panel (inline admin)

- Tab calls `switchTab('decisiontree')` → renders inline panel
- D3 force-directed graph (520px), lazy-loaded on first tab click
- Root post selector + depth 2/3/4 + Auto Hub + Reset zoom
- Directed arrows with link type colours
- Node click → info panel + Set as root
- `↗ Full page` link to `/ibelieve/decision-tree/`

---

## Trusted Device Auto-Login

### D1 trusted_devices (3 devices active)
```sql
token TEXT PRIMARY KEY,  -- 32-byte random hex
user_id TEXT,
username TEXT,
role TEXT,
device_name TEXT,        -- iPhone/iPad/Android/Mac/Windows
expires_at INTEGER       -- 90 days
```

### Flow
```
First login:  enter admin/password + ✅ Trust this device
              → Worker SHA-256 verify → issue token → localStorage
Next visit:   DOMContentLoaded → tryAutoLogin() → verify-device
              → skip login form → enter admin directly
Sign out:     DELETE /auth/trust-device → clear localStorage
```

---

## Bug Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| `+New` button unclickable | `notifLoad()` threw on tab switch, froze JS | `switchTab`: `.catch()` isolation |
| `notifOpenNew` JS error | No null guards | Wrapped in `try/catch` |
| Send 500 error | Worker-to-Worker HTTP blocked (CF 1042) | Direct LINE API call from forum Worker |
| CORS 405 on Edit | `PUT` missing from `Allow-Methods` | Added `PUT` to CORS header |

---

## Pending / Next Steps

- [ ] Trusted device management UI (list/revoke devices per user)
- [ ] Migrate KV post replies → D1 replies table
- [ ] Post embeddings + semantic search (Vectorize)
- [ ] Infinite scroll (replace Load More)
- [ ] `contradicts`/`expands` bias in Auto-Link prompt

---

*Generated: 2026-03-26 by Claude Sonnet 4.6*
