#!/usr/bin/env python
"""
Test script to check AI API functionality and output quality.
"""

import json
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


def test_ai_quality():
    """Test AI analysis with a real news-like event."""
    print("Testing AI Analysis Quality...")

    # Create a test user
    try:
        user = User.objects.get(username="quality_test_user")
    except User.DoesNotExist:
        user = User.objects.create_user(
            username="quality_test_user",
            email="quality@example.com",
            password="testpass123",
        )
        print("Created test user")

    # Create a realistic test post
    post = Post.objects.create(
        user=user,
        title="EU Passes Landmark AI Act Requiring Transparency for High-Risk AI Systems",
        content="""The European Union has officially passed the AI Act, marking the world's first comprehensive
        AI regulation. The legislation, which comes into effect in 2025, introduces strict requirements for
        AI systems deemed "high-risk," including those used in healthcare, law enforcement, and employment
        decisions. Companies will be required to provide clear information about how their AI systems make
        decisions, undergo regular audits, and maintain human oversight. The act also bans certain AI
        applications outright, including social scoring systems and real-time biometric identification in
        public spaces. Tech companies face fines of up to 7% of global annual revenue for violations.
        Industry leaders have expressed mixed reactions, with some praising the move toward responsible AI
        development while others warn it could stifle innovation in Europe.""",
        source_url="https://example.com/eu-ai-act-passed",
        status="live",  # Skip moderation for this test
    )
    print(f"Created test post: {post.id}")

    # Run AI analysis
    print("\nRunning AI analysis across all providers...")
    result = run_ai_analysis(post.id)
    print(f"Analysis complete: {result}")

    # Display results
    print("\n" + "=" * 80)
    print("AI ANALYSIS QUALITY CHECK")
    print("=" * 80)

    ai_responses = AIResponse.objects.filter(post=post).order_by("created_at")

    if not ai_responses:
        print("No AI responses found!")
        return

    print(f"\nFound {ai_responses.count()} AI responses\n")

    for response in ai_responses:
        print(f"\n{'='*40}")
        print(f"Model: {response.ai_model}")
        print(f"Response Time: {response.metadata.get('response_time_ms', 'N/A')}ms")
        print(f"{'='*40}")

        # Check if response has meaningful content
        sections = [
            "summary",
            "impact_assessment",
            "objectivity_analysis",
            "key_quotes",
        ]
        empty_sections = []

        for section in sections:
            content = getattr(response, section, "")
            if not content or len(content) < 50:
                empty_sections.append(section)

        if empty_sections:
            print(
                f"⚠️  Warning: Empty or too short sections: {', '.join(empty_sections)}"
            )
        else:
            print("✅ All sections have substantial content")

        # Show first 300 chars of each section
        print(f"\n1. Summary (first 300 chars):")
        print(
            f"   {response.summary[:300]}..."
            if len(response.summary) > 300
            else f"   {response.summary}"
        )

        print(f"\n2. Historical Context (first 300 chars):")
        print(
            f"   {response.impact_assessment[:300]}..."
            if len(response.impact_assessment) > 300
            else f"   {response.impact_assessment}"
        )

        # Check token usage
        if "usage" in response.metadata:
            usage = response.metadata["usage"]
            if isinstance(usage, dict):
                output_tokens = usage.get("output_tokens") or usage.get(
                    "completion_tokens"
                )
                if output_tokens:
                    print(f"\nOutput tokens used: {output_tokens:,}")
                    print(f"Percentage of 32k limit: {(output_tokens/32000)*100:.1f}%")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    working_models = []
    failed_models = []

    providers = [
        "o3-2025-04-16",
        "gemini-2.5-pro",
        "claude-sonnet-4-20250514",
        "grok-3-preview",
        "deepseek-r1-0528",
    ]
    responded_models = [r.ai_model for r in ai_responses]

    for model in providers:
        if model in responded_models:
            working_models.append(model)
        else:
            failed_models.append(model)

    print(f"\n✅ Working Models ({len(working_models)}):")
    for model in working_models:
        print(f"   - {model}")

    if failed_models:
        print(f"\n❌ Failed Models ({len(failed_models)}):")
        for model in failed_models:
            print(f"   - {model}")

    # Cleanup
    print("\nCleaning up test data...")
    AIResponse.objects.filter(post=post).delete()
    post.delete()
    user.delete()
    print("Done!")


if __name__ == "__main__":
    test_ai_quality()
