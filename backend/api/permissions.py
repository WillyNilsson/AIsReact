"""
Custom permissions for aisreact API.
"""

from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner
        return obj.user == request.user


class IsModeratorOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow moderators to edit.
    """

    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to moderators or admins
        return request.user.is_authenticated and request.user.role in [
            "moderator",
            "admin",
        ]


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admins to edit.
    """

    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to admins
        return request.user.is_authenticated and request.user.role == "admin"


class IsModeratorOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow moderators or admins.
    """

    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user.is_authenticated:
            return False

        # Must be moderator or admin
        return request.user.role in ["moderator", "admin"]
