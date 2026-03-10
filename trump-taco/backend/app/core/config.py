from __future__ import annotations

from typing import List

from pydantic import BaseSettings, PostgresDsn


class Settings(BaseSettings):
    database_url: PostgresDsn = "postgresql+asyncpg://postgres:postgres@db:5432/taco"
    fetch_interval_hours: int = 4
    report_topic_window_days: int = 7
    statement_sources: List[str] = [
        "https://openai-tw.com/toao/",
        "https://www.reuters.com/world/us/",
        "https://www.cnn.com/politics",
    ]
    tone_positive_keywords: List[str] = ["strong", "win", "success", "deal", "historic", "leading"]
    tone_negative_keywords: List[str] = ["fake", "enemy", "bad", "lose", "weak", "crisis"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
