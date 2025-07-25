"""
Django models for aisreact platform.
"""

import hashlib
import json
import re
import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator, RegexValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    """

    email = models.EmailField(unique=True, help_text="User's email address")
    username = models.CharField(
        max_length=50,
        unique=True,
        validators=[
            MinLengthValidator(3),
            RegexValidator(
                regex=r"^[a-zA-Z0-9_-]+$",
                message="Username can only contain letters, numbers, underscores, and hyphens",
            ),
        ],
        help_text="Username for login",
    )
    role = models.CharField(
        max_length=20,
        choices=[
            ("user", "User"),
            ("moderator", "Moderator"),
            ("admin", "Admin"),
        ],
        default="user",
        help_text="User role determines permissions",
    )
    is_verified = models.BooleanField(
        default=False, help_text="Whether the email is verified"
    )

    # Profile fields
    bio = models.TextField(
        max_length=500, blank=True, help_text="User biography/description"
    )
    avatar_url = models.URLField(
        blank=True, null=True, help_text="S3 URL for user avatar"
    )
    website_url = models.URLField(
        blank=True, null=True, help_text="User's personal website"
    )
    twitter_username = models.CharField(
        max_length=50,
        blank=True,
        validators=[
            RegexValidator(
                regex=r"^[a-zA-Z0-9_]+$",
                message="Twitter username can only contain letters, numbers, and underscores",
            ),
        ],
        help_text="Twitter/X username without @",
    )
    github_username = models.CharField(
        max_length=50,
        blank=True,
        validators=[
            RegexValidator(
                regex=r"^[a-zA-Z0-9-]+$",
                message="GitHub username can only contain letters, numbers, and hyphens",
            ),
        ],
        help_text="GitHub username",
    )

    # Security fields for account lockout
    failed_login_attempts = models.IntegerField(
        default=0, help_text="Number of consecutive failed login attempts"
    )
    last_failed_login = models.DateTimeField(
        null=True, blank=True, help_text="Timestamp of last failed login attempt"
    )
    locked_until = models.DateTimeField(
        null=True, blank=True, help_text="Account locked until this timestamp"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Required for email as username
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # Store username in lowercase
        self.username = self.username.lower()
        super().save(*args, **kwargs)

    def is_account_locked(self):
        """Check if account is currently locked."""
        if self.locked_until and self.locked_until > timezone.now():
            return True
        return False

    def get_lockout_duration(self):
        """Get lockout duration based on failed attempts."""
        if self.failed_login_attempts <= 5:
            return timedelta(minutes=15)
        elif self.failed_login_attempts <= 10:
            return timedelta(minutes=30)
        elif self.failed_login_attempts <= 15:
            return timedelta(hours=1)
        else:
            return timedelta(hours=24)

    def record_failed_login(self):
        """Record a failed login attempt and lock if necessary."""
        self.failed_login_attempts += 1
        self.last_failed_login = timezone.now()

        # Lock account after 5 failed attempts
        if self.failed_login_attempts >= 5:
            self.locked_until = timezone.now() + self.get_lockout_duration()

        self.save(
            update_fields=["failed_login_attempts", "last_failed_login", "locked_until"]
        )

    def reset_failed_attempts(self):
        """Reset failed login attempts on successful login."""
        if self.failed_login_attempts > 0 or self.locked_until:
            self.failed_login_attempts = 0
            self.last_failed_login = None
            self.locked_until = None
            self.save(
                update_fields=[
                    "failed_login_attempts",
                    "last_failed_login",
                    "locked_until",
                ]
            )

    @property
    def post_count(self):
        """Total number of posts by this user."""
        return self.posts.count()

    @property
    def live_post_count(self):
        """Number of live posts by this user."""
        return self.posts.filter(status="live").count()

    @property
    def verification_count(self):
        """Total number of verification votes cast by this user."""
        return self.verification_votes.count()

    @property
    def achievements(self):
        """Calculate user achievements/badges."""
        badges = []

        # Email verified badge
        if self.is_verified:
            badges.append(
                {
                    "id": "email_verified",
                    "name": "Email Verified",
                    "description": "Verified email address",
                    "icon": "shield-check",
                }
            )

        # Early adopter (joined in first 30 days)
        from datetime import timedelta

        from django.utils import timezone

        if self.created_at <= timezone.now() - timedelta(days=30):
            badges.append(
                {
                    "id": "early_adopter",
                    "name": "Early Adopter",
                    "description": "Joined in the first month",
                    "icon": "rocket",
                }
            )

        # Active contributor (5+ live posts)
        if self.live_post_count >= 5:
            badges.append(
                {
                    "id": "active_contributor",
                    "name": "Active Contributor",
                    "description": "Published 5 or more verified posts",
                    "icon": "star",
                }
            )

        # Trusted verifier (20+ verifications)
        if self.verification_count >= 20:
            badges.append(
                {
                    "id": "trusted_verifier",
                    "name": "Trusted Verifier",
                    "description": "Participated in 20+ verifications",
                    "icon": "check-circle",
                }
            )

        # Moderator/Admin badges
        if self.role == "moderator":
            badges.append(
                {
                    "id": "moderator",
                    "name": "Moderator",
                    "description": "Community moderator",
                    "icon": "gavel",
                }
            )
        elif self.role == "admin":
            badges.append(
                {
                    "id": "admin",
                    "name": "Admin",
                    "description": "Platform administrator",
                    "icon": "crown",
                }
            )

        return badges

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]


class Post(models.Model):
    """
    Main content entity submitted by users.
    """

    STATUS_CHOICES = [
        ("pending_moderation", "Pending Moderation"),
        ("pending_verification", "Pending Verification"),
        ("rejected", "Rejected"),
        ("live", "Live"),
        ("disputed", "Disputed"),
        ("removed", "Removed"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="posts",
        help_text="User who submitted the post",
    )
    title = models.CharField(max_length=200, help_text="Title of the news/event")
    content = models.TextField(help_text="Description of the news/event")
    source_url = models.URLField(help_text="Link to the original source")
    image_url = models.URLField(
        blank=True, null=True, help_text="S3 URL for uploaded image"
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="pending_moderation",
        db_index=True,
        help_text="Current status in the workflow",
    )
    moderation_result = models.JSONField(
        default=dict, blank=True, help_text="Result from automated moderation"
    )
    rejection_reason = models.TextField(
        blank=True, help_text="Reason for rejection (public)"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    verified_at = models.DateTimeField(
        null=True, blank=True, help_text="When the post was verified"
    )
    moderated_at = models.DateTimeField(
        null=True, blank=True, help_text="When the post was moderated"
    )
    moderated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_posts",
        help_text="User who moderated this post",
    )

    def __str__(self):
        return f"{self.title} ({self.status})"

    @property
    def verification_score(self):
        """Calculate verification score percentage."""
        votes = self.verification_votes.all()
        if not votes:
            return 0

        yes_votes = votes.filter(vote=True).count()
        total_votes = votes.count()

        return round((yes_votes / total_votes) * 100)

    @property
    def verification_count(self):
        """Total number of verification votes."""
        return self.verification_votes.count()

    class Meta:
        db_table = "posts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]


class AIResponse(models.Model):
    """
    Stores AI model responses to posts.
    """

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="ai_responses",
        help_text="Post this response is for",
    )
    ai_model = models.CharField(
        max_length=50, help_text="Name of the AI model (e.g., 'openai-gpt4')"
    )
    summary = models.TextField(help_text="AI's summary of the event")
    impact_assessment = models.TextField(help_text="AI's assessment of impact")
    objectivity_analysis = models.TextField(help_text="AI's analysis of objectivity")
    key_quotes = models.JSONField(
        default=list, help_text="Important quotes identified by AI"
    )
    metadata = models.JSONField(
        default=dict, help_text="Additional metadata (model version, temperature, etc.)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.ai_model} response to {self.post.title}"

    class Meta:
        db_table = "ai_responses"
        ordering = ["ai_model"]
        unique_together = [["post", "ai_model"]]


class VerificationVote(models.Model):
    """
    Community verification votes for posts.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="verification_votes",
        help_text="User who cast the vote",
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="verification_votes",
        help_text="Post being verified",
    )
    vote = models.BooleanField(help_text="True = accurate, False = inaccurate")
    comment = models.TextField(
        blank=True, help_text="Optional comment about the verification"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        vote_text = "accurate" if self.vote else "inaccurate"
        return f"{self.user.username} voted {vote_text} on {self.post.title}"

    class Meta:
        db_table = "verification_votes"
        unique_together = [["user", "post"]]
        ordering = ["-created_at"]


class PasswordResetToken(models.Model):
    """
    Store password reset tokens securely with expiration.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
        help_text="User requesting password reset",
    )
    token_hash = models.CharField(
        max_length=64, unique=True, help_text="SHA256 hash of the reset token"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="Token expiration time")
    used = models.BooleanField(default=False, help_text="Whether token has been used")
    used_at = models.DateTimeField(
        null=True, blank=True, help_text="When token was used"
    )

    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Set expiration to 24 hours from now
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if token has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        """Check if token is valid (not used and not expired)."""
        return not self.used and not self.is_expired

    @classmethod
    def create_token(cls, user):
        """Create a new password reset token for user."""
        # Generate a secure random token
        raw_token = secrets.token_urlsafe(32)
        # Hash the token for storage
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        # Delete any existing unused tokens for this user
        cls.objects.filter(user=user, used=False).delete()

        # Create new token
        reset_token = cls.objects.create(user=user, token_hash=token_hash)

        # Return both the raw token (for URL) and the model instance
        return raw_token, reset_token

    @classmethod
    def verify_token(cls, raw_token):
        """Verify a token and return the associated user."""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        try:
            reset_token = cls.objects.get(token_hash=token_hash, used=False)

            if reset_token.is_expired:
                return None

            return reset_token
        except cls.DoesNotExist:
            return None

    def mark_used(self):
        """Mark token as used."""
        self.used = True
        self.used_at = timezone.now()
        self.save()

    def __str__(self):
        return f"Password reset token for {self.user.username}"

    class Meta:
        db_table = "password_reset_tokens"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token_hash"]),
            models.Index(fields=["user", "used"]),
        ]


class EmailVerificationToken(models.Model):
    """
    Store email verification tokens securely with expiration.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
        help_text="User requiring email verification",
    )
    token_hash = models.CharField(
        max_length=64, unique=True, help_text="SHA256 hash of the verification token"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="Token expiration time")
    used = models.BooleanField(default=False, help_text="Whether token has been used")
    used_at = models.DateTimeField(
        null=True, blank=True, help_text="When token was used"
    )

    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Set expiration to 7 days from now
            self.expires_at = timezone.now() + timezone.timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if token has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        """Check if token is valid (not used and not expired)."""
        return not self.used and not self.is_expired

    @classmethod
    def create_token(cls, user):
        """Create a new email verification token for user."""
        # Generate a secure random token
        raw_token = secrets.token_urlsafe(32)
        # Hash the token for storage
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        # Delete any existing unused tokens for this user
        cls.objects.filter(user=user, used=False).delete()

        # Create new token
        verification_token = cls.objects.create(user=user, token_hash=token_hash)

        # Return both the raw token (for URL) and the model instance
        return raw_token, verification_token

    @classmethod
    def verify_token(cls, raw_token):
        """Verify a token and return the associated user."""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        try:
            verification_token = cls.objects.get(token_hash=token_hash, used=False)

            if verification_token.is_expired:
                return None

            return verification_token
        except cls.DoesNotExist:
            return None

    def mark_used(self):
        """Mark token as used."""
        self.used = True
        self.used_at = timezone.now()
        self.save()

    def __str__(self):
        return f"Email verification token for {self.user.username}"

    class Meta:
        db_table = "email_verification_tokens"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token_hash"]),
            models.Index(fields=["user", "used"]),
        ]


# Audit logging models for security and compliance.


class AuditLogQuerySet(models.QuerySet):
    """Custom queryset that prevents updates and deletes."""

    def update(self, **kwargs):
        raise ValidationError("Audit logs cannot be updated")

    def delete(self):
        raise ValidationError("Audit logs cannot be deleted")


class AuditLogManager(models.Manager):
    """Custom manager for AuditLog that prevents updates and deletes."""

    def get_queryset(self):
        return AuditLogQuerySet(self.model, using=self._db)

    def update(self, **kwargs):
        raise ValidationError("Audit logs cannot be updated")

    def delete(self):
        raise ValidationError("Audit logs cannot be deleted")


class AuditLog(models.Model):
    """
    Immutable audit log for tracking sensitive operations.

    This model is write-only to maintain audit integrity.
    """

    # Action categories
    AUTHENTICATION = "auth"
    USER_MANAGEMENT = "user"
    CONTENT_MODERATION = "moderation"
    ADMINISTRATIVE = "admin"
    SECURITY = "security"
    DATA_ACCESS = "data"

    CATEGORY_CHOICES = [
        (AUTHENTICATION, "Authentication"),
        (USER_MANAGEMENT, "User Management"),
        (CONTENT_MODERATION, "Content Moderation"),
        (ADMINISTRATIVE, "Administrative"),
        (SECURITY, "Security"),
        (DATA_ACCESS, "Data Access"),
    ]

    # Common action types
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"
    ACTION_LOGIN_FAILED = "login_failed"
    ACTION_PASSWORD_CHANGE = "password_change"
    ACTION_PASSWORD_RESET = "password_reset"
    ACTION_TOKEN_REFRESH = "token_refresh"
    ACTION_TOKEN_REVOKE = "token_revoke"
    ACTION_REGISTER = "register"
    ACTION_PROFILE_UPDATE = "profile_update"
    ACTION_ROLE_CHANGE = "role_change"
    ACTION_POST_CREATE = "post_create"
    ACTION_POST_DELETE = "post_delete"
    ACTION_POST_MODERATE = "post_moderate"
    ACTION_BULK_MODERATE = "bulk_moderate"
    ACTION_VERIFICATION_VOTE = "verification_vote"
    ACTION_EMAIL_VERIFY = "email_verify"
    ACTION_ACCOUNT_LOCK = "account_lock"
    ACTION_ACCOUNT_UNLOCK = "account_unlock"
    ACTION_EXPORT_DATA = "export_data"
    ACTION_VIEW_SENSITIVE = "view_sensitive"
    ACTION_ADMIN_OVERRIDE = "admin_override"

    # Core fields
    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    # Actor information
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="User who performed the action",
    )
    username = models.CharField(
        max_length=150,
        help_text="Username at time of action (preserved if user deleted)",
    )
    user_id_snapshot = models.IntegerField(
        null=True, help_text="User ID at time of action"
    )

    # Action details
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        db_index=True,
        help_text="Category of action",
    )
    action = models.CharField(
        max_length=50, db_index=True, help_text="Specific action performed"
    )
    success = models.BooleanField(
        default=True, help_text="Whether the action succeeded"
    )

    # Request context
    ip_address = models.GenericIPAddressField(
        null=True, blank=True, help_text="IP address of the request"
    )
    user_agent = models.TextField(blank=True, help_text="User agent string")
    request_id = models.CharField(
        max_length=50, blank=True, db_index=True, help_text="Request correlation ID"
    )

    # Resource information
    resource_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of resource affected (e.g., 'post', 'user')",
    )
    resource_id = models.IntegerField(
        null=True, blank=True, help_text="ID of the resource affected"
    )

    # Additional context
    context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional context data (automatically redacted)",
    )

    # Metadata
    reason = models.TextField(
        blank=True, help_text="Reason for the action (e.g., moderation reason)"
    )

    objects = AuditLogManager()

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp", "category"]),
            models.Index(fields=["user_id_snapshot", "-timestamp"]),
            models.Index(fields=["action", "-timestamp"]),
            models.Index(fields=["resource_type", "resource_id"]),
        ]
        permissions = [
            ("view_audit_logs", "Can view audit logs"),
            ("export_audit_logs", "Can export audit logs"),
        ]

    def __str__(self):
        return f"{self.timestamp} - {self.username} - {self.action}"

    def save(self, *args, **kwargs):
        """Override save to prevent updates."""
        if self.pk:
            raise ValidationError("Audit logs cannot be updated")

        # Ensure username is captured
        if self.user and not self.username:
            self.username = self.user.username
        if self.user and not self.user_id_snapshot:
            self.user_id_snapshot = self.user.id

        # Redact sensitive data from context
        if self.context:
            self.context = self._redact_sensitive_data(self.context)

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Override delete to prevent deletion."""
        raise ValidationError("Audit logs cannot be deleted")

    def _redact_sensitive_data(self, data):
        """Redact sensitive fields from context data."""
        if not isinstance(data, dict):
            return data

        sensitive_keys = {
            "password",
            "secret",
            "api_key",
            "access_token",
            "refresh_token",
            "authorization",
            "cookie",
            "session",
            "credit_card",
            "ssn",
            "pin",
            "auth_token",
            "bearer_token",
        }

        redacted = {}
        for key, value in data.items():
            lower_key = key.lower()
            # Check if key contains sensitive words
            if any(sensitive in lower_key for sensitive in sensitive_keys):
                redacted[key] = "[REDACTED]"
            elif isinstance(value, dict):
                redacted[key] = self._redact_sensitive_data(value)
            elif isinstance(value, list):
                redacted[key] = [
                    (
                        self._redact_sensitive_data(item)
                        if isinstance(item, dict)
                        else item
                    )
                    for item in value
                ]
            else:
                redacted[key] = value

        return redacted

    @classmethod
    def log(cls, user, action, category, request=None, **kwargs):
        """
        Convenience method to create an audit log entry.

        Args:
            user: User performing the action (can be None for anonymous)
            action: Action being performed
            category: Category of action
            request: Django request object (optional)
            **kwargs: Additional fields for the audit log
        """
        from django.conf import settings

        if not getattr(settings, "AUDIT_LOG_ENABLED", True):
            return None

        from api.utils.request_id import extract_request_id

        log_data = {
            "user": user,
            "username": user.username if user else "anonymous",
            "user_id_snapshot": user.id if user else None,
            "action": action,
            "category": category,
        }

        # Extract request information
        if request:
            log_data["ip_address"] = cls._get_client_ip(request)
            log_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")
            log_data["request_id"] = extract_request_id(request) or ""

        # Separate known fields from extra context
        known_fields = {"success", "resource_type", "resource_id", "reason", "context"}
        extra_context = {}

        for key, value in kwargs.items():
            if key in known_fields:
                log_data[key] = value
            else:
                extra_context[key] = value

        # Merge extra context into context field
        if extra_context:
            existing_context = log_data.get("context", {})
            if isinstance(existing_context, dict):
                existing_context.update(extra_context)
                log_data["context"] = existing_context
            else:
                log_data["context"] = extra_context

        # Create the log entry
        return cls.objects.create(**log_data)

    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request, considering proxies."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip
