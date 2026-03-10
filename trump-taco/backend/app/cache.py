from __future__ import annotations

from typing import List

from .schemas import DailyReportOut, MarketAlert, NarrativeRadar, TACOEventOut

latest_events: List[TACOEventOut] = []
timeline_events: List[TACOEventOut] = []
daily_reports: List[DailyReportOut] = []
market_alerts: List[MarketAlert] = []
narrative_radar: List[NarrativeRadar] = []
