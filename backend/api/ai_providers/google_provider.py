"""
Google Gemini provider implementation.
"""

import time
from typing import Any, Dict, Optional

import google.generativeai as genai

from .base import AIProvider

# Image processing imports - kept for future use when all models support it
# import io
# import httpx
# from PIL import Image



class GoogleProvider(AIProvider):
    """Google Gemini API provider implementation."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.5-pro"):
        """Initialize Google provider."""
        super().__init__(api_key, model_name)
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)

    async def analyze_content(
        self, content: str, image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze content using Google's Gemini API.

        Args:
            content: Text content to analyze
            image_url: Optional image URL to include in analysis

        Returns:
            Structured analysis response
        """
        try:
            start_time = time.time()

            # Prepare content parts
            content_parts = []

            # Add image if provided
            # Commented out for fair comparison across all models
            # if image_url:
            #     try:
            #         # Download image
            #         async with httpx.AsyncClient() as client:
            #             resp = await client.get(image_url)
            #             if resp.status_code == 200:
            #                 image_data = resp.content
            #                 # Create PIL Image object
            #                 image = Image.open(io.BytesIO(image_data))
            #                 content_parts.append(image)
            #                 self.logger.info(f"Successfully loaded image from {image_url}")
            #             else:
            #                 self.logger.warning(f"Failed to download image from {image_url}: HTTP {resp.status_code}")
            #     except Exception as e:
            #         self.logger.error(f"Error loading image: {str(e)}")

            # Add text prompt
            prompt = self.get_analysis_prompt(content)
            content_parts.append(prompt)

            # Generate response with timeout
            response = await self.model.generate_content_async(
                prompt,  # Use text-only for fair comparison
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=32000,  # Gemini 2.5 Pro supports up to 64k, using 32k
                ),
                request_options={"timeout": 300},  # 5 minutes for detailed analysis
            )

            response_time = int((time.time() - start_time) * 1000)

            # Parse response
            # Handle multi-part responses
            try:
                response_text = response.text
            except Exception as e:
                self.logger.warning(f"Failed to get response.text: {str(e)}")
                # If response.text fails, try accessing parts
                if response.parts:
                    response_text = response.parts[0].text
                else:
                    response_text = ""
                    self.logger.error("No response text found from Gemini")

            # Debug log for empty responses
            if not response_text or len(response_text) < 50:
                self.logger.warning(
                    f"Gemini returned short/empty response: {response_text[:100]}"
                )

            parsed_response = self.parse_response(response_text)

            # Add metadata
            metadata = {
                "response_time_ms": response_time,
                "model": self.model_name,
                "finish_reason": (
                    response.candidates[0].finish_reason.name
                    if response.candidates
                    else None
                ),
                "safety_ratings": (
                    [
                        {
                            "category": rating.category.name,
                            "probability": rating.probability.name,
                        }
                        for rating in response.candidates[0].safety_ratings
                    ]
                    if response.candidates
                    else []
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
            self.logger.error(f"Error analyzing content with Google: {str(e)}")
            raise
