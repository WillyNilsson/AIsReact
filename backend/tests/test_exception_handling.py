"""
Tests for proper exception handling across the codebase.
"""

from unittest.mock import MagicMock, patch

import pytest
from api.auth import TokenRotationView
from api.health import DetailedHealthCheckView
from api.services.email import EmailService
from api.throttles import TokenRefreshThrottle, get_throttle_wait_message
from django.core.cache import cache
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


class TestTokenBlacklistExceptionHandling:
    """Test exception handling in token blacklist check."""

    def test_invalid_token_returns_false(self):
        """Test that invalid tokens return False instead of crashing."""
        view = TokenRotationView()

        # Test with malformed token
        assert view.is_token_blacklisted("invalid.token.here") == False

        # Test with empty string
        assert view.is_token_blacklisted("") == False

        # Test with None (would raise AttributeError)
        assert view.is_token_blacklisted(None) == False


class TestThrottleExceptionHandling:
    """Test exception handling in throttling."""

    def test_token_refresh_throttle_fallback(self, rf):
        """Test that throttle falls back to IP when token parsing fails."""
        throttle = TokenRefreshThrottle()

        # Create request with invalid token
        request = rf.post(
            "/api/auth/token/refresh/", {"refresh": "invalid.token.format"}
        )

        # Should not crash, should return IP-based identifier
        ident = throttle.get_ident(request)
        assert ident is not None
        assert isinstance(ident, str)

    def test_throttle_wait_message_error_handling(self):
        """Test that wait message handles errors gracefully."""
        # Mock throttle with no wait() method
        mock_throttle = MagicMock()
        del mock_throttle.wait

        message = get_throttle_wait_message(mock_throttle)
        assert message == "Too many requests. Please try again later."

        # Mock throttle that raises exception
        mock_throttle = MagicMock()
        mock_throttle.wait.side_effect = ValueError("Invalid time")

        message = get_throttle_wait_message(mock_throttle)
        assert message == "Too many requests. Please try again later."


class TestHealthCheckExceptionHandling:
    """Test exception handling in health checks."""

    @patch("subprocess.check_output")
    def test_git_version_fallback(self, mock_subprocess):
        """Test version detection when git is not available."""
        mock_subprocess.side_effect = FileNotFoundError("git not found")

        view = DetailedHealthCheckView()
        version = view.get_version()

        # Should return 'unknown' when git fails
        assert version == "unknown"

    @patch("psutil.boot_time")
    def test_uptime_fallback(self, mock_boot_time):
        """Test uptime calculation when psutil fails."""
        mock_boot_time.side_effect = OSError("System call failed")

        view = DetailedHealthCheckView()
        uptime = view.get_uptime()

        # Should return 0 when system call fails
        assert uptime == 0

    @patch("psutil.cpu_count")
    def test_system_info_fallback(self, mock_cpu_count):
        """Test system info when psutil is not available."""
        mock_cpu_count.side_effect = AttributeError("Not available")

        view = DetailedHealthCheckView()
        info = view.get_system_info()

        # Should return empty dict when system info fails
        assert info == {}


class TestEmailServiceExceptionHandling:
    """Test exception handling in email service."""

    @patch("django.template.loader.render_to_string")
    def test_missing_text_template_fallback(self, mock_render):
        """Test that missing text template falls back to HTML stripping."""
        service = EmailService()

        # First call succeeds (HTML), second fails (text template missing)
        mock_render.side_effect = [
            "<h1>Test Email</h1><p>Content</p>",  # HTML render
            Exception("Template not found"),  # Text render fails
        ]

        html, text = service._render_email_template("test_template", {})

        # HTML should be returned as-is
        assert html == "<h1>Test Email</h1><p>Content</p>"

        # Text should be stripped HTML
        assert "Test Email" in text
        assert "Content" in text
        assert "<h1>" not in text  # HTML tags should be stripped


@pytest.mark.django_db
class TestModerationExceptionHandling:
    """Test exception handling in moderation."""

    def test_invalid_date_format_handling(self, rf, admin_user):
        """Test that invalid date formats are handled gracefully."""
        from api.moderation import ModerationViewSet

        view = ModerationViewSet()
        view.request = rf.get(
            "/api/moderation/history/",
            {
                "start_date": "invalid-date-format",
                "end_date": "2024-13-45",  # Invalid month and day
            },
        )
        view.request.user = admin_user

        # Should not crash, should log warnings
        with patch("api.moderation.logger") as mock_logger:
            response = view.history()

            # Should have logged warnings for both dates
            assert mock_logger.warning.call_count >= 2

            # Response should still work (without date filtering)
            assert response.status_code == 200
