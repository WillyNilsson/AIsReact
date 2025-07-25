"""
Request ID utilities for debugging and tracing.
"""

import threading
import uuid
from typing import Any, Dict, Optional

import httpx
import requests
from django.http import HttpRequest

# Thread-local storage for request context
_request_context = threading.local()


def generate_request_id() -> str:
    """Generate a new request ID."""
    return str(uuid.uuid4())


def get_current_request_id() -> Optional[str]:
    """Get the current request ID from thread-local storage."""
    return getattr(_request_context, "request_id", None)


def set_current_request_id(request_id: str) -> None:
    """Set the current request ID in thread-local storage."""
    _request_context.request_id = request_id


def clear_current_request_id() -> None:
    """Clear the current request ID from thread-local storage."""
    if hasattr(_request_context, "request_id"):
        delattr(_request_context, "request_id")


class RequestIDPropagator:
    """
    Propagate request ID to outgoing HTTP requests.

    This can be used as a context manager or decorator to ensure
    request IDs are included in all outgoing HTTP requests.
    """

    def __init__(self, request_id: Optional[str] = None):
        self.request_id = request_id or get_current_request_id()

    def __enter__(self):
        """Set up request ID propagation."""
        if self.request_id:
            # Monkey-patch requests library
            self._patch_requests()
            # Monkey-patch httpx library
            self._patch_httpx()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up patches."""
        # Restore original methods
        if hasattr(self, "_original_requests_request"):
            requests.Session.request = self._original_requests_request
        if hasattr(self, "_original_httpx_request"):
            httpx.Client.request = self._original_httpx_request

    def _patch_requests(self):
        """Patch requests library to include X-Request-ID header."""
        self._original_requests_request = requests.Session.request
        request_id = self.request_id

        def patched_request(session_self, method, url, **kwargs):
            headers = kwargs.get("headers", {})
            if "X-Request-ID" not in headers:
                headers["X-Request-ID"] = request_id
            kwargs["headers"] = headers
            return self._original_requests_request(session_self, method, url, **kwargs)

        requests.Session.request = patched_request

    def _patch_httpx(self):
        """Patch httpx library to include X-Request-ID header."""
        self._original_httpx_request = httpx.Client.request
        request_id = self.request_id

        def patched_request(client_self, method, url, **kwargs):
            headers = kwargs.get("headers", {})
            if "X-Request-ID" not in headers:
                headers["X-Request-ID"] = request_id
            kwargs["headers"] = headers
            return self._original_httpx_request(client_self, method, url, **kwargs)

        httpx.Client.request = patched_request


def add_request_id_header(
    headers: Dict[str, str], request_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Add X-Request-ID header to a headers dictionary.

    Args:
        headers: Existing headers dictionary
        request_id: Request ID to use (defaults to current thread's request ID)

    Returns:
        Updated headers dictionary
    """
    if request_id is None:
        request_id = get_current_request_id()

    if request_id and "X-Request-ID" not in headers:
        headers["X-Request-ID"] = request_id

    return headers


def extract_request_id(request: HttpRequest) -> Optional[str]:
    """
    Extract request ID from various sources.

    Checks in order:
    1. request.id attribute (set by middleware)
    2. X-Request-ID header
    3. X-Correlation-ID header (alternative standard)

    Args:
        request: Django HttpRequest object

    Returns:
        Request ID if found, None otherwise
    """
    # Check request attribute
    if hasattr(request, "id"):
        return request.id

    # Check headers
    request_id = request.META.get("HTTP_X_REQUEST_ID")
    if request_id:
        return request_id

    # Check alternative header
    correlation_id = request.META.get("HTTP_X_CORRELATION_ID")
    if correlation_id:
        return correlation_id

    return None


class RequestIDMiddleware:
    """
    Enhanced request ID middleware with debugging features.

    This is an alternative implementation with more features
    than the basic request_id.py middleware.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract or generate request ID
        request_id = extract_request_id(request)
        if not request_id:
            request_id = generate_request_id()

        # Set on request object
        request.id = request_id
        request.META["HTTP_X_REQUEST_ID"] = request_id

        # Set in thread-local storage
        set_current_request_id(request_id)

        try:
            # Process request with ID propagation
            with RequestIDPropagator(request_id):
                response = self.get_response(request)
        finally:
            # Clean up thread-local storage
            clear_current_request_id()

        # Add to response headers
        response["X-Request-ID"] = request_id

        # Add debug header in development
        from django.conf import settings

        if settings.DEBUG:
            response["X-Request-Processing-Time"] = str(
                getattr(request, "_request_time", 0)
            )

        return response


# Decorator for propagating request IDs
def propagate_request_id(func):
    """
    Decorator to ensure request ID is propagated in function calls.

    Usage:
        @propagate_request_id
        def call_external_api():
            response = requests.get('https://api.example.com/data')
            return response.json()
    """

    def wrapper(*args, **kwargs):
        with RequestIDPropagator():
            return func(*args, **kwargs)

    return wrapper
