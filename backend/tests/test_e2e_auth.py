"""
End-to-end tests for authentication flow using actual API calls.
"""

import json

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.e2e
class TestAuthenticationE2E:
    """E2E tests for authentication workflows."""

    def test_complete_registration_flow(self, api_client):
        """Test user registration from start to finish."""
        # 1. Register a new user
        registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
        }

        response = api_client.post("/api/auth/register/", registration_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert "access_token" in response.data
        assert "refresh_token" in response.data
        assert response.data["username"] == "newuser"
        assert response.data["email"] == "newuser@example.com"
        assert response.data["role"] == "user"
        assert response.data["is_verified"] == False

        # 2. Verify user was created in database
        user = User.objects.get(username="newuser")
        assert user.email == "newuser@example.com"
        assert user.check_password("SecurePass123!")

        # 3. Use the token to access protected endpoint
        access_token = response.data["access_token"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        me_response = api_client.get("/api/auth/me/")
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data["username"] == "newuser"

    def test_login_flow_with_username(self, api_client, test_user):
        """Test login with username and password."""
        login_data = {"username": "testuser", "password": "TestPass123!"}

        response = api_client.post("/api/auth/token/", login_data)

        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data
        assert "refresh_token" in response.data
        assert "user" in response.data
        assert response.data["user"]["username"] == "testuser"

        # Verify token works
        api_client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {response.data["access_token"]}'
        )
        me_response = api_client.get("/api/auth/me/")
        assert me_response.status_code == status.HTTP_200_OK

    def test_login_flow_with_email(self, api_client, test_user):
        """Test login with email and password."""
        login_data = {
            "username": "test@example.com",  # Using email in username field
            "password": "TestPass123!",
        }

        response = api_client.post("/api/auth/token/", login_data)

        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data
        assert response.data["user"]["email"] == "test@example.com"

    def test_invalid_login_attempts(self, api_client, test_user):
        """Test various invalid login scenarios."""
        # Wrong password
        response = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "WrongPassword"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Non-existent user
        response = api_client.post(
            "/api/auth/token/", {"username": "nonexistent", "password": "AnyPassword"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Missing credentials
        response = api_client.post("/api/auth/token/", {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_refresh_flow(self, api_client, test_user):
        """Test token refresh mechanism."""
        # 1. Login to get tokens
        login_response = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "TestPass123!"}
        )

        refresh_token = login_response.data["refresh_token"]

        # 2. Use refresh token to get new access token
        refresh_response = api_client.post(
            "/api/auth/token/refresh/", {"refresh": refresh_token}
        )

        assert refresh_response.status_code == status.HTTP_200_OK
        assert "access" in refresh_response.data

        # 3. Verify new access token works
        new_access_token = refresh_response.data["access"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access_token}")

        me_response = api_client.get("/api/auth/me/")
        assert me_response.status_code == status.HTTP_200_OK

    def test_logout_flow(self, api_client, test_user):
        """Test logout functionality."""
        # 1. Login first
        login_response = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "TestPass123!"}
        )

        access_token = login_response.data["access_token"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        # 2. Logout
        logout_response = api_client.post("/api/auth/logout/")
        assert logout_response.status_code == status.HTTP_200_OK

        # Note: In JWT, logout is handled client-side by removing tokens
        # Server-side validation still works with the token until expiry

    def test_registration_validation(self, api_client):
        """Test registration field validation."""
        # Username too short
        response = api_client.post(
            "/api/auth/register/",
            {"username": "ab", "email": "test@example.com", "password": "Pass123!"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username" in response.data

        # Invalid email
        response = api_client.post(
            "/api/auth/register/",
            {"username": "validuser", "email": "notanemail", "password": "Pass123!"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data

        # Weak password
        response = api_client.post(
            "/api/auth/register/",
            {"username": "validuser", "email": "valid@example.com", "password": "123"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

        # Duplicate username
        User.objects.create_user(
            username="existing", email="existing@example.com", password="Pass123!"
        )
        response = api_client.post(
            "/api/auth/register/",
            {
                "username": "existing",
                "email": "new@example.com",
                "password": "Pass123!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username" in response.data

    def test_protected_endpoints_require_auth(self, api_client):
        """Test that protected endpoints require authentication."""
        # Try to access without token
        response = api_client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = api_client.post("/api/posts/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = api_client.post("/api/auth/logout/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_user_profile_update(self, api_client, test_user):
        """Test updating user profile."""
        # Login first
        login_response = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "TestPass123!"}
        )

        api_client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}'
        )

        # Update profile
        update_response = api_client.patch(
            "/api/auth/me/", {"email": "newemail@example.com"}
        )

        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.data["email"] == "newemail@example.com"

        # Verify in database
        test_user.refresh_from_db()
        assert test_user.email == "newemail@example.com"

    def test_change_password_flow(self, api_client, test_user):
        """Test changing user password."""
        # Login with current password
        login_response = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "TestPass123!"}
        )

        api_client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}'
        )

        # Change password
        change_response = api_client.post(
            "/api/auth/change-password/",
            {"current_password": "TestPass123!", "new_password": "NewSecurePass456!"},
        )

        assert change_response.status_code == status.HTTP_200_OK

        # Verify old password doesn't work
        api_client.credentials()  # Clear credentials
        old_login = api_client.post(
            "/api/auth/token/", {"username": "testuser", "password": "TestPass123!"}
        )
        assert old_login.status_code == status.HTTP_401_UNAUTHORIZED

        # Verify new password works
        new_login = api_client.post(
            "/api/auth/token/",
            {"username": "testuser", "password": "NewSecurePass456!"},
        )
        assert new_login.status_code == status.HTTP_200_OK
