"""
Example module demonstrating proper error handling patterns.
This file serves as a reference for implementing error handling in new modules.
"""

import asyncio
from typing import Any, Dict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DatabaseError, transaction
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..exceptions import ExternalServiceError, NotFoundError, ValidationError
from ..models import Post, User
from .error_logging import (
    ErrorCategory,
    error_context,
    error_logger,
    log_exception,
    log_info,
    log_warning,
)


class ContentProcessor:
    """Example service demonstrating error handling patterns."""

    def __init__(self):
        self.max_retries = 3
        self.timeout = 30

    @log_exception(category=ErrorCategory.VALIDATION)
    def validate_content(self, content: str, user: User) -> Dict[str, Any]:
        """
        Validate content with proper error handling.

        The decorator automatically logs any exceptions.
        """
        # Log the start of validation
        log_info(
            "Starting content validation",
            category=ErrorCategory.VALIDATION,
            extra={"user_id": user.id, "content_length": len(content)},
        )

        # Validation checks
        if not content or not content.strip():
            raise ValidationError("Content cannot be empty")

        if len(content) > 10000:
            raise ValidationError("Content exceeds maximum length of 10,000 characters")

        if self._contains_prohibited_content(content):
            log_warning(
                "Prohibited content detected",
                category=ErrorCategory.VALIDATION,
                extra={"user_id": user.id},
            )
            raise ValidationError("Content contains prohibited material")

        return {
            "valid": True,
            "content_length": len(content),
            "estimated_tokens": len(content.split()),
        }

    async def process_with_external_service(self, post: Post) -> Dict[str, Any]:
        """
        Process content with external service, demonstrating retry logic.
        """
        retry_count = 0
        last_error = None

        while retry_count < self.max_retries:
            try:
                # Use error context for automatic logging
                with error_context(
                    "external_service_call",
                    category=ErrorCategory.EXTERNAL_SERVICE,
                    extra={"post_id": post.id, "retry_count": retry_count},
                ):
                    result = await self._call_external_api(post.content)

                    # Log successful processing
                    log_info(
                        "External service processed successfully",
                        category=ErrorCategory.EXTERNAL_SERVICE,
                        extra={"post_id": post.id, "retry_count": retry_count},
                    )

                    return result

            except asyncio.TimeoutError as e:
                last_error = e
                retry_count += 1

                log_warning(
                    f"External service timeout "
                    f"(attempt {retry_count}/{self.max_retries})",
                    category=ErrorCategory.EXTERNAL_SERVICE,
                    extra={
                        "post_id": post.id,
                        "timeout": self.timeout,
                        "retry_count": retry_count,
                    },
                )

                if retry_count < self.max_retries:
                    # Exponential backoff
                    await asyncio.sleep(2**retry_count)

            except ExternalServiceError as e:
                last_error = e
                retry_count += 1

                error_logger.log_error(
                    e,
                    category=ErrorCategory.EXTERNAL_SERVICE,
                    extra={
                        "post_id": post.id,
                        "retry_count": retry_count,
                        "service_error_code": getattr(e, "error_code", None),
                    },
                )

                if retry_count < self.max_retries:
                    await asyncio.sleep(2**retry_count)

        # All retries failed
        error_logger.log_error(
            last_error or Exception("Unknown error"),
            category=ErrorCategory.EXTERNAL_SERVICE,
            severity="error",
            extra={
                "post_id": post.id,
                "retries_exhausted": True,
                "total_attempts": retry_count,
            },
        )

        raise ExternalServiceError(
            f"External service failed after {retry_count} attempts"
        )

    @transaction.atomic
    def update_post_safely(self, post_id: int, updates: Dict[str, Any]) -> Post:
        """
        Update post with database error handling and rollback.
        """
        try:
            # Use select_for_update to prevent race conditions
            post = Post.objects.select_for_update().get(id=post_id)

            # Log the update attempt
            log_info(
                "Updating post",
                category=ErrorCategory.DATABASE,
                extra={"post_id": post_id, "updates": list(updates.keys())},
            )

            # Apply updates
            for field, value in updates.items():
                if not hasattr(post, field):
                    raise ValidationError(f"Invalid field: {field}")
                setattr(post, field, value)

            # Validate before saving
            post.full_clean()
            post.save()

            return post

        except Post.DoesNotExist:
            error_logger.log_warning(
                f"Post {post_id} not found",
                category=ErrorCategory.DATABASE,
                extra={"post_id": post_id},
            )
            raise NotFoundError(f"Post with id {post_id} not found")

        except DjangoValidationError as e:
            error_logger.log_error(
                e,
                category=ErrorCategory.VALIDATION,
                extra={
                    "post_id": post_id,
                    "validation_errors": (
                        e.message_dict if hasattr(e, "message_dict") else str(e)
                    ),
                },
            )
            raise ValidationError("Invalid post data")

        except DatabaseError as e:
            # Database errors are critical
            error_logger.log_error(
                e,
                category=ErrorCategory.DATABASE,
                severity="critical",
                extra={"post_id": post_id, "operation": "update_post"},
            )
            # Transaction will be rolled back automatically
            raise

    def _contains_prohibited_content(self, content: str) -> bool:
        """Check for prohibited content."""
        # Simplified example
        prohibited_terms = ["spam", "abuse"]
        content_lower = content.lower()
        return any(term in content_lower for term in prohibited_terms)

    async def _call_external_api(self, content: str) -> Dict[str, Any]:
        """Simulate external API call."""
        # This would be replaced with actual API call
        await asyncio.sleep(0.1)  # Simulate network delay

        # Simulate occasional failures
        import random

        if random.random() < 0.1:  # 10% failure rate
            raise ExternalServiceError("Service temporarily unavailable")

        return {"processed": True, "score": random.random()}


# Example usage in a view


@api_view(["POST"])
def process_content_view(request):
    """
    Example view using the content processor with proper error handling.
    """
    processor = ContentProcessor()

    try:
        # Get user
        user = request.user

        # Validate input
        content = request.data.get("content")
        if not content:
            raise ValidationError("Content is required")

        # Use error context for the entire operation
        with error_context(
            "content_processing", category=ErrorCategory.VALIDATION, request=request
        ):
            # Validate content
            validation_result = processor.validate_content(content, user)

            # Create post
            post = Post.objects.create(
                user=user, content=content, status="pending_moderation"
            )

            # Process with external service (would be async in production)
            # In a real implementation, this would be handled by a background task
            # result = await processor.process_with_external_service(post)

            return Response(
                {
                    "post_id": post.id,
                    "validation": validation_result,
                    "status": "processing",
                },
                status=status.HTTP_201_CREATED,
            )

    except ValidationError as e:
        # Validation errors are expected and not logged as errors
        return Response(
            {"error": {"code": "validation_error", "message": str(e)}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    except Exception as e:
        # Unexpected errors are logged and return generic message
        error_logger.log_error(
            e, category=ErrorCategory.UNKNOWN, request=request, severity="error"
        )
        return Response(
            {
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
