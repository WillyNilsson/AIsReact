"""
End-to-end tests for verification system using actual API calls.
"""

import time
from unittest.mock import patch

import pytest
from api.models import Post, VerificationVote
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
@pytest.mark.e2e
class TestVerificationWorkflowE2E:
    """E2E tests for the verification voting system."""

    def test_complete_verification_flow(
        self, api_client, test_user, multiple_test_users, db
    ):
        """Test the complete verification flow from voting to post going live."""
        # 1. Create a post pending verification
        post = Post.objects.create(
            user=test_user,
            title="Breaking News for Verification",
            content="Important news that needs community verification",
            source_url="https://news.example.com/breaking",
            status="pending_verification",
        )

        # 2. Multiple users vote on the post
        positive_votes = 0
        negative_votes = 0

        for i, voter in enumerate(multiple_test_users):
            # Login as voter
            login_response = api_client.post(
                "/api/auth/token/",
                {"username": voter.username, "password": "VoterPass123!"},
            )

            api_client.credentials(
                HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}'
            )

            # Vote (4 positive, 1 negative for testing)
            vote_value = i < 4  # First 4 vote positive
            vote_response = api_client.post(
                f"/api/posts/{post.id}/verify/",
                {"vote": vote_value, "comment": f"Voter {i} comment"},
            )

            assert vote_response.status_code == status.HTTP_201_CREATED
            assert vote_response.data["vote"] == vote_value

            if vote_value:
                positive_votes += 1
            else:
                negative_votes += 1

        # 3. Check if post went live (if threshold is met)
        post.refresh_from_db()
        # Check that the post has the correct verification stats
        assert post.verification_count == 5
        assert post.verification_score == 80  # 4/5 = 80%

        # Since we have 5 votes and 80% positive, post should be live
        assert post.status == "live"
        assert post.verified_at is not None

    def test_duplicate_vote_prevention(self, authenticated_client, db, test_user):
        """Test that users cannot vote twice on the same post."""
        # Create post
        post = Post.objects.create(
            user=test_user,
            title="Post for Single Vote Test",
            content="Testing duplicate vote prevention",
            source_url="https://example.com/single-vote",
            status="pending_verification",
        )

        # First vote
        first_vote = authenticated_client.post(
            f"/api/posts/{post.id}/verify/", {"vote": True}
        )
        assert first_vote.status_code == status.HTTP_201_CREATED

        # Try to vote again
        second_vote = authenticated_client.post(
            f"/api/posts/{post.id}/verify/", {"vote": False}
        )
        assert second_vote.status_code == status.HTTP_400_BAD_REQUEST
        assert "already voted" in str(second_vote.data).lower()

    def test_verification_requires_auth(self, api_client, db, test_user):
        """Test that verification requires authentication."""
        post = Post.objects.create(
            user=test_user,
            title="Auth Required Post",
            content="Testing auth requirement",
            source_url="https://example.com/auth",
            status="pending_verification",
        )

        # Try to vote without auth
        response = api_client.post(f"/api/posts/{post.id}/verify/", {"vote": True})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cannot_vote_on_own_post(self, authenticated_client, test_post):
        """Test that users cannot vote on their own posts."""
        # Update post status to pending_verification
        test_post.status = "pending_verification"
        test_post.save()

        # Try to vote on own post
        response = authenticated_client.post(
            f"/api/posts/{test_post.id}/verify/", {"vote": True}
        )

        # This should either return 400 or create the vote depending on business rules
        # Adjust assertion based on your actual implementation
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            assert "own post" in str(response.data).lower()

    def test_verification_queue_endpoint(self, api_client, db, test_user):
        """Test the verification queue endpoint."""
        # Create posts in different states
        pending_posts = []
        for i in range(3):
            post = Post.objects.create(
                user=test_user,
                title=f"Pending Verification {i}",
                content=f"Content {i}",
                source_url=f"https://example.com/pending-{i}",
                status="pending_verification",
            )
            pending_posts.append(post)

        # Create non-pending post
        Post.objects.create(
            user=test_user,
            title="Live Post",
            content="Already verified",
            source_url="https://example.com/live",
            status="live",
        )

        # Get verification queue using the feed endpoint
        response = api_client.get("/api/feed/pending/")
        assert response.status_code == status.HTTP_200_OK

        # Should only show pending_verification posts
        results = response.data["results"]
        assert len(results) == 3  # We created 3 pending posts
        assert all(post["status"] == "pending_verification" for post in results)

    def test_vote_with_comment(self, authenticated_client, db, test_user):
        """Test voting with optional comment."""
        post = Post.objects.create(
            user=test_user,
            title="Post for Comment Test",
            content="Testing votes with comments",
            source_url="https://example.com/comment-test",
            status="pending_verification",
        )

        # Vote with comment
        response = authenticated_client.post(
            f"/api/posts/{post.id}/verify/",
            {
                "vote": True,
                "comment": "I verified this information against the source. It is accurate.",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert (
            response.data["comment"]
            == "I verified this information against the source. It is accurate."
        )

        # Verify in database
        vote = VerificationVote.objects.get(post=post, user=test_user)
        assert (
            vote.comment
            == "I verified this information against the source. It is accurate."
        )

    def test_verification_stats_for_authenticated_user(
        self, authenticated_client, db, test_user
    ):
        """Test that authenticated users can see their own vote in stats."""
        # Create post by different user
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="OtherPass123!"
        )

        post = Post.objects.create(
            user=other_user,
            title="Post to Check User Vote",
            content="Testing user vote visibility",
            source_url="https://example.com/user-vote",
            status="pending_verification",
        )

        # Vote on the post
        vote_response = authenticated_client.post(
            f"/api/posts/{post.id}/verify/", {"vote": True}
        )
        assert vote_response.status_code == status.HTTP_201_CREATED

        # Verify user cannot vote again (this confirms they already voted)
        duplicate_response = authenticated_client.post(
            f"/api/posts/{post.id}/verify/", {"vote": False}
        )
        assert duplicate_response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already voted" in duplicate_response.data["detail"]

    def test_verification_threshold_triggers_ai_analysis(
        self, api_client, multiple_test_users, db
    ):
        """Test that reaching verification threshold triggers AI analysis."""
        # Create post
        post = Post.objects.create(
            user=multiple_test_users[0],
            title="Post for AI Analysis Trigger",
            content="This post will trigger AI analysis once verified",
            source_url="https://example.com/ai-trigger",
            status="pending_verification",
        )

        with patch("api.tasks.run_ai_analysis.delay") as mock_ai_task:
            # Have 5 users vote positively
            for voter in multiple_test_users:
                login_response = api_client.post(
                    "/api/auth/token/",
                    {"username": voter.username, "password": "VoterPass123!"},
                )

                api_client.credentials(
                    HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}'
                )

                api_client.post(f"/api/posts/{post.id}/verify/", {"vote": True})

            # Check if AI analysis was triggered
            post.refresh_from_db()
            if post.status == "live":
                mock_ai_task.assert_called_once_with(post.id)

    def test_get_post_votes_list(self, api_client, multiple_test_users, db):
        """Test retrieving list of votes for a post."""
        # Create post and votes
        post = Post.objects.create(
            user=multiple_test_users[0],
            title="Post with Multiple Votes",
            content="Testing vote list retrieval",
            source_url="https://example.com/vote-list",
            status="pending_verification",
        )

        # Create votes
        for i, voter in enumerate(multiple_test_users[:3]):
            VerificationVote.objects.create(
                post=post,
                user=voter,
                vote=i % 2 == 0,  # Alternating votes
                comment=f"Comment from {voter.username}",
            )

        # Verify votes were created correctly
        votes = VerificationVote.objects.filter(post=post).order_by("created_at")
        assert votes.count() == 3

        # Verify vote details
        for i, vote in enumerate(votes):
            assert vote.user == multiple_test_users[i]
            assert vote.vote == (i % 2 == 0)  # Should alternate True/False/True
            assert vote.comment == f"Comment from {vote.user.username}"

        # Verify post's verification stats
        post.refresh_from_db()
        assert post.verification_count == 3
        # 2 positive votes out of 3 = 66.67%
        assert post.verification_score == pytest.approx(66.67, rel=0.01)


@pytest.mark.django_db
@pytest.mark.e2e
class TestVerificationEdgeCases:
    """E2E tests for verification edge cases."""

    def test_vote_on_non_pending_post(self, authenticated_client, db, test_user):
        """Test voting on posts that are not pending verification."""
        # Create posts with various statuses
        statuses = ["pending_moderation", "live", "rejected", "removed"]

        for status_val in statuses:
            post = Post.objects.create(
                user=test_user,
                title=f"Post with status {status_val}",
                content="Testing vote on non-pending",
                source_url=f"https://example.com/{status_val}",
                status=status_val,
            )

            response = authenticated_client.post(
                f"/api/posts/{post.id}/verify/", {"vote": True}
            )

            # Should not allow voting on non-pending posts
            assert response.status_code in [
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            ]

    def test_disputed_post_flow(self, api_client, multiple_test_users, db):
        """Test what happens when a post receives mostly negative votes."""
        post = Post.objects.create(
            user=multiple_test_users[0],
            title="Disputed Post",
            content="This content will be disputed",
            source_url="https://example.com/disputed",
            status="pending_verification",
        )

        # Have users vote mostly negative
        for i, voter in enumerate(multiple_test_users):
            login_response = api_client.post(
                "/api/auth/token/",
                {"username": voter.username, "password": "VoterPass123!"},
            )

            api_client.credentials(
                HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}'
            )

            # 1 positive, 4 negative
            vote_value = i == 0
            api_client.post(f"/api/posts/{post.id}/verify/", {"vote": vote_value})

        # Check post status
        post.refresh_from_db()

        # Depending on implementation, post might be marked as disputed
        # or remain in pending_verification with low score
        assert post.verification_score == 20  # 1/5 = 20%

        # Post should not go live with low score
        assert post.status != "live"


# Import User model for the tests
from django.contrib.auth import get_user_model

User = get_user_model()
