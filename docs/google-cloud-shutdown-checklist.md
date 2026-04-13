# Google Cloud shutdown checklist for iCut / Creator

After deploying the Cloudflare-based media path, you can remove the old Google setup for this project.

## In the app / hosting environment

- [ ] Remove `GOOGLE_CLOUD_PROJECT`
- [ ] Remove `GOOGLE_CLOUD_LOCATION`
- [ ] Remove `GOOGLE_CLIENT_EMAIL`
- [ ] Remove `GOOGLE_PRIVATE_KEY`
- [ ] Remove `GOOGLE_CLOUD_STORAGE_BUCKET`
- [ ] Remove `VERTEX_IMAGE_MODEL`
- [ ] Remove `VERTEX_VIDEO_MODEL`
- [ ] Remove any leftover `GOOGLE_API_KEY`
- [ ] Replace them with the Cloudflare + OpenAI vars documented in `README.md`

## In Google Cloud

- [ ] Disable the Vertex AI API for the old project if nothing else uses it
- [ ] Delete the old service account used by this app
- [ ] Revoke and delete that service account key
- [ ] Empty and delete the old Cloud Storage bucket used for generated media
- [ ] Remove any IAM roles that were granted only for this app's media pipeline
- [ ] Check billing reports for any lingering Vertex AI or Cloud Storage usage after deploy

## Verification

- [ ] Generate a new image and confirm it lands in Cloudflare R2
- [ ] Open `/image` and `/video` gallery views and confirm metadata loads from D1
- [ ] Confirm no server environment for this app still contains Google Cloud credentials
- [ ] Confirm no new Google Cloud billing appears after rollout
