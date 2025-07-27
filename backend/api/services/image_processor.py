"""
Secure image processing service for handling user uploads.
Strips EXIF metadata, validates images, and optimizes for web.
"""

import hashlib
import io
import logging
import os
from typing import Optional, Tuple

from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# Maximum image dimensions
MAX_WIDTH = 1920
MAX_HEIGHT = 1080
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Allowed image formats
ALLOWED_FORMATS = {"JPEG", "PNG", "GIF", "WEBP"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


class ImageProcessor:
    """Handles secure image processing for uploads."""

    @staticmethod
    def generate_secure_path(user_id: int, filename: str) -> str:
        """
        Generate a secure S3 path that doesn't expose user ID.

        Args:
            user_id: The user's ID
            filename: Original filename

        Returns:
            Secure path like: uploads/a1b2c3d4e5f6/uuid.jpg
        """
        # Create a hash of user_id + secret to hide actual user ID
        secret_key = getattr(settings, "SECRET_KEY", "default-key")
        user_hash = hashlib.sha256(f"{user_id}-{secret_key}".encode()).hexdigest()[:16]

        # Generate unique filename
        import uuid

        file_extension = os.path.splitext(filename)[1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            file_extension = ".jpg"  # Default to jpg

        unique_filename = f"{uuid.uuid4()}{file_extension}"

        return f"uploads/{user_hash}/{unique_filename}"

    @staticmethod
    def strip_exif_and_optimize(
        image_data: bytes,
        filename: str,
        max_width: int = MAX_WIDTH,
        max_height: int = MAX_HEIGHT,
    ) -> Tuple[bytes, str, dict]:
        """
        Strip EXIF metadata and optimize image for web.

        Args:
            image_data: Raw image bytes
            filename: Original filename
            max_width: Maximum width
            max_height: Maximum height

        Returns:
            Tuple of (processed_image_bytes, content_type, metadata)
        """
        try:
            # Open image from bytes
            image = Image.open(io.BytesIO(image_data))

            # Validate image format
            if image.format not in ALLOWED_FORMATS:
                raise ValueError(f"Unsupported image format: {image.format}")

            # Convert RGBA to RGB if necessary (for JPEG compatibility)
            if image.mode in ("RGBA", "LA", "P"):
                # Create a white background
                background = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    image = image.convert("RGBA")
                background.paste(
                    image, mask=image.split()[-1] if image.mode == "RGBA" else None
                )
                image = background
            elif image.mode not in ("RGB", "L"):
                image = image.convert("RGB")

            # Fix orientation based on EXIF data before stripping
            image = ImageOps.exif_transpose(image)

            # Strip EXIF data by creating a new image
            # This removes all metadata including GPS coordinates
            clean_image = Image.new(image.mode, image.size)
            clean_image.putdata(list(image.getdata()))

            # Resize if too large, maintaining aspect ratio
            if image.width > max_width or image.height > max_height:
                clean_image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

            # Save to bytes with optimization
            output = io.BytesIO()

            # Determine format and quality based on image characteristics
            if image.mode == "L":  # Grayscale
                image_format = "JPEG"
                save_kwargs = {"format": "JPEG", "quality": 85, "optimize": True}
            elif len(set(image.getdata())) < 256:  # Low color count, might be a graphic
                image_format = "PNG"
                save_kwargs = {"format": "PNG", "optimize": True}
            else:
                image_format = "JPEG"
                save_kwargs = {
                    "format": "JPEG",
                    "quality": 85,
                    "optimize": True,
                    "progressive": True,
                }

            clean_image.save(output, **save_kwargs)
            processed_bytes = output.getvalue()

            # Ensure file size is reasonable
            if len(processed_bytes) > MAX_FILE_SIZE:
                # Try again with lower quality
                output = io.BytesIO()
                save_kwargs["quality"] = 70
                clean_image.save(output, **save_kwargs)
                processed_bytes = output.getvalue()

            # Determine content type
            content_type = f"image/{image_format.lower()}"
            if image_format == "JPEG":
                content_type = "image/jpeg"

            # Collect safe metadata
            metadata = {
                "original_format": image.format,
                "original_size": image.size,
                "processed_size": clean_image.size,
                "file_size": len(processed_bytes),
                "stripped_exif": True,
                "optimized": True,
            }

            logger.info(
                f"Processed image: {filename} - "
                f"Original: {image.size} -> Processed: {clean_image.size}, "
                f"Size: {len(image_data)} -> {len(processed_bytes)} bytes"
            )

            return processed_bytes, content_type, metadata

        except Exception as e:
            logger.error(f"Error processing image {filename}: {str(e)}")
            raise ValueError(f"Failed to process image: {str(e)}")

    @staticmethod
    def validate_image(image_data: bytes) -> bool:
        """
        Validate that the data is actually an image and safe to process.

        Args:
            image_data: Raw image bytes

        Returns:
            True if valid, raises ValueError if not
        """
        try:
            # Check file size
            if len(image_data) > MAX_FILE_SIZE:
                raise ValueError(
                    f"Image too large: {len(image_data)} bytes (max {MAX_FILE_SIZE})"
                )

            # Try to open and verify it's an image
            image = Image.open(io.BytesIO(image_data))
            image.verify()  # Verify it's not corrupted

            # Check format
            if image.format not in ALLOWED_FORMATS:
                raise ValueError(f"Invalid image format: {image.format}")

            # Check dimensions
            if image.width > 10000 or image.height > 10000:
                raise ValueError(f"Image dimensions too large: {image.size}")

            return True

        except Exception as e:
            logger.error(f"Image validation failed: {str(e)}")
            raise ValueError(f"Invalid image: {str(e)}")

    @staticmethod
    def generate_thumbnail(
        image_data: bytes, size: Tuple[int, int] = (200, 200)
    ) -> bytes:
        """
        Generate a thumbnail for the image.

        Args:
            image_data: Raw image bytes
            size: Thumbnail size (width, height)

        Returns:
            Thumbnail image bytes
        """
        try:
            image = Image.open(io.BytesIO(image_data))

            # Convert to RGB if necessary
            if image.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    image = image.convert("RGBA")
                background.paste(
                    image, mask=image.split()[-1] if image.mode == "RGBA" else None
                )
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")

            # Create thumbnail
            image.thumbnail(size, Image.Resampling.LANCZOS)

            # Save to bytes
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=75, optimize=True)

            return output.getvalue()

        except Exception as e:
            logger.error(f"Thumbnail generation failed: {str(e)}")
            raise ValueError(f"Failed to generate thumbnail: {str(e)}")
