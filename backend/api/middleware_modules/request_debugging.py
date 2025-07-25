"""
Request debugging middleware for enhanced request tracking.
"""

import json
import logging
import time

from api.logging_config import get_request_context
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("api.debug")


class RequestDebuggingMiddleware(MiddlewareMixin):
    """
    Enhanced debugging middleware that logs detailed request/response information.

    This middleware provides:
    - Detailed request logging with headers and body
    - Response time tracking
    - Request/response size tracking
    - Correlation with request IDs
    """

    # Headers to exclude from logging for security
    SENSITIVE_HEADERS = {
        "authorization",
        "cookie",
        "x-api-key",
        "x-auth-token",
        "x-csrf-token",
    }

    def process_request(self, request: HttpRequest) -> None:
        """Log detailed request information for debugging."""
        # Skip if not in debug mode or for health checks
        if not logger.isEnabledFor(logging.DEBUG):
            return

        if hasattr(request, "_is_health_check") and request._is_health_check:
            return

        # Record start time
        request._debug_start_time = time.time()

        # Get request context
        context = get_request_context(request)

        # Get sanitized headers
        headers = self._get_sanitized_headers(request)

        # Get request body (if applicable)
        body_info = self._get_body_info(request)

        # Log debug information
        logger.debug(
            "Request started",
            extra={
                **context,
                "event_type": "request_debug",
                "headers": headers,
                "query_params": dict(request.GET),
                **body_info,
            },
        )

    def process_response(
        self, request: HttpRequest, response: HttpResponse
    ) -> HttpResponse:
        """Log detailed response information for debugging."""
        # Skip if not in debug mode or for health checks
        if not logger.isEnabledFor(logging.DEBUG):
            return response

        if hasattr(request, "_is_health_check") and request._is_health_check:
            return response

        # Calculate response time
        duration = None
        if hasattr(request, "_debug_start_time"):
            duration = time.time() - request._debug_start_time

        # Get response size
        response_size = len(response.content) if hasattr(response, "content") else 0

        # Log debug information
        logger.debug(
            "Request completed",
            extra={
                "request_id": getattr(request, "id", None),
                "event_type": "response_debug",
                "status_code": response.status_code,
                "response_size_bytes": response_size,
                "duration_seconds": duration,
                "response_headers": dict(response.items()),
            },
        )

        return response

    def process_exception(self, request: HttpRequest, exception: Exception) -> None:
        """Log detailed exception information for debugging."""
        logger.debug(
            f"Request failed with {type(exception).__name__}",
            extra={
                "request_id": getattr(request, "id", None),
                "event_type": "exception_debug",
                "exception_type": type(exception).__name__,
                "exception_message": str(exception),
            },
            exc_info=True,
        )

    def _get_sanitized_headers(self, request: HttpRequest) -> dict:
        """Get request headers with sensitive values redacted."""
        headers = {}

        for header, value in request.META.items():
            if header.startswith("HTTP_"):
                # Convert META key to header name
                header_name = header[5:].replace("_", "-").lower()

                # Redact sensitive headers
                if header_name in self.SENSITIVE_HEADERS:
                    headers[header_name] = "[REDACTED]"
                else:
                    headers[header_name] = value

        return headers

    def _get_body_info(self, request: HttpRequest) -> dict:
        """Get request body information safely."""
        body_info = {}

        try:
            # Get content type
            content_type = request.content_type
            body_info["content_type"] = content_type

            # Get body size
            if hasattr(request, "body"):
                body_info["request_size_bytes"] = len(request.body)

            # Parse JSON body if applicable
            if content_type == "application/json" and hasattr(request, "body"):
                try:
                    body_data = json.loads(request.body.decode("utf-8"))
                    # Redact sensitive fields
                    body_info["body_sample"] = self._redact_sensitive_data(body_data)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    body_info["body_parse_error"] = True
        except Exception as e:
            logger.warning(f"Error parsing request body: {e}")

        return body_info

    def _redact_sensitive_data(
        self, data: dict, max_depth: int = 3, current_depth: int = 0
    ) -> dict:
        """Redact sensitive fields from data."""
        if current_depth >= max_depth:
            return {"_truncated": True}

        if not isinstance(data, dict):
            return data

        sensitive_fields = {
            "password",
            "token",
            "secret",
            "api_key",
            "credit_card",
            "ssn",
            "email",
            "phone",
            "address",
        }

        redacted = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in sensitive_fields):
                redacted[key] = "[REDACTED]"
            elif isinstance(value, dict):
                redacted[key] = self._redact_sensitive_data(
                    value, max_depth, current_depth + 1
                )
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                redacted[key] = [
                    self._redact_sensitive_data(item, max_depth, current_depth + 1)
                    for item in value[:3]
                ]  # Limit to first 3 items
            else:
                redacted[key] = value

        return redacted


class RequestIDHeaderMiddleware(MiddlewareMixin):
    """
    Middleware to ensure request ID is propagated to upstream services.

    This adds the X-Request-ID header to all outgoing HTTP requests
    made from views, ensuring request correlation across services.
    """

    def process_request(self, request: HttpRequest) -> None:
        """Store request ID for use in outgoing requests."""
        if hasattr(request, "id"):
            # Store in thread-local storage for use by HTTP clients
            import threading

            if not hasattr(threading.current_thread(), "request_id"):
                threading.current_thread().request_id = request.id
