"""
Moderation API endpoints for moderators and admins.
"""

import logging
from datetime import datetime, timedelta

from django.db.models import Avg, Count, F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import AuditLog, Post, User

logger = logging.getLogger(__name__)
from .moderation_permissions import IsModerator
from .serializers import PostSerializer
from .utils.audit import AuditContextManager, AuditLogger


class ModerationStatSerializer(serializers.Serializer):
    """Serializer for moderation statistics."""

    total_pending = serializers.IntegerField()
    reviewed_today = serializers.IntegerField()
    reviewed_this_week = serializers.IntegerField()
    average_review_time = serializers.FloatField()
    pending_by_status = serializers.DictField()
    moderator_activity = serializers.ListField(required=False)


class BulkActionSerializer(serializers.Serializer):
    """Serializer for bulk moderation actions."""

    post_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1, max_length=100
    )
    action = serializers.ChoiceField(choices=["approve", "reject", "remove"])
    rejection_reason = serializers.CharField(
        required=False, allow_blank=True, max_length=500
    )


class ModerationHistorySerializer(serializers.ModelSerializer):
    """Serializer for moderation history entries."""

    moderator_username = serializers.CharField(
        source="moderated_by.username", read_only=True
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
            "moderated_at",
            "moderated_by",
            "moderator_username",
        ]


class ModerationQueuePagination(PageNumberPagination):
    """Custom pagination for moderation queue."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 10


class ModerationViewSet(viewsets.GenericViewSet):
    """
    Viewset for moderation actions.
    Only accessible by moderators and admins.
    """

    permission_classes = [permissions.IsAuthenticated, IsModerator]
    pagination_class = ModerationQueuePagination

    def get_queryset(self):
        """Get base queryset for posts."""
        return Post.objects.select_related("user").prefetch_related("ai_responses")

    @action(detail=False, methods=["get"])
    def queue(self, request):
        """
        Get posts pending moderation.

        Query params:
        - search: Search in title and content
        - sort: Sort by created_at (default), -created_at, user
        - source_domain: Filter by source URL domain
        """
        queryset = self.get_queryset().filter(status="pending_moderation")

        # Search functionality
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(content__icontains=search)
                | Q(user__username__icontains=search)
            )

        # Filter by source domain
        source_domain = request.query_params.get("source_domain")
        if source_domain:
            queryset = queryset.filter(source_url__icontains=source_domain)

        # Sorting
        sort = request.query_params.get("sort", "created_at")
        if sort in ["created_at", "-created_at", "user"]:
            queryset = queryset.order_by(sort)

        # Paginate results
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PostSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = PostSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        Get moderation statistics.

        Returns:
        - Total pending posts
        - Posts reviewed today
        - Posts reviewed this week
        - Average review time
        - Breakdown by status
        - Top moderator activity (admins only)
        """
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        # Get total pending
        total_pending = Post.objects.filter(status="pending_moderation").count()

        # Get reviewed today
        reviewed_today = Post.objects.filter(
            moderated_at__gte=today_start,
            status__in=["pending_verification", "rejected", "removed"],
        ).count()

        # Get reviewed this week
        reviewed_this_week = Post.objects.filter(
            moderated_at__gte=week_start,
            status__in=["pending_verification", "rejected", "removed"],
        ).count()

        # Calculate average review time (in hours)
        reviewed_posts = (
            Post.objects.filter(
                moderated_at__isnull=False,
                status__in=["pending_verification", "rejected", "removed"],
            )
            .annotate(review_time=F("moderated_at") - F("created_at"))
            .aggregate(avg_time=Avg("review_time"))
        )

        avg_review_hours = 0
        if reviewed_posts["avg_time"]:
            avg_review_hours = reviewed_posts["avg_time"].total_seconds() / 3600

        # Get pending breakdown by creation date
        pending_by_status = {
            "last_hour": Post.objects.filter(
                status="pending_moderation", created_at__gte=now - timedelta(hours=1)
            ).count(),
            "last_24h": Post.objects.filter(
                status="pending_moderation", created_at__gte=now - timedelta(hours=24)
            ).count(),
            "older": Post.objects.filter(
                status="pending_moderation", created_at__lt=now - timedelta(hours=24)
            ).count(),
        }

        stats_data = {
            "total_pending": total_pending,
            "reviewed_today": reviewed_today,
            "reviewed_this_week": reviewed_this_week,
            "average_review_time": round(avg_review_hours, 2),
            "pending_by_status": pending_by_status,
        }

        # Add moderator activity for admins
        if request.user.role == "admin":
            moderator_activity = (
                User.objects.filter(
                    role__in=["moderator", "admin"],
                    moderated_posts__moderated_at__gte=week_start,
                )
                .annotate(posts_reviewed=Count("moderated_posts"))
                .values("username", "posts_reviewed")
                .order_by("-posts_reviewed")[:10]
            )

            stats_data["moderator_activity"] = list(moderator_activity)

        serializer = ModerationStatSerializer(stats_data)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def bulk_action(self, request):
        """
        Perform bulk moderation actions.

        Request body:
        {
            "post_ids": [1, 2, 3],
            "action": "approve|reject|remove",
            "rejection_reason": "Optional reason for rejection"
        }
        """
        serializer = BulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post_ids = serializer.validated_data["post_ids"]
        action = serializer.validated_data["action"]
        rejection_reason = serializer.validated_data.get("rejection_reason", "")

        # Get posts that can be moderated
        posts = Post.objects.filter(id__in=post_ids, status="pending_moderation")

        if not posts.exists():
            return Response(
                {"detail": "No valid posts found for moderation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use audit context manager for bulk operation
        with AuditContextManager(
            request=request,
            action=AuditLog.ACTION_BULK_MODERATE,
            category=AuditLog.CONTENT_MODERATION,
        ) as audit:
            # Add initial context
            audit.add_context("total_posts", len(post_ids))
            audit.add_context("action_type", action)
            audit.add_context("posts_to_moderate", posts.count())

            # Perform action
            update_data = {"moderated_by": request.user, "moderated_at": timezone.now()}

            if action == "approve":
                update_data["status"] = "pending_verification"
            elif action == "reject":
                update_data["status"] = "rejected"
                update_data["rejection_reason"] = (
                    rejection_reason or "Content violates community guidelines"
                )
            elif action == "remove":
                update_data["status"] = "removed"
                update_data["rejection_reason"] = (
                    rejection_reason or "Removed by moderator"
                )

            # Update posts
            updated_count = posts.update(**update_data)

            # Add results to audit context
            audit.add_context("updated_count", updated_count)
            audit.add_context("post_ids", list(posts.values_list("id", flat=True)))
            if rejection_reason:
                audit.add_context("rejection_reason", rejection_reason)

            # Log individual moderation actions for each post
            for post in posts:
                logger.info(
                    f"Moderation action '{action}' applied to post {post.id} by {request.user.username}"
                )

                # Individual audit log for each post
                AuditLogger.log_content_moderation(
                    request=request,
                    action=AuditLog.ACTION_POST_MODERATE,
                    post_id=post.id,
                    success=True,
                    reason=rejection_reason if action in ["reject", "remove"] else "",
                    moderation_action=action,
                )

            return Response(
                {"success": True, "updated_count": updated_count, "action": action}
            )

    @action(detail=False, methods=["get"])
    def history(self, request):
        """
        Get moderation history.

        Query params:
        - moderator: Filter by moderator username
        - status: Filter by post status
        - start_date: Filter by moderation date (ISO format)
        - end_date: Filter by moderation date (ISO format)
        """
        queryset = (
            Post.objects.filter(moderated_at__isnull=False)
            .select_related("moderated_by", "user")
            .order_by("-moderated_at")
        )

        # Filter by moderator
        moderator = request.query_params.get("moderator")
        if moderator:
            queryset = queryset.filter(moderated_by__username=moderator)

        # Filter by status
        post_status = request.query_params.get("status")
        if post_status:
            queryset = queryset.filter(status=post_status)

        # Filter by date range
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                queryset = queryset.filter(moderated_at__gte=start)
            except ValueError as e:
                logger.warning(f"Invalid start_date format: {start_date} - {str(e)}")

        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                queryset = queryset.filter(moderated_at__lte=end)
            except ValueError as e:
                logger.warning(f"Invalid end_date format: {end_date} - {str(e)}")

        # Paginate results
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ModerationHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ModerationHistorySerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def quick_action(self, request, pk=None):
        """
        Quick moderation action on a single post.

        Request body:
        {
            "action": "approve|reject|remove",
            "rejection_reason": "Optional reason"
        }
        """
        post = get_object_or_404(Post, pk=pk, status="pending_moderation")

        action = request.data.get("action")
        if action not in ["approve", "reject", "remove"]:
            return Response(
                {"detail": "Invalid action. Must be approve, reject, or remove."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rejection_reason = request.data.get("rejection_reason", "")

        # Update post
        post.moderated_by = request.user
        post.moderated_at = timezone.now()

        if action == "approve":
            post.status = "pending_verification"
        elif action == "reject":
            post.status = "rejected"
            post.rejection_reason = (
                rejection_reason or "Content violates community guidelines"
            )
        elif action == "remove":
            post.status = "removed"
            post.rejection_reason = rejection_reason or "Removed by moderator"

        post.save()

        # Audit log moderation action
        AuditLogger.log_content_moderation(
            request=request,
            action=AuditLog.ACTION_POST_MODERATE,
            post_id=post.id,
            success=True,
            reason=post.rejection_reason if action in ["reject", "remove"] else "",
            moderation_action=action,
            post_title=post.title,
            post_author_id=post.user.id,
            post_author_username=post.user.username,
        )

        serializer = PostSerializer(post, context={"request": request})
        return Response(serializer.data)
