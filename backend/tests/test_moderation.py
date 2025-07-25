"""
Tests for moderation API endpoints.
"""

from datetime import timedelta

from api.models import Post
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class ModerationAPITestCase(TestCase):
    """Test cases for moderation API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create users
        self.regular_user = User.objects.create_user(
            username="regular",
            email="regular@test.com",
            password="testpass123",
            role="user",
        )

        self.moderator = User.objects.create_user(
            username="moderator",
            email="mod@test.com",
            password="testpass123",
            role="moderator",
        )

        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            role="admin",
        )

        # Create test posts
        self.pending_post1 = Post.objects.create(
            user=self.regular_user,
            title="Pending Post 1",
            content="Test content 1",
            source_url="https://example.com/1",
            status="pending_moderation",
        )

        self.pending_post2 = Post.objects.create(
            user=self.regular_user,
            title="Pending Post 2",
            content="Test content 2",
            source_url="https://example.com/2",
            status="pending_moderation",
        )

        self.approved_post = Post.objects.create(
            user=self.regular_user,
            title="Approved Post",
            content="Approved content",
            source_url="https://example.com/3",
            status="pending_verification",
            moderated_by=self.moderator,
            moderated_at=timezone.now(),
        )

    def test_moderation_queue_requires_auth(self):
        """Test that moderation queue requires authentication."""
        response = self.client.get("/api/moderation/queue/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_cannot_access_moderation(self):
        """Test that regular users cannot access moderation endpoints."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get("/api/moderation/queue/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderator_can_access_queue(self):
        """Test that moderators can access the moderation queue."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.get("/api/moderation/queue/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)

    def test_admin_can_access_queue(self):
        """Test that admins can access the moderation queue."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/moderation/queue/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_queue_search(self):
        """Test searching in moderation queue."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.get("/api/moderation/queue/?search=Post%201")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Pending Post 1")

    def test_moderation_stats(self):
        """Test moderation statistics endpoint."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.get("/api/moderation/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_pending"], 2)
        self.assertIn("reviewed_today", response.data)
        self.assertIn("reviewed_this_week", response.data)
        self.assertIn("average_review_time", response.data)

    def test_admin_sees_moderator_activity(self):
        """Test that admins see moderator activity in stats."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/moderation/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("moderator_activity", response.data)

    def test_quick_action_approve(self):
        """Test quick approve action."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            f"/api/moderation/{self.pending_post1.id}/quick-action/",
            {"action": "approve"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify post was updated
        self.pending_post1.refresh_from_db()
        self.assertEqual(self.pending_post1.status, "pending_verification")
        self.assertEqual(self.pending_post1.moderated_by, self.moderator)
        self.assertIsNotNone(self.pending_post1.moderated_at)

    def test_quick_action_reject(self):
        """Test quick reject action."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            f"/api/moderation/{self.pending_post1.id}/quick-action/",
            {"action": "reject", "rejection_reason": "Test rejection"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify post was updated
        self.pending_post1.refresh_from_db()
        self.assertEqual(self.pending_post1.status, "rejected")
        self.assertEqual(self.pending_post1.rejection_reason, "Test rejection")

    def test_bulk_action(self):
        """Test bulk moderation action."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            "/api/moderation/bulk-action/",
            {
                "post_ids": [self.pending_post1.id, self.pending_post2.id],
                "action": "approve",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 2)

        # Verify posts were updated
        self.pending_post1.refresh_from_db()
        self.pending_post2.refresh_from_db()
        self.assertEqual(self.pending_post1.status, "pending_verification")
        self.assertEqual(self.pending_post2.status, "pending_verification")

    def test_moderation_history(self):
        """Test moderation history endpoint."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.get("/api/moderation/history/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)  # Only approved post
        self.assertEqual(response.data["results"][0]["title"], "Approved Post")

    def test_history_filters(self):
        """Test moderation history filters."""
        self.client.force_authenticate(user=self.moderator)

        # Filter by moderator
        response = self.client.get("/api/moderation/history/?moderator=moderator")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

        # Filter by status
        response = self.client.get(
            "/api/moderation/history/?status=pending_verification"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_invalid_quick_action(self):
        """Test invalid quick action."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            f"/api/moderation/{self.pending_post1.id}/quick-action/",
            {"action": "invalid"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_moderate_already_moderated(self):
        """Test that already moderated posts cannot be moderated again."""
        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            f"/api/moderation/{self.approved_post.id}/quick-action/",
            {"action": "reject"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
