"""
Tests for account lockout functionality.
"""

import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from django.utils import timezone
from rest_framework import status

User = get_user_model()


class AccountLockoutTestCase(TestCase):
    """Test cases for account lockout after failed login attempts."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="ValidPassword123!"
        )
        # Clear any cached data
        cache.clear()

    def tearDown(self):
        """Clean up after tests."""
        cache.clear()

    def test_successful_login_resets_counter(self):
        """Test that successful login resets failed attempts counter."""
        # Set some failed attempts
        self.user.failed_login_attempts = 3
        self.user.save()

        # Successful login
        response = self.client.post(
            "/api/login/",
            {"username": "testuser", "password": "ValidPassword123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check counter was reset
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.last_failed_login)
        self.assertIsNone(self.user.locked_until)

    def test_failed_login_increments_counter(self):
        """Test that failed login attempts increment the counter."""
        # First failed attempt
        response = self.client.post(
            "/api/login/",
            {"username": "testuser", "password": "WrongPassword"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        data = json.loads(response.content)
        self.assertIn("4 attempts remaining", data["detail"])

        # Check counter
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 1)
        self.assertIsNotNone(self.user.last_failed_login)

    def test_account_lockout_after_five_attempts(self):
        """Test that account is locked after 5 failed attempts."""
        # Make 5 failed attempts
        for i in range(5):
            response = self.client.post(
                "/api/login/",
                {"username": "testuser", "password": "WrongPassword"},
                content_type="application/json",
            )

            if i < 4:
                # First 4 attempts show remaining
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
                data = json.loads(response.content)
                remaining = 4 - i
                self.assertIn(f"{remaining} attempts remaining", data["detail"])
            else:
                # 5th attempt triggers lockout
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
                data = json.loads(response.content)
                self.assertIn("Account is now locked for 15 minutes", data["detail"])

        # Check user is locked
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 5)
        self.assertIsNotNone(self.user.locked_until)
        self.assertTrue(self.user.is_account_locked())

    def test_locked_account_cannot_login(self):
        """Test that locked account cannot login even with correct password."""
        # Lock the account
        self.user.failed_login_attempts = 5
        self.user.locked_until = timezone.now() + timedelta(minutes=15)
        self.user.save()

        # Try to login with correct password
        response = self.client.post(
            "/api/login/",
            {"username": "testuser", "password": "ValidPassword123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        data = json.loads(response.content)
        self.assertIn(
            "Account is locked due to too many failed login attempts", data["detail"]
        )
        self.assertIn("try again in", data["detail"])

    def test_lockout_duration_increases(self):
        """Test that lockout duration increases with more failures."""
        # Test different failure counts
        test_cases = [
            (5, 15),  # 5 failures = 15 minutes
            (10, 30),  # 10 failures = 30 minutes
            (15, 60),  # 15 failures = 1 hour
            (20, 1440),  # 20+ failures = 24 hours
        ]

        for failures, expected_minutes in test_cases:
            self.user.failed_login_attempts = failures
            duration = self.user.get_lockout_duration()
            self.assertEqual(
                duration.total_seconds() / 60,
                expected_minutes,
                f"Expected {expected_minutes} minutes for {failures} failures",
            )

    def test_username_enumeration_protection(self):
        """Test that non-existent users get generic error message."""
        # Try with non-existent username
        response = self.client.post(
            "/api/login/",
            {"username": "nonexistent", "password": "anypassword"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        data = json.loads(response.content)
        # Should get generic message, not "user not found"
        self.assertEqual(data["detail"], "Invalid credentials")
        # Should NOT mention remaining attempts
        self.assertNotIn("attempts remaining", data["detail"])

    def test_email_login_with_lockout(self):
        """Test that email login respects account lockout."""
        # Lock the account
        self.user.failed_login_attempts = 5
        self.user.locked_until = timezone.now() + timedelta(minutes=15)
        self.user.save()

        # Try to login with email
        response = self.client.post(
            "/api/login/",
            {"username": "test@example.com", "password": "ValidPassword123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        data = json.loads(response.content)
        self.assertIn("Account is locked", data["detail"])

    def test_case_insensitive_username_lockout(self):
        """Test that username lockout is case-insensitive."""
        # Fail with lowercase
        for i in range(3):
            self.client.post(
                "/api/login/",
                {"username": "testuser", "password": "WrongPassword"},
                content_type="application/json",
            )

        # Try with uppercase - should continue counting
        response = self.client.post(
            "/api/login/",
            {"username": "TESTUSER", "password": "WrongPassword"},
            content_type="application/json",
        )

        data = json.loads(response.content)
        self.assertIn("1 attempts remaining", data["detail"])

        # Check it's the same user
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 4)

    def test_lockout_expires(self):
        """Test that account unlocks after lockout period expires."""
        # Lock the account with expired timestamp
        self.user.failed_login_attempts = 5
        self.user.locked_until = timezone.now() - timedelta(minutes=1)  # Expired
        self.user.save()

        # Should be able to login
        response = self.client.post(
            "/api/login/",
            {"username": "testuser", "password": "ValidPassword123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Counter should be reset
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)


class IPRateLimitingTestCase(TestCase):
    """Test cases for IP-based rate limiting."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        # Create multiple users for testing
        for i in range(5):
            User.objects.create_user(
                username=f"user{i}",
                email=f"user{i}@example.com",
                password="TestPassword123!",
            )
        cache.clear()

    def tearDown(self):
        """Clean up after tests."""
        cache.clear()

    def test_ip_rate_limiting(self):
        """Test that IP gets rate limited after too many attempts."""
        # Make 20 failed attempts (the limit)
        for i in range(20):
            response = self.client.post(
                "/api/login/",
                {"username": f"user{i % 5}", "password": "WrongPassword"},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 21st attempt should be rate limited
        response = self.client.post(
            "/api/login/",
            {"username": "user1", "password": "WrongPassword"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 429)  # Too Many Requests
        data = json.loads(response.content)
        self.assertIn("Too many login attempts from this IP", data["detail"])

    def test_successful_login_clears_ip_counter(self):
        """Test that successful login clears IP attempt counter."""
        # Make some failed attempts
        for i in range(10):
            self.client.post(
                "/api/login/",
                {"username": "user0", "password": "WrongPassword"},
                content_type="application/json",
            )

        # Successful login
        response = self.client.post(
            "/api/login/",
            {"username": "user0", "password": "TestPassword123!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should be able to make more attempts
        for i in range(10):
            response = self.client.post(
                "/api/login/",
                {"username": "user1", "password": "WrongPassword"},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
