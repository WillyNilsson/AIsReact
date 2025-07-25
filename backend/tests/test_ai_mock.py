#!/usr/bin/env python
"""
Mock test for AI analysis functionality.
"""

import json
import os
import sys
from datetime import datetime

import django

# Add the parent directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings")
django.setup()

from api.models import AIResponse, Post, User


def create_mock_ai_responses(post):
    """Create mock AI responses for testing."""

    # Mock responses for different AI models
    mock_responses = [
        {
            "ai_model": "o3-2025-04-16",
            "summary": "OpenAI has unveiled GPT-5, a significant advancement in AI language models with enhanced reasoning, factual accuracy, and multimodal capabilities including text, image, and audio processing.",
            "impact_assessment": "This represents a major milestone in AI development, building upon the transformer architecture revolution started in 2017. It continues the exponential growth in model capabilities seen from GPT-3 to GPT-4, potentially accelerating AI adoption across industries.",
            "objectivity_analysis": "GPT-5 will likely accelerate AI integration in education, healthcare, and creative industries. We may see new applications in scientific research, more sophisticated AI assistants, and increased debate about AI governance and safety measures.",
            "key_quotes": "The multimodal capabilities represent a convergence toward more general-purpose AI systems. The 10x larger training dataset suggests diminishing returns may not yet apply to language models. This advancement raises important questions about AI alignment and societal readiness.",
            "metadata": {
                "response_time_ms": 2341,
                "model": "o3-2025-04-16",
                "total_tokens": 523,
                "finish_reason": "stop",
            },
        },
        {
            "ai_model": "gemini-2.5-pro",
            "summary": "OpenAI announces GPT-5 with breakthrough improvements in reasoning, accuracy, and multimodal understanding, marking a significant leap in large language model capabilities.",
            "impact_assessment": "Historically, each GPT iteration has redefined possibilities in natural language processing. GPT-5 continues this trajectory, potentially matching or exceeding human performance in numerous cognitive tasks, reminiscent of other technological paradigm shifts.",
            "objectivity_analysis": "The future likely holds widespread GPT-5 integration across sectors, from automated research assistants to creative collaborators. However, challenges around computational resources, data privacy, and AI safety will intensify.",
            "key_quotes": "The simultaneous processing of text, images, and audio suggests we are approaching more unified AI systems. The enhanced mathematical reasoning could revolutionize scientific computing. Society must prepare for rapid capability expansion.",
            "metadata": {
                "response_time_ms": 1893,
                "model": "gemini-2.5-pro",
                "safety_ratings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "probability": "NEGLIGIBLE",
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "probability": "NEGLIGIBLE",
                    },
                ],
            },
        },
        {
            "ai_model": "claude-sonnet-4-20250514",
            "summary": "OpenAI reveals GPT-5, featuring substantial improvements in reasoning, factual accuracy, and multimodal capabilities, trained on a dataset 10x larger than its predecessor.",
            "impact_assessment": "This advancement reflects the rapid evolution of transformer-based models since 2020. Each generation has dramatically expanded capabilities, with GPT-5 potentially representing a qualitative shift in AI understanding and generation.",
            "objectivity_analysis": "GPT-5 will likely enable new breakthrough applications while intensifying discussions about AI regulation, job displacement, and the need for AI literacy. Educational systems may need fundamental restructuring to remain relevant.",
            "key_quotes": "The enhanced code generation and mathematical reasoning suggest GPT-5 could accelerate software development and scientific discovery. The multimodal nature points toward more human-like AI interactions. Careful consideration of societal impacts is crucial.",
            "metadata": {
                "response_time_ms": 2156,
                "model": "claude-sonnet-4-20250514",
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 245, "output_tokens": 278},
            },
        },
    ]

    # Create AI response records
    for response_data in mock_responses:
        AIResponse.objects.create(post=post, **response_data)

    print(f"Created {len(mock_responses)} mock AI responses")


def test_mock_ai_analysis():
    """Test the AI analysis with mock data."""
    print("Testing AI Analysis with Mock Data...")

    # Create a test user
    user, created = User.objects.get_or_create(
        username="mock_test_user", defaults={"email": "mocktest@example.com"}
    )
    if created:
        user.set_password("testpass123")
        user.save()
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
        status="live",
        moderation_result={"passed": True, "flagged": False, "categories": []},
    )
    print(f"Created test post: {post.id}")

    # Create mock AI responses
    create_mock_ai_responses(post)

    # Display the responses
    print("\n" + "=" * 80)
    print("AI ANALYSIS RESULTS")
    print("=" * 80)

    ai_responses = AIResponse.objects.filter(post=post).order_by("created_at")

    for response in ai_responses:
        print(f"\n{'=' * 40}")
        print(f"Model: {response.ai_model}")
        print(f"{'=' * 40}")

        print(f"\n1. Summary:")
        print(f"   {response.summary}")

        print(f"\n2. Historical Context:")
        print(f"   {response.impact_assessment}")

        print(f"\n3. Future Development:")
        print(f"   {response.objectivity_analysis}")

        print(f"\n4. Overall Thoughts:")
        print(f"   {response.key_quotes}")

        print(f"\nMetadata:")
        print(f"   Response Time: {response.metadata.get('response_time_ms', 'N/A')}ms")
        if "total_tokens" in response.metadata:
            print(f"   Tokens Used: {response.metadata['total_tokens']}")

    print("\n" + "=" * 80)

    # Cleanup
    print("\nCleaning up test data...")
    AIResponse.objects.filter(post=post).delete()
    post.delete()
    if created:
        user.delete()
    print("Test data cleaned up!")


if __name__ == "__main__":
    print("Mock AI Analysis Test")
    print("=" * 50)
    test_mock_ai_analysis()
