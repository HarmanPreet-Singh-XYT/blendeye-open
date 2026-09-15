"""Telemetry Middleware — Intercepts and records request throughput, HTTP status,
and response duration metrics for Prometheus and Grafana dashboards.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.observability import (
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_TOTAL,
    record_agentic_request,
)


class StudioTelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        endpoint = request.url.path
        method = request.method

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            duration = time.time() - start_time
            record_agentic_request(
                endpoint=endpoint,
                method=method,
                status_code=500,
                duration_sec=duration,
            )
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status="500").inc()
            raise

        duration = time.time() - start_time
        record_agentic_request(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration_sec=duration,
        )
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
        HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status=str(status_code)).inc()

        return response

