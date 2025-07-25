"""
Tests for environment variable validation.
"""

import os
import unittest
from unittest.mock import patch

from aisreact.env_validator import EnvValidator


class TestEnvValidator(unittest.TestCase):
    """Test cases for environment variable validation."""

    def setUp(self):
        """Set up test environment."""
        # Store original environment
        self.original_env = os.environ.copy()
        # Clear environment for tests
        for key in list(os.environ.keys()):
            if key in [
                "SECRET_KEY",
                "DATABASE_URL",
                "REDIS_URL",
                "JWT_SECRET_KEY",
                "ALLOWED_HOSTS",
                "OPENAI_API_KEY",
                "DEBUG",
            ]:
                del os.environ[key]

    def tearDown(self):
        """Restore original environment."""
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_missing_required_variables(self):
        """Test validation fails with missing required variables."""
        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertFalse(is_valid)
        self.assertTrue(len(errors) >= 4)  # At least 4 required vars
        self.assertIn("Missing required environment variable: SECRET_KEY", errors[0])

    def test_valid_development_environment(self):
        """Test validation passes with valid development environment."""
        os.environ.update(
            {
                "DEBUG": "True",
                "SECRET_KEY": "a" * 50,  # 50 chars minimum
                "DATABASE_URL": "sqlite:///db.sqlite3",
                "REDIS_URL": "redis://localhost:6379/0",
                "JWT_SECRET_KEY": "b" * 32,  # 32 chars minimum
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_invalid_variable_formats(self):
        """Test validation fails with invalid variable formats."""
        os.environ.update(
            {
                "DEBUG": "True",
                "SECRET_KEY": "short",  # Too short
                "DATABASE_URL": "invalid://url",  # Invalid protocol
                "REDIS_URL": "memcached://localhost",  # Wrong protocol
                "JWT_SECRET_KEY": "short",  # Too short
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertFalse(is_valid)
        self.assertTrue(any("Must be at least 50 characters long" in e for e in errors))
        self.assertTrue(
            any("Must be a valid PostgreSQL or SQLite URL" in e for e in errors)
        )
        self.assertTrue(any("Must be a valid Redis URL" in e for e in errors))
        self.assertTrue(any("Must be at least 32 characters long" in e for e in errors))

    def test_production_requirements(self):
        """Test additional validation requirements for production."""
        os.environ.update(
            {
                "DEBUG": "False",  # Production mode
                "SECRET_KEY": "a" * 50,
                "DATABASE_URL": "postgresql://user:pass@localhost/db",
                "REDIS_URL": "redis://localhost:6379/0",
                "JWT_SECRET_KEY": "b" * 32,
                # Missing ALLOWED_HOSTS and OPENAI_API_KEY
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertFalse(is_valid)
        self.assertTrue(any("ALLOWED_HOSTS" in e for e in errors))
        self.assertTrue(any("OPENAI_API_KEY" in e for e in errors))

    def test_insecure_defaults_detection(self):
        """Test detection of insecure default values in production."""
        os.environ.update(
            {
                "DEBUG": "False",  # Production mode
                "SECRET_KEY": "your-secret-key-here-CHANGE-IN-PRODUCTION",
                "DATABASE_URL": "postgresql://user:pass@localhost/db",
                "REDIS_URL": "redis://localhost:6379/0",
                "JWT_SECRET_KEY": "your-jwt-secret-here-CHANGE-IN-PRODUCTION",
                "ALLOWED_HOSTS": "example.com",
                "OPENAI_API_KEY": "sk-test1234567890123456789012345678901234567890",
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertFalse(is_valid)
        self.assertTrue(
            any("SECRET_KEY contains default/insecure value" in e for e in errors)
        )
        self.assertTrue(
            any("JWT_SECRET_KEY contains default/insecure value" in e for e in errors)
        )

    def test_optional_variable_validation(self):
        """Test validation of optional variables when present."""
        base_env = {
            "DEBUG": "True",
            "SECRET_KEY": "a" * 50,
            "DATABASE_URL": "sqlite:///db.sqlite3",
            "REDIS_URL": "redis://localhost:6379/0",
            "JWT_SECRET_KEY": "b" * 32,
        }

        # Test invalid optional variables
        os.environ.update(base_env)
        os.environ.update(
            {
                "GOOGLE_API_KEY": "invalid-key",  # Should start with AIza
                "AWS_ACCESS_KEY_ID": "INVALID123",  # Should match AKIA pattern
                "SENTRY_DSN": "not-a-url",  # Should be valid Sentry URL
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertTrue(is_valid)  # Optional vars only generate warnings
        self.assertTrue(len(warnings) >= 3)
        self.assertTrue(any("GOOGLE_API_KEY" in w for w in warnings))
        self.assertTrue(any("AWS_ACCESS_KEY_ID" in w for w in warnings))
        self.assertTrue(any("SENTRY_DSN" in w for w in warnings))

    def test_valid_optional_variables(self):
        """Test valid optional variables pass validation."""
        os.environ.update(
            {
                "DEBUG": "True",
                "SECRET_KEY": "a" * 50,
                "DATABASE_URL": "sqlite:///db.sqlite3",
                "REDIS_URL": "redis://localhost:6379/0",
                "JWT_SECRET_KEY": "b" * 32,
                "GOOGLE_API_KEY": "AIzaSyC1234567890123456789012345678901234",
                "ANTHROPIC_API_KEY": "sk-ant-api03-123456789012345678901234567890",
                "AWS_ACCESS_KEY_ID": "AKIAIOSFODNN7EXAMPLE",
                "AWS_SECRET_ACCESS_KEY": "1234567890123456789012345678901234567890",
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(warnings), 0)

    def test_localhost_warning_in_production(self):
        """Test warning for localhost in ALLOWED_HOSTS in production."""
        os.environ.update(
            {
                "DEBUG": "False",  # Production mode
                "SECRET_KEY": "a" * 50,
                "DATABASE_URL": "postgresql://user:pass@localhost/db",
                "REDIS_URL": "redis://localhost:6379/0",
                "JWT_SECRET_KEY": "b" * 32,
                "ALLOWED_HOSTS": "localhost,127.0.0.1,example.com",
                "OPENAI_API_KEY": "sk-test1234567890123456789012345678901234567890",
            }
        )

        validator = EnvValidator()
        is_valid, errors, warnings = validator.validate()

        self.assertTrue(is_valid)
        self.assertTrue(any("localhost" in w for w in warnings))


if __name__ == "__main__":
    unittest.main()
