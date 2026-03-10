from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Iterable, List

from .core.config import settings
from .schemas import DailyReportOut, NarrativeRadar, MarketAlert, TACOEventOut


def synthesize_paraphrase(quote: str) -> str:
    return quote.replace("Trump", "the former president").strip()[:200]


def analyze_tone(quote: str) -> str:
    text = quote.lower()
    positive = sum(text.count(word) for word in settings.tone_positive_keywords)
    negative = sum(text.count(word) for word in settings.tone_negative_keywords)
    if positive > negative:
        return "optimistic"
    if negative > positive:
        return "alarmist"
    return "neutral"


def market_score(quote: str) -> int:
    score = 2
    lower = quote.lower()
    if any(word in lower for word in ["economy", "market", "stock", "jobs"]):
        score += 1
    if any(word in lower for word in ["crash", "sell", "risk", "war"]):
        score += 2
    if "big" in lower or "huge" in lower:
        score += 1
    return min(score, 5)


def topic_from_quote(quote: str) -> str:
    keywords = {
        "economy": ["economy", "market", "jobs", "inflation"],
        "election": ["election", "vote", "ballot", "campaign"],
        "foreign policy": ["china", "russia", "nato", "asia"],
        "law & order": ["law", "justice", "crime", "court"],
    }
    lower = quote.lower()
    for topic, terms in keywords.items():
        if any(term in lower for term in terms):
            return topic
    return "general"


def build_report(events: Iterable[TACOEventOut]) -> DailyReportOut:
    events_list = list(events)
    summary = f"Tracking {len(events_list)} statements this cycle."
    highlights = [
        f"{event.topic or 'general'} • {event.quote[:80]}... (score {event.market_score})"
        for event in events_list[:3]
    ]
    return DailyReportOut(
        id=0,
        report_date=datetime.now(timezone.utc),
        summary=summary,
        highlights=highlights,
    )


def narrative_radar(today: Iterable[TACOEventOut], weekly: Iterable[TACOEventOut]) -> List[NarrativeRadar]:
    def counter(events: Iterable[TACOEventOut]) -> Counter[str]:
        c = Counter()
        for event in events:
            c[event.topic or "general"] += 1
        return c

    today_counts = counter(today)
    weekly_counts = counter(weekly)
    topics = sorted(set(today_counts) | set(weekly_counts))
    return [
        NarrativeRadar(topic=topic, today_weight=today_counts.get(topic, 0), weekly_weight=weekly_counts.get(topic, 0))
        for topic in topics
    ]


def build_alerts(events: Iterable[TACOEventOut]) -> List[MarketAlert]:
    return [
        MarketAlert(id=event.id, quote=event.quote, market_score=event.market_score or 0)
        for event in events
        if (event.market_score or 0) >= 5
    ]
