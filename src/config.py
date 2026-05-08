"""Centralised settings loaded from environment / .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_key: str
    google_places_api_key: str | None
    scrape_max_pages: int
    scrape_delay_min: float
    scrape_delay_max: float
    headless: bool
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            supabase_url=os.environ["SUPABASE_URL"],
            supabase_service_key=os.environ["SUPABASE_SERVICE_KEY"],
            google_places_api_key=os.environ.get("GOOGLE_PLACES_API_KEY") or None,
            scrape_max_pages=int(os.environ.get("SCRAPE_MAX_PAGES", "5")),
            scrape_delay_min=float(os.environ.get("SCRAPE_DELAY_MIN", "4")),
            scrape_delay_max=float(os.environ.get("SCRAPE_DELAY_MAX", "10")),
            headless=os.environ.get("HEADLESS", "true").lower() == "true",
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
