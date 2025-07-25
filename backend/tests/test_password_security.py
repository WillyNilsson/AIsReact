"""
Tests for enhanced password security.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class PasswordSecurityTestCase(TestCase):
    """Test cases for password security enhancements."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="OldSecurePassword123!",  # Valid password for existing user
        )

    def test_minimum_length_validation(self):
        """Test password minimum length requirement."""
        # Test password too short
        with self.assertRaises(ValidationError) as cm:
            validate_password("Short123!")

        errors = cm.exception.messages
        self.assertIn(
            "This password is too short. It must contain at least 12 characters.",
            errors,
        )

        # Test password exactly 12 characters
        try:
            validate_password("Exactly12Chr")
        except ValidationError:
            self.fail("12-character password should be valid")

        # Test password longer than 12 characters
        try:
            validate_password("ThisIsALongerPassword123!")
        except ValidationError:
            self.fail("Long password should be valid")

    def test_registration_with_short_password(self):
        """Test user registration with password too short."""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "Short123",  # Only 8 characters
        }

        response = self.client.post("/api/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

        # Verify user was not created
        self.assertFalse(User.objects.filter(username="newuser").exists())

    def test_registration_with_valid_password(self):
        """Test user registration with valid password."""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePassword123!",  # Valid password
        }

        response = self.client.post("/api/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify user was created
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_common_password_rejection(self):
        """Test that common passwords are rejected."""
        common_passwords = [
            "password123456",
            "123456789012",
            "qwertyuiopas",
            "administrator",
        ]

        for password in common_passwords:
            with self.assertRaises(ValidationError) as cm:
                validate_password(password)

            errors = cm.exception.messages
            self.assertTrue(
                any("This password is too common" in error for error in errors),
                f"Password '{password}' should be rejected as common",
            )

    def test_numeric_password_rejection(self):
        """Test that entirely numeric passwords are rejected."""
        with self.assertRaises(ValidationError) as cm:
            validate_password("123456789012")

        errors = cm.exception.messages
        self.assertIn("This password is entirely numeric.", errors)

    def test_password_similar_to_username(self):
        """Test that passwords similar to username are rejected."""
        # Create a user object for testing similarity
        test_user = User(username="johndoe", email="john@example.com")

        similar_passwords = [
            "johndoe12345",
            "12345johndoe",
            "JohnDoe12345",
            "johndoepassword",
        ]

        for password in similar_passwords:
            with self.assertRaises(ValidationError) as cm:
                validate_password(password, user=test_user)

            errors = cm.exception.messages
            self.assertTrue(
                any("password is too similar" in error for error in errors),
                f"Password '{password}' should be rejected as similar to username",
            )

    def test_password_change_validation(self):
        """Test password change with new validation rules."""
        self.client.force_authenticate(user=self.user)

        # Test with short password
        data = {"current_password": "OldSecurePassword123!", "new_password": "Short123"}

        response = self.client.post("/api/users/change_password/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

        # Test with valid password
        data = {
            "current_password": "OldSecurePassword123!",
            "new_password": "NewSecurePassword123!",
        }

        response = self.client.post("/api/users/change_password/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecurePassword123!"))

    def test_existing_users_can_login(self):
        """Test that existing users with shorter passwords can still login."""
        # Create a user with direct database access (bypassing validation)
        # This simulates an existing user from before the password policy change
        old_user = User.objects.create(username="olduser", email="old@example.com")
        old_user.set_password("old123")  # Short password
        old_user.save()

        # Test login still works
        data = {"username": "olduser", "password": "old123"}

        response = self.client.post("/api/login/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_password_validation_error_messages(self):
        """Test that validation provides helpful error messages."""
        test_cases = [
            {"password": "short", "expected_error": "at least 12 characters"},
            {
                "password": "123456789012",
                "expected_errors": ["entirely numeric", "too common"],
            },
            {"password": "passwordpass", "expected_error": "too common"},
        ]

        for test_case in test_cases:
            with self.assertRaises(ValidationError) as cm:
                validate_password(test_case["password"])

            errors = " ".join(cm.exception.messages).lower()

            if isinstance(test_case.get("expected_error"), str):
                self.assertIn(
                    test_case["expected_error"].lower(),
                    errors,
                    f"Expected error message for password '{test_case['password']}'",
                )
            else:
                for expected in test_case.get("expected_errors", []):
                    self.assertIn(
                        expected.lower(),
                        errors,
                        f"Expected error message for password '{test_case['password']}'",
                    )
