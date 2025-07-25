"""
Celery tasks for background processing.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List

from celery import shared_task
from django.conf import settings

from .ai_providers import (
    AnthropicProvider,
    DeepSeekProvider,
    GoogleProvider,
    OpenAIProvider,
    XAIProvider,
)
from .models import AIResponse, Post

logger = logging.getLogger(__name__)


@shared_task
def run_automated_moderation(post_id):
    """Run automated moderation on a post."""
    try:
        # Get the post
        post = Post.objects.get(id=post_id)

        # Use OpenAI's moderation API
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not openai_key:
            logger.warning("No OpenAI API key found, skipping moderation")
            # For now, approve all posts
            post.status = "pending_verification"
            post.moderation_result = {
                "passed": True,
                "reason": "No moderation API configured",
            }
            post.save()
            return True

        # Run moderation
        provider = OpenAIProvider(openai_key)

        # Create async event loop for sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            moderation_result = loop.run_until_complete(
                provider.moderate_content(post.content)
            )
        finally:
            loop.close()

        # Update post based on moderation result
        if moderation_result["flagged"]:
            post.status = "rejected"
            post.rejection_reason = moderation_result["reason"]
            post.moderation_result = moderation_result
        else:
            post.status = "pending_verification"
            post.moderation_result = moderation_result

        post.save()

        logger.info(
            f"Moderation completed for post {post_id}: {'rejected' if moderation_result['flagged'] else 'approved'}"
        )
        return True

    except Post.DoesNotExist:
        logger.error(f"Post {post_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error moderating post {post_id}: {str(e)}")
        return False


@shared_task
def run_ai_analysis(post_id):
    """Run AI analysis on a verified post."""
    try:
        # Get the post
        post = Post.objects.get(id=post_id)

        # Prepare content for analysis
        content = f"{post.title}\n\n{post.content}"

        # Define AI providers to use
        providers = [
            ("openai", "OPENAI_API_KEY", "gpt-4o-2024-08-06", OpenAIProvider),
            ("google", "GOOGLE_API_KEY", "gemini-2.5-pro", GoogleProvider),
            ("xai", "XAI_API_KEY", "grok-4-0709", XAIProvider),
            ("deepseek", "DEEPSEEK_API_KEY", "deepseek-reasoner", DeepSeekProvider),
            (
                "anthropic",
                "ANTHROPIC_API_KEY",
                "claude-sonnet-4-20250514",
                AnthropicProvider,
            ),
        ]

        # Create async event loop for sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Run analysis for each provider
            for provider_name, env_key, model_name, provider_class in providers:
                api_key = os.environ.get(env_key)

                if not api_key:
                    logger.warning(f"No API key found for {provider_name}, skipping")
                    continue

                try:
                    # Initialize provider
                    provider = provider_class(api_key, model_name)

                    # Run analysis
                    result = loop.run_until_complete(
                        provider.analyze_content(content, post.image_url)
                    )

                    # Save AI response
                    AIResponse.objects.create(
                        post=post,
                        ai_model=model_name,
                        summary=result["summary"],
                        impact_assessment=result["impact_assessment"],
                        objectivity_analysis=result["objectivity_analysis"],
                        key_quotes=result["key_quotes"],
                        metadata=result["metadata"],
                    )

                    logger.info(
                        f"AI analysis completed for post {post_id} with {provider_name}"
                    )

                except Exception as e:
                    logger.error(
                        f"Error running {provider_name} analysis for post {post_id}: {str(e)}"
                    )
                    continue

        finally:
            loop.close()

        logger.info(f"All AI analyses completed for post {post_id}")
        return True

    except Post.DoesNotExist:
        logger.error(f"Post {post_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error analyzing post {post_id}: {str(e)}")
        return False
