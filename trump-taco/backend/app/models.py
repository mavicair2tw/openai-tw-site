from __future__ import annotations

from sqlalchemy import Column, Integer, String, TIMESTAMP, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase


class Base(DeclarativeBase):
    pass


class TACOEvent(Base):
    __tablename__ = "taco_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_timestamp: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    paraphrase: Mapped[str] = mapped_column(Text, nullable=True)
    topic: Mapped[str] = mapped_column(String(120), nullable=True)
    tone: Mapped[str] = mapped_column(String(64), nullable=True)
    market_score: Mapped[int] = mapped_column(Integer, default=1)
    metadata: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_date: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    highlights: Mapped[list] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
