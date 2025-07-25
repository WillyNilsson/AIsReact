#!/usr/bin/env python
"""
Test script to run AI analysis for Anthropic/Claude only.
This avoids burning API tokens for all providers during testing.
"""

import asyncio
import logging
import os
import sys

import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings")
django.setup()

from api.ai_providers import AnthropicProvider
from api.models import AIResponse, Post
from asgiref.sync import sync_to_async

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


async def test_anthropic_analysis(post_id: int):
    """Test Anthropic analysis on a specific post."""
    try:
        # Get the post (using sync_to_async for Django ORM)
        post = await sync_to_async(Post.objects.get)(id=post_id)
        logger.info(
            f"Testing Anthropic analysis for post {post.id}: {post.title[:50]}..."
        )

        # Prepare content
        content = f"{post.title}\n\n{post.content}"

        # Get API key
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            logger.error("No ANTHROPIC_API_KEY found in environment")
            return

        # Create provider
        provider = AnthropicProvider(api_key, "claude-sonnet-4-20250514")

        # Run analysis
        logger.info("Calling Anthropic API...")
        result = await provider.analyze_content(
            content=content, image_url=post.image_url if post.image_url else None
        )

        # Log results
        logger.info("Analysis complete!")
        logger.info(f"Summary: {result.get('summary', '')[:200]}...")
        logger.info(f"Impact: {result.get('impact_assessment', '')[:200]}...")
        logger.info(f"Objectivity: {result.get('objectivity_analysis', '')[:200]}...")
        logger.info(f"Key quotes: {result.get('key_quotes', '')[:200]}...")

        # Check if we need to save or update
        existing = await sync_to_async(
            AIResponse.objects.filter(
                post=post, ai_model="claude-sonnet-4-20250514"
            ).first
        )()

        if existing:
            logger.info("Updating existing AI response...")
            existing.summary = result.get("summary", "")
            existing.impact_assessment = result.get("impact_assessment", "")
            existing.objectivity_analysis = result.get("objectivity_analysis", "")
            existing.key_quotes = result.get("key_quotes", "")
            existing.metadata = result.get("metadata", {})
            await sync_to_async(existing.save)()
        else:
            logger.info("Creating new AI response...")
            await sync_to_async(AIResponse.objects.create)(
                post=post,
                ai_model="claude-sonnet-4-20250514",
                summary=result.get("summary", ""),
                impact_assessment=result.get("impact_assessment", ""),
                objectivity_analysis=result.get("objectivity_analysis", ""),
                key_quotes=result.get("key_quotes", ""),
                metadata=result.get("metadata", {}),
            )

        logger.info("Test completed successfully!")

    except Post.DoesNotExist:
        logger.error(f"Post {post_id} not found")
    except Exception as e:
        logger.error(f"Error during test: {type(e).__name__}: {str(e)}")
        import traceback

        traceback.print_exc()


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        post_id = int(sys.argv[1])
    else:
        post_id = 30  # Default to post 30

    # Run the async test
    asyncio.run(test_anthropic_analysis(post_id))


if __name__ == "__main__":
    main()
