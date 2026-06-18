"""Rotating proxy pool shared across scrapers that hit per-IP rate-limited
targets (Google, etc.).

Reads PROXY_URLS from the environment — a comma- or whitespace-separated list
of full proxy URLs, e.g.

    PROXY_URLS=http://user:pass@host1:8000,http://user:pass@host2:8000

Format-agnostic: whatever httpx accepts as a `proxy=` value works here
(http://, https://, socks5://). SOCKS requires the `socksio` extra
(`pip install "httpx[socks]"`) — plain http(s) proxies need nothing extra.

The pool hands out proxies round-robin and quarantines ones that fail
repeatedly, so a dead VPN endpoint stops poisoning the run instead of eating
every retry. Thread-safe — built for ThreadPoolExecutor fan-out.
"""
from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

from loguru import logger


@dataclass
class _Endpoint:
    url: str
    fails: int = 0           # consecutive failures
    dead_until: float = 0.0  # epoch seconds; > now means quarantined


def _mask(url: str) -> str:
    """Hide credentials when logging a proxy URL.
    http://user:pass@host:port -> http://***@host:port"""
    if "@" not in url:
        return url
    sep = url.find("://")
    head = url[: sep + 3] if sep != -1 else ""
    return head + "***@" + url.split("@", 1)[1]


class ProxyPool:
    """Round-robin pool with per-endpoint failure quarantine."""

    # Quarantine a proxy after this many consecutive failures...
    MAX_CONSECUTIVE_FAILS = 3
    # ...for this many seconds before giving it another chance.
    QUARANTINE_S = 120.0

    def __init__(self, urls: list[str]):
        if not urls:
            raise ValueError("ProxyPool needs at least one proxy URL")
        self._eps = [_Endpoint(u) for u in urls]
        self._idx = 0
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls, var: str = "PROXY_URLS") -> "ProxyPool":
        raw = os.environ.get(var, "")
        urls = [u.strip() for u in raw.replace("\n", ",").split(",") if u.strip()]
        if not urls:
            raise RuntimeError(
                f"{var} not set / empty. Put your proxy URLs there, "
                f"comma-separated (e.g. http://user:pass@host:port,...)."
            )
        logger.info(f"ProxyPool: loaded {len(urls)} proxies from {var}")
        return cls(urls)

    def __len__(self) -> int:
        return len(self._eps)

    def acquire(self) -> str:
        """Return the next live proxy URL (round-robin, skipping quarantined
        ones). If every proxy is quarantined, return the one closest to coming
        back — better to retry a cooling-down proxy than to stall the run."""
        with self._lock:
            now = time.time()
            n = len(self._eps)
            best_dead: _Endpoint | None = None
            for _ in range(n):
                ep = self._eps[self._idx]
                self._idx = (self._idx + 1) % n
                if ep.dead_until <= now:
                    return ep.url
                if best_dead is None or ep.dead_until < best_dead.dead_until:
                    best_dead = ep
            logger.warning(
                "ProxyPool: all proxies quarantined — using least-cold one"
            )
            assert best_dead is not None  # n >= 1 guaranteed by __init__
            return best_dead.url

    def report(self, url: str, ok: bool) -> None:
        """Feed back the outcome of a request that used `url`. Resets the
        failure counter on success; quarantines after MAX_CONSECUTIVE_FAILS."""
        with self._lock:
            for ep in self._eps:
                if ep.url != url:
                    continue
                if ok:
                    ep.fails = 0
                    ep.dead_until = 0.0
                else:
                    ep.fails += 1
                    if ep.fails >= self.MAX_CONSECUTIVE_FAILS:
                        ep.dead_until = time.time() + self.QUARANTINE_S
                        logger.warning(
                            f"ProxyPool: quarantining {_mask(url)} for "
                            f"{self.QUARANTINE_S:.0f}s after {ep.fails} fails"
                        )
                return

    def live_count(self) -> int:
        """How many proxies are not currently quarantined."""
        now = time.time()
        with self._lock:
            return sum(1 for ep in self._eps if ep.dead_until <= now)
