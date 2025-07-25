"""
Custom logging formatters for structured logging.
"""

import json
import logging
import threading
from typing import Any, Dict

from pythonjsonlogger.json import JsonFormatter as BaseJsonFormatter

# Thread-local storage for request context
_request_context = threading.local()


def set_request_context(request_id: str, **kwargs):
    """Set request context for the current thread."""
    _request_context.request_id = request_id
    _request_context.extra = kwargs


def clear_request_context():
    """Clear request context for the current thread."""
    if hasattr(_request_context, "request_id"):
        delattr(_request_context, "request_id")
    if hasattr(_request_context, "extra"):
        delattr(_request_context, "extra")


class RequestAwareJsonFormatter(BaseJsonFormatter):
    """
    JSON formatter that includes request context.
    """

    def add_fields(
        self,
        log_record: Dict[str, Any],
        record: logging.LogRecord,
        message_dict: Dict[str, Any],
    ) -> None:
        """Add custom fields to log record."""
        super().add_fields(log_record, record, message_dict)

        # Add request ID if available
        if hasattr(_request_context, "request_id"):
            log_record["request_id"] = _request_context.request_id

        # Add any extra context
        if hasattr(_request_context, "extra"):
            log_record.update(_request_context.extra)

        # Add custom fields from record
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id

        # Add environment info
        import os

        log_record["environment"] = os.getenv("DJANGO_ENV", "development")
        log_record["service"] = "aisreact-backend"

        # Rename some fields for consistency
        if "asctime" in log_record:
            log_record["timestamp"] = log_record.pop("asctime")
        if "levelname" in log_record:
            log_record["level"] = log_record.pop("levelname")
        if "name" in log_record:
            log_record["logger"] = log_record.pop("name")

        # Don't modify the original log_record dict in place
        # This was causing the issue where fields were removed


class RequestIdFilter(logging.Filter):
    """
    Logging filter that adds request ID to log records.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request ID to log record if available."""
        # Try to get request ID from thread-local storage
        if hasattr(_request_context, "request_id"):
            record.request_id = _request_context.request_id
        elif not hasattr(record, "request_id"):
            record.request_id = None

        return True


class ContextualJsonFormatter(BaseJsonFormatter):
    """
    Enhanced JSON formatter with additional context and filtering.
    """

    # Fields to exclude from JSON output (too verbose or redundant)
    EXCLUDED_FIELDS = {
        "msg",
        "args",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "pathname",
        "module",
        "filename",
        "levelno",
    }

    def add_fields(
        self,
        log_record: Dict[str, Any],
        record: logging.LogRecord,
        message_dict: Dict[str, Any],
    ) -> None:
        """Add and filter fields for cleaner JSON output."""
        super().add_fields(log_record, record, message_dict)

        # Remove excluded fields
        for field in self.EXCLUDED_FIELDS:
            log_record.pop(field, None)

        # Add source location in a cleaner format
        if hasattr(record, "pathname") and hasattr(record, "lineno"):
            log_record["source"] = f"{record.pathname}:{record.lineno}"

        # Add function name if available
        if hasattr(record, "funcName") and record.funcName != "<module>":
            log_record["function"] = record.funcName

        # Clean up the output
        log_record = {k: v for k, v in log_record.items() if v is not None and v != ""}


def update_logging_config_with_context(
    logging_config: Dict[str, Any]
) -> Dict[str, Any]:
    """Update logging configuration to use context-aware formatters."""
    # Update JSON formatters to use our custom formatter
    if "formatters" in logging_config:
        for formatter_name, formatter_config in logging_config["formatters"].items():
            if formatter_name.startswith("json"):
                formatter_config["()"] = (
                    "api.logging_formatters.RequestAwareJsonFormatter"
                )
                formatter_config.pop("format", None)  # Remove format string, not needed

    # Add request ID filter to all handlers
    if "filters" not in logging_config:
        logging_config["filters"] = {}

    logging_config["filters"]["request_id"] = {
        "()": "api.logging_formatters.RequestIdFilter"
    }

    # Add filter to all handlers
    if "handlers" in logging_config:
        for handler_config in logging_config["handlers"].values():
            if "filters" not in handler_config:
                handler_config["filters"] = []
            if "request_id" not in handler_config["filters"]:
                handler_config["filters"].append("request_id")

    return logging_config
