"""
Custom throttle classes for API endpoints.
"""

import hashlib
import logging

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

logger = logging.getLogger(__name__)


class RegistrationThrottle(AnonRateThrottle):
    """
    Throttle specifically for registration endpoint.
    Prevents spam account creation.
    """

    scope = "registration"
    rate = "5/hour"  # Reduced from 10 to 5 registration attempts per hour per IP

    def get_cache_key(self, request, view):
        """Include email in cache key to prevent same email spam."""
        ident = self.get_ident(request)
        email = request.data.get("email", "").lower()
        if email:
            # Hash email to avoid storing PII in cache keys
            email_hash = hashlib.sha256(email.encode()).hexdigest()[:8]
            return self.cache_format % {
                "scope": self.scope,
                "ident": f"{ident}:{email_hash}",
            }
        return super().get_cache_key(request, view)


class LoginThrottle(AnonRateThrottle):
    """
    Throttle for login attempts.
    Stricter to prevent brute force attacks.
    """

    scope = "login"
    rate = "10/hour"  # 10 login attempts per hour per IP

    def get_cache_key(self, request, view):
        """Include username in cache key for per-account throttling."""
        ident = self.get_ident(request)
        username = request.data.get("username", "").lower()
        if username:
            # Hash username to avoid storing PII in cache keys
            username_hash = hashlib.sha256(username.encode()).hexdigest()[:8]
            return self.cache_format % {
                "scope": self.scope,
                "ident": f"{ident}:{username_hash}",
            }
        return super().get_cache_key(request, view)


class PasswordResetThrottle(AnonRateThrottle):
    """
    Throttle for password reset requests.
    Very strict to prevent email bombing.
    """

    scope = "password_reset"
    rate = "3/hour"  # Only 3 password reset requests per hour per IP

    def get_cache_key(self, request, view):
        """Include email in cache key."""
        ident = self.get_ident(request)
        email = request.data.get("email", "").lower()
        if email:
            email_hash = hashlib.sha256(email.encode()).hexdigest()[:8]
            return self.cache_format % {
                "scope": self.scope,
                "ident": f"{ident}:{email_hash}",
            }
        return super().get_cache_key(request, view)


class TokenRefreshThrottle(UserRateThrottle):
    """
    Throttle for token refresh endpoint.
    Allows authenticated users more attempts.
    """

    scope = "token_refresh"
    rate = "30/hour"  # 30 refresh attempts per hour per user

    def get_ident(self, request):
        """Use token JTI if available, otherwise IP."""
        # Try to get refresh token from request
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken

                token = RefreshToken(refresh_token)
                # Use token JTI as identifier
                return token.get("jti", super().get_ident(request))
            except Exception as e:
                # If token parsing fails, fall back to IP-based throttling
                logger.debug(f"Token parsing failed for throttling: {str(e)}")
                pass
        return super().get_ident(request)


class EmailVerificationThrottle(AnonRateThrottle):
    """
    Throttle for email verification resend.
    """

    scope = "email_verification"
    rate = "5/hour"  # 5 verification email requests per hour


class AuthThrottle(AnonRateThrottle):
    """
    General throttle for other auth endpoints.
    """

    scope = "auth"
    rate = "20/hour"  # Allow 20 auth attempts per hour per IP


class StrictUserThrottle(UserRateThrottle):
    """
    Stricter throttle for sensitive user operations.
    """

    scope = "strict_user"
    rate = "10/hour"  # 10 sensitive operations per hour per user


def get_throttle_wait_message(throttle_instance):
    """
    Generate user-friendly throttle wait message.
    """
    try:
        wait_time = int(throttle_instance.wait())
        if wait_time < 60:
            return f"Too many requests. Please try again in {wait_time} seconds."
        elif wait_time < 3600:
            minutes = wait_time // 60
            return f"Too many requests. Please try again in {minutes} minute{'s' if minutes > 1 else ''}."
        else:
            hours = wait_time // 3600
            return f"Too many requests. Please try again in {hours} hour{'s' if hours > 1 else ''}."
    except (AttributeError, TypeError, ValueError) as e:
        logger.debug(f"Failed to calculate throttle wait time: {str(e)}")
        return "Too many requests. Please try again later."
