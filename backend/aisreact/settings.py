"""
Django settings for aisreact project.
"""

import sys
from datetime import timedelta
from pathlib import Path

import environ
from api.logging_config import get_logging_config

# Initialize environment variables
env = environ.Env(DEBUG=(bool, False))

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Read .env file only if it exists (for local development)
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

# Validate environment variables (skip during testing)

if "test" not in sys.argv and "pytest" not in sys.modules:
    from .env_validator import validate_environment

    validate_environment()

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-this-in-production")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env("DEBUG")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "storages",
    # Local apps
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "api.middleware.SecurityHeadersMiddleware",  # Custom security headers
    "api.middleware_modules.request_id.RequestIdMiddleware",  # Request ID
    "api.middleware_modules.structured_logging.HealthCheckLoggingMiddleware",
    "api.middleware_modules.structured_logging.StructuredLoggingMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "api.middleware.LoginAttemptMiddleware",  # IP-based login rate limiting
]

ROOT_URLCONF = "aisreact.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "aisreact.wsgi.application"


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {"default": env.db(default="sqlite:///db.sqlite3")}

# Database connection pooling for better performance
if not DEBUG and DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":
    DATABASES["default"]["CONN_MAX_AGE"] = 600  # 10 minutes
    DATABASES["default"]["OPTIONS"] = {
        "connect_timeout": 10,
        "server_side_binding": True,
    }


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
        "OPTIONS": {
            "user_attributes": ["username", "email", "first_name", "last_name"],
            "max_similarity": 0.7,
        },
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {
            "min_length": 12,
        },
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
    {
        "NAME": "api.validators.PasswordComplexityValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User Model
AUTH_USER_MODEL = "api.User"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "PAGE_SIZE_QUERY_PARAM": "page_size",
    "MAX_PAGE_SIZE": 10,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "registration": "5/hour",  # Registration endpoint
        "login": "10/hour",  # Login attempts
        # pragma: allowlist secret
        "password_reset": "3/hour",  # Password reset requests
        "token_refresh": "30/hour",  # Token refresh
        "email_verification": "5/hour",  # Email verification
        "auth": "20/hour",  # General auth endpoints
        "strict_user": "10/hour",  # Sensitive user operations
    },
    "EXCEPTION_HANDLER": "api.exceptions.custom_exception_handler",
}

# Simple JWT settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=30),  # 30 days for better UX
    "REFRESH_TOKEN_LIFETIME": timedelta(days=90),  # 90 days refresh token
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SECRET_KEY", default=SECRET_KEY),
    "VERIFYING_KEY": None,
    "AUDIENCE": None,
    "ISSUER": None,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# CORS settings
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
)

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# CSRF settings
CSRF_COOKIE_SECURE = not DEBUG  # HTTPS only in production
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read for AJAX
CSRF_COOKIE_SAMESITE = "Lax"  # Prevent CSRF in modern browsers
CSRF_COOKIE_NAME = "csrftoken"
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
)
CSRF_USE_SESSIONS = False  # Use cookies instead of sessions

# Cache Configuration
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://127.0.0.1:6379/1"),
        "KEY_PREFIX": "aisreact",
        "TIMEOUT": 300,  # 5 minutes default
    }
}

# Cache middleware for full page caching
if not DEBUG:
    MIDDLEWARE.insert(0, "django.middleware.cache.UpdateCacheMiddleware")
    MIDDLEWARE.append("django.middleware.cache.FetchFromCacheMiddleware")
    CACHE_MIDDLEWARE_ALIAS = "default"
    CACHE_MIDDLEWARE_SECONDS = 60
    CACHE_MIDDLEWARE_KEY_PREFIX = "page"
    # Only cache pages for anonymous users to prevent user-specific data issues
    CACHE_MIDDLEWARE_ANONYMOUS_ONLY = True

# Celery Configuration
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Email Configuration
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@aisreact.com")
SERVER_EMAIL = env("SERVER_EMAIL", default="noreply@aisreact.com")
SUPPORT_EMAIL = env("SUPPORT_EMAIL", default="support@aisreact.com")

# SendGrid Configuration
SENDGRID_API_KEY = env("SENDGRID_API_KEY", default="")

# SMTP Configuration (for Django SMTP backend)
if EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
    EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
    EMAIL_PORT = env("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = env("EMAIL_USE_TLS", default=True)
    EMAIL_USE_SSL = env("EMAIL_USE_SSL", default=False)

# Frontend URL for email links
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# AWS S3 Configuration
# Bucket name is needed in both dev and production for avatar uploads
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="aisreact-uploads")

# AWS credentials - needed for avatar uploads in both dev and production
# If not set, boto3 will use AWS CLI credentials
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)

# Additional S3 settings
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")

# Use CloudFront domain if configured, otherwise use S3 directly
AWS_CLOUDFRONT_DOMAIN = env("AWS_CLOUDFRONT_DOMAIN", default=None)
if AWS_CLOUDFRONT_DOMAIN:
    AWS_S3_CUSTOM_DOMAIN = AWS_CLOUDFRONT_DOMAIN
else:
    AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"

if not DEBUG:
    AWS_S3_OBJECT_PARAMETERS = {
        "CacheControl": "max-age=86400",
    }
    # Disable ACL as bucket uses bucket policy instead
    AWS_DEFAULT_ACL = None

    # Use S3 for media files in production
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"

# Security settings for production
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# Logging
LOGGING = get_logging_config(debug=DEBUG)
