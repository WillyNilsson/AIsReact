"""
End-to-end tests for critical user journeys.
Tests complete flows from API perspective.
"""

import time
from datetime import timedelta
from unittest.mock import Mock, patch

from api.models import (
    AIResponse,
    AuditLog,
    EmailVerificationToken,
    Post,
    VerificationVote,
)
from api.tasks import run_ai_analysis, run_automated_moderation
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class UserRegistrationJourneyTest(TransactionTestCase):
    """Test complete user registration journey."""

    def setUp(self):
        self.client = APIClient()

    @patch("api.views.send_email_verification")
    def test_complete_registration_flow(self, mock_send_email):
        """Test full registration flow from signup to verification."""
        # Step 1: Register new user
        registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!@#",
            "password_confirm": "SecurePass123!@#",
        }

        response = self.client.post("/api/auth/register/", registration_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify response contains user data and tokens
        self.assertIn("id", response.data)
        self.assertIn("username", response.data)
        self.assertIn("email", response.data)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)
        self.assertFalse(response.data["is_verified"])

        user_id = response.data["id"]
        access_token = response.data["access_token"]

        # Verify email was sent
        mock_send_email.assert_called_once()

        # Step 2: Try to access protected endpoint before verification
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.post(
            "/api/posts/",
            {
                "title": "Test Post",
                "content": "Should work even without verification",
                "source_url": "https://example.com",
            },
        )
        # Should work - email verification doesn't block posting
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Step 3: Get verification token and verify email
        user = User.objects.get(id=user_id)
        token = EmailVerificationToken.objects.filter(user=user).first()
        self.assertIsNotNone(token)

        response = self.client.get(f"/api/auth/verify-email/?token={token.token}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user is now verified
        user.refresh_from_db()
        self.assertTrue(user.is_verified)

        # Step 4: Login with verified account
        self.client.credentials()  # Clear auth
        response = self.client.post(
            "/api/auth/login/", {"username": "newuser", "password": "SecurePass123!@#"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["user"]["is_verified"])

    def test_registration_with_weak_password(self):
        """Test registration fails with weak password."""
        weak_passwords = [
            "short",  # Too short
            "alllowercase123",  # No uppercase
            "ALLUPPERCASE123",  # No lowercase
            "NoNumbers!@#",  # No numbers
            "NoSymbols123",  # No symbols
        ]

        for password in weak_passwords:
            response = self.client.post(
                "/api/auth/register/",
                {
                    "username": "testuser",
                    "email": "test@example.com",
                    "password": password,
                    "password_confirm": password,
                },
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("password", response.data)

    def test_registration_duplicate_username_email(self):
        """Test registration with duplicate username/email."""
        # Create existing user
        User.objects.create_user(
            username="existing",
            email="existing@example.com",
            password="ExistingPass123!@#",
        )

        # Try duplicate username
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "existing",
                "email": "new@example.com",
                "password": "NewPass123!@#",
                "password_confirm": "NewPass123!@#",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

        # Try duplicate email
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "existing@example.com",
                "password": "NewPass123!@#",
                "password_confirm": "NewPass123!@#",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)


class PostCreationJourneyTest(TransactionTestCase):
    """Test complete post creation and verification journey."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!@#",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)

    @patch("api.tasks.run_automated_moderation.delay")
    @patch("api.tasks.run_ai_analysis.delay")
    def test_complete_post_journey(self, mock_ai_analysis, mock_moderation):
        """Test full post journey from creation to AI analysis."""
        # Step 1: Create post
        post_data = {
            "title": "Breaking: Major Tech Announcement",
            "content": "A major technology company announced groundbreaking AI advancement today.",
            "source_url": "https://technnews.example.com/breaking-ai",
        }

        response = self.client.post("/api/posts/", post_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        post_id = response.data["id"]
        self.assertEqual(response.data["status"], "pending_moderation")

        # Verify moderation was triggered
        mock_moderation.assert_called_once_with(post_id)

        # Step 2: Simulate moderation approval
        post = Post.objects.get(id=post_id)
        post.status = "pending_verification"
        post.moderation_status = "approved"
        post.save()

        # Step 3: Get post for verification
        response = self.client.get(f"/api/posts/{post_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending_verification")

        # Step 4: Create other users for verification
        verifiers = []
        for i in range(5):
            user = User.objects.create_user(
                username=f"verifier{i}",
                email=f"verifier{i}@example.com",
                password="VerifyPass123!@#",
                is_verified=True,
            )
            verifiers.append(user)

        # Step 5: Submit verification votes
        for i, verifier in enumerate(verifiers):
            self.client.force_authenticate(user=verifier)
            vote_data = {
                "vote": True if i < 4 else False,  # 4 true, 1 false
                "reason": f"Verification reason {i}",
            }
            response = self.client.post(f"/api/posts/{post_id}/verify/", vote_data)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check post status after verification
        post.refresh_from_db()
        self.assertEqual(post.status, "live")
        self.assertIsNotNone(post.verified_at)
        self.assertEqual(post.verification_count, 5)
        self.assertGreaterEqual(post.verification_score, 80)

        # Verify AI analysis was triggered
        mock_ai_analysis.assert_called_with(post_id)

        # Step 6: Simulate AI responses
        ai_providers = ["openai", "anthropic", "google", "xai", "deepseek"]
        for provider in ai_providers:
            AIResponse.objects.create(
                post=post,
                provider=provider,
                summary=f"Summary from {provider}",
                impact_assessment=f"Impact assessment from {provider}",
                objectivity_analysis=f"Objectivity analysis from {provider}",
                key_quotes=f"Key quotes from {provider}",
                response_time=1500,
                status="completed",
            )

        # Step 7: Fetch post with AI responses
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/posts/{post_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["ai_responses"]), 5)

        # Verify each AI response
        for ai_response in response.data["ai_responses"]:
            self.assertIn("provider", ai_response)
            self.assertIn("summary", ai_response)
            self.assertEqual(ai_response["status"], "completed")

    @patch("api.services.moderation.ModerationService.moderate_content")
    def test_post_rejection_flow(self, mock_moderate):
        """Test post rejection during moderation."""
        # Mock moderation to reject
        mock_moderate.return_value = {
            "approved": False,
            "reason": "Inappropriate content detected",
            "categories": ["violence", "hate_speech"],
        }

        # Create post
        response = self.client.post(
            "/api/posts/",
            {
                "title": "Inappropriate Post",
                "content": "This content violates guidelines",
                "source_url": "https://example.com",
            },
        )

        # Should still create but will be rejected after moderation
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Simulate moderation run
        post = Post.objects.get(id=response.data["id"])
        # In real flow, this would be done by the task
        from api.services.moderation import ModerationService

        service = ModerationService()
        result = service.moderate_content(post.content)

        post.status = "rejected"
        post.moderation_status = "rejected"
        post.moderation_reason = result["reason"]
        post.save()

        # Verify post is rejected
        response = self.client.get(f"/api/posts/{post.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "rejected")
        self.assertEqual(response.data["moderation_status"], "rejected")


class AuthenticationJourneyTest(TransactionTestCase):
    """Test authentication journeys including lockout."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!@#",
            is_verified=True,
        )

    def test_login_lockout_journey(self):
        """Test account lockout after failed attempts."""
        # Make 4 failed attempts
        for i in range(4):
            response = self.client.post(
                "/api/auth/login/",
                {"username": "testuser", "password": "wrongpassword"},
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertIn(f"{4-i} attempts remaining", response.data["detail"])

        # 5th attempt should lock account
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": "wrongpassword"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("locked", response.data["detail"])

        # Try with correct password - still locked
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": "TestPass123!@#"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("locked", response.data["detail"])

        # Simulate time passing
        self.user.refresh_from_db()
        self.user.locked_until = timezone.now() - timedelta(minutes=1)
        self.user.save()

        # Now should be able to login
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": "TestPass123!@#"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attempts were reset
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.locked_until)

    def test_token_refresh_journey(self):
        """Test token refresh and rotation."""
        # Login to get tokens
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": "TestPass123!@#"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        access_token = response.data["access_token"]
        refresh_token = response.data["refresh_token"]

        # Use access token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Refresh tokens
        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": refresh_token}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        new_access = response.data["access"]
        # May or may not rotate refresh token

        # Use new access token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_journey(self):
        """Test complete password reset flow."""
        # Request password reset
        response = self.client.post(
            "/api/auth/password-reset/", {"email": "test@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Get reset token (in real app, this would be from email)
        from api.models import PasswordResetToken

        reset_token = PasswordResetToken.objects.filter(user=self.user).first()
        self.assertIsNotNone(reset_token)

        # Reset password with token
        new_password = "NewSecurePass123!@#"
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": reset_token.token,
                "new_password": new_password,
                "new_password_confirm": new_password,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify can login with new password
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": new_password}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Old password should not work
        response = self.client.post(
            "/api/auth/login/", {"username": "testuser", "password": "TestPass123!@#"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class FeedAndSearchJourneyTest(TransactionTestCase):
    """Test feed browsing and search journeys."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!@#",
            is_verified=True,
        )

        # Create various posts
        self.live_posts = []
        for i in range(15):
            post = Post.objects.create(
                user=self.user,
                title=f"Live Post {i}",
                content=f"Content for live post {i}",
                source_url=f"https://example.com/{i}",
                status="live",
                verified_at=timezone.now(),
            )
            self.live_posts.append(post)

        # Create rejected posts
        for i in range(5):
            Post.objects.create(
                user=self.user,
                title=f"Rejected Post {i}",
                content=f"Inappropriate content {i}",
                source_url=f"https://bad.com/{i}",
                status="rejected",
                moderation_status="rejected",
            )

        # Create pending posts
        for i in range(3):
            Post.objects.create(
                user=self.user,
                title=f"Pending Post {i}",
                content=f"Pending verification {i}",
                source_url=f"https://pending.com/{i}",
                status="pending_verification",
            )

    def test_public_feed_browsing(self):
        """Test browsing public feeds without authentication."""
        # Browse live feed
        response = self.client.get("/api/feed/live/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 15)
        self.assertEqual(len(response.data["results"]), 10)  # Default pagination

        # Check pagination
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

        # Get second page
        response = self.client.get("/api/feed/live/?page=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNone(response.data["next"])
        self.assertIsNotNone(response.data["previous"])

        # Browse rejected feed
        response = self.client.get("/api/feed/rejected/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 5)

        # Browse pending feed
        response = self.client.get("/api/feed/pending/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)

    def test_search_functionality(self):
        """Test search across posts."""
        # Search for specific post
        response = self.client.get("/api/feed/live/?search=Post%207")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Live Post 7")

        # Search by content
        response = self.client.get("/api/feed/live/?search=Content")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 15)  # All have "Content" in them

        # Search with no results
        response = self.client.get("/api/feed/live/?search=nonexistent")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(len(response.data["results"]), 0)

    def test_user_posts_filtering(self):
        """Test filtering posts by user."""
        # Create another user with posts
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="OtherPass123!@#"
        )

        for i in range(3):
            Post.objects.create(
                user=other_user,
                title=f"Other User Post {i}",
                content=f"Content by other user {i}",
                source_url=f"https://other.com/{i}",
                status="live",
            )

        # Get specific user's posts
        response = self.client.get(f"/api/users/{self.user.username}/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should include all posts by user (live, rejected, pending)
        total_posts = 15 + 5 + 3  # live + rejected + pending
        self.assertEqual(response.data["count"], total_posts)

        # Get other user's posts (public view)
        response = self.client.get(f"/api/users/{other_user.username}/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only show live posts for other users
        self.assertEqual(response.data["count"], 3)


class UserProfileJourneyTest(TransactionTestCase):
    """Test user profile management journeys."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!@#",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_profile_update_journey(self):
        """Test updating user profile."""
        # Get current profile
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertIsNone(response.data.get("bio"))

        # Update profile
        update_data = {
            "bio": "I am a technology enthusiast interested in AI and its impact on society.",
            "full_name": "Test User",
        }
        response = self.client.patch("/api/auth/me/", update_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bio"], update_data["bio"])
        self.assertEqual(response.data["full_name"], update_data["full_name"])

        # Verify changes persisted
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, update_data["bio"])
        self.assertEqual(self.user.full_name, update_data["full_name"])

    @patch("boto3.client")
    def test_avatar_upload_journey(self, mock_boto):
        """Test avatar upload process."""
        # Mock S3 client
        mock_s3 = Mock()
        mock_boto.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = (
            "https://s3.example.com/upload-url"
        )

        # Request avatar upload URL
        response = self.client.post(
            "/api/auth/upload-avatar/", {"filename": "avatar.jpg"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("upload_url", response.data)
        self.assertIn("avatar_url", response.data)

        # Verify user's avatar_url was updated
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.avatar_url)
        self.assertIn(str(self.user.id), self.user.avatar_url)

    def test_user_stats_journey(self):
        """Test viewing user statistics."""
        # Create posts with different statuses
        Post.objects.create(
            user=self.user,
            title="Live Post",
            content="Content",
            source_url="https://example.com/1",
            status="live",
        )
        Post.objects.create(
            user=self.user,
            title="Pending Post",
            content="Content",
            source_url="https://example.com/2",
            status="pending_verification",
        )
        Post.objects.create(
            user=self.user,
            title="Rejected Post",
            content="Content",
            source_url="https://example.com/3",
            status="rejected",
        )

        # Create verification votes
        other_user = User.objects.create_user(
            username="voter", email="voter@example.com", password="VoterPass123!@#"
        )
        pending_post = Post.objects.create(
            user=other_user,
            title="Post to verify",
            content="Content",
            source_url="https://example.com/4",
            status="pending_verification",
        )

        VerificationVote.objects.create(
            user=self.user, post=pending_post, vote=True, reason="Looks accurate"
        )

        # Get user stats
        response = self.client.get(f"/api/users/{self.user.username}/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        stats = response.data
        self.assertEqual(stats["total_posts"], 3)
        self.assertEqual(stats["live_posts"], 1)
        self.assertEqual(stats["pending_posts"], 1)
        self.assertEqual(stats["rejected_posts"], 1)
        self.assertEqual(stats["total_verifications"], 1)
        self.assertEqual(stats["accurate_verifications"], 1)
        self.assertEqual(stats["verification_accuracy"], 100.0)
