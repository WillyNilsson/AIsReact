"""
Email utility functions for common email operations.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .email import email_service

logger = logging.getLogger(__name__)


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Token generator for email verification."""

    def _make_hash_value(self, user, timestamp):
        """
        Override to include email verification status.
        Token is invalidated when email is verified.
        """
        return f"{user.pk}{timestamp}{user.email}{user.is_verified}"


# Create singleton instances
password_reset_token_generator = PasswordResetTokenGenerator()
email_verification_token_generator = EmailVerificationTokenGenerator()


def generate_password_reset_link(user) -> str:
    """Generate a password reset link for the user."""
    from api.models import PasswordResetToken

    # Create a new reset token
    raw_token, reset_token = PasswordResetToken.create_token(user)

    # Create reset URL with the raw token
    reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={raw_token}"
    return reset_url


def generate_email_verification_link(user) -> str:
    """Generate an email verification link for the user."""
    from api.models import EmailVerificationToken

    # Create a new verification token
    raw_token, verification_token = EmailVerificationToken.create_token(user)

    # Create verification URL with the raw token
    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={raw_token}"
    return verification_url


def send_password_reset(user) -> bool:
    """Send password reset email to user."""
    try:
        reset_url = generate_password_reset_link(user)
        success = email_service.send_password_reset_email(user, reset_url)

        if success:
            logger.info(f"Password reset email sent to user {user.id}")
        else:
            logger.error(f"Failed to send password reset email to user {user.id}")

        return success
    except Exception as e:
        logger.error(f"Error sending password reset email: {str(e)}")
        return False


def send_email_verification(user) -> bool:
    """Send email verification to user."""
    try:
        if user.is_verified:
            logger.warning(f"User {user.id} email already verified")
            return False

        verification_url = generate_email_verification_link(user)
        success = email_service.send_verification_email(user, verification_url)

        if success:
            logger.info(f"Verification email sent to user {user.id}")
        else:
            logger.error(f"Failed to send verification email to user {user.id}")

        return success
    except Exception as e:
        logger.error(f"Error sending verification email: {str(e)}")
        return False


def send_welcome_email(user) -> bool:
    """Send welcome email to new user."""
    try:
        success = email_service.send_welcome_email(user)

        if success:
            logger.info(f"Welcome email sent to user {user.id}")
        else:
            logger.error(f"Failed to send welcome email to user {user.id}")

        return success
    except Exception as e:
        logger.error(f"Error sending welcome email: {str(e)}")
        return False


def send_post_status_notification(
    post, status: str, reason: Optional[str] = None
) -> bool:
    """Send email notification about post status change."""
    try:
        user = post.user

        if status == "live":
            success = email_service.send_post_approved_email(user, post)
        elif status == "rejected":
            success = email_service.send_post_rejected_email(
                user, post, reason or "Content policy violation"
            )
        else:
            logger.warning(f"Unknown post status for notification: {status}")
            return False

        if success:
            logger.info(
                f"Post status notification sent for post {post.id} to user {user.id}"
            )
        else:
            logger.error(f"Failed to send post status notification for post {post.id}")

        return success
    except Exception as e:
        logger.error(f"Error sending post status notification: {str(e)}")
        return False


def validate_email_domain(email: str) -> bool:
    """
    Validate email domain against blocklist.
    Returns True if email domain is allowed.
    """
    blocked_domains = getattr(
        settings,
        "BLOCKED_EMAIL_DOMAINS",
        [
            "tempmail.com",
            "throwaway.email",
            "guerrillamail.com",
            "mailinator.com",
            "10minutemail.com",
            "temp-mail.org",
        ],
    )

    domain = email.split("@")[-1].lower()
    return domain not in blocked_domains


def is_email_delivery_enabled() -> bool:
    """Check if email delivery is enabled (not using console backend)."""
    return settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"


def get_email_stats() -> dict:
    """Get email configuration stats for debugging."""
    return {
        "backend": settings.EMAIL_BACKEND,
        "from_email": settings.DEFAULT_FROM_EMAIL,
        "support_email": settings.SUPPORT_EMAIL,
        "sendgrid_configured": bool(getattr(settings, "SENDGRID_API_KEY", None)),
        "smtp_configured": bool(getattr(settings, "EMAIL_HOST", None)),
        "delivery_enabled": is_email_delivery_enabled(),
    }
