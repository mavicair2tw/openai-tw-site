from __future__ import annotations

from typing import List

from pydantic import BaseSettings, HttpUrl


class Settings(BaseSettings):
    taco_endpoint: HttpUrl = "https://openai-tw.com/toao/"
    fetch_interval_hours: int = 4
    report_topic_window_days: int = 7
    tone_positive_keywords: List[str] = ["strong", "win", "success", "deal", "historic", "leading"]
    tone_negative_keywords: List[str] = ["fake", "enemy", "bad", "lose", "weak", "crisis"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
