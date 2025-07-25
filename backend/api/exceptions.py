"""
Custom exception classes and handlers for the API.
"""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DatabaseError
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .services.error_logging import ErrorCategory, error_logger

logger = logging.getLogger(__name__)


class APIException(Exception):
    """Base exception class for API errors."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "A server error occurred."
    default_code = "error"

    def __init__(self, detail=None, code=None):
        if detail is not None:
            self.detail = detail
        else:
            self.detail = self.default_detail

        if code is not None:
            self.code = code
        else:
            self.code = self.default_code


class ValidationError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid input."
    default_code = "validation_error"


class NotFoundError(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."
    default_code = "not_found"


class PermissionDeniedError(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You do not have permission to perform this action."
    default_code = "permission_denied"


class AuthenticationError(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Authentication failed."
    default_code = "authentication_failed"


class ExternalServiceError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "External service is temporarily unavailable."
    default_code = "external_service_error"


class RateLimitError(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Rate limit exceeded. Please try again later."
    default_code = "rate_limit_exceeded"


def custom_exception_handler(exc, context):
    """
    Custom exception handler that formats all errors consistently.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # Handle throttling with custom message
    if isinstance(exc, Throttled):
        from .throttles import get_throttle_wait_message

        # Get the view and throttle instance
        view = context.get("view")
        if view and hasattr(view, "throttle_classes") and view.throttle_classes:
            # Find the throttle that triggered
            for throttle_class in view.throttle_classes:
                throttle = throttle_class()
                if not throttle.allow_request(context["request"], view):
                    wait_message = get_throttle_wait_message(throttle)
                    response.data = {
                        "error": {
                            "code": "rate_limit_exceeded",
                            "message": wait_message,
                        }
                    }
                    break
        else:
            # Fallback message
            wait = exc.wait
            if wait:
                wait_message = (
                    f"Too many requests. Please try again in {int(wait)} seconds."
                )
            else:
                wait_message = "Too many requests. Please try again later."
            response.data = {
                "error": {"code": "rate_limit_exceeded", "message": wait_message}
            }
        return response

    # If response is None, it's an unhandled exception
    if response is None:
        # Handle Django ValidationError
        if isinstance(exc, DjangoValidationError):
            data = {
                "error": {
                    "code": "validation_error",
                    "message": "Validation failed",
                    "details": (
                        exc.message_dict if hasattr(exc, "message_dict") else str(exc)
                    ),
                }
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)

        # Handle database errors
        elif isinstance(exc, DatabaseError):
            error_logger.log_error(
                exc,
                category=ErrorCategory.DATABASE,
                request=context.get("request"),
                extra={
                    "view": (
                        context.get("view").__class__.__name__
                        if context.get("view")
                        else None
                    )
                },
            )
            data = {
                "error": {
                    "code": "database_error",
                    "message": "A database error occurred. Please try again later.",
                }
            }
            return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Handle our custom API exceptions
        elif isinstance(exc, APIException):
            data = {"error": {"code": exc.code, "message": exc.detail}}
            return Response(data, status=exc.status_code)

        # Handle any other exception
        else:
            error_logger.log_error(
                exc,
                category=ErrorCategory.UNKNOWN,
                severity="critical",
                request=context.get("request"),
                extra={
                    "view": (
                        context.get("view").__class__.__name__
                        if context.get("view")
                        else None
                    )
                },
            )
            data = {
                "error": {
                    "code": "internal_server_error",
                    "message": "An unexpected error occurred.",
                }
            }
            return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Format the response data consistently
    if response is not None:
        custom_response_data = {
            "error": {"code": "api_error", "message": "Request failed"}
        }

        # Extract error details from DRF response
        if isinstance(response.data, dict):
            if "detail" in response.data:
                custom_response_data["error"]["message"] = response.data["detail"]
            elif "non_field_errors" in response.data:
                custom_response_data["error"]["message"] = response.data[
                    "non_field_errors"
                ][0]
            else:
                # Field-specific errors
                errors = {}
                for field, messages in response.data.items():
                    if isinstance(messages, list):
                        errors[field] = messages[0] if messages else "Invalid value"
                    else:
                        errors[field] = str(messages)
                custom_response_data["error"]["details"] = errors
                custom_response_data["error"]["message"] = "Validation failed"

        response.data = custom_response_data

    return response
