from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Iterable, List

from .core.config import settings
from .schemas import NarrativeRadar, TACOEventBase


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
    if any(word in quote.lower() for word in ["economy", "market", "stock", "jobs"]):
        score += 1
    if any(word in quote.lower() for word in ["crash", "sell", "risk", "war"]):
        score += 2
    if "big" in quote.lower() or "huge" in quote.lower():
        score += 1
    return min(score, 5)


def topic_from_quote(quote: str) -> str:
    keywords = {
        "economy": ["economy", "market", "jobs", "inflation"],
        "election": ["election", "vote", "ballot", "campaign"],
        "foreign policy": ["china", "russia", "nato", "asia"],
        "law & order": ["law", "justice", "crime", "court"],
    }
    text = quote.lower()
    for topic, terms in keywords.items():
        if any(term in text for term in terms):
            return topic
    return "general"


def narrative_radar(today_events: Iterable[TACOEventBase], weekly_events: Iterable[TACOEventBase]) -> List[NarrativeRadar]:
    def topic_weights(events: Iterable[TACOEventBase]) -> Counter:
        counter = Counter()
        for event in events:
            counter[event.topic or "general"] += 1
        return counter

    today_counts = topic_weights(today_events)
    weekly_counts = topic_weights(weekly_events)
    radar = []
    topics = set(today_counts) | set(weekly_counts)
    for topic in topics:
        radar.append(
            NarrativeRadar(topic=topic, today_weight=today_counts.get(topic, 0), weekly_weight=weekly_counts.get(topic, 0))
        )
    return radar


def estimated_sentiment(events: Iterable[TACOEventBase]) -> str:
    tone_counter = Counter(event.tone for event in events if event.tone)
    if not tone_counter:
        return "mixed"
    return tone_counter.most_common(1)[0][0]


def build_report(events: Iterable[TACOEventBase]) -> tuple[str, List[str]]:
    sorted_events = sorted(events, key=lambda e: e.event_timestamp, reverse=True)
    summary = f"Tracking {len(events)} statements today."
    highlights = []
    top = sorted_events[:3]
    for event in top:
        highlights.append(f"{event.topic or 'general'} • {event.quote[:80]}... (score {event.market_score})")
    return summary, highlights
