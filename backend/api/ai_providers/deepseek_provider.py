"""
DeepSeek provider implementation.
"""

import time
from typing import Any, Dict, Optional

import httpx

from .base import AIProvider


class DeepSeekProvider(AIProvider):
    """DeepSeek API provider implementation."""

    def __init__(self, api_key: str, model_name: str = "deepseek-reasoner"):
        """Initialize DeepSeek provider."""
        super().__init__(api_key, model_name)
        self.base_url = "https://api.deepseek.com/v1"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def analyze_content(
        self, content: str, image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze content using DeepSeek's API.

        Args:
            content: Text content to analyze
            image_url: Optional image URL to include in analysis

        Returns:
            Structured analysis response
        """
        try:
            start_time = time.time()

            # Prepare request
            prompt = self.get_analysis_prompt(content)

            if image_url:
                self.logger.warning(
                    "Image analysis not yet implemented for DeepSeek provider"
                )

            # Make API request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={
                        "model": self.model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 32000,  # DeepSeek R1 via deepseek-reasoner model
                    },
                    timeout=300.0,  # 5 minutes for detailed analysis
                )
                response.raise_for_status()
                data = response.json()

            response_time = int((time.time() - start_time) * 1000)

            # Parse response
            response_text = (
                data.get("choices", [{}])[0].get("message", {}).get("content", "")
            )
            parsed_response = self.parse_response(response_text)

            # Add metadata
            metadata = {
                "response_time_ms": response_time,
                "model": self.model_name,
                "finish_reason": data.get("choices", [{}])[0].get("finish_reason"),
                "usage": data.get("usage", {}),
            }

            return {
                "summary": parsed_response.get("summary", ""),
                "impact_assessment": parsed_response.get("impact_assessment", ""),
                "objectivity_analysis": parsed_response.get("objectivity_analysis", ""),
                "key_quotes": parsed_response.get("key_quotes", ""),
                "metadata": metadata,
            }

        except Exception as e:
            self.logger.error(f"Error analyzing content with DeepSeek: {str(e)}")
            raise
