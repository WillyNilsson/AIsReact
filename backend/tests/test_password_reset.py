"""
Tests for password reset functionality.
"""

import re

from api.models import PasswordResetToken, User
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordResetTestCase(TestCase):
    """Test password reset flow."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="oldpassword123"
        )

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_request_valid_email(self):
        """Test requesting password reset with valid email."""
        url = reverse("api:password_reset_request")
        data = {"email": "test@example.com"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account exists", response.data["detail"])

        # Check that a token was created
        self.assertTrue(
            PasswordResetToken.objects.filter(user=self.user, used=False).exists()
        )

        # Check that email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["test@example.com"])
        self.assertIn("Password Reset", mail.outbox[0].subject)

    def test_password_reset_request_invalid_email(self):
        """Test requesting password reset with non-existent email."""
        url = reverse("api:password_reset_request")
        data = {"email": "nonexistent@example.com"}

        response = self.client.post(url, data, format="json")

        # Should still return 200 to prevent email enumeration
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account exists", response.data["detail"])

        # No token should be created
        self.assertFalse(PasswordResetToken.objects.filter(used=False).exists())

        # No email should be sent
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_confirm_valid_token(self):
        """Test resetting password with valid token."""
        # Create a reset token
        raw_token, reset_token = PasswordResetToken.create_token(self.user)

        url = reverse("api:password_reset_confirm")
        data = {"token": raw_token, "new_password": "newpassword123"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["detail"], "Password has been reset successfully."
        )

        # Check that user is returned with tokens
        self.assertIn("user", response.data)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)

        # Check that password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))

        # Check that token was marked as used
        reset_token.refresh_from_db()
        self.assertTrue(reset_token.used)
        self.assertIsNotNone(reset_token.used_at)

    def test_password_reset_confirm_invalid_token(self):
        """Test resetting password with invalid token."""
        url = reverse("api:password_reset_confirm")
        data = {"token": "invalid-token", "new_password": "newpassword123"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or expired reset token", str(response.data))

    def test_password_reset_confirm_expired_token(self):
        """Test resetting password with expired token."""
        from datetime import timedelta

        from django.utils import timezone

        # Create an expired token
        raw_token, reset_token = PasswordResetToken.create_token(self.user)

        # Manually expire the token
        reset_token.expires_at = timezone.now() - timedelta(hours=1)
        reset_token.save()

        url = reverse("api:password_reset_confirm")
        data = {"token": raw_token, "new_password": "newpassword123"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or expired reset token", str(response.data))

    def test_password_reset_confirm_used_token(self):
        """Test resetting password with already used token."""
        # Create and use a token
        raw_token, reset_token = PasswordResetToken.create_token(self.user)
        reset_token.mark_used()

        url = reverse("api:password_reset_confirm")
        data = {"token": raw_token, "new_password": "newpassword123"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or expired reset token", str(response.data))

    def test_password_reset_confirm_weak_password(self):
        """Test resetting password with weak password."""
        raw_token, reset_token = PasswordResetToken.create_token(self.user)

        url = reverse("api:password_reset_confirm")
        data = {"token": raw_token, "new_password": "123"}  # Too short

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Django's password validation can return different messages
        self.assertIn("password", str(response.data).lower())
        self.assertTrue(
            "too short" in str(response.data)
            or "at least 6 characters" in str(response.data)
        )

    def test_multiple_reset_requests(self):
        """Test that multiple reset requests invalidate previous tokens."""
        # Create first token
        raw_token1, reset_token1 = PasswordResetToken.create_token(self.user)

        # Create second token
        raw_token2, reset_token2 = PasswordResetToken.create_token(self.user)

        # First token should no longer exist
        self.assertFalse(PasswordResetToken.objects.filter(id=reset_token1.id).exists())

        # Only second token should be valid
        self.assertEqual(
            PasswordResetToken.objects.filter(user=self.user, used=False).count(), 1
        )
