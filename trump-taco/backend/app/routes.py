from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import crud, models, schemas, services
from .database import get_session

router = APIRouter()


@router.post("/api/events", response_model=schemas.TACOEventOut)
async def ingest_event(event: schemas.TACOEventCreate, session: AsyncSession = Depends(get_session)):
    return await crud.create_event(session, event)


@router.get("/api/events/latest", response_model=List[schemas.TACOEventOut])
async def latest_events(session: AsyncSession = Depends(get_session)):
    events = await crud.list_events(session, limit=10)
    return events


@router.get("/api/events/timeline", response_model=List[schemas.TACOEventOut])
async def timeline(session: AsyncSession = Depends(get_session)):
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    events = await crud.events_between(session, start, end)
    return events


@router.get("/api/reports/daily", response_model=List[schemas.DailyReportOut])
async def get_daily_reports(session: AsyncSession = Depends(get_session)):
    stmt = select(models.DailyReport).order_by(models.DailyReport.report_date.desc()).limit(5)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/api/alerts", response_model=List[schemas.MarketAlert])
async def alerts(session: AsyncSession = Depends(get_session)):
    events = await crud.alert_events(session)
    return [schemas.MarketAlert(id=evt.id, quote=evt.quote, market_score=evt.market_score or 0) for evt in events]


@router.get("/api/narrative", response_model=List[schemas.NarrativeRadar])
async def narrative(session: AsyncSession = Depends(get_session)):
    now = datetime.utcnow()
    today_events = await crud.events_between(session, now - timedelta(days=1), now)
    week_events = await crud.events_between(session, now - timedelta(days=7), now)
    return services.narrative_radar(today_events, week_events)
