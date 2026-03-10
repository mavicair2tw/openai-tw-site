from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class TACOEventBase(BaseModel):
    event_timestamp: datetime
    source: str
    quote: str
    paraphrase: Optional[str]
    topic: Optional[str]
    tone: Optional[str]
    market_score: Optional[int]


class TACOEventCreate(TACOEventBase):
    pass


class TACOEventOut(TACOEventBase):
    id: int

    class Config:
        orm_mode = True


class DailyReportOut(BaseModel):
    id: int
    report_date: datetime
    summary: str
    highlights: List[str] = Field(default_factory=list)

    class Config:
        orm_mode = True


class NarrativeRadar(BaseModel):
    topic: str
    today_weight: float
    weekly_weight: float


class MarketAlert(BaseModel):
    id: int
    quote: str
    market_score: int
