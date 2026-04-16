# Release Notes, 2026-04-15 Final

## Summary

This release finalized the shared-auth and admin-control flow across iCut and the iBelieve admin page.

Main outcomes:
- iCut now uses the shared auth database
- site access is enforced with explicit per-site roles
- admin user management now runs against the shared auth worker
- the Token dashboard now shows both legacy token usage and live iCut Grok spend
- the Token dashboard distinguishes token cost vs API cost and labels usage type

## Authentication and Access

### iCut
- Added a front-door sign-in gate before entering iCut.
- Protected app routes, API routes, and media routes.
- Added trusted-device login support and token fallback for unreliable browser cookie flows.
- Bound iCut to shared auth D1 (`ibelieve-db`) through `AUTH_DB`.

### Shared role model
- `status=active` is required
- no site role means no access
- `user` role can only access iCut / iBelieve when explicitly granted `user`
- `user` role cannot access admin
- `operator` / `admin` can access admin only when admin-site permission is explicitly granted

### Admin page account editor
- Can manage username, email, password, role, status, and site roles
- Site-role dropdowns now change based on the selected global role
- Invalid combinations are no longer offered in the UI
- Admin page shell now verifies shared admin permission before opening, so plain `user` accounts can no longer enter the admin UI and tabs

## Token Dashboard

### Data sources
The Token tab now merges two sources:
1. legacy token/session dashboard data for OpenAI-style token usage
2. live iCut D1-backed spend data for Grok image/video generation

### Grok spend
- Grok image/video generation cost is now recorded from xAI response metadata
- historical asset metadata is backfilled into the spend ledger
- Grok image/video rows show real cost even when token counts are not provided by xAI

### Dashboard improvements
- Provider filter added: `All / Grok / OpenAI / Google`
- Cost basis label added: `Token / API`
- Usage type label added: `LLM / Generation API / Speech API / Other API`
- Cost-only rows now show dashes instead of fake zero token counts

## Important Behavior Notes

- Grok image/video generation currently exposes cost, not token counts, so Input / Output / Total may be unavailable for those rows.
- Accounts with blank site roles now have no effective site access until explicit permissions are granted.
- GitHub Pages may briefly serve stale HTML after push. Cache-busting query strings can help immediately after deploy.

## Final Working URLs

- iCut production: `https://icut2.openai-tw.com/`
- iCut worker.dev: `https://icut-worker.googselect.workers.dev`
- Admin page: `https://openai-tw.com/ibelieve/admin.html`

## Final Freeze Points

### iCut worker repo
- commit: `2e60012` — `Enforce shared site role access rules`

### Admin page repo
- commit: `11f0b96` — `Match account editor to shared role rules`
- GitHub Pages main deploy commit: `d83ce89` — `Match account editor to shared role rules`

## Recommended Follow-up

1. Add a direct admin-only create-user endpoint.
2. Add a visible access audit for users with empty site roles.
3. Mirror the same shared access checks everywhere the old forum/iBelieve runtime still relies on older logic.
