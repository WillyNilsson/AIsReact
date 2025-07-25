"""
DRF views for aisreact API.
"""

import contextlib
import logging
import uuid
from typing import Optional, cast

import boto3
from botocore.exceptions import ClientError
from django.conf import settings
from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .auth import RotatingRefreshToken
from .models import AuditLog, EmailVerificationToken, Post, User, VerificationVote
from .permissions import IsOwnerOrReadOnly
from .serializers import (
    ChangePasswordSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PostCreateSerializer,
    PostListSerializer,
    PostSerializer,
    S3PresignedUrlSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserStatsSerializer,
    VerificationVoteSerializer,
)
from .services.email_utils import send_email_verification
from .tasks import run_ai_analysis, run_automated_moderation
from .throttles import (
    AuthThrottle,
    EmailVerificationThrottle,
    LoginThrottle,
    PasswordResetThrottle,
    RegistrationThrottle,
)
from .utils.audit import AuditLogger

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class RegisterView(APIView):
    """User registration endpoint."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegistrationThrottle]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Audit log successful registration
            AuditLogger.log_authentication(
                request=request,
                action=AuditLog.ACTION_REGISTER,
                success=True,
                user=user,
                email=user.email,
            )

            # TEMPORARILY DISABLED FOR V1: Email verification
            # Send verification email
            # try:
            #     send_email_verification(user)
            #     logger.info(f"Verification email sent to user {user.id}")
            # except Exception as e:
            #     logger.error(
            #         f"Failed to send verification email to "
            #         f"user {user.id}: {str(e)}"
            #     )
            #     # Continue with registration even if email fails

            # Generate tokens
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "created_at": user.created_at,
                    "is_verified": user.is_verified,
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                },
                status=status.HTTP_201_CREATED,
            )

        # Audit log failed registration attempt
        AuditLogger.log_authentication(
            request=request,
            action=AuditLog.ACTION_REGISTER,
            success=False,
            username=request.data.get("username", "unknown"),
            email=request.data.get("email", "unknown"),
            errors=serializer.errors,
        )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """Logout endpoint (for frontend compatibility)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Audit log logout
        if request.user.is_authenticated:
            AuditLogger.log_authentication(
                request=request,
                action=AuditLog.ACTION_LOGOUT,
                success=True,
                user=request.user,
            )

        # In JWT, we don't need to do anything server-side
        # The frontend will clear the tokens
        return Response({"detail": "Successfully logged out"})


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(TokenObtainPairView):
    """Enhanced login view that accepts username or email."""

    throttle_classes = [LoginThrottle]

    def post(self, request, *args, **kwargs):
        # Handle OAuth2 form data format
        if request.content_type == "application/x-www-form-urlencoded":
            username = request.data.get("username")
            password = request.data.get("password")
        else:
            # JSON format
            username = request.data.get("username")
            password = request.data.get("password")

        if not username or not password:
            return Response(
                {"detail": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Try to find the user first
        user_obj = None
        if "@" in username:
            # Try email lookup
            with contextlib.suppress(User.DoesNotExist):
                user_obj = User.objects.get(email=username)
        else:
            # Try username lookup
            with contextlib.suppress(User.DoesNotExist):
                user_obj = User.objects.get(username__iexact=username)

        # Check if account is locked before attempting authentication
        if user_obj and user_obj.is_account_locked():
            locked_minutes = int(
                (user_obj.locked_until - timezone.now()).total_seconds() / 60
            )

            # Audit log account locked attempt
            AuditLogger.log_security(
                request=request,
                action=AuditLog.ACTION_LOGIN_FAILED,
                success=False,
                severity="high",
                reason="Account locked",
                locked_until=user_obj.locked_until.isoformat(),
                username=user_obj.username,
                user_id=user_obj.id,
            )

            return Response(
                {
                    "detail": (
                        f"Account is locked due to too many "
                        f"failed login attempts. "
                        f"Please try again in {locked_minutes} minutes."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Try to authenticate
        user = None
        if user_obj:
            authenticated_user = authenticate(
                username=user_obj.username, password=password
            )
            # Type assertion - we know this returns our User model if successful
            user = cast(Optional[User], authenticated_user)

        if not user:
            # Record failed attempt if user exists
            if user_obj:
                user_obj.record_failed_login()
                remaining_attempts = max(0, 5 - user_obj.failed_login_attempts)

                # Audit log failed login
                AuditLogger.log_authentication(
                    request=request,
                    action=AuditLog.ACTION_LOGIN_FAILED,
                    success=False,
                    user=user_obj,
                    remaining_attempts=remaining_attempts,
                )

                if remaining_attempts > 0:
                    return Response(
                        {
                            "detail": (
                                f"Invalid credentials. "
                                f"{remaining_attempts} attempts "
                                f"remaining before account lockout."
                            )
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                else:
                    # Account just got locked
                    AuditLogger.log_security(
                        request=request,
                        action=AuditLog.ACTION_ACCOUNT_LOCK,
                        success=True,
                        user=user_obj,
                        severity="high",
                        reason="Too many failed login attempts",
                    )

                    locked_minutes = int(
                        user_obj.get_lockout_duration().total_seconds() / 60
                    )
                    return Response(
                        {
                            "detail": (
                                f"Invalid credentials. Account is now locked "
                                f"for {locked_minutes} minutes."
                            )
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            else:
                # Audit log failed login with unknown user
                AuditLogger.log_authentication(
                    request=request,
                    action=AuditLog.ACTION_LOGIN_FAILED,
                    success=False,
                    username=username,
                    reason="User not found",
                )

                # Generic message when user doesn't exist
                # (prevent username enumeration)
                return Response(
                    {"detail": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        if not user.is_active:
            # Audit log disabled account login attempt
            AuditLogger.log_authentication(
                request=request,
                action=AuditLog.ACTION_LOGIN_FAILED,
                success=False,
                user=user,
                reason="Account disabled",
            )

            return Response(
                {"detail": "User account is disabled"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Reset failed attempts on successful login
        user.reset_failed_attempts()

        # Audit log successful login
        AuditLogger.log_authentication(
            request=request, action=AuditLog.ACTION_LOGIN, success=True, user=user
        )

        # Generate tokens with rotation support
        refresh = RotatingRefreshToken.for_user(user)

        # Return response with both token formats for compatibility
        return Response(
            {
                # Standard JWT format
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                # OAuth2 format for backward compatibility
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "token_type": "Bearer",
                "expires_in": settings.SIMPLE_JWT[
                    "ACCESS_TOKEN_LIFETIME"
                ].total_seconds(),
                "refresh_expires_in": settings.SIMPLE_JWT[
                    "REFRESH_TOKEN_LIFETIME"
                ].total_seconds(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "created_at": user.created_at,
                    "is_verified": user.is_verified,
                },
            }
        )


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user operations."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]  # Allow public profile viewing
    lookup_field = "username"
    lookup_value_regex = "[^/]+"  # Allow any character except /

    def get_serializer_class(self):
        """Use different serializers for different actions."""
        if self.action == "retrieve":
            return UserProfileSerializer
        elif self.action in ["update_me", "partial_update_me"]:
            return UserProfileUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ["me", "update_me", "change_password", "upload_avatar"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]  # Public profile viewing

    def retrieve(self, request, username=None):
        """Get public user profile by username."""
        try:
            user = User.objects.get(username__iexact=username)
            serializer = self.get_serializer(user, context={"request": request})
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Get current user info."""
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["patch"])
    def update_me(self, request):
        """Update current user profile."""
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        if serializer.is_valid():
            # Track what fields changed
            changed_fields = list(serializer.validated_data.keys())

            serializer.save()

            # Audit log profile update
            AuditLogger.log_user_management(
                request=request,
                action=AuditLog.ACTION_PROFILE_UPDATE,
                target_user=request.user,
                success=True,
                changed_fields=changed_fields,
            )

            return Response(UserProfileSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def change_password(self, request):
        """Change current user's password."""
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save()

            # Audit log password change
            AuditLogger.log_authentication(
                request=request,
                action=AuditLog.ACTION_PASSWORD_CHANGE,
                success=True,
                user=request.user,
            )

            return Response({"detail": "Password changed successfully"})

        # Audit log failed password change attempt
        AuditLogger.log_authentication(
            request=request,
            action=AuditLog.ACTION_PASSWORD_CHANGE,
            success=False,
            user=request.user,
            errors=serializer.errors,
        )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def posts(self, request, username=None):
        """Get all posts by a specific user."""
        try:
            user = User.objects.get(username__iexact=username)
            # Get posts based on requester
            if request.user.is_authenticated and request.user == user:
                # User viewing their own posts - show all
                posts = user.posts.all()
            else:
                # Others viewing - show only live posts
                posts = user.posts.filter(status="live")

            # Apply ordering
            posts = posts.order_by("-created_at")

            # Paginate results
            page = self.paginate_queryset(posts)
            if page is not None:
                serializer = PostListSerializer(
                    page, many=True, context={"request": request}
                )
                return self.get_paginated_response(serializer.data)

            serializer = PostListSerializer(
                posts, many=True, context={"request": request}
            )
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["get"])
    def stats(self, request, username=None):
        """Get user statistics."""
        try:
            user = User.objects.get(username__iexact=username)

            # Calculate statistics
            total_posts = user.posts.count()
            live_posts = user.posts.filter(status="live").count()
            pending_posts = user.posts.filter(
                status__in=["pending_moderation", "pending_verification"]
            ).count()
            rejected_posts = user.posts.filter(status="rejected").count()

            # Verification statistics
            total_verifications = user.verification_votes.count()
            accurate_verifications = user.verification_votes.filter(vote=True).count()
            verification_accuracy = (
                (accurate_verifications / total_verifications * 100)
                if total_verifications > 0
                else 0
            )

            # Activity statistics
            joined_days_ago = (timezone.now() - user.created_at).days
            last_post = user.posts.order_by("-created_at").first()
            last_active = last_post.created_at if last_post else user.created_at

            stats_data = {
                "total_posts": total_posts,
                "live_posts": live_posts,
                "pending_posts": pending_posts,
                "rejected_posts": rejected_posts,
                "total_verifications": total_verifications,
                "accurate_verifications": accurate_verifications,
                "verification_accuracy": round(verification_accuracy, 1),
                "joined_days_ago": joined_days_ago,
                "last_active": last_active,
            }

            serializer = UserStatsSerializer(stats_data)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["post"])
    def upload_avatar(self, request):
        """Generate presigned URL for avatar upload."""
        # Check if filename is provided
        filename = request.data.get("filename")
        if not filename:
            return Response(
                {"detail": "Filename is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extension
        allowed_extensions = ["jpg", "jpeg", "png", "gif", "webp"]
        file_extension = filename.split(".")[-1].lower()
        if file_extension not in allowed_extensions:
            return Response(
                {
                    "detail": (
                        f"Invalid file type. Allowed: "
                        f"{', '.join(allowed_extensions)}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate unique key for avatar
        key = f"avatars/{request.user.id}/{uuid.uuid4()}.{file_extension}"

        # Generate presigned URL
        try:
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
                region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
            )
            presigned_url = s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                    "Key": key,
                    "ContentType": f"image/{file_extension}",
                    # Note: ACL removed as bucket uses bucket policy instead
                },
                ExpiresIn=3600,  # 1 hour
            )

            # Update user's avatar_url
            avatar_url = (
                f"https://{settings.AWS_STORAGE_BUCKET_NAME}." f"s3.amazonaws.com/{key}"
            )
            request.user.avatar_url = avatar_url
            request.user.save()

            return Response(
                {
                    "upload_url": presigned_url,
                    "avatar_url": avatar_url,
                }
            )
        except ClientError as e:
            # Log the full error for debugging but don't expose to client
            logger.error(
                f"S3 avatar upload URL generation failed: {e}",
                extra={
                    "user_id": request.user.id,
                    "error_code": (
                        e.response.get("Error", {}).get("Code") if e.response else None
                    ),
                    "request_id": (
                        e.response.get("ResponseMetadata", {}).get("RequestId")
                        if e.response
                        else None
                    ),
                },
            )
            # Return generic error to avoid exposing AWS details
            return Response(
                {"detail": "Failed to generate upload URL. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PostViewSet(viewsets.ModelViewSet):
    """ViewSet for posts."""

    queryset = Post.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "content"]
    ordering_fields = ["created_at", "verified_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return PostCreateSerializer
        elif self.action == "list":
            return PostListSerializer
        return PostSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Filter by user
        user_param = self.request.query_params.get("user")
        if user_param:
            queryset = queryset.filter(user__username=user_param)

        return queryset.select_related("user").prefetch_related(
            "ai_responses", "verification_votes"
        )

    def perform_create(self, serializer):
        """Create post and trigger moderation."""
        post = serializer.save()
        # Trigger automated moderation
        try:
            run_automated_moderation.delay(post.id)
        except Exception as e:
            # Log the error but don't fail the post creation
            logger.error(f"Failed to trigger moderation for post {post.id}: {str(e)}")
            # Post is already created, moderation can be retried later

    def create(self, request, *args, **kwargs):
        """Create a post and return full serialized data."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        # Return the full post data using PostSerializer
        # with related data
        post = Post.objects.select_related("user").get(id=serializer.instance.id)
        output_serializer = PostSerializer(post, context={"request": request})
        headers = self.get_success_headers(output_serializer.data)
        return Response(
            output_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    @action(
        detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated]
    )
    def verify(self, request, pk=None):
        """Submit a verification vote."""
        post = self.get_object()

        # Check if post is pending verification
        if post.status != "pending_verification":
            return Response(
                {"detail": "This post is not open for verification"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if already voted
        existing_vote = VerificationVote.objects.filter(
            user=request.user, post=post
        ).first()

        if existing_vote:
            # Check if clicking the same vote (toggle off)
            requested_vote = request.data.get("vote")
            if existing_vote.vote == requested_vote:
                # Delete the vote
                existing_vote.delete()
                return Response(
                    {
                        "detail": "Vote removed",
                        "user_vote": None,
                        "new_verification_score": post.verification_score,
                        "new_verification_count": post.verification_count,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                # Change vote
                serializer = VerificationVoteSerializer(
                    existing_vote, data=request.data, context={"request": request}
                )
        else:
            # New vote
            serializer = VerificationVoteSerializer(
                data=request.data, context={"request": request}
            )

        if serializer.is_valid():
            if existing_vote:
                vote = serializer.save()
            else:
                vote = serializer.save(post=post, user=request.user)

            # Check if post should be verified
            if post.verification_count >= 5 and post.verification_score >= 80:
                post.status = "live"
                post.verified_at = timezone.now()
                post.save()
                # Trigger AI analysis
                run_ai_analysis.delay(post.id)

            # Return comprehensive response matching frontend expectations
            response_data = {
                "id": vote.id,
                "user": {"id": vote.user.id, "username": vote.user.username},
                "post_id": post.id,
                "vote_type": "positive" if vote.vote else "negative",
                "vote": vote.vote,
                "reason": vote.comment,
                "created_at": vote.created_at,
                "new_verification_score": post.verification_score,
                "new_verification_count": post.verification_count,
                "post_status": post.status,
                "message": "Vote recorded successfully",
            }

            return Response(response_data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, permissions.IsAdminUser],
    )
    def trigger_ai_analysis(self, request, pk=None):
        """Manually trigger AI analysis for a post (admin only)."""
        post = self.get_object()

        # Check if post is in a valid state
        # for AI analysis
        if post.status not in ["live", "pending_verification"]:
            return Response(
                {
                    "detail": (
                        "Post must be live or pending "
                        "verification to trigger AI analysis"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Trigger AI analysis
        run_ai_analysis.delay(post.id)

        return Response(
            {"detail": "AI analysis triggered successfully"}, status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def ai_status(self, request, pk=None):
        """Get AI analysis status for a post."""
        post = self.get_object()

        # Get existing AI responses
        ai_responses = post.ai_responses.all()

        # Define all expected AI providers
        providers = ["openai", "anthropic", "google", "xai", "deepseek"]

        # Build status response
        status_data = {
            "post_id": post.id,
            "analysis_complete": len(ai_responses) == len(providers),
            "providers": {},
        }

        # Add status for each provider
        for provider in providers:
            response = ai_responses.filter(ai_model__icontains=provider).first()
            if response:
                status_data["providers"][provider] = {
                    "status": "completed",
                    "completed_at": response.created_at,
                    "has_error": False,
                }
            else:
                status_data["providers"][provider] = {
                    "status": "pending",
                    "completed_at": None,
                    "has_error": False,
                }

        return Response(status_data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        url_path="verification-stats",
    )
    def verification_stats(self, request, pk=None):
        """Get verification statistics for a post."""
        post = self.get_object()

        # Get user's vote if authenticated
        user_vote = None
        if request.user.is_authenticated:
            vote = VerificationVote.objects.filter(user=request.user, post=post).first()
            if vote:
                user_vote = "positive" if vote.vote else "negative"

        # Build stats response
        stats_data = {
            "post_id": post.id,
            "total_votes": post.verification_count,
            "positive_votes": post.verification_votes.filter(vote=True).count(),
            "negative_votes": post.verification_votes.filter(vote=False).count(),
            "verification_score": post.verification_score,
            "user_vote": user_vote,
        }

        return Response(stats_data)

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="batch-vote",
    )
    def batch_vote(self, request):
        """Submit verification votes for multiple posts."""
        post_ids = request.data.get("post_ids", [])
        # Default to positive vote
        vote_value = request.data.get("vote", True)

        if not post_ids:
            return Response(
                {"detail": "No post IDs provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        results = []

        for post_id in post_ids:
            try:
                post = Post.objects.get(id=post_id)

                # Check if post is pending verification
                if post.status != "pending_verification":
                    results.append(
                        {
                            "post_id": post_id,
                            "success": False,
                            "error": "Post is not open for verification",
                        }
                    )
                    continue

                # Check if already voted
                existing_vote = VerificationVote.objects.filter(
                    user=request.user, post=post
                ).first()

                if existing_vote:
                    results.append(
                        {
                            "post_id": post_id,
                            "success": False,
                            "error": "Already voted on this post",
                        }
                    )
                    continue

                # Create vote
                VerificationVote.objects.create(
                    user=request.user, post=post, vote=vote_value, comment=""
                )

                # Check if post should be verified
                if post.verification_count >= 5 and post.verification_score >= 80:
                    post.status = "live"
                    post.verified_at = timezone.now()
                    post.save()
                    # Trigger AI analysis
                    run_ai_analysis.delay(post.id)

                results.append(
                    {
                        "post_id": post_id,
                        "success": True,
                        "new_vote_count": post.verification_count,
                    }
                )

            except Post.DoesNotExist:
                results.append(
                    {"post_id": post_id, "success": False, "error": "Post not found"}
                )
            except Exception as e:
                logger.error(f"Error in batch vote for post {post_id}: {str(e)}")
                results.append(
                    {"post_id": post_id, "success": False, "error": "Internal error"}
                )

        return Response({"message": "Votes processed", "results": results})

    def destroy(self, request, *args, **kwargs):
        """Override destroy to allow admins to delete any post."""
        post = self.get_object()

        # Check if user is the owner or an admin
        if request.user != post.user and request.user.role != "admin":
            return Response(
                {"detail": "You do not have permission to delete this post"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Prevent deletion of analyzed posts (LIVE status) to preserve historical data
        if post.status == "live":
            return Response(
                {
                    "detail": "Cannot delete posts that have been analyzed. This preserves the historical record of AI responses."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Perform the deletion
        post.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for public feeds."""

    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ["title", "content", "user__username"]
    ordering = ["-created_at"]

    def get_queryset(self):
        feed_type = self.kwargs.get("feed_type", "live")

        queryset = Post.objects.select_related("user").prefetch_related(
            "verification_votes", "ai_responses"
        )

        if feed_type == "live":
            return queryset.filter(status="live")
        elif feed_type == "rejected":
            return queryset.filter(status="rejected")
        elif feed_type == "pending":
            return queryset.filter(status="pending_verification")
        else:
            return Post.objects.none()

    def list(self, request, *args, **kwargs):
        """Override list to handle custom page_size parameter."""
        # Get page_size from query params and update paginator if provided
        page_size = request.query_params.get("page_size")
        if page_size:
            try:
                page_size_int = int(page_size)
                # Limit page size to prevent abuse - max 10 items per page
                if 1 <= page_size_int <= 10:
                    self.paginator.page_size = page_size_int
                else:
                    # Force max 10 items
                    self.paginator.page_size = 10
                    logger.warning(
                        f"Page size {page_size_int} exceeds limit, " f"using 10"
                    )
            except (ValueError, AttributeError) as e:
                logger.debug(f"Invalid page_size parameter: {page_size} - {str(e)}")

        return super().list(request, *args, **kwargs)


class S3PresignedUrlView(APIView):
    """Generate presigned URLs for S3 uploads."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = S3PresignedUrlSerializer(data=request.data)
        if serializer.is_valid():
            filename = serializer.validated_data["filename"]
            content_type = serializer.validated_data["content_type"]

            # Generate unique key
            file_extension = filename.split(".")[-1]
            key = f"uploads/{request.user.id}/{uuid.uuid4()}.{file_extension}"

            # Generate presigned URL
            try:
                s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                    aws_secret_access_key=getattr(
                        settings, "AWS_SECRET_ACCESS_KEY", None
                    ),
                    region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
                )
                presigned_url = s3_client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                        "Key": key,
                        "ContentType": content_type,
                        # Note: ACL removed as bucket uses bucket policy instead
                    },
                    ExpiresIn=3600,  # 1 hour
                )

                return Response(
                    {
                        "upload_url": presigned_url,
                        "file_url": (
                            f"https://{settings.AWS_STORAGE_BUCKET_NAME}."
                            f"s3.amazonaws.com/{key}"
                        ),
                    }
                )
            except ClientError as e:
                # Log the full error for debugging but don't expose to client
                logger.error(
                    f"S3 presigned URL generation failed: {e}",
                    extra={
                        "user_id": (
                            request.user.id if request.user.is_authenticated else None
                        ),
                        "error_code": (
                            e.response.get("Error", {}).get("Code")
                            if e.response
                            else None
                        ),
                        "request_id": (
                            e.response.get("ResponseMetadata", {}).get("RequestId")
                            if e.response
                            else None
                        ),
                    },
                )
                # Return generic error to avoid exposing AWS details
                return Response(
                    {
                        "detail": "Failed to generate upload URL. "
                        "Please try again later."
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """Request a password reset email."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            # Always return success to prevent email enumeration
            return Response(
                {
                    "detail": (
                        "If an account exists with this email, "
                        "you will receive a password reset link."
                    )
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """Reset password with a valid token."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]  # Less strict since token is required

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Generate new tokens for automatic login after reset
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "detail": "Password has been reset successfully.",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": user.role,
                        "is_verified": user.is_verified,
                    },
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailVerificationView(APIView):
    """Verify email with token."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Verify email address with token from URL."""
        token = request.query_params.get("token")

        if not token:
            return Response(
                {"detail": "Verification token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the token
        verification_token = EmailVerificationToken.verify_token(token)

        if not verification_token:
            return Response(
                {"detail": "Invalid or expired verification token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark user as verified
        user = verification_token.user
        user.is_verified = True
        user.save()

        # Mark token as used
        verification_token.mark_used()

        # Generate tokens for automatic login
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "detail": "Email verified successfully",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "is_verified": user.is_verified,
                },
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    """Resend verification email."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [EmailVerificationThrottle]

    def post(self, request):
        """Resend verification email to current user."""
        user = request.user

        # Check if already verified
        if user.is_verified:
            return Response(
                {"detail": "Email is already verified"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check rate limiting - get tokens created in last hour
        from datetime import timedelta

        from django.utils import timezone

        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_tokens = EmailVerificationToken.objects.filter(
            user=user, created_at__gte=one_hour_ago
        ).count()

        if recent_tokens >= 3:
            return Response(
                {
                    "detail": (
                        "Too many verification emails sent. " "Please try again later."
                    )
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Send new verification email
        try:
            send_email_verification(user)
            return Response(
                {"detail": "Verification email sent successfully"},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Failed to resend verification email: {str(e)}")
            return Response(
                {
                    "detail": (
                        "Failed to send verification email. " "Please try again later."
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
