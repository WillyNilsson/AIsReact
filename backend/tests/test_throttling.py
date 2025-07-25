"""
Tests for authentication endpoint throttling.
"""

import time
from unittest.mock import patch

import pytest
from api.models import User
from api.throttles import get_throttle_wait_message
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    return User.objects.create_user(
        username="testuser", email="test@example.com", password="TestPass123!"
    )


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestRegistrationThrottling:
    """Test registration endpoint throttling."""

    def test_registration_throttle_by_ip(self, api_client):
        """Test that registration is throttled by IP address."""
        url = reverse("api:register")

        # Make 5 successful requests (the limit)
        for i in range(5):
            response = api_client.post(
                url,
                {
                    "username": f"user{i}",
                    "email": f"user{i}@example.com",
                    "password": "TestPass123!",
                },
            )
            assert response.status_code == status.HTTP_201_CREATED

        # 6th request should be throttled
        response = api_client.post(
            url,
            {
                "username": "user5",
                "email": "user5@example.com",
                "password": "TestPass123!",
            },
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "rate_limit_exceeded" in response.data["error"]["code"]

    def test_registration_throttle_by_email(self, api_client):
        """Test that registration is also throttled by email."""
        url = reverse("api:register")
        email = "same@example.com"

        # Try to register with same email multiple times
        for i in range(5):
            response = api_client.post(
                url,
                {"username": f"user{i}", "email": email, "password": "TestPass123!"},
            )
            # First one succeeds, rest fail due to duplicate email
            # but still count towards throttle

        # Should be throttled even with different username
        response = api_client.post(
            url, {"username": "different", "email": email, "password": "TestPass123!"}
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
class TestLoginThrottling:
    """Test login endpoint throttling."""

    def test_login_throttle_by_username(self, api_client, test_user):
        """Test that login is throttled by username."""
        url = reverse("api:token")

        # Make 10 failed login attempts (the limit)
        for i in range(10):
            # Use form data format
            form_data = f"username={test_user.username}&password=WrongPassword"
            response = api_client.post(
                url, form_data, content_type="application/x-www-form-urlencoded"
            )
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # 11th request should be throttled
        form_data = f"username={test_user.username}&password=WrongPassword"
        response = api_client.post(
            url, form_data, content_type="application/x-www-form-urlencoded"
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Too many requests" in response.data["error"]["message"]

    def test_login_throttle_different_users(self, api_client, db):
        """Test that throttling is per-username."""
        url = reverse("api:token")

        # Create multiple users
        users = []
        for i in range(3):
            user = User.objects.create_user(
                username=f"user{i}",
                email=f"user{i}@example.com",
                password="TestPass123!",
            )
            users.append(user)

        # Make 5 attempts for each user - should not trigger throttle
        for user in users:
            for _ in range(5):
                form_data = f"username={user.username}&password=WrongPassword"
                response = api_client.post(
                    url, form_data, content_type="application/x-www-form-urlencoded"
                )
                assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPasswordResetThrottling:
    """Test password reset throttling."""

    def test_password_reset_strict_limit(self, api_client, test_user):
        """Test that password reset has strict limit."""
        url = reverse("api:password_reset_request")

        # Make 3 requests (the limit)
        for i in range(3):
            response = api_client.post(url, {"email": test_user.email})
            assert response.status_code == status.HTTP_200_OK

        # 4th request should be throttled
        response = api_client.post(url, {"email": test_user.email})
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_password_reset_throttle_by_email(self, api_client):
        """Test that throttling includes email hash."""
        url = reverse("api:password_reset_request")

        # Different emails should have separate limits
        emails = ["user1@example.com", "user2@example.com"]

        for email in emails:
            # Each email can make 3 requests
            for _ in range(3):
                response = api_client.post(url, {"email": email})
                assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTokenRefreshThrottling:
    """Test token refresh throttling."""

    @patch("rest_framework_simplejwt.tokens.RefreshToken")
    def test_token_refresh_throttle(self, mock_token, api_client):
        """Test that token refresh is throttled."""
        url = reverse("api:token_refresh")

        # Mock token to return consistent JTI
        mock_token.return_value = {"jti": "test-jti-123"}

        # Make 30 requests (the limit)
        for i in range(30):
            response = api_client.post(url, {"refresh": "test-refresh-token"})
            # Will fail due to invalid token, but throttle still applies

        # 31st request should be throttled
        response = api_client.post(url, {"refresh": "test-refresh-token"})
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


class TestThrottleMessages:
    """Test throttle wait messages."""

    def test_wait_message_seconds(self):
        """Test message for waits under a minute."""

        class MockThrottle:
            def wait(self):
                return 45

        message = get_throttle_wait_message(MockThrottle())
        assert message == "Too many requests. Please try again in 45 seconds."

    def test_wait_message_minutes(self):
        """Test message for waits under an hour."""

        class MockThrottle:
            def wait(self):
                return 180  # 3 minutes

        message = get_throttle_wait_message(MockThrottle())
        assert message == "Too many requests. Please try again in 3 minutes."

    def test_wait_message_hours(self):
        """Test message for waits over an hour."""

        class MockThrottle:
            def wait(self):
                return 7200  # 2 hours

        message = get_throttle_wait_message(MockThrottle())
        assert message == "Too many requests. Please try again in 2 hours."

    def test_wait_message_error_handling(self):
        """Test message when wait() fails."""

        class MockThrottle:
            def wait(self):
                raise Exception("Error")

        message = get_throttle_wait_message(MockThrottle())
        assert message == "Too many requests. Please try again later."


@pytest.mark.django_db
class TestEmailVerificationThrottling:
    """Test email verification resend throttling."""

    def test_resend_verification_throttle(self, api_client, test_user):
        """Test that email verification resend is throttled."""
        # Login as user
        api_client.force_authenticate(user=test_user)

        url = reverse("api:resend_verification")

        # Make 5 requests (the limit)
        for i in range(5):
            response = api_client.post(url)
            # Will fail because user is already verified in test
            # but throttle still counts

        # 6th request should be throttled
        response = api_client.post(url)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
