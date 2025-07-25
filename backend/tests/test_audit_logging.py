"""
Tests for audit logging functionality.
"""

import json
from datetime import datetime, timedelta
from unittest import skip
from unittest.mock import Mock, patch

from api.admin import AuditLogAdmin
from api.models import AuditLog
from api.utils.audit import AuditContextManager, AuditLogger, audit_action
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()


class AuditLogModelTest(TestCase):
    """Test the AuditLog model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.factory = RequestFactory()

    def test_create_audit_log(self):
        """Test creating an audit log entry."""
        log = AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            success=True,
            ip_address="127.0.0.1",
            user_agent="Test Browser",
            request_id="test-123",
        )

        self.assertEqual(log.user, self.user)
        self.assertEqual(log.username, "testuser")
        self.assertEqual(log.action, "login")
        self.assertEqual(log.category, "auth")
        self.assertTrue(log.success)

    def test_audit_log_immutability(self):
        """Test that audit logs cannot be updated."""
        log = AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        # Try to update
        log.action = AuditLog.ACTION_LOGOUT
        with self.assertRaises(ValidationError) as context:
            log.save()
        self.assertIn("cannot be updated", str(context.exception))

    def test_audit_log_cannot_delete(self):
        """Test that audit logs cannot be deleted."""
        log = AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        with self.assertRaises(ValidationError) as context:
            log.delete()
        self.assertIn("cannot be deleted", str(context.exception))

    def test_manager_prevents_bulk_update(self):
        """Test that the manager prevents bulk updates."""
        AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        with self.assertRaises(ValidationError) as context:
            AuditLog.objects.update(success=False)
        self.assertIn("cannot be updated", str(context.exception))

    def test_manager_prevents_bulk_delete(self):
        """Test that the manager prevents bulk deletes."""
        AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        with self.assertRaises(ValidationError) as context:
            AuditLog.objects.all().delete()
        self.assertIn("cannot be deleted", str(context.exception))

    def test_sensitive_data_redaction(self):
        """Test that sensitive data is automatically redacted."""
        log = AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            context={
                "username": "testuser",
                "password": "secret123",
                "api_key": "sk-1234567890",
                "auth_token": "bearer-token",
                "normal_field": "visible",
            },
        )

        # Refresh from database
        log.refresh_from_db()

        self.assertEqual(log.context["username"], "testuser")
        self.assertEqual(log.context["password"], "[REDACTED]")
        self.assertEqual(log.context["api_key"], "[REDACTED]")
        self.assertEqual(log.context["auth_token"], "[REDACTED]")
        self.assertEqual(log.context["normal_field"], "visible")

    def test_nested_redaction(self):
        """Test redaction works on nested data structures."""
        log = AuditLog.objects.create(
            user=self.user,
            username=self.user.username,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            context={
                "user": {
                    "name": "John",
                    "password": "secret",
                    "profile": {"api_key": "key123"},
                },
                "tokens": [{"access_token": "token1"}, {"refresh_token": "token2"}],
            },
        )

        log.refresh_from_db()

        self.assertEqual(log.context["user"]["name"], "John")
        self.assertEqual(log.context["user"]["password"], "[REDACTED]")
        self.assertEqual(log.context["user"]["profile"]["api_key"], "[REDACTED]")

        # Check that tokens is still a list after redaction
        self.assertIsInstance(log.context["tokens"], list)
        self.assertEqual(len(log.context["tokens"]), 2)
        self.assertEqual(log.context["tokens"][0]["access_token"], "[REDACTED]")
        self.assertEqual(log.context["tokens"][1]["refresh_token"], "[REDACTED]")

    def test_log_class_method(self):
        """Test the convenience log() class method."""
        request = self.factory.get("/test", HTTP_X_REQUEST_ID="req-123")

        log = AuditLog.log(
            user=self.user,
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            request=request,
            extra_field="extra_value",
        )

        self.assertEqual(log.user, self.user)
        self.assertEqual(log.username, "testuser")
        self.assertEqual(log.action, "login")
        self.assertEqual(log.request_id, "req-123")
        self.assertEqual(log.context["extra_field"], "extra_value")

    def test_anonymous_user_logging(self):
        """Test logging for anonymous users."""
        log = AuditLog.log(
            user=None,
            action=AuditLog.ACTION_LOGIN_FAILED,
            category=AuditLog.AUTHENTICATION,
            request=None,
        )

        self.assertIsNone(log.user)
        self.assertEqual(log.username, "anonymous")
        self.assertIsNone(log.user_id_snapshot)


class AuditLoggerTest(TestCase):
    """Test the AuditLogger utility class."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.factory = RequestFactory()
        self.request = self.factory.post("/login")
        self.request.user = self.user
        self.request.META["REMOTE_ADDR"] = "127.0.0.1"

    def test_log_authentication(self):
        """Test logging authentication events."""
        log = AuditLogger.log_authentication(
            request=self.request,
            action=AuditLog.ACTION_LOGIN,
            success=True,
            user=self.user,
        )

        self.assertEqual(log.category, AuditLog.AUTHENTICATION)
        self.assertEqual(log.action, "login")
        self.assertTrue(log.success)
        self.assertEqual(log.user, self.user)
        self.assertEqual(log.ip_address, "127.0.0.1")

    def test_log_user_management(self):
        """Test logging user management events."""
        target_user = User.objects.create_user(
            username="targetuser", email="target@example.com"
        )

        log = AuditLogger.log_user_management(
            request=self.request,
            action=AuditLog.ACTION_ROLE_CHANGE,
            target_user=target_user,
            old_role="user",
            new_role="moderator",
        )

        self.assertEqual(log.category, AuditLog.USER_MANAGEMENT)
        self.assertEqual(log.resource_type, "user")
        self.assertEqual(log.resource_id, target_user.id)
        self.assertEqual(log.context["target_user_id"], target_user.id)
        self.assertEqual(log.context["old_role"], "user")
        self.assertEqual(log.context["new_role"], "moderator")

    def test_log_content_moderation(self):
        """Test logging content moderation events."""
        log = AuditLogger.log_content_moderation(
            request=self.request,
            action=AuditLog.ACTION_POST_MODERATE,
            post_id=123,
            reason="Spam content",
            moderation_action="reject",
        )

        self.assertEqual(log.category, AuditLog.CONTENT_MODERATION)
        self.assertEqual(log.resource_type, "post")
        self.assertEqual(log.resource_id, 123)
        self.assertEqual(log.reason, "Spam content")
        self.assertEqual(log.context["moderation_action"], "reject")

    def test_log_security(self):
        """Test logging security events."""
        log = AuditLogger.log_security(
            request=self.request,
            action=AuditLog.ACTION_ACCOUNT_LOCK,
            severity="high",
            reason="Too many failed attempts",
        )

        self.assertEqual(log.category, AuditLog.SECURITY)
        self.assertEqual(log.context["severity"], "high")
        self.assertEqual(log.context["reason"], "Too many failed attempts")

    def test_log_data_access(self):
        """Test logging data access events."""
        log = AuditLogger.log_data_access(
            request=self.request,
            action=AuditLog.ACTION_EXPORT_DATA,
            resource_type="user_data",
            resource_id=self.user.id,
            export_format="csv",
        )

        self.assertEqual(log.category, AuditLog.DATA_ACCESS)
        self.assertEqual(log.resource_type, "user_data")
        self.assertEqual(log.resource_id, self.user.id)
        self.assertEqual(log.context["export_format"], "csv")


class AuditDecoratorTest(TestCase):
    """Test the audit_action decorator."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.factory = RequestFactory()

    def test_decorator_success(self):
        """Test decorator logs successful actions."""

        @audit_action(category=AuditLog.AUTHENTICATION, action=AuditLog.ACTION_LOGIN)
        def test_view(request):
            from django.http import HttpResponse

            return HttpResponse(status=200)

        request = self.factory.post("/test")
        request.user = self.user
        request.path = "/test"
        request.method = "POST"

        response = test_view(request)

        # Check audit log was created
        log = AuditLog.objects.get()
        self.assertEqual(log.action, "login")
        self.assertEqual(log.category, "auth")
        self.assertTrue(log.success)
        self.assertEqual(log.context["view"], "test_view")
        self.assertEqual(log.context["status_code"], 200)

    def test_decorator_failure(self):
        """Test decorator logs failed actions."""

        @audit_action(
            category=AuditLog.AUTHENTICATION,
            action=AuditLog.ACTION_LOGIN,
            log_failure=True,
        )
        def test_view(request):
            from django.http import HttpResponse

            return HttpResponse(status=401)

        request = self.factory.post("/test")
        request.user = self.user
        request.path = "/test"
        request.method = "POST"

        response = test_view(request)

        # Check audit log was created
        log = AuditLog.objects.get()
        self.assertEqual(log.action, "login")
        self.assertFalse(log.success)
        self.assertEqual(log.context["status_code"], 401)

    def test_decorator_exception(self):
        """Test decorator logs exceptions."""

        @audit_action(
            category=AuditLog.AUTHENTICATION,
            action=AuditLog.ACTION_LOGIN,
            log_failure=True,
        )
        def test_view(request):
            raise ValueError("Test error")

        request = self.factory.post("/test")
        request.user = self.user

        with self.assertRaises(ValueError):
            test_view(request)

        # Check audit log was created
        log = AuditLog.objects.get()
        self.assertEqual(log.action, "login")
        self.assertFalse(log.success)
        self.assertEqual(log.context["error"], "Test error")
        self.assertEqual(log.context["error_type"], "ValueError")


class AuditContextManagerTest(TestCase):
    """Test the AuditContextManager."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.factory = RequestFactory()
        self.request = self.factory.post("/test")
        self.request.user = self.user

    def test_context_manager_success(self):
        """Test context manager for successful operations."""
        with AuditContextManager(
            request=self.request,
            action=AuditLog.ACTION_BULK_MODERATE,
            category=AuditLog.CONTENT_MODERATION,
        ) as audit:
            audit.add_context("items_processed", 10)
            audit.add_context("action_type", "approve")

        # Check audit log was created
        log = AuditLog.objects.get()
        self.assertEqual(log.action, "bulk_moderate")
        self.assertEqual(log.category, "moderation")
        self.assertTrue(log.success)
        self.assertEqual(log.context["items_processed"], 10)
        self.assertEqual(log.context["action_type"], "approve")
        self.assertIn("duration_seconds", log.context)

    def test_context_manager_failure(self):
        """Test context manager for failed operations."""
        try:
            with AuditContextManager(
                request=self.request,
                action=AuditLog.ACTION_BULK_MODERATE,
                category=AuditLog.CONTENT_MODERATION,
            ) as audit:
                audit.add_context("items_to_process", 10)
                audit.mark_failed("Validation error")
                raise ValueError("Test error")
        except ValueError:
            pass

        # Check audit log was created
        log = AuditLog.objects.get()
        self.assertEqual(log.action, "bulk_moderate")
        self.assertFalse(log.success)
        self.assertEqual(log.context["failure_reason"], "Validation error")
        self.assertEqual(log.context["error"], "Test error")
        self.assertEqual(log.context["error_type"], "ValueError")


class AuditLogAdminTest(TestCase):
    """Test the audit log admin interface."""

    def setUp(self):
        self.site = AdminSite()
        self.admin = AuditLogAdmin(AuditLog, self.site)
        self.superuser = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="adminpass123"
        )
        self.factory = RequestFactory()

    def test_admin_read_only(self):
        """Test that admin interface is read-only."""
        request = self.factory.get("/admin/")
        request.user = self.superuser

        # Check permissions
        self.assertFalse(self.admin.has_add_permission(request))
        self.assertFalse(self.admin.has_delete_permission(request))

        # With view permission
        self.superuser.user_permissions.add(*User._meta.permissions)
        self.assertTrue(self.admin.has_change_permission(request))

    def test_admin_display_methods(self):
        """Test admin display methods."""
        log = AuditLog.objects.create(
            user=self.superuser,
            username="admin",
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            success=True,
            timestamp=timezone.now(),
        )

        # Test timestamp display
        timestamp_str = self.admin.timestamp_display(log)
        self.assertIn(str(timezone.now().year), timestamp_str)

        # Test action display with icon
        action_str = self.admin.action_display(log)
        self.assertIn("🔑", action_str)  # Login icon
        self.assertIn("login", action_str)

        # Test success display
        success_str = self.admin.success_display(log)
        self.assertIn("Success", success_str)
        self.assertIn("green", success_str)

    def test_admin_context_display(self):
        """Test context JSON display."""
        log = AuditLog.objects.create(
            user=self.superuser,
            username="admin",
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
            context={"test": "value", "nested": {"key": "value"}},
        )

        context_html = self.admin.context_display(log)
        self.assertIn("<pre", context_html)
        # HTML escapes quotes as &quot;
        self.assertIn("&quot;test&quot;: &quot;value&quot;", context_html)
        self.assertIn("&quot;nested&quot;:", context_html)


@skip("Integration tests require full Django setup with all middleware")
class AuditLogIntegrationTest(TestCase):
    """Test audit logging integration with views."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_login_audit_success(self):
        """Test successful login creates audit log."""
        response = self.client.post(
            "/api/auth/token/", {"username": "testuser", "password": "testpass123"}
        )

        self.assertEqual(response.status_code, 200)

        # Check audit log
        log = AuditLog.objects.get(action=AuditLog.ACTION_LOGIN)
        self.assertEqual(log.user, self.user)
        self.assertTrue(log.success)
        self.assertEqual(log.category, AuditLog.AUTHENTICATION)

    def test_login_audit_failure(self):
        """Test failed login creates audit log."""
        response = self.client.post(
            "/api/auth/token/", {"username": "testuser", "password": "wrongpass"}
        )

        self.assertEqual(response.status_code, 401)

        # Check audit log
        log = AuditLog.objects.get(action=AuditLog.ACTION_LOGIN_FAILED)
        self.assertEqual(log.user, self.user)
        self.assertFalse(log.success)

    def test_registration_audit(self):
        """Test registration creates audit log."""
        response = self.client.post(
            "/api/auth/register",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "newpass123!",
            },
        )

        self.assertEqual(response.status_code, 201)

        # Check audit log
        log = AuditLog.objects.get(action=AuditLog.ACTION_REGISTER)
        self.assertTrue(log.success)
        self.assertEqual(log.username, "newuser")
        self.assertEqual(log.context["email"], "new@example.com")

    def test_logout_audit(self):
        """Test logout creates audit log."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post("/api/auth/logout")

        self.assertEqual(response.status_code, 200)

        # Check audit log
        log = AuditLog.objects.get(action=AuditLog.ACTION_LOGOUT)
        self.assertEqual(log.user, self.user)
        self.assertTrue(log.success)

    def test_password_change_audit(self):
        """Test password change creates audit log."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/auth/change-password/",
            {"old_password": "testpass123", "new_password": "newpass123!"},
        )

        self.assertEqual(response.status_code, 200)

        # Check audit log
        log = AuditLog.objects.get(action=AuditLog.ACTION_PASSWORD_CHANGE)
        self.assertEqual(log.user, self.user)
        self.assertTrue(log.success)
