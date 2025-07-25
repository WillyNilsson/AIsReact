"""
Tests for email service functionality.
"""

from unittest.mock import MagicMock, patch

import pytest
from api.models import Post
from api.services.email import (
    ConsoleBackend,
    DjangoSMTPBackend,
    EmailService,
    SendGridBackend,
)
from api.services.email_utils import (
    generate_email_verification_link,
    generate_password_reset_link,
    send_email_verification,
    send_password_reset,
    send_post_status_notification,
    send_welcome_email,
    validate_email_domain,
)
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

User = get_user_model()


class EmailBackendTests(TestCase):
    """Test individual email backends."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_console_backend(self):
        """Test console email backend."""
        backend = ConsoleBackend()

        # Should always return True and print to console
        result = backend.send(
            subject="Test Email",
            html_content="<p>Test HTML</p>",
            text_content="Test Text",
            to_emails=["test@example.com"],
        )

        self.assertTrue(result)

    @patch("sendgrid.SendGridAPIClient")
    def test_sendgrid_backend_success(self, mock_sg_client):
        """Test SendGrid backend successful send."""
        # Mock SendGrid response
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_sg_client.return_value.send.return_value = mock_response

        with override_settings(SENDGRID_API_KEY="test-key"):
            backend = SendGridBackend()
            result = backend.send(
                subject="Test Email",
                html_content="<p>Test HTML</p>",
                text_content="Test Text",
                to_emails=["test@example.com"],
            )

            self.assertTrue(result)
            mock_sg_client.return_value.send.assert_called_once()

    @patch("sendgrid.SendGridAPIClient")
    def test_sendgrid_backend_failure(self, mock_sg_client):
        """Test SendGrid backend failure."""
        mock_sg_client.return_value.send.side_effect = Exception("API Error")

        with override_settings(SENDGRID_API_KEY="test-key"):
            backend = SendGridBackend()
            result = backend.send(
                subject="Test Email",
                html_content="<p>Test HTML</p>",
                text_content="Test Text",
                to_emails=["test@example.com"],
            )

            self.assertFalse(result)

    @patch("django.core.mail.EmailMultiAlternatives.send")
    def test_django_smtp_backend_success(self, mock_send):
        """Test Django SMTP backend successful send."""
        mock_send.return_value = 1  # Number of emails sent

        backend = DjangoSMTPBackend()
        result = backend.send(
            subject="Test Email",
            html_content="<p>Test HTML</p>",
            text_content="Test Text",
            to_emails=["test@example.com"],
        )

        self.assertTrue(result)
        mock_send.assert_called_once()

    @patch("django.core.mail.EmailMultiAlternatives.send")
    def test_django_smtp_backend_failure(self, mock_send):
        """Test Django SMTP backend failure."""
        mock_send.side_effect = Exception("SMTP Error")

        backend = DjangoSMTPBackend()
        result = backend.send(
            subject="Test Email",
            html_content="<p>Test HTML</p>",
            text_content="Test Text",
            to_emails=["test@example.com"],
        )

        self.assertFalse(result)


class EmailServiceTests(TestCase):
    """Test main email service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.service = EmailService()

    @override_settings(
        DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend"
    )
    def test_email_service_initialization_dev(self):
        """Test email service initialization in development."""
        service = EmailService()

        # Should have console backend in dev
        self.assertTrue(any(isinstance(b, ConsoleBackend) for b in service.backends))

    @override_settings(
        DEBUG=False,
        SENDGRID_API_KEY="test-key",
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    )
    def test_email_service_initialization_prod(self):
        """Test email service initialization in production."""
        service = EmailService()

        # Should have SendGrid and SMTP backends
        backend_types = [type(b).__name__ for b in service.backends]
        self.assertIn("SendGridBackend", backend_types)
        self.assertIn("DjangoSMTPBackend", backend_types)

    @patch.object(EmailService, "_send_with_fallback", return_value=True)
    def test_send_password_reset_email(self, mock_send):
        """Test sending password reset email."""
        result = self.service.send_password_reset_email(
            self.user, "https://example.com/reset/token"
        )

        self.assertTrue(result)
        mock_send.assert_called_once()

        # Check email content
        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["subject"], "Password Reset Request - aisreact")
        self.assertIn("reset", call_args["html_content"].lower())
        self.assertIn("https://example.com/reset/token", call_args["html_content"])

    @patch.object(EmailService, "_send_with_fallback", return_value=True)
    def test_send_verification_email(self, mock_send):
        """Test sending verification email."""
        result = self.service.send_verification_email(
            self.user, "https://example.com/verify/token"
        )

        self.assertTrue(result)
        mock_send.assert_called_once()

        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["subject"], "Verify Your Email - aisreact")
        self.assertIn("verify", call_args["html_content"].lower())

    @patch.object(EmailService, "_send_with_fallback", return_value=True)
    def test_send_welcome_email(self, mock_send):
        """Test sending welcome email."""
        result = self.service.send_welcome_email(self.user)

        self.assertTrue(result)
        mock_send.assert_called_once()

        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["subject"], "Welcome to aisreact!")
        self.assertIn("welcome", call_args["html_content"].lower())

    @patch.object(EmailService, "_send_with_fallback", return_value=True)
    def test_send_post_approved_email(self, mock_send):
        """Test sending post approved email."""
        post = Post.objects.create(
            user=self.user,
            title="Test Post",
            content="Test content",
            source_url="https://example.com/news",
        )

        result = self.service.send_post_approved_email(self.user, post)

        self.assertTrue(result)
        mock_send.assert_called_once()

        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["subject"], "Your Post is Now Live - aisreact")
        self.assertIn("Test Post", call_args["html_content"])

    @patch.object(EmailService, "_send_with_fallback", return_value=True)
    def test_send_post_rejected_email(self, mock_send):
        """Test sending post rejected email."""
        post = Post.objects.create(
            user=self.user,
            title="Test Post",
            content="Test content",
            source_url="https://example.com/news",
        )

        result = self.service.send_post_rejected_email(
            self.user, post, "Content violates guidelines"
        )

        self.assertTrue(result)
        mock_send.assert_called_once()

        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["subject"], "Post Moderation Update - aisreact")
        self.assertIn("Content violates guidelines", call_args["html_content"])


class EmailUtilsTests(TestCase):
    """Test email utility functions."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_generate_password_reset_link(self):
        """Test password reset link generation."""
        link = generate_password_reset_link(self.user)

        self.assertIn("/auth/reset-password", link)
        self.assertIn("token=", link)  # Token should be in link

    def test_generate_email_verification_link(self):
        """Test email verification link generation."""
        link = generate_email_verification_link(self.user)

        self.assertIn("/auth/verify-email", link)
        self.assertIn("token=", link)  # Token should be in link

    @patch("api.services.email.email_service.send_password_reset_email")
    def test_send_password_reset(self, mock_send):
        """Test send password reset utility."""
        mock_send.return_value = True

        result = send_password_reset(self.user)

        self.assertTrue(result)
        mock_send.assert_called_once()

    @patch("api.services.email.email_service.send_verification_email")
    def test_send_email_verification(self, mock_send):
        """Test send email verification utility."""
        mock_send.return_value = True

        result = send_email_verification(self.user)

        self.assertTrue(result)
        mock_send.assert_called_once()

    @patch("api.services.email.email_service.send_welcome_email")
    def test_send_welcome_email_util(self, mock_send):
        """Test send welcome email utility."""
        mock_send.return_value = True

        result = send_welcome_email(self.user)

        self.assertTrue(result)
        mock_send.assert_called_once()

    def test_validate_email_domain(self):
        """Test email domain validation."""
        # Valid domains
        self.assertTrue(validate_email_domain("user@gmail.com"))
        self.assertTrue(validate_email_domain("user@company.com"))

        # Blocked domains
        self.assertFalse(validate_email_domain("user@tempmail.com"))
        self.assertFalse(validate_email_domain("user@mailinator.com"))

    @patch("api.services.email.email_service.send_post_approved_email")
    def test_send_post_status_notification_approved(self, mock_send):
        """Test sending post approval notification."""
        mock_send.return_value = True

        post = Post.objects.create(
            user=self.user,
            title="Test Post",
            content="Test content",
            source_url="https://example.com/news",
        )

        result = send_post_status_notification(post, "live")

        self.assertTrue(result)
        mock_send.assert_called_once_with(self.user, post)

    @patch("api.services.email.email_service.send_post_rejected_email")
    def test_send_post_status_notification_rejected(self, mock_send):
        """Test sending post rejection notification."""
        mock_send.return_value = True

        post = Post.objects.create(
            user=self.user,
            title="Test Post",
            content="Test content",
            source_url="https://example.com/news",
        )

        result = send_post_status_notification(post, "rejected", "Spam content")

        self.assertTrue(result)
        mock_send.assert_called_once_with(self.user, post, "Spam content")
