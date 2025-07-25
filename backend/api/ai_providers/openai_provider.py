"""
OpenAI provider implementation.
"""

import time
from typing import Any, Dict, Optional

import openai
from openai import AsyncOpenAI

from ..services.error_logging import ErrorCategory, error_logger
from .base import AIProvider


class OpenAIProvider(AIProvider):
    """OpenAI API provider implementation."""

    def __init__(self, api_key: str, model_name: str = "gpt-4o-2024-08-06"):
        """Initialize OpenAI provider."""
        super().__init__(api_key, model_name)
        self.client = AsyncOpenAI(api_key=api_key)

    async def analyze_content(
        self, content: str, image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze content using OpenAI's API.

        Args:
            content: Text content to analyze
            image_url: Optional image URL to include in analysis

        Returns:
            Structured analysis response
        """
        try:
            start_time = time.time()

            # Prepare messages
            messages = []

            # Commented out for fair comparison across all models
            # if image_url:
            #     messages.append(
            #         {
            #             "role": "user",
            #             "content": [
            #                 {"type": "text", "text": self.get_analysis_prompt(content)},
            #                 {"type": "image_url", "image_url": {"url": image_url}},
            #             ],
            #         }
            #     )
            # else:
            #     messages.append(
            #         {"role": "user", "content": self.get_analysis_prompt(content)}
            #     )

            # Use text-only for fair comparison
            messages.append(
                {"role": "user", "content": self.get_analysis_prompt(content)}
            )

            # Call OpenAI API
            # o3 has specific requirements
            if self.model_name.startswith("o3"):
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=1.0,  # o3 only supports temperature=1
                    max_completion_tokens=32000,  # o3 uses max_completion_tokens
                )
            else:
                # GPT-4 models support up to 16384 tokens
                max_tokens = 16384 if "gpt-4" in self.model_name else 32000
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=max_tokens,
                )

            response_time = int((time.time() - start_time) * 1000)

            # Parse response
            response_text = response.choices[0].message.content
            parsed_response = self.parse_response(response_text)

            # Add metadata
            metadata = {
                "response_time_ms": response_time,
                "model": self.model_name,
                "finish_reason": response.choices[0].finish_reason,
                "total_tokens": response.usage.total_tokens if response.usage else None,
                "prompt_tokens": (
                    response.usage.prompt_tokens if response.usage else None
                ),
                "completion_tokens": (
                    response.usage.completion_tokens if response.usage else None
                ),
            }

            return {
                "summary": parsed_response.get("summary", ""),
                "impact_assessment": parsed_response.get("impact_assessment", ""),
                "objectivity_analysis": parsed_response.get("objectivity_analysis", ""),
                "key_quotes": parsed_response.get("key_quotes", ""),
                "metadata": metadata,
            }

        except openai.APIError as e:
            error_logger.log_error(
                e,
                category=ErrorCategory.AI_PROVIDER,
                extra={
                    "provider": "openai",
                    "model": self.model_name,
                    "error_type": type(e).__name__,
                    "status_code": getattr(e, "status_code", None),
                    "response_body": getattr(e, "response_body", None),
                },
            )
            raise
        except Exception as e:
            error_logger.log_error(
                e,
                category=ErrorCategory.AI_PROVIDER,
                severity="critical",
                extra={
                    "provider": "openai",
                    "model": self.model_name,
                    "operation": "analyze_content",
                },
            )
            raise

    async def moderate_content(self, content: str) -> Dict[str, Any]:
        """
        Use OpenAI's moderation API to check content.

        Args:
            content: Text content to moderate

        Returns:
            Moderation results
        """
        try:
            response = await self.client.moderations.create(input=content)

            result = response.results[0]

            # Check if content is flagged
            flagged = result.flagged

            # Get categories that were flagged
            flagged_categories = []
            if flagged:
                for category, value in result.categories.model_dump().items():
                    if value:
                        flagged_categories.append(category)

            # Get severity scores
            category_scores = result.category_scores.model_dump()

            return {
                "flagged": flagged,
                "categories": flagged_categories,
                "category_scores": category_scores,
                "reason": ", ".join(flagged_categories) if flagged_categories else None,
            }

        except Exception as e:
            self.logger.error(f"Error moderating content with OpenAI: {str(e)}")
            raise
