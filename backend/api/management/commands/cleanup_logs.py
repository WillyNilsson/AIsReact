"""
Django management command to clean up old logs based on retention policies.
"""

import logging
from datetime import timedelta

from api.models import AuditLog
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Clean up old logs based on retention policies"

    # Retention policies by log category (in days)
    RETENTION_POLICIES = {
        # Security and authentication logs - keep for 2 years for compliance
        AuditLog.AUTHENTICATION: 730,
        AuditLog.SECURITY: 730,
        # User management and administrative logs - keep for 1 year
        AuditLog.USER_MANAGEMENT: 365,
        AuditLog.ADMINISTRATIVE: 365,
        # Content moderation logs - keep for 6 months
        AuditLog.CONTENT_MODERATION: 180,
        # Data access logs - keep for 90 days minimum (GDPR requirement)
        AuditLog.DATA_ACCESS: 90,
    }

    # Special retention for specific actions (override category retention)
    ACTION_RETENTION_OVERRIDE = {
        # Keep all role changes for 2 years regardless of category
        AuditLog.ACTION_ROLE_CHANGE: 730,
        # Keep account locks/unlocks for 2 years
        AuditLog.ACTION_ACCOUNT_LOCK: 730,
        AuditLog.ACTION_ACCOUNT_UNLOCK: 730,
        # Keep data exports for 1 year (compliance)
        AuditLog.ACTION_EXPORT_DATA: 365,
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Number of records to process in each batch (default: 1000)",
        )
        parser.add_argument(
            "--category",
            type=str,
            help="Only clean up logs for a specific category",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]
        category_filter = options.get("category")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - No logs will be deleted"))

        self.stdout.write("Starting log cleanup...")
        logger.info(
            "Starting log retention cleanup",
            extra={
                "dry_run": dry_run,
                "batch_size": batch_size,
                "category_filter": category_filter,
            },
        )

        total_deleted = 0

        # Process each category
        for category, retention_days in self.RETENTION_POLICIES.items():
            if category_filter and category != category_filter:
                continue

            deleted = self._cleanup_category(
                category, retention_days, batch_size, dry_run
            )
            total_deleted += deleted

        # Process action overrides
        for action, retention_days in self.ACTION_RETENTION_OVERRIDE.items():
            deleted = self._cleanup_action(action, retention_days, batch_size, dry_run)
            total_deleted += deleted

        self.stdout.write(
            self.style.SUCCESS(
                f"Cleanup complete. Total logs "
                f'{"identified" if dry_run else "deleted"}: {total_deleted}'
            )
        )
        logger.info(
            "Log retention cleanup completed",
            extra={"total_deleted": total_deleted, "dry_run": dry_run},
        )

    def _cleanup_category(self, category, retention_days, batch_size, dry_run):
        """Clean up logs for a specific category."""
        cutoff_date = timezone.now() - timedelta(days=retention_days)

        # Build query - exclude any actions with override retention
        query = Q(category=category, timestamp__lt=cutoff_date)
        for action in self.ACTION_RETENTION_OVERRIDE.keys():
            query &= ~Q(action=action)

        # Get count first
        count = AuditLog.objects.filter(query).count()

        if count == 0:
            return 0

        self.stdout.write(
            f"Category {category}: Found {count} logs older than {retention_days} days"
        )

        if dry_run:
            return count

        # Delete in batches to avoid locking
        deleted = 0
        while True:
            # Get batch of IDs to delete
            ids_to_delete = list(
                AuditLog.objects.filter(query).values_list("id", flat=True)[:batch_size]
            )

            if not ids_to_delete:
                break

            # Note: AuditLog has delete prevention, so we need to use raw SQL
            # This should only be done by authorized cleanup processes
            with transaction.atomic():
                from django.db import connection

                with connection.cursor() as cursor:
                    placeholders = ",".join(["%s"] * len(ids_to_delete))
                    sql = (
                        f"DELETE FROM audit_logs WHERE id IN ({placeholders})"  # nosec
                    )
                    cursor.execute(sql, ids_to_delete)
                    deleted += cursor.rowcount

            self.stdout.write(f"  Deleted batch of {len(ids_to_delete)} logs")

        return deleted

    def _cleanup_action(self, action, retention_days, batch_size, dry_run):
        """Clean up logs for a specific action with override retention."""
        cutoff_date = timezone.now() - timedelta(days=retention_days)

        # For action overrides, we keep them longer than their category default
        # So we only delete if they're older than the override retention
        count = AuditLog.objects.filter(
            action=action, timestamp__lt=cutoff_date
        ).count()

        if count == 0:
            return 0

        self.stdout.write(
            f"Action {action}: Found {count} logs older than {retention_days} days"
        )

        if dry_run:
            return count

        # Delete in batches
        deleted = 0
        while True:
            ids_to_delete = list(
                AuditLog.objects.filter(
                    action=action, timestamp__lt=cutoff_date
                ).values_list("id", flat=True)[:batch_size]
            )

            if not ids_to_delete:
                break

            with transaction.atomic():
                from django.db import connection

                with connection.cursor() as cursor:
                    placeholders = ",".join(["%s"] * len(ids_to_delete))
                    sql = (
                        f"DELETE FROM audit_logs WHERE id IN ({placeholders})"  # nosec
                    )
                    cursor.execute(sql, ids_to_delete)
                    deleted += cursor.rowcount

            self.stdout.write(f"  Deleted batch of {len(ids_to_delete)} logs")

        return deleted
