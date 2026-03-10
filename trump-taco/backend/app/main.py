from __future__ import annotations

from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .core.config import settings
from . import models
from .database import engine
from .routes import router
from .tasks import fetch_and_store_events, daily_report_job

app = FastAPI(title="Trump TACO Report API")


@app.on_event("startup")
async def on_startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(fetch_and_store_events, "interval", hours=settings.fetch_interval_hours, next_run_time=None)
    scheduler.add_job(daily_report_job, "cron", hour=1)
    scheduler.start()
    app.state.scheduler = scheduler
    await fetch_and_store_events()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    scheduler: AsyncIOScheduler | None = app.state.scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


app.include_router(router)
