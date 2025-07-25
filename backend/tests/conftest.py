"""
Pytest configuration and fixtures for E2E tests.
"""

import os
import sys

import django

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings_test")

# Setup Django
django.setup()

# Mock Celery tasks for testing
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "True")
os.environ.setdefault("CELERY_TASK_EAGER_PROPAGATES", "True")

from unittest.mock import MagicMock, patch

import pytest
from api.models import AIResponse, Post, VerificationVote
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture(autouse=True)
def mock_celery_tasks():
    """Mock Celery tasks for all tests."""
    with patch("api.tasks.run_automated_moderation.delay") as mock_moderation, patch(
        "api.tasks.run_ai_analysis.delay"
    ) as mock_ai_analysis:
        # Make the mocks return a mock task result
        mock_moderation.return_value = MagicMock(id="mock-task-id")
        mock_ai_analysis.return_value = MagicMock(id="mock-task-id")
        yield mock_moderation, mock_ai_analysis


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Set up test database."""
    with django_db_blocker.unblock():
        # Any global test data setup can go here
        pass


@pytest.fixture
def api_client():
    """Provide an API client for tests."""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, test_user):
    """Provide an authenticated API client."""
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User.objects.create_user(
        username="testuser", email="test@example.com", password="TestPass123!"
    )
    return user


@pytest.fixture
def test_moderator(db):
    """Create a test moderator user."""
    user = User.objects.create_user(
        username="moderator",
        email="moderator@example.com",
        password="ModPass123!",
        role="moderator",
    )
    return user


@pytest.fixture
def test_admin(db):
    """Create a test admin user."""
    user = User.objects.create_user(
        username="admin",
        email="admin@example.com",
        password="AdminPass123!",
        role="admin",
        is_staff=True,
        is_superuser=True,
    )
    return user


@pytest.fixture
def test_post(db, test_user):
    """Create a test post."""
    post = Post.objects.create(
        user=test_user,
        title="Test News Article",
        content="This is a test news article about AI and technology.",
        source_url="https://example.com/test-article",
        status="pending_moderation",
    )
    return post


@pytest.fixture
def verified_post(db, test_user):
    """Create a verified post."""
    post = Post.objects.create(
        user=test_user,
        title="Verified News Article",
        content="This is a verified news article with AI analysis.",
        source_url="https://example.com/verified-article",
        status="live",
    )
    return post


@pytest.fixture
def test_ai_response(db, verified_post):
    """Create a test AI response."""
    ai_response = AIResponse.objects.create(
        post=verified_post,
        ai_model="gpt-4",
        summary="This article discusses advancements in AI technology.",
        impact_assessment="High impact on technology sector.",
        objectivity_analysis="The article maintains objectivity with balanced viewpoints.",
        key_quotes=["AI is transforming industries", "Technology continues to evolve"],
        metadata={"response_time_ms": 1500, "token_count": 250},
    )
    return ai_response


@pytest.fixture
def multiple_test_users(db):
    """Create multiple test users for verification testing."""
    users = []
    for i in range(5):
        user = User.objects.create_user(
            username=f"voter{i}",
            email=f"voter{i}@example.com",
            password="VoterPass123!",
        )
        users.append(user)
    return users


@pytest.fixture
def cleanup_test_data(db):
    """Clean up test data after tests."""
    yield
    # Clean up any test data created during tests
    Post.objects.filter(title__startswith="Test").delete()
    User.objects.filter(username__startswith="test").delete()
    User.objects.filter(username__startswith="voter").delete()
