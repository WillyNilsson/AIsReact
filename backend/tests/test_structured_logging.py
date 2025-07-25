"""
Tests for structured logging implementation.
"""

import json
import logging
import uuid
from unittest.mock import MagicMock, Mock, patch

from api.logging_config import (
    get_request_context,
    log_api_request,
    log_authentication_failure,
    log_authorization_failure,
    log_security_event,
    log_slow_query,
    log_slow_request,
    log_suspicious_activity,
)
from api.logging_formatters import (
    RequestAwareJsonFormatter,
    RequestIdFilter,
    clear_request_context,
    set_request_context,
    update_logging_config_with_context,
)
from api.middleware.request_id import RequestIdMiddleware
from api.middleware.structured_logging import (
    HealthCheckLoggingMiddleware,
    StructuredLoggingMiddleware,
)
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

User = get_user_model()


class RequestIdMiddlewareTest(TestCase):
    """Test request ID middleware functionality."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = RequestIdMiddleware(lambda r: HttpResponse("OK"))
        self.user = User.objects.create_user(username="testuser", password="testpass")

    def test_generates_request_id(self):
        """Test that middleware generates a request ID."""
        request = self.factory.get("/api/test")
        response = self.middleware(request)

        self.assertIsNotNone(request.id)
        self.assertEqual(response["X-Request-ID"], request.id)
        self.assertTrue(uuid.UUID(request.id))  # Valid UUID

    def test_uses_existing_request_id(self):
        """Test that middleware uses existing X-Request-ID header."""
        existing_id = str(uuid.uuid4())
        request = self.factory.get("/api/test", HTTP_X_REQUEST_ID=existing_id)
        response = self.middleware(request)

        self.assertEqual(request.id, existing_id)
        self.assertEqual(response["X-Request-ID"], existing_id)

    @patch("api.middleware.request_id.clear_request_context")
    @patch("api.middleware.request_id.set_request_context")
    def test_sets_logging_context(self, mock_set, mock_clear):
        """Test that middleware sets and clears logging context."""
        request = self.factory.get("/api/test")
        request.user = self.user

        response = self.middleware(request)

        mock_set.assert_called_once()
        call_args = mock_set.call_args[1]
        self.assertIsNotNone(call_args["request_id"])
        self.assertEqual(call_args["user_id"], self.user.id)
        self.assertEqual(call_args["path"], "/api/test")
        self.assertEqual(call_args["method"], "GET")

        mock_clear.assert_called_once()


class StructuredLoggingMiddlewareTest(TestCase):
    """Test structured logging middleware."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = StructuredLoggingMiddleware(lambda r: HttpResponse("OK"))

    @patch("api.middleware.structured_logging.log_api_request")
    def test_logs_api_requests(self, mock_log):
        """Test that API requests are logged."""
        request = self.factory.get("/api/posts")
        request._start_time = 1000.0

        with patch("time.time", return_value=1001.5):
            response = self.middleware(request)

        mock_log.assert_called_once_with(
            request=request, response_time=1.5, status_code=200
        )

    @patch("api.middleware.structured_logging.log_api_request")
    def test_skips_non_api_requests(self, mock_log):
        """Test that non-API requests are not logged."""
        request = self.factory.get("/static/test.css")
        response = self.middleware(request)

        mock_log.assert_not_called()

    @patch("api.middleware.structured_logging.log_slow_request")
    def test_logs_slow_requests(self, mock_log):
        """Test that slow requests are logged."""
        request = self.factory.get("/api/slow")
        request._start_time = 1000.0
        request.id = "test-id"

        with patch("time.time", return_value=1003.0):  # 3 seconds
            response = self.middleware(request)

        mock_log.assert_called_once_with(
            path="/api/slow",
            method="GET",
            duration=3.0,
            status_code=200,
            request_id="test-id",
        )

    @patch("api.middleware.structured_logging.log_api_error")
    def test_logs_exceptions(self, mock_log):
        """Test that exceptions are logged with context."""
        request = self.factory.get("/api/error")
        exception = ValueError("Test error")

        self.middleware.process_exception(request, exception)

        mock_log.assert_called_once_with(request, exception)


class HealthCheckLoggingMiddlewareTest(TestCase):
    """Test health check logging middleware."""

    def setUp(self):
        self.factory = RequestFactory()
        self.logger = logging.getLogger("api")
        self.middleware = HealthCheckLoggingMiddleware(lambda r: HttpResponse("OK"))

    def test_marks_health_check_requests(self):
        """Test that health check requests are marked."""
        request = self.factory.get("/api/health/")
        response = self.middleware(request)

        self.assertTrue(hasattr(request, "_is_health_check"))
        self.assertTrue(request._is_health_check)

    @patch.object(logging.getLogger("api"), "debug")
    def test_logs_health_checks_at_debug_level(self, mock_debug):
        """Test that health checks are logged at debug level."""
        request = self.factory.get("/api/health/")
        request._is_health_check = True
        request.id = "test-id"

        response = self.middleware.process_response(request, HttpResponse("OK"))

        mock_debug.assert_called_once()
        call_args = mock_debug.call_args
        self.assertIn("Health check", call_args[0][0])


class SecurityLoggingTest(TestCase):
    """Test security logging functions."""

    @patch.object(logging.getLogger("api.security"), "info")
    def test_log_security_event(self, mock_log):
        """Test generic security event logging."""
        log_security_event("TEST_EVENT", "Test message", user_id=123)

        mock_log.assert_called_once()
        call_args = mock_log.call_args
        self.assertEqual(call_args[0][0], "Test message")
        self.assertEqual(call_args[1]["extra"]["event_type"], "TEST_EVENT")
        self.assertEqual(call_args[1]["extra"]["user_id"], 123)

    @patch.object(logging.getLogger("api.security"), "info")
    def test_log_authentication_failure(self, mock_log):
        """Test authentication failure logging."""
        log_authentication_failure(
            username="test@example.com",
            ip_address="192.168.1.1",
            reason="Invalid password",
            user_agent="Mozilla/5.0",
        )

        mock_log.assert_called_once()
        extra = mock_log.call_args[1]["extra"]
        self.assertEqual(extra["event_type"], "AUTH_FAILURE")
        self.assertEqual(extra["username"], "test@example.com")
        self.assertEqual(extra["ip_address"], "192.168.1.1")
        self.assertEqual(extra["user_agent"], "Mozilla/5.0")

    @patch.object(logging.getLogger("api.security"), "info")
    def test_log_suspicious_activity(self, mock_log):
        """Test suspicious activity logging."""
        log_suspicious_activity(
            user_id=123,
            ip_address="192.168.1.1",
            activity="Port scanning",
            details={"ports": [22, 80, 443]},
        )

        mock_log.assert_called_once()
        extra = mock_log.call_args[1]["extra"]
        self.assertEqual(extra["event_type"], "SUSPICIOUS_ACTIVITY")
        self.assertEqual(extra["details"]["ports"], [22, 80, 443])


class PerformanceLoggingTest(TestCase):
    """Test performance logging functions."""

    @patch.object(logging.getLogger("api.performance"), "warning")
    def test_log_slow_query(self, mock_log):
        """Test slow query logging."""
        log_slow_query(query="SELECT * FROM users", duration=5.5, query_type="select")

        mock_log.assert_called_once()
        extra = mock_log.call_args[1]["extra"]
        self.assertEqual(extra["event_type"], "slow_query")
        self.assertEqual(extra["duration_seconds"], 5.5)
        self.assertEqual(extra["query_type"], "select")

    @patch.object(logging.getLogger("api.performance"), "warning")
    def test_log_slow_request(self, mock_log):
        """Test slow request logging."""
        log_slow_request(
            path="/api/heavy", method="POST", duration=10.5, status_code=200
        )

        mock_log.assert_called_once()
        extra = mock_log.call_args[1]["extra"]
        self.assertEqual(extra["event_type"], "slow_request")
        self.assertEqual(extra["duration_seconds"], 10.5)
        self.assertEqual(extra["path"], "/api/heavy")


class JsonFormatterTest(TestCase):
    """Test JSON formatter functionality."""

    def test_request_aware_formatter(self):
        """Test that RequestAwareJsonFormatter includes request context."""
        formatter = RequestAwareJsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        # Set request context
        set_request_context(request_id="test-123", user_id=456)

        try:
            formatted = formatter.format(record)
            data = json.loads(formatted)

            # Basic checks - the formatter should produce valid JSON with our fields
            self.assertEqual(data["request_id"], "test-123")
            self.assertEqual(data["message"], "Test message")
            self.assertEqual(data["service"], "aisreact-backend")
            # Check that some timestamp field exists
            self.assertTrue(any(k in data for k in ["timestamp", "asctime"]))
        finally:
            clear_request_context()

    def test_request_id_filter(self):
        """Test that RequestIdFilter adds request ID to records."""
        filter = RequestIdFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test",
            args=(),
            exc_info=None,
        )

        set_request_context(request_id="filter-test-123")

        try:
            result = filter.filter(record)
            self.assertTrue(result)
            self.assertEqual(record.request_id, "filter-test-123")
        finally:
            clear_request_context()


class UtilityFunctionsTest(TestCase):
    """Test utility functions."""

    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username="testuser")

    def test_get_request_context(self):
        """Test request context extraction."""
        request = self.factory.get(
            "/api/test", HTTP_X_FORWARDED_FOR="10.0.0.1, 192.168.1.1"
        )
        request.user = self.user
        request.id = "req-123"

        context = get_request_context(request)

        self.assertEqual(context["path"], "/api/test")
        self.assertEqual(context["method"], "GET")
        self.assertEqual(context["ip_address"], "10.0.0.1")
        self.assertEqual(context["request_id"], "req-123")
        self.assertEqual(context["user_id"], self.user.id)
        self.assertEqual(context["username"], "testuser")

    def test_update_logging_config_with_context(self):
        """Test logging config enhancement."""
        config = {
            "formatters": {"json": {"()": "pythonjsonlogger.jsonlogger.JsonFormatter"}},
            "handlers": {"console": {"formatter": "json"}},
        }

        enhanced = update_logging_config_with_context(config)

        # Check formatter was updated
        self.assertEqual(
            enhanced["formatters"]["json"]["()"],
            "api.logging_formatters.RequestAwareJsonFormatter",
        )

        # Check filter was added
        self.assertIn("request_id", enhanced["filters"])
        self.assertIn("request_id", enhanced["handlers"]["console"]["filters"])
