"""
Tests for log cleanup management command.
"""

from datetime import timedelta
from io import StringIO

from api.models import AuditLog
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

User = get_user_model()


class CleanupLogsTest(TransactionTestCase):
    """Test the cleanup_logs management command.

    Using TransactionTestCase because we need to test raw SQL operations.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.out = StringIO()
        self.err = StringIO()

    def _create_old_log_via_sql(self, action, category, days_old, username="testuser"):
        """Create an old log entry using raw SQL to bypass timestamp restrictions."""
        timestamp = timezone.now() - timedelta(days=days_old)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO audit_logs
                (timestamp, username, user_id_snapshot, action, category, success,
                 ip_address, user_agent, request_id, resource_type, resource_id,
                 context, reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """,
                [
                    timestamp,
                    username,
                    self.user.id,
                    action,
                    category,
                    True,
                    "127.0.0.1",
                    "Test Agent",
                    "test-123",
                    "",
                    None,
                    '{"test": true}',
                    "",
                ],
            )
            log_id = cursor.fetchone()[0]

        return log_id

    def test_dry_run_mode(self):
        """Test dry run mode doesn't delete anything."""
        # Create some old logs
        old_log_id = self._create_old_log_via_sql(
            AuditLog.ACTION_LOGIN,
            AuditLog.AUTHENTICATION,
            days_old=731,  # Older than 2 year retention
        )

        # Get initial count
        initial_count = AuditLog.objects.count()

        # Run in dry run mode
        call_command("cleanup_logs", "--dry-run", stdout=self.out, stderr=self.err)

        # Verify nothing was deleted
        self.assertEqual(AuditLog.objects.count(), initial_count)
        self.assertIn("DRY RUN", self.out.getvalue())
        self.assertIn(
            "Category auth: Found 1 logs older than 730 days", self.out.getvalue()
        )

        # Verify the old log still exists
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [old_log_id]
            )
            count = cursor.fetchone()[0]
            self.assertEqual(count, 1)

    def test_actual_deletion(self):
        """Test that old logs are actually deleted when not in dry run."""
        # Create an old authentication log
        old_auth_log_id = self._create_old_log_via_sql(
            AuditLog.ACTION_LOGIN, AuditLog.AUTHENTICATION, days_old=731
        )

        # Create a recent log that should not be deleted
        recent_log = AuditLog.objects.create(
            user=self.user,
            username="testuser",
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        # Run cleanup (not dry run)
        call_command("cleanup_logs", stdout=self.out, stderr=self.err)

        # Verify old log was deleted
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [old_auth_log_id]
            )
            count = cursor.fetchone()[0]
            self.assertEqual(count, 0, "Old log should have been deleted")

        # Verify recent log still exists
        self.assertTrue(AuditLog.objects.filter(id=recent_log.id).exists())
        self.assertIn("Total logs deleted: 1", self.out.getvalue())

    def test_category_specific_cleanup(self):
        """Test cleanup for specific category only."""
        # Create old logs in different categories
        old_auth_log_id = self._create_old_log_via_sql(
            AuditLog.ACTION_LOGIN, AuditLog.AUTHENTICATION, days_old=731
        )

        old_mod_log_id = self._create_old_log_via_sql(
            AuditLog.ACTION_POST_MODERATE,
            AuditLog.CONTENT_MODERATION,
            days_old=181,  # Older than 6 month retention
        )

        # Run cleanup for moderation category only
        call_command(
            "cleanup_logs", "--category", "moderation", stdout=self.out, stderr=self.err
        )

        # Verify only moderation log was deleted
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [old_mod_log_id]
            )
            self.assertEqual(
                cursor.fetchone()[0], 0, "Moderation log should be deleted"
            )

            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [old_auth_log_id]
            )
            self.assertEqual(cursor.fetchone()[0], 1, "Auth log should still exist")

    def test_retention_policy_boundaries(self):
        """Test that logs are kept/deleted at retention boundaries."""
        # Create logs at various ages for authentication (730 day retention)
        just_under_id = self._create_old_log_via_sql(
            AuditLog.ACTION_LOGIN,
            AuditLog.AUTHENTICATION,
            days_old=729,  # Should be kept
        )

        just_over_id = self._create_old_log_via_sql(
            AuditLog.ACTION_LOGIN,
            AuditLog.AUTHENTICATION,
            days_old=731,  # Should be deleted
        )

        # Run cleanup
        call_command("cleanup_logs", stdout=self.out, stderr=self.err)

        # Verify boundary behavior
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [just_under_id]
            )
            self.assertEqual(
                cursor.fetchone()[0], 1, "Log just under retention should be kept"
            )

            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [just_over_id]
            )
            self.assertEqual(
                cursor.fetchone()[0], 0, "Log just over retention should be deleted"
            )

    def test_action_override_retention(self):
        """Test that action-specific retention overrides category retention."""
        # Create a role change log that's older than category retention (365 days)
        # but within action override retention (730 days)
        role_change_id = self._create_old_log_via_sql(
            AuditLog.ACTION_ROLE_CHANGE,
            AuditLog.USER_MANAGEMENT,
            days_old=400,  # Older than 1 year category but within 2 year override
        )

        # Create a regular user management log at same age
        regular_user_log_id = self._create_old_log_via_sql(
            AuditLog.ACTION_PROFILE_UPDATE,
            AuditLog.USER_MANAGEMENT,
            days_old=400,  # Should be deleted
        )

        # Run cleanup
        call_command("cleanup_logs", stdout=self.out, stderr=self.err)

        # Verify override worked
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [role_change_id]
            )
            self.assertEqual(
                cursor.fetchone()[0], 1, "Role change should be kept due to override"
            )

            cursor.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [regular_user_log_id]
            )
            self.assertEqual(
                cursor.fetchone()[0], 0, "Regular user log should be deleted"
            )

    def test_batch_processing(self):
        """Test that batch processing works correctly."""
        # Create 5 old logs
        log_ids = []
        for i in range(5):
            log_id = self._create_old_log_via_sql(
                AuditLog.ACTION_LOGIN, AuditLog.AUTHENTICATION, days_old=731 + i
            )
            log_ids.append(log_id)

        # Run with small batch size
        call_command(
            "cleanup_logs", "--batch-size", "2", stdout=self.out, stderr=self.err
        )

        # All logs should be deleted
        with connection.cursor() as cursor:
            for log_id in log_ids:
                cursor.execute(
                    "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [log_id]
                )
                self.assertEqual(
                    cursor.fetchone()[0], 0, f"Log {log_id} should be deleted"
                )

        # Should see multiple batch messages
        output = self.out.getvalue()
        self.assertIn("Deleted batch of", output)
        # With 5 logs and batch size 2, we should have 3 batches (2+2+1)
        batch_count = output.count("Deleted batch of")
        self.assertEqual(batch_count, 3, "Should have processed 3 batches")

    def test_no_logs_to_delete(self):
        """Test behavior when there are no logs to delete."""
        # Create only recent logs
        AuditLog.objects.create(
            user=self.user,
            username="testuser",
            action=AuditLog.ACTION_LOGIN,
            category=AuditLog.AUTHENTICATION,
        )

        # Run cleanup
        call_command("cleanup_logs", stdout=self.out, stderr=self.err)

        # Should complete successfully with 0 deleted
        self.assertIn("Total logs deleted: 0", self.out.getvalue())

    def test_mixed_categories_and_actions(self):
        """Test cleanup with mixed categories and special actions."""
        # Create various old logs
        logs_to_delete = [
            self._create_old_log_via_sql(
                AuditLog.ACTION_LOGIN, AuditLog.AUTHENTICATION, 731
            ),
            self._create_old_log_via_sql(
                AuditLog.ACTION_POST_MODERATE, AuditLog.CONTENT_MODERATION, 181
            ),
            self._create_old_log_via_sql(
                AuditLog.ACTION_VIEW_SENSITIVE, AuditLog.DATA_ACCESS, 91
            ),
        ]

        logs_to_keep = [
            self._create_old_log_via_sql(
                AuditLog.ACTION_ROLE_CHANGE, AuditLog.USER_MANAGEMENT, 400
            ),  # Override
            self._create_old_log_via_sql(
                AuditLog.ACTION_ACCOUNT_LOCK, AuditLog.SECURITY, 500
            ),  # Override
            self._create_old_log_via_sql(
                AuditLog.ACTION_LOGIN, AuditLog.AUTHENTICATION, 700
            ),  # Under limit
        ]

        # Run cleanup
        call_command("cleanup_logs", stdout=self.out, stderr=self.err)

        # Verify correct logs were deleted/kept
        with connection.cursor() as cursor:
            for log_id in logs_to_delete:
                cursor.execute(
                    "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [log_id]
                )
                self.assertEqual(
                    cursor.fetchone()[0], 0, f"Log {log_id} should be deleted"
                )

            for log_id in logs_to_keep:
                cursor.execute(
                    "SELECT COUNT(*) FROM audit_logs WHERE id = %s", [log_id]
                )
                self.assertEqual(
                    cursor.fetchone()[0], 1, f"Log {log_id} should be kept"
                )

    def test_invalid_category_filter(self):
        """Test handling of invalid category filter."""
        # Run with non-existent category
        call_command(
            "cleanup_logs",
            "--category",
            "invalid_category",
            stdout=self.out,
            stderr=self.err,
        )

        # Should complete without error
        self.assertIn("Total logs deleted: 0", self.out.getvalue())

    def test_help_command(self):
        """Test that help is available."""
        with self.assertRaises(SystemExit) as cm:
            call_command("cleanup_logs", "--help", stdout=self.out, stderr=self.err)

        # Should exit cleanly
        self.assertEqual(cm.exception.code, 0)
        help_text = self.out.getvalue()
        self.assertIn("Clean up old logs based on retention policies", help_text)
        self.assertIn("--dry-run", help_text)
        self.assertIn("--batch-size", help_text)
        self.assertIn("--category", help_text)
