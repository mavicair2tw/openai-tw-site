# openai-tw-site

Next.js app with iCut / Creator image generation wired to OpenAI Images, generated media stored in Cloudflare R2, and media gallery metadata stored in Cloudflare D1.

## Required environment variables

```bash
# Required for image generation
OPENAI_API_KEY=<openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-1

# Required for Cloudflare D1 metadata storage
CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
CLOUDFLARE_API_TOKEN=<cloudflare-api-token>
CLOUDFLARE_D1_DATABASE_ID=<cloudflare-d1-database-id>

# Required for Cloudflare R2 media storage
CLOUDFLARE_R2_BUCKET=<r2-bucket-name>
CLOUDFLARE_R2_ACCESS_KEY_ID=<r2-access-key-id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://<public-media-host>

# Optional R2 override if you do not want the default account endpoint
# CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# Optional media prefix inside the bucket
# CLOUDFLARE_R2_PREFIX=media-gallery

# Optional delete controls, disabled by default
NEXT_PUBLIC_ALLOW_MEDIA_DELETE=false
MEDIA_DELETE_ENABLED=false
```

## Notes

- Image generation is now non-Google.
- Media files are now stored in Cloudflare R2.
- Media gallery metadata is now stored in Cloudflare D1.
- Video generation and image-to-video still need a replacement non-Google provider. The routes now fail explicitly instead of calling Google services.
- Deletion stays locked down by default. To fully enable it, set both `NEXT_PUBLIC_ALLOW_MEDIA_DELETE=true` and `MEDIA_DELETE_ENABLED=true`.
- See `docs/google-cloud-shutdown-checklist.md` for the concrete teardown steps after rollout.

## Run locally

```bash
npm install
npm run build
npm run dev
```
