"""World Air Quality Index (WAQI) geo-query client.

Pulls latest AQI + PM2.5 by lat/lng from the nearest monitoring station.

Free token signup: https://aqicn.org/data-platform/token/
Endpoint:          https://api.waqi.info/feed/geo:{lat};{lng}/?token={...}

Korean / Chinese / Japanese buyers care heavily about PM2.5 — for Bangkok
specifically, AQI varies meaningfully by district (Sukhumvit lower vs.
Bang Sue / Hua Lamphong higher). Surfacing per-condo AQI is a real
differentiator for the foreign-buyer market.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from loguru import logger

BASE = "https://api.waqi.info/feed"


def _token() -> str:
    k = os.environ.get("WAQI_TOKEN", "").strip()
    if not k:
        raise RuntimeError(
            "WAQI_TOKEN not set in env. Get a free token at "
            "https://aqicn.org/data-platform/token/"
        )
    return k


def fetch_aqi(
    client: httpx.Client,
    lat: float,
    lng: float,
) -> dict[str, Any] | None:
    """Return {aqi, pm25, station_name, station_lat, station_lng, dominantpol}
    for the nearest WAQI monitoring station to (lat, lng). None on failure or
    if no station is reachable for that coordinate.
    """
    url = f"{BASE}/geo:{lat:.6f};{lng:.6f}/?token={_token()}"
    try:
        r = client.get(url, timeout=15)
    except httpx.HTTPError as e:
        logger.debug(f"[waqi] http error at ({lat},{lng}): {e}")
        return None
    if r.status_code != 200:
        logger.debug(f"[waqi] {r.status_code} at ({lat},{lng}): {r.text[:120]}")
        return None
    payload = r.json()
    if payload.get("status") != "ok":
        return None
    data = payload.get("data") or {}
    aqi = data.get("aqi")
    if aqi == "-" or aqi is None:
        return None
    iaqi = data.get("iaqi") or {}
    pm25_obj = iaqi.get("pm25") or {}
    pm25 = pm25_obj.get("v")
    city = data.get("city") or {}
    geo = city.get("geo") or [None, None]
    return {
        "aqi": int(aqi) if isinstance(aqi, (int, float)) else None,
        "pm25": float(pm25) if isinstance(pm25, (int, float)) else None,
        "station_name": city.get("name"),
        "station_lat": geo[0] if len(geo) >= 1 else None,
        "station_lng": geo[1] if len(geo) >= 2 else None,
        "dominantpol": data.get("dominentpol"),
        "url": city.get("url"),
    }
