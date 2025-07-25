#!/usr/bin/env python
"""
Test script for AI analysis functionality.
"""

import os
import sys

import django

# Add the parent directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings")
django.setup()

from api.models import AIResponse, Post, User
from api.tasks import run_ai_analysis, run_automated_moderation


def test_ai_analysis():
    """Test the AI analysis pipeline."""
    print("Testing AI Analysis Pipeline...")

    # Create a test user if doesn't exist
    try:
        user = User.objects.get(username="test_ai_user")
        created = False
        print("Using existing test user")
    except User.DoesNotExist:
        user = User.objects.create_user(
            username="test_ai_user", email="test_ai@example.com", password="testpass123"
        )
        created = True
        print("Created test user")

    # Create a test post
    post = Post.objects.create(
        user=user,
        title="OpenAI Announces GPT-5 with Breakthrough Capabilities",
        content="""OpenAI has announced the release of GPT-5, their most advanced language model to date.
        The new model demonstrates significant improvements in reasoning, factual accuracy, and
        multimodal understanding. Key features include enhanced code generation, improved mathematical
        reasoning, and the ability to process and generate content across text, images, and audio
        simultaneously. The model has been trained on a dataset 10x larger than GPT-4 and shows
        remarkable performance on complex reasoning benchmarks.""",
        source_url="https://example.com/openai-gpt5-announcement",
        status="pending_moderation",
    )
    print(f"Created test post: {post.id}")

    # Test moderation
    print("\nTesting moderation...")
    result = run_automated_moderation(post.id)
    print(f"Moderation result: {result}")

    # Refresh post
    post.refresh_from_db()
    print(f"Post status after moderation: {post.status}")
    print(f"Moderation result: {post.moderation_result}")

    # If passed moderation, mark as verified for testing
    if post.status == "pending_verification":
        post.status = "live"
        post.save()
        print("Post marked as live for AI analysis")

        # Test AI analysis
        print("\nTesting AI analysis...")
        result = run_ai_analysis(post.id)
        print(f"AI analysis result: {result}")

        # Check AI responses
        ai_responses = AIResponse.objects.filter(post=post)
        print(f"\nFound {ai_responses.count()} AI responses:")

        for response in ai_responses:
            print(f"\n--- {response.ai_model} ---")
            print(f"Summary: {response.summary[:200]}...")
            print(
                f"Response time: {response.metadata.get('response_time_ms', 'N/A')}ms"
            )

    else:
        print(f"Post was rejected: {post.rejection_reason}")

    # Cleanup
    print("\nCleaning up test data...")
    AIResponse.objects.filter(post=post).delete()
    post.delete()
    if created:
        user.delete()

    print("\nTest completed!")


def check_api_keys():
    """Check which API keys are configured."""
    print("Checking API keys...")

    keys = [
        ("OPENAI_API_KEY", "OpenAI"),
        ("GOOGLE_API_KEY", "Google Gemini"),
        ("ANTHROPIC_API_KEY", "Anthropic Claude"),
        ("XAI_API_KEY", "xAI Grok"),
        ("DEEPSEEK_API_KEY", "DeepSeek"),
    ]

    configured = []
    missing = []

    for key, name in keys:
        if os.environ.get(key):
            configured.append(name)
        else:
            missing.append(name)

    print(f"\nConfigured: {', '.join(configured) if configured else 'None'}")
    print(f"Missing: {', '.join(missing) if missing else 'None'}")

    return len(configured) > 0


if __name__ == "__main__":
    print("AI Analysis Test Script")
    print("=" * 50)

    if check_api_keys():
        print("\nAt least one API key is configured. Running test...")
        test_ai_analysis()
    else:
        print(
            "\nNo API keys configured. Please set at least one of the following environment variables:"
        )
        print("- OPENAI_API_KEY")
        print("- GOOGLE_API_KEY")
        print("- ANTHROPIC_API_KEY")
        print("- XAI_API_KEY")
        print("- DEEPSEEK_API_KEY")
