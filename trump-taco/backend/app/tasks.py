from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List

import requests
from bs4 import BeautifulSoup

from . import crud, schemas, services
from .core.config import settings
from .database import AsyncSessionLocal

HEADERS = {"User-Agent": "Mozilla/5.0 (OpenClaw)"}


def parse_statements_from_html(body: str, source: str) -> List[str]:
    soup = BeautifulSoup(body, "html.parser")
    statements: List[str] = []
    for paragraph in soup.find_all("p"):
        text = paragraph.get_text(separator=" ").strip()
        if len(text) < 40:
            continue
        if "trump" not in text.lower() and "donald" not in text.lower():
            continue
        statements.append(text)
    return statements


def assemble_events() -> List[schemas.TACOEventCreate]:
    events: List[schemas.TACOEventCreate] = []
    now = datetime.now(timezone.utc)
    for source in settings.statement_sources:
        try:
            resp = requests.get(source, headers=HEADERS, timeout=12)
            resp.raise_for_status()
        except Exception:
            continue
        quotes = parse_statements_from_html(resp.text, source)
        for quote in quotes[:3]:
            topic = services.topic_from_quote(quote)
            tone = services.analyze_tone(quote)
            score = services.market_score(quote)
            paraphrase = services.synthesize_paraphrase(quote)
            events.append(
                schemas.TACOEventCreate(
                    event_timestamp=now,
                    source=source,
                    quote=quote,
                    paraphrase=paraphrase,
                    topic=topic,
                    tone=tone,
                    market_score=score,
                )
            )
    return events


async def fetch_and_store_events() -> None:
    statements = await asyncio.to_thread(assemble_events)
    if not statements:
        return
    async with AsyncSessionLocal() as session:
        for event in statements:
            await crud.create_event(session, event)


async def daily_report_job() -> None:
    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=1)
        todays = await crud.events_between(session, start, now)
        if not todays:
            return
        summary, highlights = services.build_report(todays)
        await crud.create_daily_report(session, summary, highlights)


async def narrative_window_events(days: int) -> List[schemas.TACOEventCreate]:
    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)
        return await crud.events_between(session, start, now)
