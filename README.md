# openai-tw-site

Next.js app with image and video generation flows backed by Google APIs, with generated media files stored under `public/` and gallery metadata stored in Turso/LibSQL.

## Required environment variables

```bash
# Required for gallery metadata persistence
LIBSQL_URL=libsql://<database>-<org>.turso.io
LIBSQL_AUTH_TOKEN=<turso-auth-token>

# Or for local development with LibSQL/SQLite semantics
# LIBSQL_URL=file:./data/media-gallery.db
# LIBSQL_AUTH_TOKEN=

# Required for Gemini image and video generation
GEMINI_API_KEY=<google-api-key>
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_VIDEO_MODEL=veo-3.1-fast-generate-preview

# Optional Vertex AI fallback for image generation
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional delete controls, disabled by default
NEXT_PUBLIC_ALLOW_MEDIA_DELETE=false
MEDIA_DELETE_ENABLED=false
```

## Notes

- `LIBSQL_URL` is required. If it is missing, gallery load and persistence fail with a clear server error instead of falling back to local JSON.
- `LIBSQL_AUTH_TOKEN` is required for remote Turso/LibSQL URLs and can be omitted only for `file:` URLs.
- Generated image and video files are still written to `public/generated-images` and `public/generated-videos`. Only gallery metadata lives in the database.
- Deletion stays locked down by default. To fully enable it, set both `NEXT_PUBLIC_ALLOW_MEDIA_DELETE=true` and `MEDIA_DELETE_ENABLED=true`.

## Run locally

```bash
npm install
npm run build
npm run dev
```
