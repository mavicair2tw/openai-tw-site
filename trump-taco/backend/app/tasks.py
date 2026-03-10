from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import List

import requests
from bs4 import BeautifulSoup

from .cache import daily_reports, latest_events, market_alerts, narrative_radar, timeline_events
from .core.config import settings
from .schemas import TACOEventOut
from . import services

HEADERS = {"User-Agent": "Mozilla/5.0 (OpenClaw)"}
EVENT_LIMIT = 20


def parse_statements(body: str) -> List[str]:
    soup = BeautifulSoup(body, "html.parser")
    statements: List[str] = []
    for paragraph in soup.find_all("p"):
        text = paragraph.get_text(separator=" ").strip()
        if len(text) < 40:
            continue
        lowered = text.lower()
        if "trump" not in lowered and "donald" not in lowered:
            continue
        statements.append(text)
    return statements


def build_events() -> List[TACOEventOut]:
    events: List[TACOEventOut] = []
    try:
        resp = requests.get(str(settings.taco_endpoint), headers=HEADERS, timeout=12)
        resp.raise_for_status()
    except Exception:
        return events
    quotes = parse_statements(resp.text)
    now = datetime.now(timezone.utc)
    for idx, quote in enumerate(quotes[:EVENT_LIMIT], start=1):
        event = TACOEventOut(
            id=idx,
            event_timestamp=now,
            source=str(settings.taco_endpoint),
            quote=quote,
            paraphrase=services.synthesize_paraphrase(quote),
            topic=services.topic_from_quote(quote),
            tone=services.analyze_tone(quote),
            market_score=services.market_score(quote),
        )
        events.append(event)
    return events


def update_cache(events: List[TACOEventOut]) -> None:
    if not events:
        return
    latest_events.clear()
    latest_events.extend(events[:10])
    timeline_events.clear()
    timeline_events.extend(events)
    report = services.build_report(events)
    report.id = 1
    daily_reports.clear()
    daily_reports.append(report)
    market_alerts.clear()
    market_alerts.extend(services.build_alerts(events))
    narrative_radar.clear()
    narrative_radar.extend(services.narrative_radar(events, events))


async def fetch_and_cache() -> None:
    events = await asyncio.to_thread(build_events)
    update_cache(events)
