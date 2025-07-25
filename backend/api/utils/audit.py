"""
Audit logging utilities and decorators.
"""

import functools
import logging
from typing import TYPE_CHECKING, Any, Callable, Dict, Optional

from api.models import AuditLog
from django.contrib.auth import get_user_model
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# Type hint for User model
if TYPE_CHECKING:
    from api.models import User
else:
    User = get_user_model()


class AuditLogger:
    """Centralized audit logging with automatic context extraction."""

    @staticmethod
    def log_authentication(
        request: HttpRequest,
        action: str,
        success: bool = True,
        user: Optional[User] = None,
        **context,
    ):
        """Log authentication-related actions."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        user = user or getattr(request, "user", None)
        if user and user.is_anonymous:
            user = None

        return AuditLog.log(
            user=user,
            action=action,
            category=AuditLog.AUTHENTICATION,
            request=request,
            success=success,
            context=context,
        )

    @staticmethod
    def log_user_management(
        request: HttpRequest,
        action: str,
        target_user: Optional[User] = None,
        success: bool = True,
        **context,
    ):
        """Log user management actions."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        actor = getattr(request, "user", None)
        if actor and actor.is_anonymous:
            actor = None

        log_context = context.copy()
        if target_user:
            log_context["target_user_id"] = target_user.id
            log_context["target_username"] = target_user.username

        return AuditLog.log(
            user=actor,
            action=action,
            category=AuditLog.USER_MANAGEMENT,
            request=request,
            success=success,
            resource_type="user",
            resource_id=target_user.id if target_user else None,
            context=log_context,
        )

    @staticmethod
    def log_content_moderation(
        request: HttpRequest,
        action: str,
        post_id: Optional[int] = None,
        success: bool = True,
        reason: str = "",
        **context,
    ):
        """Log content moderation actions."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        moderator = getattr(request, "user", None)
        if moderator and moderator.is_anonymous:
            moderator = None

        return AuditLog.log(
            user=moderator,
            action=action,
            category=AuditLog.CONTENT_MODERATION,
            request=request,
            success=success,
            resource_type="post",
            resource_id=post_id,
            reason=reason,
            context=context,
        )

    @staticmethod
    def log_administrative(
        request: HttpRequest, action: str, success: bool = True, **context
    ):
        """Log administrative actions."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        admin = getattr(request, "user", None)
        if admin and admin.is_anonymous:
            admin = None

        return AuditLog.log(
            user=admin,
            action=action,
            category=AuditLog.ADMINISTRATIVE,
            request=request,
            success=success,
            context=context,
        )

    @staticmethod
    def log_security(
        request: HttpRequest,
        action: str,
        success: bool = True,
        severity: str = "medium",
        **context,
    ):
        """Log security-related events."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        user = getattr(request, "user", None)
        if user and user.is_anonymous:
            user = None

        log_context = context.copy()
        log_context["severity"] = severity

        return AuditLog.log(
            user=user,
            action=action,
            category=AuditLog.SECURITY,
            request=request,
            success=success,
            context=log_context,
        )

    @staticmethod
    def log_data_access(
        request: HttpRequest,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        success: bool = True,
        **context,
    ):
        """Log data access and export actions."""
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        user = getattr(request, "user", None)
        if user and user.is_anonymous:
            user = None

        return AuditLog.log(
            user=user,
            action=action,
            category=AuditLog.DATA_ACCESS,
            request=request,
            success=success,
            resource_type=resource_type,
            resource_id=resource_id,
            context=context,
        )


def audit_action(
    category: str,
    action: str,
    log_success: bool = True,
    log_failure: bool = True,
    include_response: bool = False,
):
    """
    Decorator to automatically audit log API actions.

    Args:
        category: Audit log category
        action: Action name
        log_success: Whether to log successful actions
        log_failure: Whether to log failed actions
        include_response: Whether to include response data in context

    Usage:
        @audit_action(AuditLog.AUTHENTICATION, AuditLog.ACTION_LOGIN)
        def login_view(request):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(request, *args, **kwargs):
            # For DRF ViewSets, extract the actual request
            if hasattr(request, "request"):
                audit_request = request.request
            else:
                audit_request = request

            context = {
                "view": func.__name__,
                "method": audit_request.method,
                "path": audit_request.path,
            }

            # Extract relevant kwargs for context
            if "pk" in kwargs:
                context["resource_id"] = kwargs["pk"]

            try:
                # Execute the actual view
                response = func(request, *args, **kwargs)

                # Determine if the action was successful
                if isinstance(response, (HttpResponse, Response)):
                    success = 200 <= response.status_code < 400
                    context["status_code"] = response.status_code

                    if include_response and hasattr(response, "data"):
                        # Include non-sensitive response data
                        context["response_summary"] = _summarize_response(response.data)
                else:
                    success = True

                # Log successful action
                if success and log_success:
                    AuditLog.log(
                        user=getattr(audit_request, "user", None),
                        action=action,
                        category=category,
                        request=audit_request,
                        success=True,
                        context=context,
                    )
                elif not success and log_failure:
                    AuditLog.log(
                        user=getattr(audit_request, "user", None),
                        action=action,
                        category=category,
                        request=audit_request,
                        success=False,
                        context=context,
                    )

                return response

            except Exception as e:
                # Log failed action
                if log_failure:
                    context["error"] = str(e)
                    context["error_type"] = type(e).__name__

                    AuditLog.log(
                        user=getattr(audit_request, "user", None),
                        action=action,
                        category=category,
                        request=audit_request,
                        success=False,
                        context=context,
                    )
                raise

        return wrapper

    return decorator


def audit_model_change(action: str, category: str = AuditLog.USER_MANAGEMENT):
    """
    Decorator for model methods that should be audited.

    Usage:
        @audit_model_change(AuditLog.ACTION_PROFILE_UPDATE)
        def update_profile(self, **data):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            # Capture before state for important fields
            before_state = {}
            if hasattr(self, "pk") and self.pk:
                important_fields = getattr(self, "AUDIT_FIELDS", [])
                for field in important_fields:
                    if hasattr(self, field):
                        before_state[field] = getattr(self, field)

            try:
                result = func(self, *args, **kwargs)

                # Capture after state and compute changes
                after_state = {}
                changes = {}
                for field in before_state:
                    current_value = getattr(self, field)
                    if current_value != before_state[field]:
                        changes[field] = {
                            "from": before_state[field],
                            "to": current_value,
                        }
                        after_state[field] = current_value

                # Log the change
                context = {
                    "model": self.__class__.__name__,
                    "object_id": self.pk,
                    "changes": changes,
                }

                # Try to get current request from thread local
                from api.utils.request_id import get_current_request_id

                AuditLog.objects.create(
                    user=getattr(self, "modified_by", None),
                    username=(
                        getattr(self, "modified_by", "system").username
                        if hasattr(getattr(self, "modified_by", None), "username")
                        else "system"
                    ),
                    action=action,
                    category=category,
                    success=True,
                    resource_type=self.__class__.__name__.lower(),
                    resource_id=self.pk,
                    request_id=get_current_request_id() or "",
                    context=context,
                )

                return result

            except Exception as e:
                logger.error(f"Model change audit failed: {e}")
                raise

        return wrapper

    return decorator


def _summarize_response(data: Any) -> Dict[str, Any]:
    """Create a summary of response data, excluding sensitive information."""
    if not data:
        return {}

    if isinstance(data, dict):
        # Remove sensitive fields
        sensitive_fields = {"password", "token", "secret", "api_key"}
        summary = {}
        for key, value in data.items():
            if key.lower() not in sensitive_fields:
                if isinstance(value, (str, int, float, bool)):
                    summary[key] = value
                elif isinstance(value, list):
                    summary[key] = f"[{len(value)} items]"
                elif isinstance(value, dict):
                    summary[key] = "{...}"
        return summary
    elif isinstance(data, list):
        return {"count": len(data), "type": "list"}
    else:
        return {"type": type(data).__name__}


class AuditContextManager:
    """
    Context manager for complex operations that need audit logging.

    Usage:
        with AuditContextManager(request, AuditLog.ACTION_BULK_MODERATE) as audit:
            # Perform operations
            audit.add_context('posts_processed', 10)
            if error:
                audit.mark_failed('Validation error')
    """

    def __init__(
        self, request: HttpRequest, action: str, category: str, **initial_context
    ):
        self.request = request
        self.action = action
        self.category = category
        self.context = initial_context
        self.success = True
        self.audit_log = None

    def __enter__(self):
        self.start_time = timezone.now()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Calculate duration
        self.context["duration_seconds"] = (
            timezone.now() - self.start_time
        ).total_seconds()

        # Mark as failed if exception occurred
        if exc_type is not None:
            self.success = False
            self.context["error"] = str(exc_val)
            self.context["error_type"] = exc_type.__name__

        # Create audit log
        self.audit_log = AuditLog.log(
            user=getattr(self.request, "user", None),
            action=self.action,
            category=self.category,
            request=self.request,
            success=self.success,
            context=self.context,
        )

        # Don't suppress exceptions
        return False

    def add_context(self, key: str, value: Any):
        """Add context information during the operation."""
        self.context[key] = value

    def mark_failed(self, reason: str):
        """Mark the operation as failed with a reason."""
        self.success = False
        self.context["failure_reason"] = reason
