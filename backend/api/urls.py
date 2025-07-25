"""
URL configuration for API app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_actions import admin_approve_post, bulk_admin_approve
from .auth import TokenRevokeView, TokenRotationView
from .csrf import get_csrf_token
from .health import (
    DetailedHealthCheckView,
    HealthCheckView,
    LivenessCheckView,
    ReadinessCheckView,
)
from .moderation import ModerationViewSet
from .views import (
    EmailVerificationView,
    FeedViewSet,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PostViewSet,
    RegisterView,
    ResendVerificationView,
    S3PresignedUrlView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"posts", PostViewSet, basename="post")

app_name = "api"

urlpatterns = [
    # CSRF Token
    path("csrf/", get_csrf_token, name="csrf_token"),
    # Health checks
    path("health/", HealthCheckView.as_view(), name="health"),
    path("health/detailed/", DetailedHealthCheckView.as_view(), name="health_detailed"),
    path("health/ready/", ReadinessCheckView.as_view(), name="health_ready"),
    path("health/live/", LivenessCheckView.as_view(), name="health_live"),
    # Authentication
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", LoginView.as_view(), name="token"),
    path("auth/token/refresh/", TokenRotationView.as_view(), name="token_refresh"),
    path("auth/token/revoke/", TokenRevokeView.as_view(), name="token_revoke"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path(
        "auth/me/", UserViewSet.as_view({"get": "me", "patch": "update_me"}), name="me"
    ),
    path(
        "auth/change-password/",
        UserViewSet.as_view({"post": "change_password"}),
        name="change_password",
    ),
    path(
        "auth/upload-avatar/",
        UserViewSet.as_view({"post": "upload_avatar"}),
        name="upload_avatar",
    ),
    path(
        "auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path(
        "auth/verify-email/",
        EmailVerificationView.as_view(),
        name="verify_email",
    ),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="resend_verification",
    ),
    # S3 Upload
    path(
        "upload/presigned-url/", S3PresignedUrlView.as_view(), name="s3_presigned_url"
    ),
    # Feed endpoints
    path(
        "feed/live/",
        FeedViewSet.as_view({"get": "list"}),
        {"feed_type": "live"},
        name="feed_live",
    ),
    path(
        "feed/rejected/",
        FeedViewSet.as_view({"get": "list"}),
        {"feed_type": "rejected"},
        name="feed_rejected",
    ),
    path(
        "feed/pending/",
        FeedViewSet.as_view({"get": "list"}),
        {"feed_type": "pending"},
        name="feed_pending",
    ),
    # Moderation endpoints
    path(
        "moderation/queue/",
        ModerationViewSet.as_view({"get": "queue"}),
        name="moderation_queue",
    ),
    path(
        "moderation/stats/",
        ModerationViewSet.as_view({"get": "stats"}),
        name="moderation_stats",
    ),
    path(
        "moderation/bulk-action/",
        ModerationViewSet.as_view({"post": "bulk_action"}),
        name="moderation_bulk_action",
    ),
    path(
        "moderation/history/",
        ModerationViewSet.as_view({"get": "history"}),
        name="moderation_history",
    ),
    path(
        "moderation/<int:pk>/quick-action/",
        ModerationViewSet.as_view({"post": "quick_action"}),
        name="moderation_quick_action",
    ),
    # Admin actions
    path(
        "admin/posts/<int:post_id>/approve/",
        admin_approve_post,
        name="admin_approve_post",
    ),
    path(
        "admin/posts/bulk-approve/",
        bulk_admin_approve,
        name="bulk_admin_approve",
    ),
    # User profile endpoints
    path(
        "users/<str:username>/",
        UserViewSet.as_view({"get": "retrieve"}),
        name="user_profile",
    ),
    path(
        "users/<str:username>/posts/",
        UserViewSet.as_view({"get": "posts"}),
        name="user_posts",
    ),
    path(
        "users/<str:username>/stats/",
        UserViewSet.as_view({"get": "stats"}),
        name="user_stats",
    ),
    # Include router URLs
    path("", include(router.urls)),
]
