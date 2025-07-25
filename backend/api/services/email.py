"""
Email service for aisreact platform.

Supports multiple email providers:
- SendGrid (primary)
- Django SMTP (fallback)
- Console backend (development)
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils.html import strip_tags

try:
    import sendgrid
    from sendgrid.helpers.mail import Content, Email, Mail, To

    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    sendgrid = None

logger = logging.getLogger(__name__)


class EmailBackend(ABC):
    """Abstract base class for email backends."""

    @abstractmethod
    def send(
        self,
        subject: str,
        html_content: str,
        text_content: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
    ) -> bool:
        """Send an email."""
        pass


class SendGridBackend(EmailBackend):
    """SendGrid email backend."""

    def __init__(self):
        self.api_key = getattr(settings, "SENDGRID_API_KEY", None)
        self.from_email = getattr(
            settings, "DEFAULT_FROM_EMAIL", "noreply@aisreact.com"
        )
        self.sg = None
        if SENDGRID_AVAILABLE and self.api_key:
            self.sg = sendgrid.SendGridAPIClient(api_key=self.api_key)

    def send(
        self,
        subject: str,
        html_content: str,
        text_content: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
    ) -> bool:
        """Send email via SendGrid."""
        if not SENDGRID_AVAILABLE:
            logger.error("SendGrid not available (not installed)")
            return False
        if not self.sg:
            logger.error("SendGrid API key not configured")
            return False

        try:
            message = Mail(
                from_email=Email(from_email or self.from_email),
                to_emails=[To(email) for email in to_emails],
                subject=subject,
                plain_text_content=Content("text/plain", text_content),
                html_content=Content("text/html", html_content),
            )

            response = self.sg.send(message)
            logger.info(
                f"Email sent via SendGrid to {to_emails}, "
                f"status: {response.status_code}"
            )
            return response.status_code in [200, 201, 202]

        except Exception as e:
            logger.error(f"SendGrid error: {str(e)}")
            return False


class DjangoSMTPBackend(EmailBackend):
    """Django SMTP email backend."""

    def __init__(self):
        self.from_email = getattr(
            settings, "DEFAULT_FROM_EMAIL", "noreply@aisreact.com"
        )

    def send(
        self,
        subject: str,
        html_content: str,
        text_content: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
    ) -> bool:
        """Send email via Django's email backend."""
        try:
            connection = get_connection()
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email or self.from_email,
                to=to_emails,
                connection=connection,
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            logger.info(f"Email sent via Django SMTP to {to_emails}")
            return True

        except Exception as e:
            logger.error(f"Django SMTP error: {str(e)}")
            return False


class ConsoleBackend(EmailBackend):
    """Console email backend for development."""

    def send(
        self,
        subject: str,
        html_content: str,
        text_content: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
    ) -> bool:
        """Print email to console."""
        print("=" * 60)
        print(f"EMAIL TO: {', '.join(to_emails)}")
        print(f"FROM: {from_email or 'noreply@aisreact.com'}")
        print(f"SUBJECT: {subject}")
        print("-" * 60)
        print("TEXT VERSION:")
        print(text_content)
        print("-" * 60)
        print("HTML VERSION:")
        print(html_content)
        print("=" * 60)
        return True


class EmailService:
    """Main email service that manages multiple backends."""

    def __init__(self):
        self.backends = self._initialize_backends()

    def _initialize_backends(self) -> List[EmailBackend]:
        """Initialize email backends based on settings."""
        backends: List[EmailBackend] = []

        # Add backends in priority order
        if hasattr(settings, "SENDGRID_API_KEY") and settings.SENDGRID_API_KEY:
            backends.append(SendGridBackend())

        if settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend":
            backends.append(DjangoSMTPBackend())

        # Always add console backend as last resort (or primary for dev)
        if settings.DEBUG or not backends:
            backends.append(ConsoleBackend())

        return backends

    def _render_email_template(
        self, template_name: str, context: Dict[str, Any]
    ) -> tuple[str, str]:
        """Render email template to HTML and text."""
        # Render HTML version
        html_content = render_to_string(f"emails/{template_name}.html", context)

        # Try to render text version, or strip HTML
        try:
            text_content = render_to_string(f"emails/{template_name}.txt", context)
        except Exception:
            # Text template not found, fall back to stripping HTML
            logger.debug(
                f"Text template not found for {template_name}, using stripped HTML"
            )
            text_content = str(strip_tags(html_content))

        return html_content, text_content

    def _send_with_fallback(
        self,
        subject: str,
        html_content: str,
        text_content: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
    ) -> bool:
        """Send email using backends with fallback."""
        for backend in self.backends:
            try:
                if backend.send(
                    subject, html_content, text_content, to_emails, from_email
                ):
                    return True
                logger.warning(
                    f"Failed to send with {backend.__class__.__name__}, "
                    f"trying next backend"
                )
            except Exception as e:
                logger.error(f"Error with {backend.__class__.__name__}: {str(e)}")
                continue

        logger.error(f"All email backends failed for email to {to_emails}")
        return False

    def send_password_reset_email(self, user, reset_url: str) -> bool:
        """Send password reset email to user."""
        context = {
            "user": user,
            "reset_url": reset_url,
            "site_name": "aisreact",
            "support_email": getattr(settings, "SUPPORT_EMAIL", "support@aisreact.com"),
        }

        html_content, text_content = self._render_email_template(
            "password_reset", context
        )

        return self._send_with_fallback(
            subject="Password Reset Request - aisreact",
            html_content=html_content,
            text_content=text_content,
            to_emails=[user.email],
        )

    def send_verification_email(self, user, verification_url: str) -> bool:
        """Send email verification to user."""
        context = {
            "user": user,
            "verification_url": verification_url,
            "site_name": "aisreact",
            "expire_days": 7,
        }

        html_content, text_content = self._render_email_template(
            "email_verification", context
        )

        return self._send_with_fallback(
            subject="Verify Your Email - aisreact",
            html_content=html_content,
            text_content=text_content,
            to_emails=[user.email],
        )

    def send_welcome_email(self, user) -> bool:
        """Send welcome email to new user."""
        context = {
            "user": user,
            "site_name": "aisreact",
            "login_url": (
                f"{getattr(settings, 'FRONTEND_URL', 'https://aisreact.com')}" f"/login"
            ),
            "submit_url": (
                f"{getattr(settings, 'FRONTEND_URL', 'https://aisreact.com')}"
                f"/submit"
            ),
            "features": [
                "Submit news and events for AI analysis",
                "View how different AI models react to the same content",
                "Participate in community verification",
                "Access transparent moderation logs",
            ],
        }

        html_content, text_content = self._render_email_template("welcome", context)

        return self._send_with_fallback(
            subject="Welcome to aisreact!",
            html_content=html_content,
            text_content=text_content,
            to_emails=[user.email],
        )

    def send_post_approved_email(self, user, post) -> bool:
        """Send email when post is approved and goes live."""
        context = {
            "user": user,
            "post": post,
            "post_url": (
                f"{getattr(settings, 'FRONTEND_URL', 'https://aisreact.com')}"
                f"/posts/{post.id}"
            ),
            "site_name": "aisreact",
        }

        html_content, text_content = self._render_email_template(
            "post_approved", context
        )

        return self._send_with_fallback(
            subject="Your Post is Now Live - aisreact",
            html_content=html_content,
            text_content=text_content,
            to_emails=[user.email],
        )

    def send_post_rejected_email(self, user, post, reason: str) -> bool:
        """Send email when post is rejected."""
        context = {
            "user": user,
            "post": post,
            "reason": reason,
            "guidelines_url": (
                f"{getattr(settings, 'FRONTEND_URL', 'https://aisreact.com')}"
                f"/guidelines"
            ),
            "site_name": "aisreact",
        }

        html_content, text_content = self._render_email_template(
            "post_rejected", context
        )

        return self._send_with_fallback(
            subject="Post Moderation Update - aisreact",
            html_content=html_content,
            text_content=text_content,
            to_emails=[user.email],
        )


# Create a singleton instance
email_service = EmailService()
