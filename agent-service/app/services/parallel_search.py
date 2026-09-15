"""Parallel Web Systems Service — High-performance web intelligence and search grounding.
Powers real-time location scouting, municipal permit lookups, soundstage specs,
and cinematic box office precedent research via the official `parallel-web` SDK.
Provides runtime Search API execution for the location-scouting agents.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from parallel import Parallel

from app.config import get_settings
from app.services.observability import (
    PARALLEL_SEARCH_LATENCY_SECONDS,
    PARALLEL_SEARCH_QUERIES_TOTAL,
)

logger = logging.getLogger(__name__)

# The Parallel SDK's own connect+read timeout can exceed the caller's
# patience (e.g. a FastAPI request already juggling an LLM call), and a
# hung Parallel call previously had no ceiling of its own here.
_REQUEST_TIMEOUT_SECONDS = 15.0

_parallel_client: Parallel | None = None


def get_parallel_client() -> Parallel | None:
    """Returns a singleton instance of the Parallel client if an API key is configured."""
    global _parallel_client
    if _parallel_client is not None:
        return _parallel_client

    settings = get_settings()
    api_key = settings.parallel_api_key or os.environ.get("PARALLEL_API_KEY", "")
    if not api_key:
        logger.warning("PARALLEL_API_KEY is not configured. Parallel search will be bypassed.")
        return None

    try:
        _parallel_client = Parallel(api_key=api_key, timeout=_REQUEST_TIMEOUT_SECONDS)
        logger.info("Parallel Web Systems client initialized successfully.")
        return _parallel_client
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to initialize Parallel client: %s", e)
        return None


def is_parallel_available() -> bool:
    """Cheap check for whether Parallel is configured (an API key is present
    and the client constructed OK), used to decide whether to fall back to
    Google Search grounding for a request. Does not make a network call —
    a configured-but-down Parallel API still returns True here; that failure
    mode is instead handled per-call by search_parallel returning [].
    """
    return get_parallel_client() is not None


def _search_parallel_sync(
    query: str,
    *,
    num_results: int,
    category: str,
) -> list[dict[str, Any]]:
    client = get_parallel_client()
    if not client:
        return []

    PARALLEL_SEARCH_QUERIES_TOTAL.labels(category=category).inc()
    _start_time = time.time()
    try:
        logger.info("Dispatching runtime search to Parallel API for query: '%s'", query)
        response = client.search(search_queries=[query])
        results: list[dict[str, Any]] = []

        raw_results = getattr(response, "results", None) or []
        for item in raw_results[:num_results]:
            url = getattr(item, "url", "")
            title = getattr(item, "title", "")
            publish_date = getattr(item, "publish_date", None)
            excerpts = getattr(item, "excerpts", []) or []

            results.append({
                "title": title.strip() if title else url,
                "url": url,
                "publish_date": publish_date,
                "excerpts": excerpts[:3],
                "source_engine": "parallel-web",
            })

        logger.info("Parallel API returned %d results for '%s'", len(results), query)
        return results

    except Exception as e:  # noqa: BLE001
        # Logged at warning (not debug) so a misconfigured key, rate limit,
        # or timeout is actually visible — the default root log level is
        # WARNING, so debug-level failures here were previously invisible
        # in production, making Parallel look like it was silently
        # returning nothing rather than erroring.
        logger.warning("Parallel API search failed for query '%s': %s", query, e)
        return []
    finally:
        PARALLEL_SEARCH_LATENCY_SECONDS.observe(time.time() - _start_time)


async def search_parallel(
    query: str,
    *,
    num_results: int = 5,
    category: str = "general",
) -> list[dict[str, Any]]:
    """Executes a real-time web search query using the official Parallel Search API.
    Returns normalized search result dictionaries containing title, url, excerpts, and publish_date.

    The Parallel SDK is synchronous; this runs it in a worker thread so a
    slow or hung Parallel call doesn't stall the FastAPI event loop (and
    every other in-flight request on this worker) for the duration of the
    HTTP round-trip.
    """
    return await asyncio.to_thread(_search_parallel_sync, query, num_results=num_results, category=category)


def _clean_location_query(name: str) -> str:
    """Strips city prefixes, dashes, and parentheticals to form a crisp search term."""
    if " — " in name:
        parts = name.split(" — ")
        name = parts[1] if len(parts) > 1 else parts[0]
    import re
    cleaned = re.sub(r"\(.*?\)", "", name)
    return " ".join(cleaned.split())[:80].strip()


async def search_filming_locations(
    location_name: str,
    region: str,
    category: str = "filming location",
) -> list[dict[str, Any]]:
    """Specialized helper to search real-world venues, film offices, and permit guidelines
    in the targeted region using Parallel Web Systems.
    """
    clean_name = _clean_location_query(location_name) or location_name
    query = f"{region} {clean_name} {category} film location permit".strip()
    return await search_parallel(query, num_results=4, category="location_scouting")

