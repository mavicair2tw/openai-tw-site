from __future__ import annotations

from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .core.config import settings
from .routes import router
from .tasks import fetch_and_cache

app = FastAPI(title="Trump TACO Report API")


@app.on_event("startup")
async def on_startup() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(fetch_and_cache, "interval", hours=settings.fetch_interval_hours, next_run_time=None)
    scheduler.start()
    app.state.scheduler = scheduler
    await fetch_and_cache()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    scheduler: AsyncIOScheduler | None = app.state.scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


app.include_router(router)
