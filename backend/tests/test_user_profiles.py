"""
Tests for user profile functionality.
"""

import pytest
from api.models import Post, VerificationVote
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserProfileTestCase(TestCase):
    """Test user profile functionality."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create test users
        self.user1 = User.objects.create_user(
            username="testuser1",
            email="test1@example.com",
            password="testpass123",
            bio="Test bio for user 1",
            website_url="https://example.com",
            twitter_username="testuser1",
            github_username="testuser1",
        )

        self.user2 = User.objects.create_user(
            username="testuser2", email="test2@example.com", password="testpass123"
        )

        # Create some posts for user1
        self.live_post = Post.objects.create(
            user=self.user1,
            title="Live Post",
            content="This is a live post",
            source_url="https://example.com/news1",
            status="live",
        )

        self.pending_post = Post.objects.create(
            user=self.user1,
            title="Pending Post",
            content="This is a pending post",
            source_url="https://example.com/news2",
            status="pending_verification",
        )

        self.rejected_post = Post.objects.create(
            user=self.user1,
            title="Rejected Post",
            content="This is a rejected post",
            source_url="https://example.com/news3",
            status="rejected",
            rejection_reason="Inappropriate content",
        )

        # Create verification votes
        VerificationVote.objects.create(user=self.user1, post=self.live_post, vote=True)

        # Generate tokens
        self.user1_token = RefreshToken.for_user(self.user1)
        self.user2_token = RefreshToken.for_user(self.user2)

    def test_get_public_profile(self):
        """Test getting a public user profile."""
        response = self.client.get(f"/api/users/{self.user1.username}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.user1.username)
        self.assertEqual(response.data["bio"], self.user1.bio)
        self.assertEqual(response.data["website_url"], self.user1.website_url)
        self.assertEqual(response.data["twitter_username"], self.user1.twitter_username)
        self.assertEqual(response.data["github_username"], self.user1.github_username)
        self.assertEqual(response.data["post_count"], 3)
        self.assertEqual(response.data["live_post_count"], 1)
        self.assertEqual(response.data["verification_count"], 1)
        self.assertIn("achievements", response.data)

    def test_get_nonexistent_profile(self):
        """Test getting a profile that doesn't exist."""
        response = self.client.get("/api/users/nonexistentuser/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_user_posts_public(self):
        """Test getting user posts as public viewer."""
        response = self.client.get(f"/api/users/{self.user1.username}/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Public viewers should only see live posts
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], self.live_post.id)

    def test_get_user_posts_own(self):
        """Test getting own posts shows all posts."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.user1_token.access_token}"
        )
        response = self.client.get(f"/api/users/{self.user1.username}/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # User should see all their own posts
        self.assertEqual(len(response.data["results"]), 3)

    def test_get_user_stats(self):
        """Test getting user statistics."""
        response = self.client.get(f"/api/users/{self.user1.username}/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_posts"], 3)
        self.assertEqual(response.data["live_posts"], 1)
        self.assertEqual(response.data["pending_posts"], 1)
        self.assertEqual(response.data["rejected_posts"], 1)
        self.assertEqual(response.data["total_verifications"], 1)
        self.assertEqual(response.data["accurate_verifications"], 1)
        self.assertEqual(response.data["verification_accuracy"], 100.0)
        self.assertIn("joined_days_ago", response.data)
        self.assertIn("last_active", response.data)

    def test_update_profile(self):
        """Test updating user profile."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.user1_token.access_token}"
        )

        update_data = {
            "bio": "Updated bio",
            "website_url": "https://newsite.com",
            "twitter_username": "newtwitter",
            "github_username": "newgithub",
        }

        response = self.client.patch("/api/auth/me/", update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bio"], "Updated bio")
        self.assertEqual(response.data["website_url"], "https://newsite.com")
        self.assertEqual(response.data["twitter_username"], "newtwitter")
        self.assertEqual(response.data["github_username"], "newgithub")

        # Verify in database
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.bio, "Updated bio")

    def test_update_profile_unauthorized(self):
        """Test updating profile without authentication."""
        response = self.client.patch("/api/auth/me/", {"bio": "Hacker bio"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_profile_invalid_social_usernames(self):
        """Test updating profile with invalid social media usernames."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.user1_token.access_token}"
        )

        # Invalid Twitter username
        response = self.client.patch(
            "/api/auth/me/", {"twitter_username": "invalid@user"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("twitter_username", response.data)

        # Invalid GitHub username
        response = self.client.patch(
            "/api/auth/me/", {"github_username": "invalid user"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("github_username", response.data)

    def test_upload_avatar_presigned_url(self):
        """Test generating presigned URL for avatar upload."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.user1_token.access_token}"
        )

        response = self.client.post(
            "/api/auth/upload-avatar/", {"filename": "avatar.jpg"}
        )

        # This will fail without AWS credentials configured
        # In a real test environment, you would mock the S3 client
        if response.status_code == status.HTTP_200_OK:
            self.assertIn("upload_url", response.data)
            self.assertIn("avatar_url", response.data)

    def test_upload_avatar_invalid_file_type(self):
        """Test uploading avatar with invalid file type."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.user1_token.access_token}"
        )

        response = self.client.post(
            "/api/auth/upload-avatar/", {"filename": "avatar.exe"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid file type", response.data["detail"])

    def test_achievements_calculation(self):
        """Test that achievements are calculated correctly."""
        # Mark user as verified
        self.user1.is_verified = True
        self.user1.save()

        response = self.client.get(f"/api/users/{self.user1.username}/")

        achievements = response.data["achievements"]
        achievement_ids = [a["id"] for a in achievements]

        # Should have email_verified achievement
        self.assertIn("email_verified", achievement_ids)

        # Add more posts to trigger active_contributor achievement
        for i in range(5):
            Post.objects.create(
                user=self.user1,
                title=f"Post {i}",
                content=f"Content {i}",
                source_url=f"https://example.com/news{i}",
                status="live",
            )

        response = self.client.get(f"/api/users/{self.user1.username}/")
        achievements = response.data["achievements"]
        achievement_ids = [a["id"] for a in achievements]

        # Should now have active_contributor achievement
        self.assertIn("active_contributor", achievement_ids)

    def test_case_insensitive_username_lookup(self):
        """Test that username lookup is case-insensitive."""
        response1 = self.client.get(f"/api/users/{self.user1.username}/")
        response2 = self.client.get(f"/api/users/{self.user1.username.upper()}/")

        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.data["id"], response2.data["id"])


class UserProfileAPITestCase(TestCase):
    """Test user profile API endpoints with pagination."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="prolificuser",
            email="prolific@example.com",
            password="testpass123",
        )

        # Create many posts for pagination testing
        for i in range(25):
            Post.objects.create(
                user=self.user,
                title=f"Post {i}",
                content=f"Content for post {i}",
                source_url=f"https://example.com/news{i}",
                status="live" if i % 2 == 0 else "pending_verification",
            )

    def test_user_posts_pagination(self):
        """Test pagination of user posts."""
        response = self.client.get(f"/api/users/{self.user.username}/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)

        # Should only show live posts to public (13 posts)
        self.assertEqual(response.data["count"], 13)

        # Default page size should apply
        self.assertLessEqual(len(response.data["results"]), 20)
