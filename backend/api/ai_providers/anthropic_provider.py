"""
Anthropic Claude provider implementation.
"""

import time
from typing import Any, Dict, Optional

from anthropic import AsyncAnthropic

from .base import AIProvider


class AnthropicProvider(AIProvider):
    """Anthropic Claude API provider implementation."""

    def __init__(self, api_key: str, model_name: str = "claude-sonnet-4-20250514"):
        """Initialize Anthropic provider."""
        super().__init__(api_key, model_name)
        self.client = AsyncAnthropic(api_key=api_key)

    async def analyze_content(
        self, content: str, image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze content using Anthropic's Claude API.

        Args:
            content: Text content to analyze
            image_url: Optional image URL to include in analysis

        Returns:
            Structured analysis response
        """
        try:
            start_time = time.time()

            # Prepare messages
            prompt = self.get_analysis_prompt(content)

            # Build message content
            message_content = []

            # Add image if provided
            # Commented out for fair comparison across all models
            # if image_url:
            #     message_content.append({
            #         "type": "image",
            #         "source": {
            #             "type": "url",
            #             "url": image_url
            #         }
            #     })
            #     self.logger.info(f"Including image in analysis: {image_url}")

            # Add text prompt
            message_content.append({"type": "text", "text": prompt})

            # Call Claude API using the messages endpoint with streaming
            response_text = ""

            async with self.client.messages.stream(
                model=self.model_name,
                max_tokens=16384,  # Claude Sonnet 4 supports up to 16384
                temperature=0.7,
                messages=[
                    {"role": "user", "content": prompt}
                ],  # Use text-only for fair comparison
            ) as stream:
                async for text in stream.text_stream:
                    response_text += text

                # Get the final message with metadata
                message = await stream.get_final_message()

            response_time = int((time.time() - start_time) * 1000)

            # Parse response
            parsed_response = self.parse_response(response_text)

            # Debug log
            if not any(parsed_response.values()):
                self.logger.warning(
                    f"Empty parsed response. Raw text length: {len(response_text)}"
                )
                self.logger.debug(f"Raw text preview: {response_text[:200]}...")

            # Add metadata
            metadata = {
                "response_time_ms": response_time,
                "model": self.model_name,
                "stop_reason": message.stop_reason if message else None,
                "usage": (
                    {
                        "input_tokens": message.usage.input_tokens,
                        "output_tokens": message.usage.output_tokens,
                    }
                    if message and message.usage
                    else None
                ),
            }

            return {
                "summary": parsed_response.get("summary", ""),
                "impact_assessment": parsed_response.get("impact_assessment", ""),
                "objectivity_analysis": parsed_response.get("objectivity_analysis", ""),
                "key_quotes": parsed_response.get("key_quotes", ""),
                "metadata": metadata,
            }

        except Exception as e:
            self.logger.error(f"Error analyzing content with Anthropic: {str(e)}")
            raise
