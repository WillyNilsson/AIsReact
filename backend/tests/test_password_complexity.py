"""
Tests for password complexity requirements.
"""

from api.validators import PasswordComplexityValidator
from django.core.exceptions import ValidationError
from django.test import TestCase


class PasswordComplexityTestCase(TestCase):
    """Test cases for password complexity validator."""

    def setUp(self):
        """Set up test data."""
        self.validator = PasswordComplexityValidator()

    def test_valid_password(self):
        """Test password that meets all requirements."""
        valid_passwords = [
            "SecurePass123!",
            "MyP@ssw0rd2024",
            "Complex!ty9",
            "Test123$Pass",
            "Aa1!bcdefghijk",  # Minimal but valid
        ]

        for password in valid_passwords:
            try:
                self.validator.validate(password)
            except ValidationError:
                self.fail(f"Password '{password}' should be valid")

    def test_missing_uppercase(self):
        """Test password without uppercase letter."""
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("securepass123!")

        self.assertIn("uppercase letter", str(cm.exception))

    def test_missing_lowercase(self):
        """Test password without lowercase letter."""
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("SECUREPASS123!")

        self.assertIn("lowercase letter", str(cm.exception))

    def test_missing_digit(self):
        """Test password without digit."""
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("SecurePass!")

        self.assertIn("digit", str(cm.exception))

    def test_missing_special_character(self):
        """Test password without special character."""
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("SecurePass123")

        self.assertIn("special character", str(cm.exception))

    def test_multiple_missing_requirements(self):
        """Test password missing multiple requirements."""
        # Missing uppercase and special char
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("securepass123")

        error_msg = str(cm.exception)
        self.assertIn("uppercase letter", error_msg)
        self.assertIn("special character", error_msg)
        self.assertIn(" and ", error_msg)

        # Missing three requirements
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("securepass")

        error_msg = str(cm.exception)
        self.assertIn("uppercase letter", error_msg)
        self.assertIn("digit", error_msg)
        self.assertIn("special character", error_msg)
        self.assertIn(", and ", error_msg)

    def test_all_special_characters(self):
        """Test that all defined special characters are accepted."""
        special_chars = "!@#$%^&*()-_=+[]{}\\|;:'\",.<>/?`~"

        for char in special_chars:
            password = f"Test123{char}"
            try:
                self.validator.validate(password)
            except ValidationError:
                self.fail(f"Special character '{char}' should be accepted")

    def test_help_text(self):
        """Test that help text is informative."""
        help_text = self.validator.get_help_text()

        self.assertIn("uppercase letter", help_text)
        self.assertIn("lowercase letter", help_text)
        self.assertIn("digit", help_text)
        self.assertIn("special character", help_text)

    def test_error_code(self):
        """Test that proper error code is set."""
        try:
            self.validator.validate("badpassword")
        except ValidationError as e:
            self.assertEqual(e.code, "password_no_complexity")
            self.assertIsInstance(e.params.get("missing"), list)
            self.assertTrue(len(e.params["missing"]) > 0)

    def test_unicode_characters(self):
        """Test handling of unicode characters."""
        # Unicode letters should not count as special characters
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("Pássword123")  # Has ñ but no special char

        self.assertIn("special character", str(cm.exception))

        # But combined with special char should work
        try:
            self.validator.validate("Pássword123!")
        except ValidationError:
            self.fail("Unicode password with special char should be valid")

    def test_long_password(self):
        """Test very long password still validates correctly."""
        long_password = "A" * 50 + "a" * 50 + "1" * 10 + "!" * 10
        try:
            self.validator.validate(long_password)
        except ValidationError:
            self.fail("Long password meeting requirements should be valid")

    def test_password_with_spaces(self):
        """Test password with spaces."""
        # Spaces are not special characters in our definition
        with self.assertRaises(ValidationError) as cm:
            self.validator.validate("Secure Pass 123")

        self.assertIn("special character", str(cm.exception))

        # But with special char should work
        try:
            self.validator.validate("Secure Pass 123!")
        except ValidationError:
            self.fail("Password with spaces and special char should be valid")
