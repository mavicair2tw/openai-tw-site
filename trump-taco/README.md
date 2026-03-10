# Trump TACO Report

A Next.js + Tailwind dashboard backed by a lightweight FastAPI service. Instead of storing statements in a database, the backend mirrors the latest content from `https://openai-tw.com/toao/`, analyzes tone/market factors, and exposes the same reporting endpoints as the previous design.

## Stack

- Frontend: Next.js (App Router) + Tailwind CSS
- Backend: FastAPI + APScheduler + in-memory cache
- Deployment: Docker Compose (backend + frontend services)

## Running Locally

```bash
cd openai-tw-site-clone/trump-taco
docker-compose up --build
```

- Frontend UI: http://localhost:3000
- Backend docs: http://localhost:8000/docs

## Automation

- FastAPI launches APScheduler at startup.
- Every 4 hours the backend fetches the latest statements from `https://openai-tw.com/toao/` and refreshes the in-memory cache.
- From those events we compute tone tags, market scores, daily highlights, alerts (market_score ≥ 5), and a small narrative radar.

## Endpoints

- `GET /api/events/latest`
- `GET /api/events/timeline`
- `GET /api/reports/daily`
- `GET /api/alerts`
- `GET /api/narrative`

## Environment

- `TACO_ENDPOINT`: optional override for the upstream source (default `https://openai-tw.com/toao/`).
- `FETCH_INTERVAL_HOURS`: how often to refresh the cache (default `4`).
- `NEXT_PUBLIC_API_BASE_URL`: controls where the frontend points (defaults to `http://localhost:8000`).

## GitHub Actions

The repo ships a GitHub Actions workflow under `.github/workflows/deploy-trump-taco.yaml`.
It builds the backend Docker image, deploys it to Render via `render-deploy`, and builds the Next.js frontend before deploying to Vercel.
Provide the following secrets before the workflow runs: `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Trigger the workflow by pushing to `main` or using `workflow_dispatch`.
