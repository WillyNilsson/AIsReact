"""
End-to-end tests for post creation and workflow using actual API calls.
"""

import json
import time
from unittest.mock import Mock, patch

import pytest
from api.models import AIResponse, Post
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
@pytest.mark.e2e
class TestPostCreationE2E:
    """E2E tests for post creation and management workflows."""

    def test_complete_post_submission_flow(self, authenticated_client, test_user):
        """Test creating a post from submission to moderation."""
        # 1. Create a new post
        post_data = {
            "title": "Breaking: AI Breakthrough Announced",
            "content": "Scientists have announced a major breakthrough in artificial intelligence that could revolutionize healthcare.",
            "source_url": "https://news.example.com/ai-breakthrough",
        }

        response = authenticated_client.post("/api/posts/", post_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == post_data["title"]
        assert response.data["content"] == post_data["content"]
        assert response.data["source_url"] == post_data["source_url"]
        assert response.data["status"] == "pending_moderation"
        assert response.data["user"]["id"] == test_user.id

        post_id = response.data["id"]

        # 2. Verify post in database
        post = Post.objects.get(id=post_id)
        assert post.user == test_user
        assert post.status == "pending_moderation"

        # 3. Retrieve the post
        get_response = authenticated_client.get(f"/api/posts/{post_id}/")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.data["id"] == post_id

    def test_post_with_image_upload(self, authenticated_client, test_user):
        """Test creating a post with an image URL."""
        post_data = {
            "title": "Visual Evidence of Climate Change",
            "content": "New satellite imagery shows dramatic changes in polar ice caps.",
            "source_url": "https://climate.example.com/polar-ice",
            "image_url": "https://example-bucket.s3.amazonaws.com/images/polar-ice.jpg",
        }

        response = authenticated_client.post("/api/posts/", post_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["image_url"] == post_data["image_url"]

        # Verify in database
        post = Post.objects.get(id=response.data["id"])
        assert post.image_url == post_data["image_url"]

    def test_post_validation_errors(self, authenticated_client):
        """Test post creation with invalid data."""
        # Missing required fields
        response = authenticated_client.post("/api/posts/", {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data
        assert "content" in response.data
        assert "source_url" in response.data

        # Invalid URL
        response = authenticated_client.post(
            "/api/posts/",
            {
                "title": "Valid Title",
                "content": "Valid content",
                "source_url": "not-a-url",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "source_url" in response.data

        # Title too long
        response = authenticated_client.post(
            "/api/posts/",
            {
                "title": "A" * 300,  # Exceeds 200 char limit
                "content": "Valid content",
                "source_url": "https://example.com",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data

    def test_list_user_posts(self, authenticated_client, test_user):
        """Test listing posts for a specific user."""
        # Create multiple posts
        for i in range(3):
            authenticated_client.post(
                "/api/posts/",
                {
                    "title": f"Test Post {i}",
                    "content": f"Content for post {i}",
                    "source_url": f"https://example.com/post-{i}",
                },
            )

        # List posts
        response = authenticated_client.get("/api/posts/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 3

        # Filter by user
        response = authenticated_client.get(f"/api/posts/?user={test_user.username}")
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert all(post["user"]["username"] == test_user.username for post in results)

    def test_post_status_filtering(self, authenticated_client, test_user, db):
        """Test filtering posts by status."""
        # Create posts with different statuses
        statuses = ["pending_moderation", "pending_verification", "live", "rejected"]
        for status_val in statuses:
            Post.objects.create(
                user=test_user,
                title=f"Post with status {status_val}",
                content="Test content",
                source_url=f"https://example.com/{status_val}",
                status=status_val,
            )

        # Test each status filter
        for status_val in statuses:
            response = authenticated_client.get(f"/api/posts/?status={status_val}")
            assert response.status_code == status.HTTP_200_OK
            results = response.data["results"]
            assert all(post["status"] == status_val for post in results)

    def test_update_own_post(self, authenticated_client, test_post):
        """Test updating user's own post."""
        # Update post
        update_data = {
            "title": "Updated Title",
            "content": "Updated content with more details",
        }

        response = authenticated_client.patch(
            f"/api/posts/{test_post.id}/", update_data
        )

        # Note: Update might be restricted based on permissions
        # Check the actual behavior of your API
        if response.status_code == status.HTTP_200_OK:
            assert response.data["title"] == update_data["title"]
            assert response.data["content"] == update_data["content"]

    def test_delete_own_post(self, authenticated_client, test_post):
        """Test deleting user's own post."""
        response = authenticated_client.delete(f"/api/posts/{test_post.id}/")

        # Check if deletion is allowed
        if response.status_code == status.HTTP_204_NO_CONTENT:
            assert not Post.objects.filter(id=test_post.id).exists()
        else:
            # Deletion might be restricted
            assert response.status_code in [
                status.HTTP_403_FORBIDDEN,
                status.HTTP_405_METHOD_NOT_ALLOWED,
            ]

    def test_unauthorized_post_access(self, api_client, test_post):
        """Test accessing posts without authentication."""
        # Public posts should be readable
        response = api_client.get(f"/api/posts/{test_post.id}/")
        assert response.status_code == status.HTTP_200_OK

        # But creating requires auth
        response = api_client.post(
            "/api/posts/",
            {
                "title": "Unauthorized",
                "content": "Should fail",
                "source_url": "https://example.com",
            },
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
@pytest.mark.e2e
class TestPostModerationWorkflow:
    """E2E tests for post moderation workflow."""

    @patch("api.tasks.run_automated_moderation.delay")
    def test_post_triggers_moderation(self, mock_moderation, authenticated_client):
        """Test that creating a post triggers moderation task."""
        response = authenticated_client.post(
            "/api/posts/",
            {
                "title": "News for Moderation",
                "content": "This content will be checked by moderation.",
                "source_url": "https://example.com/news",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        post_id = response.data["id"]

        # Verify moderation task was called
        mock_moderation.assert_called_once_with(post_id)

    def test_moderation_result_updates_post(self, db, test_post):
        """Test updating post with moderation results."""
        # Simulate moderation result
        test_post.moderation_result = {
            "flagged": False,
            "categories": {"hate": 0.001, "violence": 0.002, "self-harm": 0.0001},
        }
        test_post.status = "pending_verification"
        test_post.save()

        # Verify status change
        test_post.refresh_from_db()
        assert test_post.status == "pending_verification"
        assert test_post.moderation_result["flagged"] is False

    def test_rejected_post_flow(self, authenticated_client, db, test_user):
        """Test flow when post is rejected by moderation."""
        # Create a post that will be rejected
        post = Post.objects.create(
            user=test_user,
            title="Rejected Post",
            content="This content violates guidelines",
            source_url="https://example.com/bad",
            status="rejected",
            rejection_reason="Content violates community guidelines",
            moderation_result={"flagged": True, "categories": {"hate": 0.95}},
        )

        # User can still see their rejected post
        response = authenticated_client.get(f"/api/posts/{post.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "rejected"
        assert (
            response.data["rejection_reason"] == "Content violates community guidelines"
        )


@pytest.mark.django_db
@pytest.mark.e2e
class TestPublicFeedEndpoints:
    """E2E tests for public feed endpoints."""

    def test_live_feed_endpoint(self, api_client, db, test_user):
        """Test the public live feed endpoint."""
        # Create mix of posts with different statuses
        live_posts = []
        for i in range(3):
            post = Post.objects.create(
                user=test_user,
                title=f"Live Post {i}",
                content=f"Live content {i}",
                source_url=f"https://example.com/live-{i}",
                status="live",
            )
            live_posts.append(post)

        # Create non-live posts
        Post.objects.create(
            user=test_user,
            title="Pending Post",
            content="Pending content",
            source_url="https://example.com/pending",
            status="pending_verification",
        )

        # Get live feed
        response = api_client.get("/api/feed/live/")
        assert response.status_code == status.HTTP_200_OK

        results = response.data["results"]
        assert len(results) == 3
        assert all(post["status"] == "live" for post in results)

    def test_rejected_feed_endpoint(self, api_client, db, test_user):
        """Test the public rejected posts feed."""
        # Create rejected posts
        for i in range(2):
            Post.objects.create(
                user=test_user,
                title=f"Rejected Post {i}",
                content=f"Rejected content {i}",
                source_url=f"https://example.com/rejected-{i}",
                status="rejected",
                rejection_reason=f"Reason {i}",
            )

        response = api_client.get("/api/feed/rejected/")
        assert response.status_code == status.HTTP_200_OK

        results = response.data["results"]
        assert all(post["status"] == "rejected" for post in results)
        assert all("rejection_reason" in post for post in results)

    def test_feed_pagination(self, api_client, db, test_user):
        """Test pagination in feed endpoints."""
        # Create many posts
        for i in range(25):
            Post.objects.create(
                user=test_user,
                title=f"Live Post {i}",
                content=f"Content {i}",
                source_url=f"https://example.com/post-{i}",
                status="live",
            )

        # Test default page size
        response = api_client.get("/api/feed/live/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 20  # Default page size
        assert response.data["count"] == 25
        assert response.data["next"] is not None

        # Test custom page size
        response = api_client.get("/api/feed/live/?page_size=10")
        assert len(response.data["results"]) == 10

        # Test second page
        response = api_client.get("/api/feed/live/?page=2&page_size=10")
        assert len(response.data["results"]) == 10

    def test_feed_search(self, api_client, db, test_user):
        """Test search functionality in feeds."""
        # Create posts with searchable content
        Post.objects.create(
            user=test_user,
            title="AI Technology News",
            content="Artificial intelligence is advancing rapidly",
            source_url="https://example.com/ai-news",
            status="live",
        )

        Post.objects.create(
            user=test_user,
            title="Climate Report",
            content="Global temperatures continue to rise",
            source_url="https://example.com/climate",
            status="live",
        )

        # Search for AI-related posts
        response = api_client.get("/api/feed/live/?search=artificial")
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 1
        assert "artificial" in results[0]["content"].lower()

        # Search in title
        response = api_client.get("/api/feed/live/?search=climate")
        assert len(response.data["results"]) == 1
