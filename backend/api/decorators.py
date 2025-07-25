"""
Custom decorators for API views.
"""

import logging
from functools import wraps

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)


def conditional_csrf_exempt(view_func):
    """
    Conditionally exempt a view from CSRF protection.

    This should only be used for specific endpoints that:
    1. Use token-based authentication (JWT)
    2. Don't use session authentication
    3. Are not vulnerable to CSRF attacks

    Examples: Login, token refresh endpoints
    """

    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        # Log CSRF exemption for security auditing
        logger.info(
            f"CSRF exemption applied to {request.method} {request.path} "
            f"from {request.META.get('REMOTE_ADDR', 'unknown')}"
        )
        return view_func(request, *args, **kwargs)

    # Apply CSRF exemption
    wrapped_view.csrf_exempt = True
    return csrf_exempt(wrapped_view)


def method_decorator_csrf_exempt(methods):
    """
    Apply CSRF exemption to specific methods in a ViewSet.

    Usage:
        @method_decorator_csrf_exempt(['post'])
        class MyViewSet(viewsets.ModelViewSet):
            ...
    """

    def decorator(cls):
        for method in methods:
            if hasattr(cls, method):
                setattr(cls, method, csrf_exempt(getattr(cls, method)))
        return cls

    return decorator
