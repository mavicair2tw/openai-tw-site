from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from . import models, schemas


async def create_event(session: AsyncSession, event_data: schemas.TACOEventCreate) -> models.TACOEvent:
    obj = models.TACOEvent(**event_data.model_dump())
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def list_events(session: AsyncSession, limit: int = 10) -> List[models.TACOEvent]:
    stmt = select(models.TACOEvent).order_by(models.TACOEvent.event_timestamp.desc()).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()


async def events_between(session: AsyncSession, start: datetime, end: datetime) -> List[models.TACOEvent]:
    stmt = (
        select(models.TACOEvent)
        .where(models.TACOEvent.event_timestamp >= start)
        .where(models.TACOEvent.event_timestamp <= end)
        .order_by(models.TACOEvent.event_timestamp.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().all()


async def alert_events(session: AsyncSession) -> List[models.TACOEvent]:
    stmt = select(models.TACOEvent).where(models.TACOEvent.market_score >= 5).order_by(models.TACOEvent.event_timestamp.desc())
    result = await session.execute(stmt)
    return result.scalars().all()


async def create_daily_report(session: AsyncSession, summary: str, highlights: List[str]) -> models.DailyReport:
    report = models.DailyReport(summary=summary, highlights=highlights)
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def latest_report(session: AsyncSession) -> models.DailyReport | None:
    stmt = select(models.DailyReport).order_by(models.DailyReport.report_date.desc()).limit(1)
    result = await session.execute(stmt)
    return result.scalars().first()
