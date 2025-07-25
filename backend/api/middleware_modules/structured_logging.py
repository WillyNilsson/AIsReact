"""
Structured logging middleware for API requests.
"""

import logging
import time
from typing import Optional

from api.logging_config import log_api_error, log_api_request, log_slow_request
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("api")


class StructuredLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log all API requests with structured data.

    This middleware:
    - Logs all incoming requests with metadata
    - Tracks request duration
    - Logs slow requests
    - Captures errors with context
    """

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Record request start time."""
        request._start_time = time.time()
        return None

    def process_response(
        self, request: HttpRequest, response: HttpResponse
    ) -> HttpResponse:
        """Log request completion with metrics."""
        # Calculate request duration
        duration = None
        if hasattr(request, "_start_time"):
            duration = time.time() - request._start_time

            # Log slow requests
            if duration > 2.0:  # 2 seconds threshold
                log_slow_request(
                    path=request.path,
                    method=request.method,
                    duration=duration,
                    status_code=response.status_code,
                    request_id=getattr(request, "id", None),
                )

        # Log all API requests
        if request.path.startswith("/api/"):
            log_api_request(
                request=request,
                response_time=duration,
                status_code=response.status_code,
            )

        return response

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> Optional[HttpResponse]:
        """Log exceptions with request context."""
        # Calculate duration if possible
        duration = None
        if hasattr(request, "_start_time"):
            duration = time.time() - request._start_time

        # Log the error with context
        log_api_error(request, exception)

        # Log if it was also a slow request
        if duration and duration > 2.0:
            log_slow_request(
                path=request.path,
                method=request.method,
                duration=duration,
                status_code=500,
                error_type=type(exception).__name__,
            )

        # Let Django handle the exception
        return None


class HealthCheckLoggingMiddleware(MiddlewareMixin):
    """
    Separate middleware to reduce noise from health check endpoints.
    """

    # Paths to exclude from detailed logging
    EXCLUDED_PATHS = {
        "/health/",
        "/api/health/",
        "/readiness/",
        "/api/readiness/",
        "/liveness/",
        "/api/liveness/",
    }

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Mark health check requests."""
        if request.path in self.EXCLUDED_PATHS:
            request._is_health_check = True
        return None

    def process_response(
        self, request: HttpRequest, response: HttpResponse
    ) -> HttpResponse:
        """Log health checks at debug level only."""
        if getattr(request, "_is_health_check", False) and response.status_code == 200:
            # Log at debug level to reduce noise
            logger.debug(
                f"Health check: {request.path}",
                extra={
                    "event_type": "health_check",
                    "path": request.path,
                    "status_code": response.status_code,
                    "request_id": getattr(request, "id", None),
                },
            )
        return response
