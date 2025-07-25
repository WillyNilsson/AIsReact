"""
Test to verify audit logging works when enabled.
"""

from api.models import AuditLog
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()


class AuditLoggingTest(TestCase):
    """Test audit logging functionality."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!@",
            is_verified=True,
        )

    @override_settings(AUDIT_LOG_ENABLED=True)
    def test_audit_logging_when_enabled(self):
        """Test that audit logs are created when enabled."""
        # Count existing logs
        initial_count = AuditLog.objects.filter(
            action=AuditLog.ACTION_LOGIN, username="testuser"
        ).count()

        # Perform a login
        data = {"username": "testuser", "password": "TestPass123!@"}
        response = self.client.post("/api/auth/token/", data)

        # Check response
        self.assertEqual(response.status_code, 200)

        # Verify audit log was created
        logs = AuditLog.objects.filter(
            action=AuditLog.ACTION_LOGIN, username="testuser"
        )
        self.assertEqual(logs.count(), initial_count + 1)

        log = logs.last()
        self.assertTrue(log.success)
        self.assertEqual(log.category, AuditLog.AUTHENTICATION)
        self.assertEqual(log.user_id_snapshot, self.user.id)

    @override_settings(AUDIT_LOG_ENABLED=False)
    def test_audit_logging_when_disabled(self):
        """Test that audit logs are NOT created when disabled."""
        # Count existing logs
        initial_count = AuditLog.objects.filter(
            action=AuditLog.ACTION_LOGIN, username="testuser"
        ).count()

        # Perform a login
        data = {"username": "testuser", "password": "TestPass123!@"}
        response = self.client.post("/api/auth/token/", data)

        # Check response
        self.assertEqual(response.status_code, 200)

        # Verify NO new audit log was created
        logs = AuditLog.objects.filter(
            action=AuditLog.ACTION_LOGIN, username="testuser"
        )
        self.assertEqual(logs.count(), initial_count)

    def test_audit_log_immutability(self):
        """Test that audit logs cannot be modified or deleted."""
        # Create a log directly
        log = AuditLog.objects.create(
            username="testuser",
            user_id_snapshot=self.user.id,
            action="test_action",
            category=AuditLog.AUTHENTICATION,
            success=True,
        )

        # Try to update - should raise ValidationError
        with self.assertRaises(Exception):
            log.action = "modified_action"
            log.save()

        # Try to delete - should raise ValidationError
        with self.assertRaises(Exception):
            log.delete()
