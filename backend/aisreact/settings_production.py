"""
Production settings for aisreact project.

This file contains production-specific settings that override
the base settings for deployment on Render.
"""

import dj_database_url

from .settings import *  # noqa: F403, F401

# Memory optimization for Render free tier (512MB)
# These settings help reduce memory footprint

# Security settings for production
DEBUG = False
ALLOWED_HOSTS = env.list(  # noqa: F405
    "ALLOWED_HOSTS",
    default=[
        "aisreact-backend.onrender.com",
        "api.aisreact.com",
        "aisreact.com",
        "www.aisreact.com",
        ".onrender.com",
    ],
)

# Use environment variable for secret key
SECRET_KEY = env("SECRET_KEY")  # noqa: F405

# Database configuration from DATABASE_URL with memory optimization
DATABASES = {
    "default": dj_database_url.config(
        default=env("DATABASE_URL"),  # noqa: F405
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Redis configuration from REDIS_URL
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),  # noqa: F405
        "KEY_PREFIX": "aisreact",
        "TIMEOUT": 300,
    }
}

# Celery configuration
CELERY_BROKER_URL = env("REDIS_URL")  # noqa: F405
CELERY_RESULT_BACKEND = env("REDIS_URL")  # noqa: F405

# Security headers
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# CORS settings for production
CORS_ALLOWED_ORIGINS = env.list(  # noqa: F405
    "CORS_ALLOWED_ORIGINS",
    default=[
        "https://aisreact-frontend.onrender.com",
        "https://aisreact.com",
        "https://www.aisreact.com",
    ],
)

CORS_ALLOW_CREDENTIALS = True

# Static files with WhiteNoise
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_AUTOREFRESH = False
WHITENOISE_COMPRESS_OFFLINE = True

# Media files on S3
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")  # noqa: F405
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")  # noqa: F405
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")  # noqa: F405
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")  # noqa: F405
AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": "max-age=86400",
}
# Disable ACL as bucket uses bucket policy instead
AWS_DEFAULT_ACL = None
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_FILE_OVERWRITE = False
AWS_QUERYSTRING_AUTH = True  # Enable pre-signed URLs for secure uploads

# Email configuration (optional)
if env("EMAIL_HOST", default=None):  # noqa: F405
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")  # noqa: F405
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)  # noqa: F405
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)  # noqa: F405
    EMAIL_HOST_USER = env("EMAIL_HOST_USER")  # noqa: F405
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")  # noqa: F405
    DEFAULT_FROM_EMAIL = env(  # noqa: F405
        "DEFAULT_FROM_EMAIL", default="noreply@aisreact.com"
    )

# Logging configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "api": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Sentry error tracking - DISABLED FOR NOW
# To enable Sentry in the future:
# 1. Uncomment the code below
# 2. Set SENTRY_DSN environment variable
# 3. Install sentry-sdk package
#
# sentry_dsn = env("SENTRY_DSN", default=None)  # noqa: F405
# if sentry_dsn and sentry_dsn.strip() and not
#     sentry_dsn.startswith("https://your-sentry-dsn"):
#     try:
#         import sentry_sdk
#         from sentry_sdk.integrations.celery import CeleryIntegration
#         from sentry_sdk.integrations.django import DjangoIntegration
#         from sentry_sdk.integrations.redis import RedisIntegration
#
#         sentry_sdk.init(
#             dsn=sentry_dsn,
#             integrations=[
#                 DjangoIntegration(),
#                 CeleryIntegration(),
#                 RedisIntegration(),
#             ],
#             traces_sample_rate=0.1,
#             send_default_pii=False,
#             environment="production",
#         )
#     except Exception as e:
#         print(f"Warning: Failed to initialize Sentry: {e}")

# Performance optimizations
CONN_MAX_AGE = 600  # Database connection pooling
CONN_HEALTH_CHECKS = True

# API throttling for production
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": "60/hour",
    "user": "600/hour",
}

# Frontend URL for CORS and redirects
FRONTEND_URL = env("FRONTEND_URL", default="https://aisreact.com")  # noqa: F405

# Monitoring configuration - DISABLED for memory optimization
# Uncomment below to enable prometheus monitoring
# INSTALLED_APPS = ["django_prometheus"] + list(INSTALLED_APPS)  # noqa: F405
#
# MIDDLEWARE = (
#     [
#         "django_prometheus.middleware.PrometheusBeforeMiddleware",
#     ]
#     + MIDDLEWARE  # noqa: F405
#     + [
#         "api.monitoring.MonitoringMiddleware",
#         "django_prometheus.middleware.PrometheusAfterMiddleware",
#     ]
# )

# Prometheus metrics export
PROMETHEUS_EXPORT_MIGRATIONS = False
PROMETHEUS_LATENCY_BUCKETS = (
    0.01,
    0.025,
    0.05,
    0.075,
    0.1,
    0.25,
    0.5,
    0.75,
    1.0,
    2.5,
    5.0,
    7.5,
    10.0,
    25.0,
    50.0,
)


# Additional memory optimizations for 512MB limit
# Django's redis cache backend handles connection pooling automatically
# No additional OPTIONS needed for basic operation

# Celery memory optimization
CELERY_WORKER_MAX_TASKS_PER_CHILD = 50  # Restart worker after 50 tasks
CELERY_WORKER_MAX_MEMORY_PER_CHILD = 200000  # 200MB max per worker
CELERY_WORKER_CONCURRENCY = 1  # Only 1 worker process
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Only fetch 1 task at a time
CELERY_TASK_ACKS_LATE = True  # Acknowledge tasks after completion
CELERY_TASK_REJECT_ON_WORKER_LOST = True  # Reject tasks if worker dies

# Limit file upload sizes to save memory
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5MB

# Disable debug toolbar and silk profiler in production
DEBUG_TOOLBAR = False
SILKY_ENABLED = False

# Optimize logging to reduce memory usage
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
