"""
Middleware for API security features.
"""

import logging

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger(__name__)


class LoginAttemptMiddleware:
    """
    Middleware to track and limit login attempts by IP address.
    Prevents distributed brute force attacks.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Configuration
        self.max_attempts_per_ip = 20  # Max attempts per IP per time window
        self.time_window = 900  # 15 minutes in seconds
        self.lockout_duration = 3600  # 1 hour in seconds

    def __call__(self, request):
        # Only apply to login endpoints
        if (
            request.path in ["/api/auth/token/", "/api/auth/login/"]
            and request.method == "POST"
        ):
            ip_address = self.get_client_ip(request)

            # Check if IP is locked out
            lockout_key = f"login_lockout:{ip_address}"
            if cache.get(lockout_key):
                logger.warning(f"Blocked login attempt from locked IP: {ip_address}")
                return JsonResponse(
                    {
                        "detail": (
                            "Too many login attempts from this IP address. "
                            "Please try again later."
                        )
                    },
                    status=429,  # Too Many Requests
                )

            # Check attempt count
            attempt_key = f"login_attempts:{ip_address}"
            attempts = cache.get(attempt_key, 0)

            if attempts >= self.max_attempts_per_ip:
                # Lock out the IP
                cache.set(lockout_key, True, self.lockout_duration)
                cache.delete(attempt_key)  # Reset counter
                logger.warning(
                    f"IP locked out due to excessive login attempts: {ip_address}"
                )
                return JsonResponse(
                    {
                        "detail": (
                            "Too many login attempts from this IP address. "
                            "Please try again in 1 hour."
                        )
                    },
                    status=429,
                )

        response = self.get_response(request)

        # Increment counter after login attempt
        if (
            request.path in ["/api/auth/token/", "/api/auth/login/"]
            and request.method == "POST"
        ):
            ip_address = self.get_client_ip(request)
            attempt_key = f"login_attempts:{ip_address}"

            # Only count failed attempts (non-200 responses)
            if response.status_code != 200:
                attempts = cache.get(attempt_key, 0)
                cache.set(attempt_key, attempts + 1, self.time_window)
            else:
                # Clear attempts on successful login
                cache.delete(attempt_key)

        return response

    def get_client_ip(self, request):
        """Get the client's IP address from the request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            # Take the first IP in the chain (client's IP)
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses.

    This middleware adds various security headers to protect against
    common web vulnerabilities.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only add headers if not already set by Django

        # Content Security Policy
        if not response.get("Content-Security-Policy"):
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
                "https://cdn.jsdelivr.net",  # Allow inline scripts for now
                "style-src 'self' 'unsafe-inline' "
                "https://fonts.googleapis.com",  # Allow inline styles
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https: blob:",  # Allow images from anywhere
                "connect-src 'self' ws: wss: http://localhost:* "
                "http://127.0.0.1:*",  # Allow WebSocket and local connections
                "frame-ancestors 'none'",  # Prevent embedding
                "base-uri 'self'",
                "form-action 'self'",
            ]
            response["Content-Security-Policy"] = "; ".join(csp_directives)

        # Strict Transport Security (already in Django settings for production)
        if (
            hasattr(settings, "SECURE_HSTS_SECONDS")
            and settings.SECURE_HSTS_SECONDS
            and not response.get("Strict-Transport-Security")
        ):
            hsts_header = f"max-age={settings.SECURE_HSTS_SECONDS}"
            if (
                hasattr(settings, "SECURE_HSTS_INCLUDE_SUBDOMAINS")
                and settings.SECURE_HSTS_INCLUDE_SUBDOMAINS
            ):
                hsts_header += "; includeSubDomains"
            if (
                hasattr(settings, "SECURE_HSTS_PRELOAD")
                and settings.SECURE_HSTS_PRELOAD
            ):
                hsts_header += "; preload"
            response["Strict-Transport-Security"] = hsts_header

        # X-Content-Type-Options
        if not response.get("X-Content-Type-Options"):
            response["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options (already in Django settings)
        if hasattr(settings, "X_FRAME_OPTIONS") and not response.get("X-Frame-Options"):
            response["X-Frame-Options"] = settings.X_FRAME_OPTIONS

        # X-XSS-Protection (legacy but still useful)
        if not response.get("X-XSS-Protection"):
            response["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy
        if not response.get("Referrer-Policy"):
            response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy (formerly Feature-Policy)
        if not response.get("Permissions-Policy"):
            permissions = [
                "accelerometer=()",
                "camera=()",
                "geolocation=()",
                "gyroscope=()",
                "magnetometer=()",
                "microphone=()",
                "payment=()",
                "usb=()",
            ]
            response["Permissions-Policy"] = ", ".join(permissions)

        # Remove server identification headers
        response["Server"] = "aisreact"  # Generic server name
        if "X-Powered-By" in response:
            del response["X-Powered-By"]

        # Cache-Control for ALL API endpoints
        # API responses should never be cached by the full-page cache middleware
        # because they often contain user-specific data (user_vote, permissions, etc.)
        # and handle mutations (POST, PUT, DELETE requests)
        # Static assets and non-API pages can still be cached

        # Check if this is an API endpoint
        is_api_endpoint = request.path.startswith("/api/")

        if is_api_endpoint and not response.get("Cache-Control"):
            # Prevent caching of user-specific data
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            # Also set Vary header to indicate response varies by user
            response["Vary"] = "Authorization"

        return response
