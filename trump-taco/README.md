# Trump TACO Report

A Next.js + Tailwind dashboard with a FastAPI backend and PostgreSQL database. This project ingests statements attributed to Donald Trump from verified sources, scores tone + market impact, and surfaces alerts and narrative shifts.

## Stack

- Frontend: Next.js (App Router) + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + APScheduler
- Database: PostgreSQL
- Deployment: Docker Compose

## Running Locally

1. Start the stack:
   ```bash
   docker-compose up --build
   ```
2. Frontend: http://localhost:3000
3. Backend: http://localhost:8000

## Automation

- FastAPI launches an APScheduler instance that pulls statements every 4 hours and builds a daily report at 01:00 UTC.
- `backend/tasks.py` handles scraping, tone analysis, market scoring, and storing events.

## Endpoints

- `GET /api/events/latest`
- `GET /api/events/timeline`
- `GET /api/reports/daily`
- `GET /api/alerts`
- `GET /api/narrative`
- `POST /api/events`

## Environment

- `DATABASE_URL` should point at PostgreSQL (default `postgresql+asyncpg://postgres:postgres@db:5432/taco`).
- `NEXT_PUBLIC_API_BASE_URL` controls the backend URL reachable by the dashboard.
