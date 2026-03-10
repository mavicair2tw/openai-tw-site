from __future__ import annotations

from fastapi import APIRouter

from .cache import daily_reports, latest_events, market_alerts, narrative_radar, timeline_events

router = APIRouter()


@router.get("/api/events/latest")
async def latest_events_endpoint():
    return latest_events


@router.get("/api/events/timeline")
async def timeline_endpoint():
    return timeline_events


@router.get("/api/reports/daily")
async def daily_reports_endpoint():
    return daily_reports


@router.get("/api/alerts")
async def alerts_endpoint():
    return market_alerts


@router.get("/api/narrative")
async def narrative_endpoint():
    return narrative_radar
