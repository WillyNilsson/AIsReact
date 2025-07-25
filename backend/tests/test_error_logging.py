"""
Tests for centralized error logging service.
"""

from unittest.mock import MagicMock, patch

import pytest
from api.exceptions import custom_exception_handler
from api.services.error_logging import (
    ErrorCategory,
    ErrorContext,
    ErrorLogger,
    error_context,
    error_logger,
    log_error,
    log_exception,
    log_warning,
)
from django.contrib.auth import get_user_model
from rest_framework.request import Request

User = get_user_model()


class TestErrorContext:
    """Test ErrorContext class."""

    def test_error_context_creation(self):
        """Test creating error context with all fields."""
        context = ErrorContext(
            user_id=123,
            username="testuser",
            request_id="req-123",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            url="https://example.com/api/test",
            method="POST",
            extra={"custom": "data"},
        )

        data = context.to_dict()
        assert data["user_id"] == 123
        assert data["username"] == "testuser"
        assert data["request_id"] == "req-123"
        assert data["ip_address"] == "192.168.1.1"
        assert data["user_agent"] == "Mozilla/5.0"
        assert data["url"] == "https://example.com/api/test"
        assert data["method"] == "POST"
        assert data["custom"] == "data"
        assert "timestamp" in data

    def test_error_context_filters_none_values(self):
        """Test that None values are filtered out."""
        context = ErrorContext(user_id=123, username=None)
        data = context.to_dict()

        assert "user_id" in data
        assert "username" not in data


class TestErrorLogger:
    """Test ErrorLogger class."""

    @pytest.fixture
    def mock_logger(self):
        """Mock the logger."""
        with patch("api.services.error_logging.logger") as mock:
            yield mock

    def test_extract_request_context_django_request(self, rf):
        """Test extracting context from Django request."""
        request = rf.post(
            "/api/test",
            HTTP_X_FORWARDED_FOR="192.168.1.1",
            HTTP_USER_AGENT="TestAgent",
            HTTP_X_REQUEST_ID="req-123",
        )

        # Add user to request
        user = MagicMock()
        user.id = 456
        user.username = "testuser"
        request.user = user

        logger = ErrorLogger()
        context = logger._extract_request_context(request)

        assert context.user_id == 456
        assert context.username == "testuser"
        assert context.ip_address == "192.168.1.1"
        assert context.user_agent == "TestAgent"
        assert context.request_id == "req-123"
        assert context.method == "POST"
        assert "/api/test" in context.url

    def test_extract_request_context_drf_request(self, rf):
        """Test extracting context from DRF request."""
        django_request = rf.get("/api/test")
        drf_request = Request(django_request)

        logger = ErrorLogger()
        context = logger._extract_request_context(drf_request)

        assert context.method == "GET"
        assert "/api/test" in context.url

    def test_log_error_with_context(self, mock_logger, rf):
        """Test logging error with full context."""
        request = rf.get("/api/test")
        error = ValueError("Test error")

        logger = ErrorLogger()
        logger.log_error(
            error=error,
            category=ErrorCategory.VALIDATION,
            severity="error",
            request=request,
            extra={"field": "test_field"},
        )

        # Verify logger was called
        mock_logger.error.assert_called_once()
        call_args = mock_logger.error.call_args
        assert "[validation] ValueError: Test error" in call_args[0][0]
        assert "error_data" in call_args[1]["extra"]

        error_data = call_args[1]["extra"]["error_data"]
        assert error_data["error_type"] == "ValueError"
        assert error_data["error_message"] == "Test error"
        assert error_data["category"] == ErrorCategory.VALIDATION
        assert "traceback" in error_data
        assert error_data["context"]["method"] == "GET"
        assert error_data["context"]["field"] == "test_field"

    def test_sentry_integration(self, mock_logger):
        """Test Sentry integration when enabled."""
        # Test with Sentry module mock
        import sys

        mock_sentry = MagicMock()
        mock_sentry.push_scope.return_value.__enter__ = MagicMock()
        mock_sentry.push_scope.return_value.__exit__ = MagicMock()

        with patch.dict(sys.modules, {"sentry_sdk": mock_sentry}):
            logger = ErrorLogger()
            logger._sentry_enabled = True

            error = RuntimeError("Critical error")
            logger.log_error(
                error, category=ErrorCategory.DATABASE, severity="critical"
            )

            # Verify Sentry was called
            mock_sentry.push_scope.assert_called_once()
            mock_sentry.capture_exception.assert_called_once_with(error)

    def test_error_context_manager(self, mock_logger):
        """Test error context manager."""
        logger = ErrorLogger()

        # Test successful operation
        with logger.error_context("test_operation"):
            pass  # No error

        # Logger should not be called
        mock_logger.error.assert_not_called()

        # Test with error
        with pytest.raises(ValueError), logger.error_context(
            "failing_operation", category=ErrorCategory.VALIDATION
        ):
            raise ValueError("Test error")

        # Logger should be called
        mock_logger.error.assert_called_once()
        call_args = mock_logger.error.call_args
        error_data = call_args[1]["extra"]["error_data"]
        assert error_data["context"]["operation"] == "failing_operation"

    def test_log_exception_decorator(self, mock_logger):
        """Test exception logging decorator."""
        logger = ErrorLogger()

        @logger.log_exception_decorator(category=ErrorCategory.DATABASE)
        def failing_function():
            raise RuntimeError("Database connection failed")

        # Function should raise and log
        with pytest.raises(RuntimeError):
            failing_function()

        mock_logger.error.assert_called_once()
        call_args = mock_logger.error.call_args
        error_data = call_args[1]["extra"]["error_data"]
        assert error_data["category"] == ErrorCategory.DATABASE
        assert error_data["context"]["function"] == "failing_function"


@pytest.mark.django_db
class TestExceptionHandlerIntegration:
    """Test integration with Django exception handler."""

    def test_database_error_logging(self, rf):
        """Test that database errors are logged properly."""
        from django.db import DatabaseError

        request = rf.get("/api/test")
        exc = DatabaseError("Connection failed")
        context = {
            "request": request,
            "view": MagicMock(__class__=MagicMock(__name__="TestView")),
        }

        with patch("api.exceptions.error_logger.log_error") as mock_log:
            response = custom_exception_handler(exc, context)

            mock_log.assert_called_once()
            call_args = mock_log.call_args
            assert call_args[0][0] == exc
            assert call_args[1]["category"] == ErrorCategory.DATABASE
            assert call_args[1]["request"] == request
            assert call_args[1]["extra"]["view"] == "TestView"

        assert response.status_code == 500
        assert response.data["error"]["code"] == "database_error"

    def test_unhandled_exception_logging(self, rf):
        """Test that unhandled exceptions are logged as critical."""
        request = rf.get("/api/test")
        exc = RuntimeError("Unexpected error")
        context = {"request": request}

        with patch("api.exceptions.error_logger.log_error") as mock_log:
            response = custom_exception_handler(exc, context)

            mock_log.assert_called_once()
            call_args = mock_log.call_args
            assert call_args[0][0] == exc
            assert call_args[1]["category"] == ErrorCategory.UNKNOWN
            assert call_args[1]["severity"] == "critical"

        assert response.status_code == 500
        assert response.data["error"]["code"] == "internal_server_error"


class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_log_error_function(self):
        """Test log_error convenience function."""
        with patch.object(error_logger, "log_error") as mock:
            error = ValueError("Test")
            log_error(error, category=ErrorCategory.VALIDATION)

            mock.assert_called_once_with(error, category=ErrorCategory.VALIDATION)

    def test_log_warning_function(self):
        """Test log_warning convenience function."""
        with patch.object(error_logger, "log_warning") as mock:
            log_warning("Test warning", category=ErrorCategory.CONFIGURATION)

            mock.assert_called_once_with(
                "Test warning", category=ErrorCategory.CONFIGURATION
            )

    def test_error_context_function(self):
        """Test error_context convenience function."""
        with patch.object(error_logger, "error_context") as mock:
            with error_context("operation"):
                pass

            mock.assert_called_once_with("operation")

    def test_log_exception_decorator_function(self):
        """Test log_exception decorator convenience function."""
        with patch.object(error_logger, "log_exception_decorator") as mock:
            mock.return_value = lambda f: f

            # Call the decorator function
            decorator = log_exception(category=ErrorCategory.AI_PROVIDER)

            # Apply decorator
            @decorator
            def test_func():
                pass

            # The convenience function passes positional category first
            mock.assert_called_once()
            args, kwargs = mock.call_args
            assert (
                args[0] == ErrorCategory.AI_PROVIDER
                or kwargs.get("category") == ErrorCategory.AI_PROVIDER
            )
