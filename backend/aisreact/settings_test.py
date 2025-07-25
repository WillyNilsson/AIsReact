"""
Test settings for aisreact project.
"""

import os

# Set required environment variables for testing
os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-for-testing-only-this-needs-to-be-at-least-50-chars-long",
)
os.environ.setdefault(
    "JWT_SECRET_KEY", "test-jwt-secret-key-for-testing-only-this-also-needs-to-be-long"
)
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "AKIATEST1234567890AB")
os.environ.setdefault(
    "AWS_SECRET_ACCESS_KEY", "1234567890123456789012345678901234567890"
)
os.environ.setdefault("AWS_STORAGE_BUCKET_NAME", "test-bucket")
os.environ.setdefault("AWS_S3_REGION_NAME", "us-east-1")

# AI provider keys for testing (mock keys)
os.environ.setdefault("OPENAI_API_KEY", "sk-test1234567890")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test1234567890")
os.environ.setdefault("GOOGLE_API_KEY", "test-google-api-key")
os.environ.setdefault("XAI_API_KEY", "test-xai-api-key")
os.environ.setdefault("DEEPSEEK_API_KEY", "sk-test-deepseek")

# Email settings
os.environ.setdefault("SENDGRID_API_KEY", "SG.test-key")
os.environ.setdefault("EMAIL_FROM", "test@example.com")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

from .settings import *  # noqa: F403, F401, E402

# Override settings for testing
DEBUG = True
SECRET_KEY = "test-secret-key-for-testing-only-not-for-production"

# Disable environment validation for tests
import sys

from . import env_validator_mock

sys.modules["aisreact.env_validator"] = env_validator_mock

# Test database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Test cache
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Disable email sending in tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# JWT settings for tests
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=90),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
}

# Keep rate limiting enabled for throttle tests
if "REST_FRAMEWORK" not in locals():
    REST_FRAMEWORK = {}
# Don't disable throttling - we need it for throttle tests

# Disable Celery in tests
CELERY_ALWAYS_EAGER = True
CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

# Disable audit logging in tests to avoid serialization issues
AUDIT_LOG_ENABLED = False

# Test file storage
DEFAULT_FILE_STORAGE = "django.core.files.storage.InMemoryStorage"

# Disable SSL redirect for tests
SECURE_SSL_REDIRECT = False

# Test allowed hosts
ALLOWED_HOSTS = ["*"]

# Disable CSRF for tests
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False

# Test logging - disable all logging to avoid serialization issues
LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
    },
    "loggers": {
        "django": {
            "handlers": ["null"],
            "propagate": False,
        },
        "api": {
            "handlers": ["null"],
            "propagate": False,
        },
    },
}

# Simplify middleware for testing
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
]
