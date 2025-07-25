# Type stubs for api.models

from typing import Any, Optional
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from datetime import datetime, timedelta

class User(AbstractBaseUser, PermissionsMixin):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime
    is_verified: bool
    bio: str
    profile_image_url: Optional[str]
    verification_count: int
    posts: models.Manager[Post]
    verification_votes: models.Manager[VerificationVote]
    is_active: bool
    is_staff: bool
    failed_login_attempts: int
    locked_until: Optional[datetime]
    
    def is_account_locked(self) -> bool: ...
    def reset_failed_attempts(self) -> None: ...
    def increment_failed_attempts(self) -> None: ...
    def get_username(self) -> str: ...
    def record_failed_login(self) -> None: ...
    def get_lockout_duration(self) -> timedelta: ...

class Post(models.Model):
    id: int
    title: str
    content: str
    source_url: Optional[str]
    author: User
    created_at: datetime
    updated_at: datetime
    status: str
    moderation_status: str
    moderation_reason: Optional[str]
    moderated_at: Optional[datetime]
    verified_count: int
    rejected_count: int
    verified_at: Optional[datetime]
    ai_responses: models.Manager[AIResponse]
    verification_votes: models.Manager[VerificationVote]
    image_url: Optional[str]
    moderation_result: Optional[dict]
    rejection_reason: Optional[str]
    verification_count: int
    verification_score: float

class AIResponse(models.Model):
    id: int
    post: Post
    provider: str
    model_name: str
    response_text: str
    response_data: dict
    response_time_ms: int
    created_at: datetime
    error: Optional[str]

class VerificationVote(models.Model):
    id: int
    post: Post
    user: User
    vote: str
    reason: Optional[str]
    created_at: datetime

class AuditLog(models.Model):
    id: int
    timestamp: datetime
    user: Optional[User]
    action: str
    details: dict
    ip_address: Optional[str]
    user_agent: Optional[str]
    request_id: Optional[str]
    category: str
    severity: str
    context: dict
    
    # Category constants
    AUTHENTICATION: str
    SECURITY: str
    USER_MANAGEMENT: str
    ADMINISTRATIVE: str
    CONTENT_MODERATION: str
    DATA_ACCESS: str
    
    # Action constants
    ACTION_LOGIN: str
    ACTION_LOGOUT: str
    ACTION_LOGIN_FAILED: str
    ACTION_REGISTER: str
    ACTION_PASSWORD_CHANGE: str
    ACTION_PASSWORD_RESET: str
    ACTION_PROFILE_UPDATE: str
    ACTION_EMAIL_VERIFIED: str
    ACTION_ACCOUNT_LOCK: str
    ACTION_ACCOUNT_UNLOCK: str
    ACTION_ROLE_CHANGE: str
    ACTION_EXPORT_DATA: str
    ACTION_ACCOUNT_LOCKED: str
    ACTION_POST_DELETE: str
    
    @classmethod
    def log(cls, *args, **kwargs) -> AuditLog: ...

class EmailVerificationToken(models.Model):
    id: int
    user: User
    token: str
    created_at: datetime
    expires_at: datetime
    is_used: bool
    
    @classmethod
    def verify_token(cls, token: str) -> Optional[EmailVerificationToken]: ...
    
    @classmethod
    def create_token(cls, user: User) -> EmailVerificationToken: ...
    
    def mark_used(self) -> None: ...

class PasswordResetToken(models.Model):
    id: int
    user: User
    token: str
    created_at: datetime
    expires_at: datetime
    is_used: bool
    
    @classmethod
    def verify_token(cls, token: str) -> Optional[PasswordResetToken]: ...
    
    @classmethod
    def create_token(cls, user: User) -> PasswordResetToken: ...
    
    def mark_used(self) -> None: ...