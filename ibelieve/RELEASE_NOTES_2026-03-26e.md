# iBelieve v2.5 — Release Notes
**Date:** 2026-03-26 (Session 5)
**Branch:** `release/2026-03-26e-ibelieve-v2.5`
**Tag:** `v2.5.0-ibelieve`

---

## Infrastructure

| Resource | Details |
|---|---|
| openai-tw-forum Worker | LINE_TOKEN active, notifications CRUD |
| ibelieve-cron Worker | 5 crons active |
| D1 ibelieve-db | `ba9845e6-1273-4976-aa58-74c5be3f2659` |
| D1 tables | 15 |
| D1 posts | 82 · release_notes: 8 · notifications: 1 · trusted_devices: 3 |

---

## Cron Pipeline (UTC) — Final State ✅

| Time | Taiwan | Job |
|---|---|---|
| 21:00 | 05:00 | runGenerate — Claude Haiku → 5 posts+replies → QUEUE |
| */30 | — | runPublish — QUEUE → FORUM_KV |
| 22:00 | 06:00 | runAutoLink — AI semantic links |
| 23:00 | 07:00 | runSnapshot — graph → D1 |
| 23:30 | 07:30 | runLinePush — LINE daily report |

---

## Knowledge Graph Modal (Full View)

### Before
```
"Full view →"  →  href="./decision-tree/"  →  full page navigation ❌
```

### After
```
"Full view →"  →  openGraphModal()  →  inline modal overlay ✅
```

### Implementation
```javascript
function openGraphModal() {
  modal.style.display = 'flex';        // overlay appears
  document.body.style.overflow = 'hidden'; // no bg scroll
  gmInit();                            // BFS + D3 render
}
function closeGraphModal() {
  modal.style.display = 'none';
  document.body.style.overflow = '';
  gmSim.stop();
}
// 3 dismiss methods:
document.addEventListener('click', e => { if(e.target===modal) closeGraphModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') closeGraphModal(); });
// + ✕ button
```

### Modal layout
```
┌──────────────────────────────────────────────────────┐
│ ✦ KNOWLEDGE GRAPH — FULL VIEW  [D3▾][✦Hub][⊡Reset][✕]│
│ ●supports ●contradicts ●expands ●inspires ●related   │
│                                        42 nodes·153 links│
├──────────────────────────────────────────────────────┤
│                                                      │
│         Full D3 force-directed graph                 │
│    ○────●────○  (drag · zoom · click · dblclick)    │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Helix-3 · topic: discovery · links: 8 · "Discovery…"│
└──────────────────────────────────────────────────────┘
```

### Graph features
- BFS from root node (includes backlinks for richer traversal)
- Depth: 2 / 3 / 4 / All
- Node radius: root=22, others scaled by degree+depth
- Opacity fades with depth
- Directed arrows per link type
- Single click → info bar; double click → set as root
- D3 simulation stops after 4s (perf)
- `scaleExtent([0.05, 5])` for zoom

---

## Audio Mutual Exclusion

### stopSpotify() — 4 fallback methods
```javascript
// Method 1: exact origin
iframe.contentWindow.postMessage('{"command":"pause"}', 'https://open.spotify.com');
// Method 2: wildcard
iframe.contentWindow.postMessage('{"command":"pause"}', '*');
// Method 3: alternative format
iframe.contentWindow.postMessage(JSON.stringify({type:'playback',action:'pause'}), '*');
// Method 4: reload with autoplay=0 (guaranteed)
iframe.src = currentSrc + '?autoplay=0';
```

### Rule
```
Spotify ▶  →  stopSpeech() + stopNarration()
Listen ▶   →  stopSpotify()
Post ▶     →  stopSpotify()
```

---

## Release Notes Category

Search bar: `[Keyword] [Date] [Category ▾] [Search] [+ New]`

Form (4-col): `[Version] [Date] [Category ▾] [Tags]`

Categories: Summary · Release Notes · Bug Report · Notification · Post · +custom

---

## Full Session History (2026-03-26)

| Tag | Features |
|---|---|
| v2.1.0 | D1 pagination · TTS highlight · Mobile · i18n |
| v2.2.0 | Trusted Device · Loading overlay · Decision Tree tab |
| v2.3.0 | LINE notifications · Cron complete · Inline admin |
| v2.4.0 | Audio exclusion · Category dropdown · AI report save |
| **v2.5.0** | **Knowledge Graph modal · Audio hardened** |

---

*Generated: 2026-03-26 by Claude Sonnet 4.6*
