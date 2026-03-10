from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class TACOEventOut(BaseModel):
    id: int
    event_timestamp: datetime
    source: str
    quote: str
    paraphrase: Optional[str]
    topic: Optional[str]
    tone: Optional[str]
    market_score: Optional[int]


class DailyReportOut(BaseModel):
    id: int
    report_date: datetime
    summary: str
    highlights: List[str]


class NarrativeRadar(BaseModel):
    topic: str
    today_weight: float
    weekly_weight: float


class MarketAlert(BaseModel):
    id: int
    quote: str
    market_score: int
