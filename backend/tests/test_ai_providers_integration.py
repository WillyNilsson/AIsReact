"""
Integration tests for AI providers.
Tests the complete flow without making actual API calls.
"""

import asyncio
import json
import os
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import google.generativeai as genai
import pytest
from anthropic import APIError as AnthropicAPIError
from anthropic import RateLimitError as AnthropicRateLimitError
from api.ai_providers.anthropic_provider import AnthropicProvider
from api.ai_providers.deepseek_provider import DeepSeekProvider
from api.ai_providers.google_provider import GoogleProvider
from api.ai_providers.openai_provider import OpenAIProvider
from api.ai_providers.xai_provider import XAIProvider
from asgiref.sync import async_to_sync
from django.test import TestCase, TransactionTestCase
from openai import APIError, APITimeoutError, RateLimitError


def get_provider(provider_name: str):
    """Factory function to get AI provider instance."""
    providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "google": GoogleProvider,
        "xai": XAIProvider,
        "deepseek": DeepSeekProvider,
    }

    if provider_name not in providers:
        raise ValueError(f"Invalid provider: {provider_name}")

    # Check for API key
    env_key_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "google": "GOOGLE_API_KEY",
        "xai": "XAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
    }

    api_key = os.environ.get(env_key_map[provider_name])
    if not api_key:
        raise ValueError(f"Missing API key for {provider_name}")

    return providers[provider_name](api_key=api_key)


def get_mock_response():
    """Get a mock successful response."""
    return """## 1. Summary
This is a test summary of the content provided.

## 2. Historical Context
From a historical perspective, this represents a significant development.

## 3. Future Development
Looking forward, this could lead to important changes.

## 4. Overall Thoughts
My overall assessment is that this is noteworthy."""


@pytest.mark.django_db
class OpenAIProviderIntegrationTest(TransactionTestCase):
    """Integration tests for OpenAI provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.provider = OpenAIProvider(api_key="test-key", model_name="gpt-4")

        # Mock the OpenAI client
        self.mock_client = AsyncMock()
        self.provider.client = self.mock_client

    def test_successful_analysis(self):
        """Test successful content analysis with OpenAI."""
        # Mock successful response
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=get_mock_response()))]
        mock_response.usage = Mock(
            total_tokens=500, prompt_tokens=350, completion_tokens=150
        )

        self.mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Run the async method
        content = "Test news content about AI developments"
        result = async_to_sync(self.provider.analyze_content)(content)

        # Verify results
        self.assertIsInstance(result, dict)
        self.assertIn("summary", result)
        self.assertIn("impact_assessment", result)
        self.assertIn("objectivity_analysis", result)
        self.assertIn("key_quotes", result)
        self.assertIn("metadata", result)

        # Check content is not empty
        self.assertTrue(result["summary"])
        self.assertTrue(result["impact_assessment"])
        self.assertTrue(result["objectivity_analysis"])
        self.assertTrue(result["key_quotes"])

        # Check metadata
        metadata = result["metadata"]
        self.assertIn("model", metadata)
        self.assertIn("response_time_ms", metadata)
        self.assertIn("total_tokens", metadata)

    def test_analysis_with_image(self):
        """Test OpenAI analysis with image."""
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=get_mock_response()))]
        mock_response.usage = Mock(total_tokens=600)

        self.mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = async_to_sync(self.provider.analyze_content)(
            "Test", "https://example.com/image.jpg"
        )

        # Verify image was included in the request
        call_args = self.mock_client.chat.completions.create.call_args
        messages = call_args[1]["messages"]
        self.assertTrue(any("image_url" in str(msg) for msg in messages))

    def test_rate_limit_error(self):
        """Test OpenAI rate limit error handling."""
        self.mock_client.chat.completions.create = AsyncMock(
            side_effect=RateLimitError("Rate limit exceeded", response=Mock(), body={})
        )

        with self.assertRaises(RateLimitError) as context:
            async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIn("rate", str(context.exception).lower())

    def test_timeout_error(self):
        """Test OpenAI timeout error handling."""
        self.mock_client.chat.completions.create = AsyncMock(
            side_effect=APITimeoutError("Request timed out.")
        )

        with self.assertRaises(APITimeoutError) as context:
            async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIn("timed out", str(context.exception).lower())

    def test_model_specific_features(self):
        """Test OpenAI-specific model features."""
        # Test o3 model
        provider = OpenAIProvider(api_key="test-key", model_name="o3-2025-04-16")
        provider.client = self.mock_client

        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=get_mock_response()))]
        mock_response.usage = Mock(total_tokens=1000)

        self.mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = async_to_sync(provider.analyze_content)("Complex reasoning task")
        self.assertIsInstance(result, dict)

        # Verify o3-specific parameters were used
        call_args = self.mock_client.chat.completions.create.call_args
        self.assertEqual(call_args[1]["temperature"], 1.0)  # o3 requires temperature=1
        self.assertIn(
            "max_completion_tokens", call_args[1]
        )  # o3 uses max_completion_tokens


@pytest.mark.django_db
class AnthropicProviderIntegrationTest(TransactionTestCase):
    """Integration tests for Anthropic provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.provider = AnthropicProvider(
            api_key="test-key", model_name="claude-3-5-haiku-latest"
        )

        # Mock the Anthropic client
        self.mock_client = AsyncMock()
        self.provider.client = self.mock_client

    def test_successful_analysis(self):
        """Test successful content analysis with Anthropic."""
        # Mock successful response
        mock_response = Mock()
        mock_response.content = [Mock(text=get_mock_response())]
        mock_response.usage = Mock(input_tokens=350, output_tokens=150)

        # Mock the async stream context manager
        mock_stream = AsyncMock()
        mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
        mock_stream.__aexit__ = AsyncMock(return_value=None)
        mock_stream.get_final_message = AsyncMock(return_value=mock_response)

        self.mock_client.messages.stream = Mock(return_value=mock_stream)

        result = async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIsInstance(result, dict)
        self.assertIn("summary", result)
        self.assertTrue(result["summary"])

    def test_rate_limit_error(self):
        """Test Anthropic rate limit error handling."""
        mock_stream = AsyncMock()
        mock_stream.__aenter__ = AsyncMock(
            side_effect=AnthropicRateLimitError(
                message="Rate limit exceeded", response=Mock(status_code=429), body={}
            )
        )

        self.mock_client.messages.stream = Mock(return_value=mock_stream)

        with self.assertRaises(AnthropicRateLimitError) as context:
            async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIn("rate", str(context.exception).lower())

    def test_vision_capability(self):
        """Test Anthropic's vision capability."""
        mock_response = Mock()
        mock_response.content = [Mock(text=get_mock_response())]
        mock_response.usage = Mock(input_tokens=400, output_tokens=200)

        mock_stream = AsyncMock()
        mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
        mock_stream.__aexit__ = AsyncMock(return_value=None)
        mock_stream.get_final_message = AsyncMock(return_value=mock_response)

        self.mock_client.messages.stream = Mock(return_value=mock_stream)

        result = async_to_sync(self.provider.analyze_content)(
            "Test", "https://example.com/image.jpg"
        )

        # Verify image was processed
        call_args = self.mock_client.messages.stream.call_args
        messages = call_args[1]["messages"]
        self.assertTrue(any("image" in str(msg) for msg in messages))


@pytest.mark.django_db
class GoogleProviderIntegrationTest(TransactionTestCase):
    """Integration tests for Google provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.provider = GoogleProvider(
            api_key="test-key", model_name="gemini-2.0-flash-exp"
        )

        # Mock the Gemini model
        self.mock_model = MagicMock()
        self.provider.model = self.mock_model

    def test_successful_analysis(self):
        """Test successful content analysis with Google."""
        # Mock successful response
        mock_response = Mock()
        mock_response.text = get_mock_response()
        mock_response.usage_metadata = Mock(
            total_token_count=500, prompt_token_count=350, candidates_token_count=150
        )

        # Google uses sync methods, so we need to handle the async wrapper
        self.mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        result = async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIsInstance(result, dict)
        self.assertIn("summary", result)
        self.assertTrue(result["summary"])

    def test_safety_filter(self):
        """Test Google's safety filter handling."""
        # Mock response blocked by safety filter
        mock_response = Mock()
        mock_response.text = ""
        mock_response.candidates = []
        mock_response.prompt_feedback = Mock(block_reason="SAFETY")

        self.mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with self.assertRaises(Exception) as context:
            async_to_sync(self.provider.analyze_content)("Potentially unsafe content")

        self.assertIn("safety", str(context.exception).lower())


@pytest.mark.django_db
class XAIProviderIntegrationTest(TransactionTestCase):
    """Integration tests for xAI provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.provider = XAIProvider(api_key="test-key", model_name="grok-beta")

        # Mock the OpenAI-compatible client
        self.mock_client = AsyncMock()
        self.provider.client = self.mock_client

    def test_successful_analysis(self):
        """Test successful content analysis with xAI."""
        # xAI uses OpenAI-compatible API
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=get_mock_response()))]
        mock_response.usage = Mock(
            total_tokens=500, prompt_tokens=350, completion_tokens=150
        )

        self.mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIsInstance(result, dict)
        self.assertIn("summary", result)
        self.assertTrue(result["summary"])


@pytest.mark.django_db
class DeepSeekProviderIntegrationTest(TransactionTestCase):
    """Integration tests for DeepSeek provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.provider = DeepSeekProvider(api_key="test-key", model_name="deepseek-chat")

        # Mock the OpenAI-compatible client
        self.mock_client = AsyncMock()
        self.provider.client = self.mock_client

    def test_successful_analysis(self):
        """Test successful content analysis with DeepSeek."""
        # DeepSeek uses OpenAI-compatible API
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=get_mock_response()))]
        mock_response.usage = Mock(
            total_tokens=500, prompt_tokens=350, completion_tokens=150
        )

        self.mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = async_to_sync(self.provider.analyze_content)("Test content")

        self.assertIsInstance(result, dict)
        self.assertIn("summary", result)
        self.assertTrue(result["summary"])


@pytest.mark.django_db
class AIProviderFactoryTest(TransactionTestCase):
    """Test the AI provider factory pattern."""

    @patch.dict(
        "os.environ",
        {
            "OPENAI_API_KEY": "test-openai-key",
            "ANTHROPIC_API_KEY": "test-anthropic-key",
            "GOOGLE_API_KEY": "test-google-key",
            "XAI_API_KEY": "test-xai-key",
            "DEEPSEEK_API_KEY": "test-deepseek-key",
        },
    )
    def test_provider_factory(self):
        """Test creating providers through factory."""
        # Test each provider type
        providers = [
            ("openai", OpenAIProvider),
            ("anthropic", AnthropicProvider),
            ("google", GoogleProvider),
            ("xai", XAIProvider),
            ("deepseek", DeepSeekProvider),
        ]

        for provider_name, provider_class in providers:
            provider = get_provider(provider_name)
            self.assertIsInstance(provider, provider_class)

    def test_invalid_provider(self):
        """Test factory with invalid provider name."""
        with self.assertRaises(ValueError):
            get_provider("invalid-provider")

    def test_missing_api_key(self):
        """Test factory with missing API key."""
        # Clear environment
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ValueError) as context:
                get_provider("openai")

            self.assertIn("API key", str(context.exception))


@pytest.mark.django_db
class AIProviderResponseParsingTest(TransactionTestCase):
    """Test response parsing for different formats."""

    def setUp(self):
        """Set up test fixtures."""
        # Use base provider for testing parsing
        self.provider = OpenAIProvider(api_key="test-key")

    def test_parse_numbered_response(self):
        """Test parsing numbered format responses."""
        response = """1. This is a summary of the content.

2. From a historical perspective, this is significant.

3. Future developments look promising.

4. Overall, this is an important development."""

        parsed = self.provider.parse_response(response)

        self.assertEqual(parsed["summary"], "This is a summary of the content.")
        self.assertEqual(
            parsed["impact_assessment"],
            "From a historical perspective, this is significant.",
        )
        self.assertEqual(
            parsed["objectivity_analysis"], "Future developments look promising."
        )
        self.assertEqual(
            parsed["key_quotes"], "Overall, this is an important development."
        )

    def test_parse_markdown_response(self):
        """Test parsing markdown format responses."""
        response = """## 1. Summary
This is a summary with multiple lines.
It continues here.

## 2. Historical Context
Historical analysis goes here.

## 3. Future Development
Future predictions.

## 4. Overall Thoughts
Final thoughts and analysis."""

        parsed = self.provider.parse_response(response)

        self.assertEqual(
            parsed["summary"],
            "This is a summary with multiple lines.\nIt continues here.",
        )
        self.assertEqual(parsed["impact_assessment"], "Historical analysis goes here.")

    def test_parse_mixed_format_response(self):
        """Test parsing responses with mixed formatting."""
        response = """Some preamble text.

1. Summary: This is the summary.

Some middle text.

2. Historical perspective here.

3. Future outlook.

4. Conclusions."""

        parsed = self.provider.parse_response(response)

        self.assertTrue(parsed["summary"])
        self.assertTrue(parsed["impact_assessment"])
        self.assertTrue(parsed["objectivity_analysis"])
        self.assertTrue(parsed["key_quotes"])
