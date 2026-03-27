# iBelieve v2.4 — Release Notes
**Date:** 2026-03-26 (Session 4 — Final)
**Branch:** `release/2026-03-26d-ibelieve-v2.4`
**Tag:** `v2.4.0-ibelieve`

---

## Infrastructure

| Resource | Details |
|---|---|
| openai-tw-forum Worker | LINE_TOKEN secret active |
| ibelieve-cron Worker | All 5 crons active |
| D1 ibelieve-db | `ba9845e6-1273-4976-aa58-74c5be3f2659` |
| D1 release_notes | 7 entries (incl. this one) |
| D1 posts | 82 |
| D1 trusted_devices | 3 |
| D1 notifications | 1 |

---

## Cron Pipeline (UTC) — Final State

| Time | Taiwan | Job | Status |
|---|---|---|---|
| 21:00 | 05:00 | runGenerate | ✅ Active |
| */30 | every 30m | runPublish | ✅ Active |
| 22:00 | 06:00 | runAutoLink | ✅ Active |
| 23:00 | 07:00 | runSnapshot | ✅ Active |
| 23:30 | 07:30 | runLinePush | ✅ Active |

---

## Audio Mutual Exclusion

### Rule: Only one audio source at a time

```
Spotify ▶️  →  stop Listen/Post TTS
Listen ▶️   →  stop Spotify
Post ▶️     →  stop Spotify
```

### Implementation

**Spotify → TTS (via postMessage listener):**
```javascript
window.addEventListener('message', e => {
  if (d.type === 'playback_update' && !d.payload.isPaused) {
    stopSpeech(); stopNarrationDisplay();
  }
});
```

**TTS → Spotify (`stopSpotify()`, 4 methods):**

| Method | Mechanism |
|---|---|
| 1 | `postMessage('{"command":"pause"}', 'https://open.spotify.com')` |
| 2 | `postMessage('{"command":"pause"}', '*')` |
| 3 | `postMessage({type:'playback',action:'pause'}, '*')` |
| 4 | `iframe.src = currentSrc + '?autoplay=0'` ← guaranteed stop |

Method 4 reloads the iframe with `autoplay=0`, ensuring 100% stop regardless of API support.

---

## Release Notes — Category Dropdown

### Search bar (right of Date field)
```
[Keyword] [Date] [Category ▾] [Search] [+ New]
                  All Categories
                  Summary
                  Release Notes
                  Bug Report
                  Notification
                  Post
```

### Form (4-column grid)
```
[Version] [Release Date] [Category ▾] [Tags]
                          + New category... → [text input]
[Title]
[Content (Markdown)]
[Save] [Cancel]
```

- Category auto-prepended to tags array on save
- Edit mode: auto-detects category from existing tags
- `+ New category...` → inline text input → adds to both dropdowns

---

## AI Report Auto-Save

When **Generate Report** completes in Cloud Map:
1. `cmSaveReportAsNote(text)` called silently in background
2. Creates D1 release note:
   - `version: "summary"`
   - `title: "Cloud Map Summary — 2026-03-26 15:42"` (Taiwan time)
   - `tags: ["summary", "cloud-map", "ai-report"]`
3. Status: `"Report generated & saved to Release Notes ✦"`
4. No overwrite — each report unique timestamped entry
5. Errors swallowed silently (main report unaffected)

Search in Release Notes tab: filter by **Category = Summary**

---

## Today's Complete Feature Summary (v2.1 → v2.4)

| Version | Key Features |
|---|---|
| v2.1 | D1 pagination, TTS word highlight, mobile fixes, i18n dropdown |
| v2.2 | Trusted device login, loading overlay, Decision Tree admin tab |
| v2.3 | LINE notifications CRUD, cron pipeline complete, inline admin panels |
| **v2.4** | **Audio exclusion, category dropdown, AI report auto-save** |

---

## Pending / Next Steps

- [ ] Trusted device management UI (list/revoke devices)
- [ ] KV post replies → D1 replies table migration
- [ ] Post embeddings + semantic search (Vectorize)
- [ ] Infinite scroll (replace Load More)
- [ ] `contradicts`/`expands` bias in Auto-Link prompt (~82% related)

---

*Generated: 2026-03-26 by Claude Sonnet 4.6*
