"""
Tests for email verification functionality.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from api.models import EmailVerificationToken
from api.services.email_utils import send_email_verification
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class EmailVerificationTokenTests(TestCase):
    """Test EmailVerificationToken model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            is_verified=False,
        )

    def test_create_token(self):
        """Test creating a verification token."""
        raw_token, token = EmailVerificationToken.create_token(self.user)

        self.assertIsNotNone(raw_token)
        self.assertIsNotNone(token)
        self.assertEqual(token.user, self.user)
        self.assertFalse(token.used)
        self.assertIsNotNone(token.token_hash)

        # Check expiration is 7 days
        expected_expiry = timezone.now() + timedelta(days=7)
        self.assertAlmostEqual(
            token.expires_at.timestamp(),
            expected_expiry.timestamp(),
            delta=60,  # Allow 1 minute difference
        )

    def test_verify_valid_token(self):
        """Test verifying a valid token."""
        raw_token, token = EmailVerificationToken.create_token(self.user)

        verified_token = EmailVerificationToken.verify_token(raw_token)

        self.assertIsNotNone(verified_token)
        self.assertEqual(verified_token.id, token.id)
        self.assertEqual(verified_token.user, self.user)

    def test_verify_invalid_token(self):
        """Test verifying an invalid token."""
        verified_token = EmailVerificationToken.verify_token("invalid-token")
        self.assertIsNone(verified_token)

    def test_verify_used_token(self):
        """Test verifying a used token."""
        raw_token, token = EmailVerificationToken.create_token(self.user)
        token.mark_used()

        verified_token = EmailVerificationToken.verify_token(raw_token)
        self.assertIsNone(verified_token)

    def test_verify_expired_token(self):
        """Test verifying an expired token."""
        raw_token, token = EmailVerificationToken.create_token(self.user)

        # Manually set expiration to past
        token.expires_at = timezone.now() - timedelta(hours=1)
        token.save()

        verified_token = EmailVerificationToken.verify_token(raw_token)
        self.assertIsNone(verified_token)

    def test_multiple_tokens_for_user(self):
        """Test that creating a new token deletes old unused tokens."""
        # Create first token
        raw_token1, token1 = EmailVerificationToken.create_token(self.user)

        # Create second token
        raw_token2, token2 = EmailVerificationToken.create_token(self.user)

        # First token should be deleted
        self.assertFalse(EmailVerificationToken.objects.filter(id=token1.id).exists())

        # Second token should exist
        self.assertTrue(EmailVerificationToken.objects.filter(id=token2.id).exists())


class EmailVerificationAPITests(TestCase):
    """Test email verification API endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            is_verified=False,
        )

    @patch("api.views.send_email_verification")
    def test_registration_sends_verification_email(self, mock_send_email):
        """Test that registration sends verification email."""
        mock_send_email.return_value = True

        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "newpass123",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_verified"])
        mock_send_email.assert_called_once()

        # Check user was created with is_verified=False
        new_user = User.objects.get(username="newuser")
        self.assertFalse(new_user.is_verified)

    def test_verify_email_with_valid_token(self):
        """Test email verification with valid token."""
        # Create token
        raw_token, token = EmailVerificationToken.create_token(self.user)

        response = self.client.get(f"/api/auth/verify-email/?token={raw_token}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Email verified successfully")
        self.assertTrue(response.data["user"]["is_verified"])

        # Check user is marked as verified
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)

        # Check token is marked as used
        token.refresh_from_db()
        self.assertTrue(token.used)

        # Check response includes auth tokens
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)

    def test_verify_email_without_token(self):
        """Test email verification without token."""
        response = self.client.get("/api/auth/verify-email/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Verification token is required")

    def test_verify_email_with_invalid_token(self):
        """Test email verification with invalid token."""
        response = self.client.get("/api/auth/verify-email/?token=invalid-token")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"], "Invalid or expired verification token"
        )

    def test_verify_email_with_used_token(self):
        """Test email verification with used token."""
        raw_token, token = EmailVerificationToken.create_token(self.user)
        token.mark_used()

        response = self.client.get(f"/api/auth/verify-email/?token={raw_token}")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"], "Invalid or expired verification token"
        )

    @patch("api.views.send_email_verification")
    def test_resend_verification_authenticated(self, mock_send_email):
        """Test resending verification email for authenticated user."""
        mock_send_email.return_value = True

        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/auth/resend-verification/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["detail"], "Verification email sent successfully"
        )
        mock_send_email.assert_called_once_with(self.user)

    def test_resend_verification_unauthenticated(self):
        """Test resending verification email without authentication."""
        response = self.client.post("/api/auth/resend-verification/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_resend_verification_already_verified(self):
        """Test resending verification for already verified user."""
        self.user.is_verified = True
        self.user.save()

        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/auth/resend-verification/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Email is already verified")

    def test_resend_verification_rate_limiting(self):
        """Test rate limiting for resend verification."""
        self.client.force_authenticate(user=self.user)

        # Create 3 recent tokens
        for _ in range(3):
            EmailVerificationToken.create_token(self.user)

        # Fourth request should be rate limited
        response = self.client.post("/api/auth/resend-verification/")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(
            response.data["detail"],
            "Too many verification emails sent. Please try again later.",
        )


class UnverifiedUserRestrictionsTests(TestCase):
    """Test restrictions for unverified users."""

    def setUp(self):
        self.client = APIClient()
        self.verified_user = User.objects.create_user(
            username="verified",
            email="verified@example.com",
            password="testpass123",
            is_verified=True,
        )
        self.unverified_user = User.objects.create_user(
            username="unverified",
            email="unverified@example.com",
            password="testpass123",
            is_verified=False,
        )

    def test_unverified_user_can_view_posts(self):
        """Test that unverified users can view posts."""
        self.client.force_authenticate(user=self.unverified_user)
        response = self.client.get("/api/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unverified_user_can_view_feeds(self):
        """Test that unverified users can view feeds."""
        self.client.force_authenticate(user=self.unverified_user)

        # Test different feed types
        for feed_type in ["live", "rejected", "pending"]:
            response = self.client.get(f"/api/feed/{feed_type}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unverified_user_can_access_profile(self):
        """Test that unverified users can access their profile."""
        self.client.force_authenticate(user=self.unverified_user)

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_verified"])
