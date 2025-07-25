"""
Environment variable validation for aisreact.

This module validates that all required environment variables are present
and properly formatted at application startup.
"""

import os
import re
import sys
from typing import List, Tuple


class EnvValidator:
    """Validates environment variables at startup."""

    # Required variables for all environments
    REQUIRED_VARS = {
        "SECRET_KEY": {
            "description": "Django secret key for cryptographic signing",
            "validator": lambda v: len(v) >= 50,
            "error": "Must be at least 50 characters long",
        },
        "DATABASE_URL": {
            "description": "PostgreSQL connection string",
            "validator": lambda v: v.startswith(
                ("postgresql://", "postgres://", "sqlite://")
            ),
            "error": "Must be a valid PostgreSQL or SQLite URL",
        },
        "REDIS_URL": {
            "description": "Redis connection string",
            "validator": lambda v: v.startswith("redis://"),
            "error": "Must be a valid Redis URL",
        },
        "JWT_SECRET_KEY": {
            "description": "Secret key for JWT token signing",
            "validator": lambda v: len(v) >= 32,
            "error": "Must be at least 32 characters long",
        },
    }

    # Required in production only
    PRODUCTION_REQUIRED_VARS = {
        "ALLOWED_HOSTS": {
            "description": "Comma-separated list of allowed hosts",
            "validator": lambda v: len(v.strip()) > 0,
            "error": "Must not be empty in production",
        },
        "OPENAI_API_KEY": {
            "description": "OpenAI API key for moderation and GPT models",
            "validator": lambda v: v.startswith("sk-") and len(v) > 20,
            "error": "Must be a valid OpenAI API key starting with sk-",
        },
    }

    # Optional variables with validation
    OPTIONAL_VARS = {
        "GOOGLE_API_KEY": {
            "description": "Google AI API key",
            "validator": lambda v: v.startswith("AIza") and len(v) > 20,
            "error": "Must be a valid Google API key starting with AIza",
        },
        "ANTHROPIC_API_KEY": {
            "description": "Anthropic API key",
            "validator": lambda v: v.startswith("sk-ant-") and len(v) > 20,
            "error": "Must be a valid Anthropic API key starting with sk-ant-",
        },
        "XAI_API_KEY": {
            "description": "xAI API key",
            "validator": lambda v: v.startswith("xai-") and len(v) > 20,
            "error": "Must be a valid xAI API key starting with xai-",
        },
        "DEEPSEEK_API_KEY": {
            "description": "DeepSeek API key",
            "validator": lambda v: v.startswith("sk-") and len(v) > 20,
            "error": "Must be a valid DeepSeek API key starting with sk-",
        },
        "AWS_ACCESS_KEY_ID": {
            "description": "AWS access key ID",
            "validator": lambda v: re.match(r"^AKIA[A-Z0-9]{16}$", v) is not None,
            "error": (
                "Must be a valid AWS access key ID "
                "(AKIA followed by 16 alphanumeric characters)"
            ),
        },
        "AWS_SECRET_ACCESS_KEY": {
            "description": "AWS secret access key",
            "validator": lambda v: len(v) == 40,
            "error": "Must be 40 characters long",
        },
        "SENTRY_DSN": {
            "description": "Sentry DSN for error tracking",
            "validator": lambda v: v.startswith("https://")
            and "@" in v
            and "sentry.io" in v,
            "error": "Must be a valid Sentry DSN",
        },
    }

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.is_production = os.getenv("DEBUG", "True").lower() == "false"

    def validate(self) -> Tuple[bool, List[str], List[str]]:
        """
        Validate all environment variables.

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        self.errors = []
        self.warnings = []

        # Validate required variables
        self._validate_required()

        # Validate production-only requirements
        if self.is_production:
            self._validate_production()

        # Validate optional variables if present
        self._validate_optional()

        # Check for insecure default values in production
        if self.is_production:
            self._check_insecure_defaults()

        return len(self.errors) == 0, self.errors, self.warnings

    def _validate_required(self):
        """Validate required environment variables."""
        for var_name, config in self.REQUIRED_VARS.items():
            value = os.getenv(var_name)

            if not value:
                self.errors.append(
                    f"Missing required environment variable: {var_name}\n"
                    f"  Description: {config['description']}"
                )
            elif not config["validator"](value):
                self.errors.append(f"Invalid {var_name}: {config['error']}")

    def _validate_production(self):
        """Validate production-only requirements."""
        for var_name, config in self.PRODUCTION_REQUIRED_VARS.items():
            value = os.getenv(var_name)

            if not value:
                self.errors.append(
                    f"Missing required environment variable for "
                    f"production: {var_name}\n"
                    f"  Description: {config['description']}"
                )
            elif not config["validator"](value):
                self.errors.append(f"Invalid {var_name}: {config['error']}")

    def _validate_optional(self):
        """Validate optional environment variables if present."""
        for var_name, config in self.OPTIONAL_VARS.items():
            value = os.getenv(var_name)

            if value and not config["validator"](value):
                self.warnings.append(f"Invalid {var_name}: {config['error']}")

    def _check_insecure_defaults(self):
        """Check for insecure default values in production."""
        # Check for default secret key
        secret_key = os.getenv("SECRET_KEY", "")
        if (
            "your-secret-key-here" in secret_key.lower()
            or "change-in-production" in secret_key.lower()
        ):
            self.errors.append(
                "SECRET_KEY contains default/insecure value. "
                "Generate a secure key with: python -c "
                "'from django.core.management.utils import "
                "get_random_secret_key; print(get_random_secret_key())'"
            )

        # Check for default JWT secret
        jwt_secret = os.getenv("JWT_SECRET_KEY", "")
        if (
            "your-jwt-secret" in jwt_secret.lower()
            or "change-in-production" in jwt_secret.lower()
        ):
            self.errors.append(
                "JWT_SECRET_KEY contains default/insecure value. "
                "Generate a secure key with: python -c "
                "'import secrets; print(secrets.token_urlsafe(32))'"
            )

        # Check for localhost in allowed hosts
        allowed_hosts = os.getenv("ALLOWED_HOSTS", "")
        if "localhost" in allowed_hosts or "127.0.0.1" in allowed_hosts:
            self.warnings.append(
                "ALLOWED_HOSTS contains localhost/127.0.0.1 in production. "
                "This should only contain your production domain(s)."
            )

    def print_validation_report(self):
        """Print a formatted validation report."""
        is_valid, errors, warnings = self.validate()

        print("\n" + "=" * 60)
        print("ENVIRONMENT VARIABLE VALIDATION REPORT")
        print("=" * 60)
        print(f"Environment: {'PRODUCTION' if self.is_production else 'DEVELOPMENT'}")
        print(f"Status: {'✅ PASSED' if is_valid else '❌ FAILED'}")
        print("=" * 60)

        if errors:
            print("\n❌ ERRORS (must fix):")
            for i, error in enumerate(errors, 1):
                print(f"\n{i}. {error}")

        if warnings:
            print("\n⚠️  WARNINGS (should review):")
            for i, warning in enumerate(warnings, 1):
                print(f"\n{i}. {warning}")

        if not errors and not warnings:
            print("\n✅ All environment variables validated successfully!")

        print("\n" + "=" * 60 + "\n")

        return is_valid


def validate_environment():
    """
    Validate environment variables and exit if critical errors found.

    This function should be called early in the Django settings or app startup.
    """
    validator = EnvValidator()
    is_valid = validator.print_validation_report()

    if not is_valid:
        print("🚨 CRITICAL: Environment validation failed!")
        print("Please fix the errors above and restart the application.")
        print("\nFor more information, see backend/.env.example")
        sys.exit(1)


if __name__ == "__main__":
    # Allow running as a standalone script for testing
    validate_environment()
