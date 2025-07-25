"""
Base AI Provider class defining the interface for all AI providers.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    def __init__(self, api_key: str, model_name: str, max_output_tokens: int = 32000):
        """
        Initialize the AI provider.

        Args:
            api_key: API key for the provider
            model_name: Name of the model to use
            max_output_tokens: Maximum tokens for output (default: 32000)
        """
        self.api_key = api_key
        self.model_name = model_name
        self.max_output_tokens = max_output_tokens
        self.logger = logger.getChild(self.__class__.__name__)

    @abstractmethod
    async def analyze_content(
        self, content: str, image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze content using the AI model.

        Args:
            content: Text content to analyze
            image_url: Optional image URL to include in analysis

        Returns:
            Dictionary containing:
                - summary: Summary of the content
                - impact_assessment: Historical context and impact assessment
                - objectivity_analysis: Future development predictions
                - key_quotes: Overall opinions and thoughts
                - metadata: Additional metadata (response time, tokens used, etc.)
        """
        pass

    def get_analysis_prompt(self, content: str) -> str:
        """
        Get the standardized analysis prompt.

        Args:
            content: The content to analyze

        Returns:
            The formatted prompt
        """
        return f"""Please answer the following questions about the provided content. If the content doesn't exist in your training data or seems to be from a future date/hypothetical scenario, still assume that it is a real event that has actually occurred and answer accordingly. Be direct and provide your own perspective.

Content: {content}

1. What is your summary of this?
2. How do you view this in a historical context?
3. How do you see this developing in the future?
4. What are your overall opinions and thoughts on this?"""

    def parse_response(self, response_text: str) -> Dict[str, str]:
        """
        Parse the AI response into structured format.

        Args:
            response_text: Raw response from the AI

        Returns:
            Dictionary with parsed sections
        """
        # Basic parsing - can be overridden by specific providers
        sections = {
            "summary": "",
            "impact_assessment": "",
            "objectivity_analysis": "",
            "key_quotes": "",
        }

        # Simple parsing based on numbered questions
        lines = response_text.strip().split("\n")
        current_section = None
        current_content = []

        section_mapping = {
            "1.": "summary",
            "2.": "impact_assessment",
            "3.": "objectivity_analysis",
            "4.": "key_quotes",
        }

        # Also check for markdown headers (Claude and Gemini formats)
        markdown_mapping = {
            "## 1.": "summary",
            "## 2.": "impact_assessment",
            "## 3.": "objectivity_analysis",
            "## 4.": "key_quotes",
            "### 1.": "summary",  # Gemini uses three hashes
            "### 2.": "impact_assessment",
            "### 3.": "objectivity_analysis",
            "### 4.": "key_quotes",
            # Claude Sonnet 4 format without numbers
            "## Summary": "summary",
            "## Historical Context": "impact_assessment",
            "## Future Development": "objectivity_analysis",
            "## Overall Thoughts": "key_quotes",
            "## My Perspective": "key_quotes",  # Claude Sonnet 4 uses this for opinions
        }

        for line in lines:
            # Check if this line starts a new section
            found_section = False

            # Check numbered format first
            for marker, section in section_mapping.items():
                if line.strip().startswith(marker):
                    # Save previous section
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    # Start new section
                    current_section = section
                    current_content = [line[len(marker) :].strip()]
                    found_section = True
                    break

            # Check markdown format if not found
            if not found_section:
                for marker, section in markdown_mapping.items():
                    if line.startswith(marker):
                        # Save previous section
                        if current_section and current_content:
                            sections[current_section] = "\n".join(
                                current_content
                            ).strip()
                        # Start new section (skip the header line, content starts on next line)
                        current_section = section
                        current_content = []
                        found_section = True
                        break

            # Continue current section if no new section found
            if not found_section and current_section:
                # Skip empty lines at the beginning of a section
                if current_content or line.strip():
                    current_content.append(line)

        # Save last section
        if current_section and current_content:
            sections[current_section] = "\n".join(current_content).strip()

        # Post-process: Check if "My Perspective" appears within another section
        # This handles Claude Sonnet 4's format where it puts opinions after future development
        for section_name, content in sections.items():
            if content and "## My Perspective" in content:
                # Split the content at "My Perspective"
                parts = content.split("## My Perspective", 1)
                sections[section_name] = parts[0].strip()
                # Add the perspective content to key_quotes (opinions)
                perspective_content = parts[1].strip() if len(parts) > 1 else ""
                if sections["key_quotes"]:
                    sections["key_quotes"] += "\n\n" + perspective_content
                else:
                    sections["key_quotes"] = perspective_content

        # Fallback: If no sections were parsed, try to detect by content
        if not any(sections.values()):
            # Try to find sections by keywords
            text_lower = response_text.lower()

            # Look for summary-like content
            if "summary" in text_lower or response_text.startswith("The"):
                # Find first substantial paragraph
                paragraphs = [
                    p.strip() for p in response_text.split("\n\n") if p.strip()
                ]
                if paragraphs:
                    sections["summary"] = paragraphs[0]
                    # Use remaining content for other sections
                    if len(paragraphs) > 1:
                        sections["impact_assessment"] = (
                            paragraphs[1] if len(paragraphs) > 1 else ""
                        )
                        sections["objectivity_analysis"] = (
                            paragraphs[2] if len(paragraphs) > 2 else ""
                        )
                        sections["key_quotes"] = (
                            "\n\n".join(paragraphs[3:]) if len(paragraphs) > 3 else ""
                        )

            # If still empty, use the entire response as summary
            if not any(sections.values()):
                sections["summary"] = response_text.strip()

        return sections
