"""
Logging configuration for the aisreact platform.
"""

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional


def get_logging_config(debug=False):
    """
    Get logging configuration dictionary with structured JSON logging.

    Args:
        debug: Whether to enable debug logging

    Returns:
        Dictionary suitable for Django's LOGGING setting
    """
    from api.logging_formatters import update_logging_config_with_context

    log_level = "DEBUG" if debug else "INFO"
    log_dir = Path("/var/log/aisreact")

    # Create log directory if it doesn't exist (and we have permissions)
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except (PermissionError, OSError):
        # Fall back to current directory
        log_dir = Path("logs")
        log_dir.mkdir(parents=True, exist_ok=True)

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "verbose": {
                "format": "[{levelname}] {asctime} [{name}] [{process:d}] [{thread:d}] {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "simple": {
                "format": "[{levelname}] {asctime} {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "json": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(funcName)s %(lineno)d",
                "rename_fields": {"asctime": "timestamp"},
                "static_fields": {"service": "aisreact-backend"},
            },
            "json_verbose": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(funcName)s %(lineno)d %(process)d %(thread)d",
                "rename_fields": {"asctime": "timestamp"},
                "static_fields": {"service": "aisreact-backend"},
            },
        },
        "filters": {
            "require_debug_false": {"()": "django.utils.log.RequireDebugFalse"},
            "require_debug_true": {"()": "django.utils.log.RequireDebugTrue"},
        },
        "handlers": {
            "console": {
                "level": "DEBUG",
                "class": "logging.StreamHandler",
                "formatter": "json" if not debug else "simple",
                "stream": sys.stdout,
            },
            "console_error": {
                "level": "ERROR",
                "class": "logging.StreamHandler",
                "formatter": "json_verbose" if not debug else "verbose",
                "stream": sys.stderr,
            },
            "file": {
                "level": "INFO",
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(log_dir / "app.log"),
                "maxBytes": 1024 * 1024 * 50,  # 50 MB
                "backupCount": 10,
                "formatter": "json_verbose",
                "encoding": "utf-8",
            },
            "error_file": {
                "level": "ERROR",
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(log_dir / "error.log"),
                "maxBytes": 1024 * 1024 * 50,  # 50 MB
                "backupCount": 10,
                "formatter": "json_verbose",
                "encoding": "utf-8",
            },
            "security_file": {
                "level": "INFO",
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(log_dir / "security.log"),
                "maxBytes": 1024 * 1024 * 50,  # 50 MB
                "backupCount": 10,
                "formatter": "json_verbose",
                "encoding": "utf-8",
            },
            "performance_file": {
                "level": "INFO",
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(log_dir / "performance.log"),
                "maxBytes": 1024 * 1024 * 50,  # 50 MB
                "backupCount": 10,
                "formatter": "json",  # JSON format for easier parsing
                "encoding": "utf-8",
            },
            "mail_admins": {
                "level": "ERROR",
                "filters": ["require_debug_false"],
                "class": "django.utils.log.AdminEmailHandler",
                "include_html": True,
            },
        },
        "loggers": {
            # Django loggers
            "django": {
                "handlers": ["console", "file"],
                "level": "INFO",
                "propagate": True,
            },
            "django.request": {
                "handlers": ["error_file", "mail_admins"],
                "level": "ERROR",
                "propagate": False,
            },
            "django.security": {
                "handlers": ["security_file", "console_error"],
                "level": "INFO",
                "propagate": False,
            },
            "django.db.backends": {
                "handlers": ["performance_file"] if not debug else ["console"],
                "level": "DEBUG" if debug else "INFO",
                "propagate": False,
            },
            # Application loggers
            "api": {
                "handlers": ["console", "file", "error_file"],
                "level": log_level,
                "propagate": False,
            },
            "api.services.error_logging": {
                "handlers": ["console_error", "error_file"],
                "level": "INFO",
                "propagate": False,
            },
            "api.security": {
                "handlers": ["security_file", "console_error"],
                "level": "INFO",
                "propagate": False,
            },
            "api.performance": {
                "handlers": ["performance_file"],
                "level": "INFO",
                "propagate": False,
            },
            "api.ai_providers": {
                "handlers": ["console", "file"],
                "level": log_level,
                "propagate": False,
            },
            # Celery/task loggers
            "celery": {
                "handlers": ["console", "file"],
                "level": "INFO",
                "propagate": False,
            },
            "api.tasks": {
                "handlers": ["console", "file"],
                "level": "INFO",
                "propagate": False,
            },
            # Root logger
            "": {
                "handlers": ["console", "file"],
                "level": log_level,
            },
        },
    }

    # Apply context-aware enhancements
    return update_logging_config_with_context(config)


# Security event logging functions
def log_security_event(event_type: str, message: str, **kwargs):
    """Log a security-related event with structured data."""
    security_logger = logging.getLogger("api.security")
    # Include all kwargs as extra fields for JSON logging
    extra = {"event_type": event_type, "event_category": "security", **kwargs}
    security_logger.info(message, extra=extra)


def log_authentication_failure(
    username: str, ip_address: str, reason: str, user_agent: Optional[str] = None
):
    """Log authentication failure with structured data."""
    log_security_event(
        "AUTH_FAILURE",
        f"Authentication failed for {username}",
        username=username,
        ip_address=ip_address,
        reason=reason,
        user_agent=user_agent,
        severity="warning",
    )


def log_authorization_failure(
    user_id: int, resource: str, action: str, required_permission: Optional[str] = None
):
    """Log authorization failure with structured data."""
    log_security_event(
        "AUTHZ_FAILURE",
        f"Authorization denied for user {user_id}",
        user_id=user_id,
        resource=resource,
        action=action,
        required_permission=required_permission,
        severity="warning",
    )


def log_suspicious_activity(
    user_id: Optional[int],
    ip_address: str,
    activity: str,
    details: Optional[Dict[str, Any]] = None,
):
    """Log suspicious activity with structured data."""
    log_security_event(
        "SUSPICIOUS_ACTIVITY",
        f"Suspicious activity detected: {activity}",
        user_id=user_id,
        ip_address=ip_address,
        activity=activity,
        details=details or {},
        severity="error",
    )


# Performance logging functions
def log_slow_query(
    query: str, duration: float, query_type: Optional[str] = None, **kwargs
):
    """Log slow database query with structured data."""
    perf_logger = logging.getLogger("api.performance")
    perf_logger.warning(
        "Slow query detected",
        extra={
            "event_type": "slow_query",
            "event_category": "performance",
            "query": query,
            "duration_seconds": duration,
            "query_type": query_type,
            "threshold_seconds": 1.0,
            **kwargs,
        },
    )


def log_slow_request(
    path: str, method: str, duration: float, status_code: Optional[int] = None, **kwargs
):
    """Log slow HTTP request with structured data."""
    perf_logger = logging.getLogger("api.performance")
    perf_logger.warning(
        "Slow request detected",
        extra={
            "event_type": "slow_request",
            "event_category": "performance",
            "path": path,
            "method": method,
            "duration_seconds": duration,
            "status_code": status_code,
            "threshold_seconds": 2.0,
            **kwargs,
        },
    )


# Utility functions for structured logging
def get_request_context(request) -> Dict[str, Any]:
    """Extract context from Django request for structured logging."""
    from django.http import HttpRequest

    context = {
        "path": request.path,
        "method": request.method,
        "ip_address": get_client_ip(request),
        "user_agent": request.META.get("HTTP_USER_AGENT", ""),
    }

    # Add request ID if available
    if hasattr(request, "id"):
        context["request_id"] = request.id

    # Add user info if authenticated
    if hasattr(request, "user") and request.user.is_authenticated:
        context["user_id"] = request.user.id
        context["username"] = request.user.username

    return context


def get_client_ip(request) -> str:
    """Get client IP address from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR", "")
    return ip


def log_api_request(
    request, response_time: Optional[float] = None, status_code: Optional[int] = None
):
    """Log API request with structured data."""
    api_logger = logging.getLogger("api")

    context = get_request_context(request)
    context.update(
        {
            "event_type": "api_request",
            "event_category": "request",
            "response_time_seconds": response_time,
            "status_code": status_code,
        }
    )

    api_logger.info(f"{request.method} {request.path}", extra=context)


def log_api_error(request, error: Exception, status_code: int = 500):
    """Log API error with structured data."""
    api_logger = logging.getLogger("api")

    context = get_request_context(request)
    context.update(
        {
            "event_type": "api_error",
            "event_category": "error",
            "error_type": type(error).__name__,
            "error_message": str(error),
            "status_code": status_code,
        }
    )

    api_logger.error(f"API error: {type(error).__name__}", extra=context, exc_info=True)
