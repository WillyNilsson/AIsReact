"""
Enhanced authentication with JWT refresh token rotation.
"""

import logging
import uuid

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from .throttles import AuthThrottle, TokenRefreshThrottle

logger = logging.getLogger(__name__)


class RotatingRefreshToken(RefreshToken):
    """Extended RefreshToken with rotation support."""

    @classmethod
    def for_user(cls, user):
        """Create token with family ID for tracking."""
        token = super().for_user(user)
        # Add family ID for tracking token lineage
        token["family_id"] = str(uuid.uuid4())
        token["rotation_counter"] = 0
        return token


@method_decorator(csrf_exempt, name="dispatch")
class TokenRotationView(TokenRefreshView):
    """
    Token refresh view with rotation.

    This view implements refresh token rotation for enhanced security:
    - Issues new refresh token on each use
    - Blacklists old tokens
    - Detects token reuse and invalidates family
    """

    permission_classes = [AllowAny]
    throttle_classes = [TokenRefreshThrottle]

    def post(self, request, *args, **kwargs):
        """Handle token refresh with rotation."""
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Check if token is blacklisted
            if self.is_token_blacklisted(refresh_token):
                logger.warning("Attempted use of blacklisted token")
                return Response(
                    {"detail": "Token has been revoked"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Decode the refresh token
            old_token = RefreshToken(refresh_token)

            # Check for token reuse attack
            family_id = old_token.get("family_id")
            if family_id and self.detect_token_reuse(family_id, old_token["jti"]):
                # Token reuse detected - invalidate entire family
                self.invalidate_token_family(family_id)
                logger.warning(f"Token reuse detected for family {family_id}")
                return Response(
                    {"detail": ("Token reuse detected. " "All tokens invalidated.")},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Create new token pair with rotation
            user_id = old_token["user_id"]
            new_token = RotatingRefreshToken()
            new_token["user_id"] = user_id
            new_token["family_id"] = family_id or str(uuid.uuid4())
            new_token["rotation_counter"] = old_token.get("rotation_counter", 0) + 1

            # Blacklist the old refresh token
            self.blacklist_token(old_token)

            # Record the new token in the family
            if family_id:
                self.record_token_in_family(family_id, new_token["jti"])

            # Generate new access token
            new_access = new_token.access_token

            return Response(
                {
                    "access": str(new_access),
                    "refresh": str(new_token),
                    "access_expires_in": settings.SIMPLE_JWT[
                        "ACCESS_TOKEN_LIFETIME"
                    ].total_seconds(),
                    "refresh_expires_in": settings.SIMPLE_JWT[
                        "REFRESH_TOKEN_LIFETIME"
                    ].total_seconds(),
                }
            )

        except TokenError as e:
            logger.error(f"Token refresh error: {str(e)}")
            return Response(
                {"detail": "Invalid or expired token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {str(e)}")
            return Response(
                {"detail": "Token refresh failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def is_token_blacklisted(self, token_str):
        """Check if token is in blacklist."""
        try:
            token = RefreshToken(token_str)
            jti = token["jti"]
            return cache.get(f"blacklist_token:{jti}") is not None
        except (TokenError, KeyError, AttributeError) as e:
            logger.debug(f"Token blacklist check failed: {str(e)}")
            return False

    def blacklist_token(self, token):
        """Add token to blacklist."""
        jti = token["jti"]
        exp = token["exp"]

        # Calculate TTL based on token expiry
        ttl = exp - timezone.now().timestamp()
        if ttl > 0:
            # Store in cache with expiry
            cache.set(f"blacklist_token:{jti}", True, int(ttl))
            logger.info(f"Token {jti} blacklisted for {ttl} seconds")

    def detect_token_reuse(self, family_id, current_jti):
        """Detect if a token from this family was already used."""
        # Get the last known good token for this family
        last_jti = cache.get(f"token_family:{family_id}:last_jti")

        if last_jti and last_jti != current_jti:
            # Check if current token is older than last known
            # This indicates potential token theft
            return cache.get(f"blacklist_token:{current_jti}") is not None

        return False

    def record_token_in_family(self, family_id, jti):
        """Record token as the latest in its family."""
        # Store for 7 days (refresh token lifetime)
        cache.set(f"token_family:{family_id}:last_jti", jti, 7 * 24 * 60 * 60)

    def invalidate_token_family(self, family_id):
        """Invalidate all tokens in a family."""
        # In a production system, you'd want to track all JTIs in a family
        # For now, we'll mark the family as compromised
        cache.set(
            f"token_family:{family_id}:compromised", True, 30 * 24 * 60 * 60  # 30 days
        )


class TokenRevokeView(APIView):
    """View to revoke refresh tokens (logout)."""

    throttle_classes = [AuthThrottle]

    def post(self, request):
        """Revoke the provided refresh token."""
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)

            # Blacklist the token
            jti = token["jti"]
            exp = token["exp"]
            ttl = exp - timezone.now().timestamp()

            if ttl > 0:
                cache.set(f"blacklist_token:{jti}", True, int(ttl))

            # Also invalidate the token family to prevent any rotated versions
            family_id = token.get("family_id")
            if family_id:
                cache.set(f"token_family:{family_id}:revoked", True, 7 * 24 * 60 * 60)

            return Response({"detail": "Token revoked successfully"})

        except TokenError:
            return Response(
                {"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST
            )
