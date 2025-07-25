"""
Request ID middleware for tracking requests through the system.
"""

import logging
import uuid

from api.logging_formatters import clear_request_context, set_request_context

logger = logging.getLogger(__name__)


class RequestIdMiddleware:
    """
    Middleware that adds a unique request ID to each request.
    This helps with tracking requests through logs and error reports.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if request ID was provided in headers (from load balancer/proxy)
        request_id = request.META.get("HTTP_X_REQUEST_ID")

        # Generate new ID if not provided
        if not request_id:
            request_id = str(uuid.uuid4())

        # Store request ID on the request object
        request.id = request_id
        request.META["HTTP_X_REQUEST_ID"] = request_id

        # Add request ID to logging context
        set_request_context(
            request_id=request_id,
            user_id=(
                request.user.id
                if hasattr(request, "user") and request.user.is_authenticated
                else None
            ),
            path=request.path,
            method=request.method,
        )

        try:
            # Process the request
            response = self.get_response(request)

            # Add request ID to response headers
            response["X-Request-ID"] = request_id

            return response
        finally:
            # Clear the logging context
            clear_request_context()
