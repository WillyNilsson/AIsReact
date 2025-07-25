"""
Centralized error logging service for the aisreact platform.

This service provides a consistent interface for logging errors throughout
the application, with support for structured logging, error categorization,
and integration with external error tracking services.
"""

import logging
import traceback
from contextlib import contextmanager
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional, Union

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest
from rest_framework.request import Request

# Configure structured logging
logger = logging.getLogger(__name__)


class ErrorContext:
    """Context information for error logging."""

    def __init__(
        self,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        url: Optional[str] = None,
        method: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.request_id = request_id
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.url = url
        self.method = method
        self.extra = extra or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for logging."""
        context = {
            "user_id": self.user_id,
            "username": self.username,
            "request_id": self.request_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "url": self.url,
            "method": self.method,
            "timestamp": datetime.utcnow().isoformat(),
        }
        context.update(self.extra)
        return {k: v for k, v in context.items() if v is not None}


class ErrorCategory:
    """Error categories for classification."""

    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    VALIDATION = "validation"
    DATABASE = "database"
    EXTERNAL_SERVICE = "external_service"
    AI_PROVIDER = "ai_provider"
    EMAIL = "email"
    FILE_UPLOAD = "file_upload"
    RATE_LIMIT = "rate_limit"
    CONFIGURATION = "configuration"
    UNKNOWN = "unknown"


class ErrorLogger:
    """Centralized error logging service."""

    def __init__(self):
        self.logger = logger
        self._sentry_enabled = False
        self._initialize_sentry()

    def _initialize_sentry(self):
        """Initialize Sentry if configured."""
        if hasattr(settings, "SENTRY_DSN") and settings.SENTRY_DSN:
            try:
                import sentry_sdk
                from sentry_sdk.integrations.django import DjangoIntegration
                from sentry_sdk.integrations.logging import LoggingIntegration

                sentry_logging = LoggingIntegration(
                    level=logging.INFO,  # Capture info and above as breadcrumbs
                    event_level=logging.ERROR,  # Send errors as events
                )

                sentry_sdk.init(
                    dsn=settings.SENTRY_DSN,
                    integrations=[
                        DjangoIntegration(),
                        sentry_logging,
                    ],
                    traces_sample_rate=getattr(
                        settings, "SENTRY_TRACES_SAMPLE_RATE", 0.1
                    ),
                    environment=getattr(settings, "ENVIRONMENT", "development"),
                    release=getattr(settings, "APP_VERSION", "unknown"),
                )
                self._sentry_enabled = True
                logger.info("Sentry error tracking initialized")
            except ImportError:
                logger.warning("Sentry SDK not installed, error tracking disabled")
            except Exception as e:
                logger.error(f"Failed to initialize Sentry: {str(e)}")

    def _extract_request_context(
        self, request: Optional[Union[HttpRequest, Request]]
    ) -> ErrorContext:
        """Extract context information from request."""
        if not request:
            return ErrorContext()

        # Handle DRF Request wrapper
        if isinstance(request, Request):
            django_request = request._request
        else:
            django_request = request

        # Extract user information
        user_id = None
        username = None
        if hasattr(request, "user") and not isinstance(request.user, AnonymousUser):
            user_id = request.user.id
            username = getattr(request.user, "username", None)

        # Extract request information
        ip_address = self._get_client_ip(django_request)
        user_agent = django_request.META.get("HTTP_USER_AGENT", "")
        url = django_request.build_absolute_uri()
        method = django_request.method
        request_id = django_request.META.get("HTTP_X_REQUEST_ID", "")

        return ErrorContext(
            user_id=user_id,
            username=username,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent,
            url=url,
            method=method,
        )

    def _get_client_ip(self, request: HttpRequest) -> str:
        """Get client IP address from request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR", "")
        return ip

    def log_error(
        self,
        error: Exception,
        category: str = ErrorCategory.UNKNOWN,
        severity: str = "error",
        request: Optional[Union[HttpRequest, Request]] = None,
        context: Optional[ErrorContext] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """
        Log an error with full context information.

        Args:
            error: The exception to log
            category: Error category for classification
            severity: Log level (debug, info, warning, error, critical)
            request: Optional HTTP request object
            context: Optional error context (will be extracted from request if
                not provided)
            extra: Additional context information
        """
        # Extract context from request if not provided
        if context is None and request is not None:
            context = self._extract_request_context(request)
        elif context is None:
            context = ErrorContext()

        # Add extra information to context
        if extra:
            context.extra.update(extra)

        # Build error data
        error_data = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "category": category,
            "traceback": traceback.format_exc(),
            "context": context.to_dict(),
        }

        # Log at appropriate level
        log_message = f"[{category}] {type(error).__name__}: {str(error)}"
        log_method = getattr(self.logger, severity, self.logger.error)
        log_method(log_message, extra={"error_data": error_data})

        # Send to Sentry if enabled
        if self._sentry_enabled and severity in ["error", "critical"]:
            try:
                import sentry_sdk

                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("error_category", category)
                    scope.set_context("error_context", context.to_dict())
                    if extra:
                        scope.set_context("extra", extra)
                    sentry_sdk.capture_exception(error)
            except Exception as e:
                self.logger.warning(f"Failed to send error to Sentry: {str(e)}")

    def log_warning(
        self,
        message: str,
        category: str = ErrorCategory.UNKNOWN,
        request: Optional[Union[HttpRequest, Request]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """Log a warning message with context."""
        context = self._extract_request_context(request) if request else ErrorContext()
        if extra:
            context.extra.update(extra)

        warning_data = {
            "message": message,
            "category": category,
            "context": context.to_dict(),
        }

        self.logger.warning(
            f"[{category}] {message}", extra={"warning_data": warning_data}
        )

    def log_info(
        self,
        message: str,
        category: str = ErrorCategory.UNKNOWN,
        request: Optional[Union[HttpRequest, Request]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """Log an info message with context."""
        context = self._extract_request_context(request) if request else ErrorContext()
        if extra:
            context.extra.update(extra)

        info_data = {
            "message": message,
            "category": category,
            "context": context.to_dict(),
        }

        self.logger.info(f"[{category}] {message}", extra={"info_data": info_data})

    @contextmanager
    def error_context(
        self,
        operation: str,
        category: str = ErrorCategory.UNKNOWN,
        request: Optional[Union[HttpRequest, Request]] = None,
        reraise: bool = True,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """
        Context manager for error handling with automatic logging.

        Usage:
            with error_logger.error_context(
                'user_registration', ErrorCategory.AUTHENTICATION
            ):
                # code that might raise exceptions
        """
        try:
            yield
        except Exception as e:
            self.log_error(
                error=e,
                category=category,
                request=request,
                extra={"operation": operation, **(extra or {})},
            )
            if reraise:
                raise

    def log_exception_decorator(
        self,
        category: str = ErrorCategory.UNKNOWN,
        severity: str = "error",
        reraise: bool = True,
    ):
        """
        Decorator for automatic exception logging.

        Usage:
            @error_logger.log_exception_decorator(category=ErrorCategory.DATABASE)
            def my_function():
                # function code
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    # Try to extract request from args
                    request = None
                    for arg in args:
                        if isinstance(arg, (HttpRequest, Request)):
                            request = arg
                            break

                    self.log_error(
                        error=e,
                        category=category,
                        severity=severity,
                        request=request,
                        extra={"function": func.__name__},
                    )
                    if reraise:
                        raise

            return wrapper

        return decorator


# Create singleton instance
error_logger = ErrorLogger()


# Convenience functions
def log_error(error: Exception, **kwargs):
    """Convenience function for logging errors."""
    error_logger.log_error(error, **kwargs)


def log_warning(message: str, **kwargs):
    """Convenience function for logging warnings."""
    error_logger.log_warning(message, **kwargs)


def log_info(message: str, **kwargs):
    """Convenience function for logging info."""
    error_logger.log_info(message, **kwargs)


def error_context(operation: str, **kwargs):
    """Convenience function for error context manager."""
    return error_logger.error_context(operation, **kwargs)


def log_exception(category: str = ErrorCategory.UNKNOWN, **kwargs):
    """Convenience decorator for exception logging."""
    return error_logger.log_exception_decorator(category, **kwargs)
