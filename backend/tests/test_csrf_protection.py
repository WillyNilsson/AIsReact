"""
Tests for CSRF protection implementation.
"""

import pytest
from api.models import User
from django.middleware.csrf import get_token
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def csrf_client(api_client):
    """API client with CSRF token."""
    # Get CSRF token
    response = api_client.get(reverse("api:csrf_token"))
    csrf_token = response.data["csrfToken"]

    # Set CSRF header
    api_client.credentials(HTTP_X_CSRFTOKEN=csrf_token)
    return api_client


@pytest.fixture
def auth_user(db):
    """Create an authenticated user."""
    user = User.objects.create_user(
        username="testuser", email="test@example.com", password="TestPass123!"
    )
    return user


@pytest.fixture
def auth_client(csrf_client, auth_user):
    """Authenticated client with CSRF token."""
    # Login to get JWT token
    response = csrf_client.post(
        reverse("api:token"),
        "username=testuser&password=TestPass123!",
        content_type="application/x-www-form-urlencoded",
    )
    access_token = response.data["access"]

    # Set auth header
    csrf_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
        HTTP_X_CSRFTOKEN=csrf_client._credentials["HTTP_X_CSRFTOKEN"],
    )
    return csrf_client


class TestCSRFTokenEndpoint:
    """Test CSRF token endpoint."""

    def test_get_csrf_token(self, api_client):
        """Test getting CSRF token."""
        response = api_client.get(reverse("api:csrf_token"))

        assert response.status_code == status.HTTP_200_OK
        assert "csrfToken" in response.data
        assert response.data["headerName"] == "X-CSRFToken"
        assert response.data["cookieName"] == "csrftoken"

        # Check that CSRF cookie is set
        assert "csrftoken" in response.cookies

    def test_csrf_token_changes(self, api_client):
        """Test that CSRF tokens are unique per session."""
        response1 = api_client.get(reverse("api:csrf_token"))
        token1 = response1.data["csrfToken"]

        # New client should get different token
        new_client = APIClient()
        response2 = new_client.get(reverse("api:csrf_token"))
        token2 = response2.data["csrfToken"]

        assert token1 != token2


@pytest.mark.django_db
class TestCSRFProtection:
    """Test CSRF protection on endpoints."""

    def test_post_without_csrf_fails(self, api_client, auth_user):
        """Test that POST without CSRF token fails."""
        # Try to create a post without CSRF token
        response = api_client.post(
            reverse("api:post-list"), {"title": "Test Post", "content": "Test content"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_post_with_csrf_succeeds(self, auth_client):
        """Test that POST with CSRF token succeeds."""
        # Create a post with CSRF token
        response = auth_client.post(
            reverse("api:post-list"), {"title": "Test Post", "content": "Test content"}
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_put_without_csrf_fails(self, api_client, auth_user):
        """Test that PUT without CSRF token fails."""
        # First create a post (with CSRF)
        csrf_client = APIClient()
        csrf_response = csrf_client.get(reverse("api:csrf_token"))
        csrf_client.credentials(HTTP_X_CSRFTOKEN=csrf_response.data["csrfToken"])
        csrf_client.force_authenticate(user=auth_user)

        post_response = csrf_client.post(
            reverse("api:post-list"), {"title": "Test", "content": "Content"}
        )
        post_id = post_response.data["id"]

        # Try to update without CSRF
        api_client.force_authenticate(user=auth_user)
        response = api_client.put(
            reverse("api:post-detail", args=[post_id]),
            {"title": "Updated", "content": "Updated content"},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_without_csrf_fails(self, api_client, auth_user):
        """Test that DELETE without CSRF token fails."""
        # Create a post first
        csrf_client = APIClient()
        csrf_response = csrf_client.get(reverse("api:csrf_token"))
        csrf_client.credentials(HTTP_X_CSRFTOKEN=csrf_response.data["csrfToken"])
        csrf_client.force_authenticate(user=auth_user)

        post_response = csrf_client.post(
            reverse("api:post-list"), {"title": "Test", "content": "Content"}
        )
        post_id = post_response.data["id"]

        # Try to delete without CSRF
        api_client.force_authenticate(user=auth_user)
        response = api_client.delete(reverse("api:post-detail", args=[post_id]))

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestCSRFExemptions:
    """Test CSRF exemptions on auth endpoints."""

    def test_login_without_csrf(self, api_client):
        """Test that login works without CSRF token."""
        # Create user
        User.objects.create_user(
            username="testuser", email="test@example.com", password="TestPass123!"
        )

        # Login without CSRF token
        response = api_client.post(
            reverse("api:token"),
            "username=testuser&password=TestPass123!",
            content_type="application/x-www-form-urlencoded",
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_register_without_csrf(self, api_client):
        """Test that registration works without CSRF token."""
        response = api_client.post(
            reverse("api:register"),
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "TestPass123!",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_token_refresh_without_csrf(self, api_client, db):
        """Test that token refresh works without CSRF token."""
        # Create user and get tokens
        user = User.objects.create_user(
            username="testuser", email="test@example.com", password="TestPass123!"
        )

        login_response = api_client.post(
            reverse("api:token"),
            "username=testuser&password=TestPass123!",
            content_type="application/x-www-form-urlencoded",
        )
        refresh_token = login_response.data["refresh"]

        # Refresh without CSRF token
        response = api_client.post(
            reverse("api:token_refresh"), {"refresh": refresh_token}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data


@pytest.mark.django_db
class TestCSRFWithSessions:
    """Test CSRF with session-based requests."""

    def test_change_password_requires_csrf(self, api_client, auth_user):
        """Test that change password requires CSRF token."""
        api_client.force_authenticate(user=auth_user)

        # Try without CSRF token
        response = api_client.post(
            reverse("api:change_password"),
            {"current_password": "TestPass123!", "new_password": "NewTestPass123!"},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_change_password_with_csrf(self, auth_client):
        """Test that change password works with CSRF token."""
        response = auth_client.post(
            reverse("api:change_password"),
            {"current_password": "TestPass123!", "new_password": "NewTestPass123!"},
        )

        assert response.status_code == status.HTTP_200_OK
