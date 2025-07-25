"""
Custom permissions for moderation endpoints.
"""

from rest_framework import permissions


class IsModerator(permissions.BasePermission):
    """
    Custom permission to only allow moderators and admins.
    """

    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Must have moderator or admin role
        return request.user.role in ["moderator", "admin"]
