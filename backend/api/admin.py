"""
Django admin configuration for aisreact models.
"""

import json
import logging

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    AIResponse,
    AuditLog,
    PasswordResetToken,
    Post,
    User,
    VerificationVote,
)

logger = logging.getLogger(__name__)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model."""

    list_display = (
        "username",
        "email",
        "role",
        "is_verified",
        "is_active",
        "created_at",
    )
    list_filter = ("role", "is_verified", "is_active", "created_at")
    search_fields = ("username", "email")
    ordering = ("-created_at",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Additional Info", {"fields": ("role", "is_verified")}),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Additional Info", {"fields": ("email", "role")}),
    )


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """Admin interface for Post model."""

    list_display = ("title", "user", "status", "created_at", "verified_at")
    list_filter = ("status", "created_at", "verified_at")
    search_fields = ("title", "content", "user__username")
    ordering = ("-created_at",)
    readonly_fields = (
        "created_at",
        "updated_at",
        "verification_score",
        "verification_count",
    )

    fieldsets = (
        (
            "Content",
            {"fields": ("user", "title", "content", "source_url", "image_url")},
        ),
        (
            "Status",
            {
                "fields": (
                    "status",
                    "moderation_result",
                    "rejection_reason",
                    "verified_at",
                )
            },
        ),
        (
            "Metrics",
            {
                "fields": (
                    "verification_score",
                    "verification_count",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(AIResponse)
class AIResponseAdmin(admin.ModelAdmin):
    """Admin interface for AIResponse model."""

    list_display = ("post", "ai_model", "created_at")
    list_filter = ("ai_model", "created_at")
    search_fields = ("post__title", "summary", "impact_assessment")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(VerificationVote)
class VerificationVoteAdmin(admin.ModelAdmin):
    """Admin interface for VerificationVote model."""

    list_display = ("user", "post", "vote", "created_at")
    list_filter = ("vote", "created_at")
    search_fields = ("user__username", "post__title", "comment")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """Admin interface for PasswordResetToken model."""

    list_display = ("user", "created_at", "expires_at", "used", "used_at")
    list_filter = ("used", "created_at", "expires_at")
    search_fields = ("user__username", "user__email")
    ordering = ("-created_at",)
    readonly_fields = ("token_hash", "created_at", "used_at")

    fieldsets = (
        (
            "Token Info",
            {"fields": ("user", "token_hash", "created_at", "expires_at")},
        ),
        (
            "Usage",
            {"fields": ("used", "used_at")},
        ),
    )


# Audit Log Admin
class AuditLogAdmin(admin.ModelAdmin):
    """Admin interface for viewing audit logs (read-only)."""

    list_display = [
        "timestamp_display",
        "username",
        "action_display",
        "category",
        "success_display",
        "ip_address",
        "resource_link",
    ]
    list_filter = [
        "category",
        "action",
        "success",
        "timestamp",
        ("user", admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        "username",
        "action",
        "ip_address",
        "request_id",
        "resource_type",
        "reason",
    ]
    readonly_fields = [
        "id",
        "timestamp",
        "user",
        "username",
        "user_id",
        "category",
        "action",
        "success",
        "ip_address",
        "user_agent",
        "request_id",
        "resource_type",
        "resource_id",
        "context_display",
        "reason",
    ]
    date_hierarchy = "timestamp"
    ordering = ["-timestamp"]

    # Disable add/change/delete permissions
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.has_perm("api.view_audit_logs")

    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        """Remove all actions (including delete selected)."""
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions

    def timestamp_display(self, obj):
        """Display timestamp in local timezone."""
        return timezone.localtime(obj.timestamp).strftime("%Y-%m-%d %H:%M:%S")

    timestamp_display.short_description = "Timestamp"  # type: ignore[attr-defined]
    timestamp_display.admin_order_field = "timestamp"  # type: ignore[attr-defined]

    def action_display(self, obj):
        """Display action with icon."""
        icons = {
            AuditLog.ACTION_LOGIN: "🔑",
            AuditLog.ACTION_LOGOUT: "🚪",
            AuditLog.ACTION_LOGIN_FAILED: "❌",
            AuditLog.ACTION_PASSWORD_CHANGE: "🔐",
            AuditLog.ACTION_REGISTER: "👤",
            AuditLog.ACTION_POST_DELETE: "🗑️",
            AuditLog.ACTION_ROLE_CHANGE: "👑",
            AuditLog.ACTION_ACCOUNT_LOCK: "🔒",
        }
        icon = icons.get(obj.action, "📝")
        return format_html("{} {}", icon, obj.action)

    action_display.short_description = "Action"  # type: ignore[attr-defined]
    action_display.admin_order_field = "action"  # type: ignore[attr-defined]

    def success_display(self, obj):
        """Display success status with color."""
        if obj.success:
            return format_html('<span style="color: green;">✓ Success</span>')
        else:
            return format_html('<span style="color: red;">✗ Failed</span>')

    success_display.short_description = "Status"  # type: ignore[attr-defined]
    success_display.admin_order_field = "success"  # type: ignore[attr-defined]

    def resource_link(self, obj):
        """Create a link to the affected resource if possible."""
        if not obj.resource_type or not obj.resource_id:
            return "-"

        # Map resource types to admin URLs
        resource_map = {
            "user": "api_user",
            "post": "api_post",
        }

        model_name = resource_map.get(obj.resource_type)
        if model_name:
            try:
                url = reverse(f"admin:{model_name}_change", args=[obj.resource_id])
                return format_html(
                    '<a href="{}">{}#{}</a>', url, obj.resource_type, obj.resource_id
                )
            except (NoReverseMatch, AttributeError) as e:
                # Log the error but don't break the admin display
                logger.warning(
                    f"Failed to generate admin link for "
                    f"{obj.resource_type}#{obj.resource_id}: {str(e)}"
                )

        return f"{obj.resource_type}#{obj.resource_id}"

    resource_link.short_description = "Resource"  # type: ignore[attr-defined]

    def context_display(self, obj):
        """Display context as formatted JSON."""
        if not obj.context:
            return "-"
        return format_html(
            '<pre style="white-space: pre-wrap;">{}</pre>',
            json.dumps(obj.context, indent=2),
        )

    context_display.short_description = "Context"  # type: ignore[attr-defined]

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related("user")

    def changelist_view(self, request, extra_context=None):
        """Add warning about immutability."""
        extra_context = extra_context or {}
        extra_context["title"] = "Audit Logs (Read-Only)"
        return super().changelist_view(request, extra_context)

    class Media:
        css = {"all": ("admin/css/audit_logs.css",)}
