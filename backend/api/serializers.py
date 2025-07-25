"""
DRF serializers for aisreact API.
"""

import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers

from .models import AIResponse, PasswordResetToken, Post, User, VerificationVote


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "role",
            "created_at",
            "is_verified",
        )
        read_only_fields = ("id", "created_at", "is_verified", "role")

    def validate_password(self, value):
        """Ensure password meets all requirements."""
        # Django's validate_password will check all configured validators
        # No need for custom length check as it's handled by MinimumLengthValidator
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user data (public)."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "role", "created_at", "is_verified")
        read_only_fields = ("id", "created_at", "is_verified", "role")


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = ("email",)

    def validate_email(self, value):
        """Check if email is already in use."""
        user = self.context["request"].user
        if User.objects.exclude(id=user.id).filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for public user profile."""

    post_count = serializers.IntegerField(read_only=True)
    live_post_count = serializers.IntegerField(read_only=True)
    verification_count = serializers.IntegerField(read_only=True)
    achievements = serializers.ListField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "role",
            "created_at",
            "is_verified",
            "bio",
            "avatar_url",
            "website_url",
            "twitter_username",
            "github_username",
            "post_count",
            "live_post_count",
            "verification_count",
            "achievements",
        )
        read_only_fields = ("id", "created_at", "is_verified", "role")


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)
    website_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    twitter_username = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    github_username = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = ("bio", "website_url", "twitter_username", "github_username")
        # Note: email and avatar_url are handled by separate endpoints for security

    def validate_twitter_username(self, value):
        """Validate Twitter username format."""
        if value and not re.match(r"^[a-zA-Z0-9_]+$", value):
            raise serializers.ValidationError(
                "Twitter username can only contain letters, numbers, and underscores"
            )
        return value

    def validate_github_username(self, value):
        """Validate GitHub username format."""
        if value and not re.match(r"^[a-zA-Z0-9-]+$", value):
            raise serializers.ValidationError(
                "GitHub username can only contain letters, numbers, and hyphens"
            )
        return value


class UserStatsSerializer(serializers.Serializer):
    """Serializer for user statistics."""

    total_posts = serializers.IntegerField()
    live_posts = serializers.IntegerField()
    pending_posts = serializers.IntegerField()
    rejected_posts = serializers.IntegerField()
    total_verifications = serializers.IntegerField()
    accurate_verifications = serializers.IntegerField()
    verification_accuracy = serializers.FloatField()
    joined_days_ago = serializers.IntegerField()
    last_active = serializers.DateTimeField()


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            # Allow login with username or email
            user = None
            if "@" in username:
                # Try email login
                try:
                    user_obj = User.objects.get(email=username)
                    user = authenticate(username=user_obj.username, password=password)
                except User.DoesNotExist:
                    # Email not found - authentication will fail below
                    user = None
            else:
                # Try username login
                user = authenticate(username=username, password=password)

            if not user:
                raise serializers.ValidationError("Invalid credentials")

            if not user.is_active:
                raise serializers.ValidationError("User account is disabled")

            attrs["user"] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include "username" and "password"')


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value

    def validate_new_password(self, value):
        """Same password requirements as registration."""
        # Django's validate_password will check all configured validators
        # No need for custom length check as it's handled by MinimumLengthValidator
        return value


class AIResponseSerializer(serializers.ModelSerializer):
    """Serializer for AI responses."""

    # Transform backend fields to match frontend expectations
    model_name = serializers.CharField(source="ai_model", read_only=True)
    post_id = serializers.IntegerField(source="post.id", read_only=True)
    response_data = serializers.SerializerMethodField()
    response_time_ms = serializers.SerializerMethodField()
    token_count = serializers.SerializerMethodField()
    is_successful = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()

    class Meta:
        model = AIResponse
        fields = (
            "id",
            "post_id",
            "model_name",
            "response_data",
            "response_time_ms",
            "token_count",
            "error_message",
            "created_at",
            "is_successful",
        )
        read_only_fields = ("id", "created_at")

    def get_response_data(self, obj):
        """Transform backend fields to frontend structure."""
        return {
            "summary": obj.summary,
            "historical_context": obj.impact_assessment,  # Backend stores historical in impact_assessment
            "future_development": obj.objectivity_analysis,  # Backend stores future in objectivity_analysis
            "opinions": (
                obj.key_quotes
                if isinstance(obj.key_quotes, str)
                else str(obj.key_quotes)
            ),  # Backend stores opinions in key_quotes
            "_fallback": (
                obj.metadata.get("_fallback", False) if obj.metadata else False
            ),
        }

    def get_response_time_ms(self, obj):
        """Extract response time from metadata."""
        if obj.metadata and "response_time_ms" in obj.metadata:
            return obj.metadata["response_time_ms"]
        return None

    def get_token_count(self, obj):
        """Extract token count from metadata."""
        if obj.metadata and "usage" in obj.metadata:
            usage = obj.metadata["usage"]
            if isinstance(usage, dict):
                return usage.get("total_tokens") or (
                    usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
                )
        return None

    def get_is_successful(self, obj):
        """AI responses stored in DB are always successful."""
        return True

    def get_error_message(self, obj):
        """No error for stored responses."""
        return None


class VerificationVoteSerializer(serializers.ModelSerializer):
    """Serializer for verification votes."""

    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = VerificationVote
        fields = ("id", "user", "username", "vote", "comment", "created_at")
        read_only_fields = ("id", "user", "username", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PostSerializer(serializers.ModelSerializer):
    """Serializer for posts with nested data."""

    user = UserSerializer(read_only=True)
    ai_responses = AIResponseSerializer(many=True, read_only=True)
    verification_score = serializers.ReadOnlyField()
    verification_count = serializers.ReadOnlyField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            "id",
            "user",
            "title",
            "content",
            "source_url",
            "image_url",
            "status",
            "moderation_result",
            "rejection_reason",
            "created_at",
            "updated_at",
            "verified_at",
            "ai_responses",
            "verification_score",
            "verification_count",
            "user_vote",
        )
        read_only_fields = (
            "id",
            "user",
            "status",
            "moderation_result",
            "rejection_reason",
            "created_at",
            "updated_at",
            "verified_at",
        )

    def get_user_vote(self, obj):
        """Get the current user's vote on this post."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            vote = VerificationVote.objects.filter(user=request.user, post=obj).first()
            if vote:
                return vote.vote
        return None


class PostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating posts."""

    content = serializers.CharField(max_length=70000)

    class Meta:
        model = Post
        fields = ("title", "content", "source_url", "image_url")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for post lists."""

    user = UserSerializer(read_only=True)
    verification_score = serializers.SerializerMethodField()
    verification_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    ai_summary = serializers.SerializerMethodField()

    def get_verification_score(self, obj):
        return obj.verification_score

    def get_verification_count(self, obj):
        return obj.verification_count

    def get_user_vote(self, obj):
        """Get the current user's vote on this post."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            vote = VerificationVote.objects.filter(user=request.user, post=obj).first()
            if vote:
                return vote.vote
        return None

    def get_ai_summary(self, obj):
        """Get AI summary, prioritizing Gemini."""
        if obj.status != "live":
            return None

        # Try to get Gemini summary first
        gemini_response = obj.ai_responses.filter(ai_model="google-gemini").first()
        if gemini_response and gemini_response.summary:
            return gemini_response.summary

        # Fallback to any available summary
        for response in obj.ai_responses.all():
            if response.summary:
                return response.summary

        return None

    class Meta:
        model = Post
        fields = (
            "id",
            "user",
            "title",
            "content",
            "source_url",
            "image_url",
            "status",
            "rejection_reason",
            "created_at",
            "verification_score",
            "verification_count",
            "user_vote",
            "ai_summary",
        )
        read_only_fields = ("id", "user", "status", "rejection_reason", "created_at")


class S3PresignedUrlSerializer(serializers.Serializer):
    """Serializer for S3 presigned URL requests."""

    filename = serializers.CharField()
    content_type = serializers.CharField()

    def validate_content_type(self, value):
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if value not in allowed_types:
            raise serializers.ValidationError(
                f'Content type must be one of: {", ".join(allowed_types)}'
            )
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting password reset."""

    email = serializers.EmailField()

    def validate_email(self, value):
        """Check if user with this email exists."""
        try:
            self.user = User.objects.get(email=value.lower())
        except User.DoesNotExist:
            # Don't reveal whether email exists for security
            pass
        return value.lower()

    def save(self):
        """Generate password reset token and send email."""
        # Only proceed if user exists
        if hasattr(self, "user"):
            from .services.email_utils import send_password_reset

            # This will use the email_utils which handles token generation
            send_password_reset(self.user)
        # Always return success to prevent email enumeration
        return True


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for resetting password with token."""

    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )

    def validate_new_password(self, value):
        """Same password requirements as registration."""
        # Django's validate_password will check all configured validators
        # No need for custom length check as it's handled by MinimumLengthValidator
        return value

    def validate_token(self, value):
        """Validate the reset token."""
        self.reset_token = PasswordResetToken.verify_token(value)
        if not self.reset_token:
            raise serializers.ValidationError("Invalid or expired reset token")
        return value

    def save(self):
        """Reset the user's password."""
        user = self.reset_token.user
        user.set_password(self.validated_data["new_password"])
        user.save()

        # Mark token as used
        self.reset_token.mark_used()

        return user
