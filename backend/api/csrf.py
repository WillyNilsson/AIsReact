"""
CSRF token management for API.
"""

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Get CSRF token for the frontend.

    This endpoint ensures a CSRF cookie is set and returns
    the token value for use in AJAX requests.
    """
    token = get_token(request)
    return Response(
        {"csrfToken": token, "headerName": "X-CSRFToken", "cookieName": "csrftoken"}
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_failure_view(request):
    """
    Custom CSRF failure response for API.
    """
    return Response(
        {
            "error": {
                "code": "csrf_failed",
                "message": "CSRF verification failed. Please refresh the page and try again.",
            }
        },
        status=403,
    )
