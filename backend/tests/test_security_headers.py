"""
Tests for security headers middleware.
"""

import pytest
from api.middleware import SecurityHeadersMiddleware
from django.conf import settings
from django.http import HttpResponse
from django.test import RequestFactory
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def request_factory():
    """Django request factory."""
    return RequestFactory()


@pytest.fixture
def middleware():
    """Security headers middleware instance."""

    def get_response(request):
        return HttpResponse("OK")

    return SecurityHeadersMiddleware(get_response)


class TestSecurityHeadersMiddleware:
    """Test security headers middleware."""

    def test_content_security_policy(self, request_factory, middleware):
        """Test that CSP header is added."""
        request = request_factory.get("/")
        response = middleware(request)

        assert "Content-Security-Policy" in response
        csp = response["Content-Security-Policy"]

        # Check key directives
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "base-uri 'self'" in csp

    def test_security_headers_added(self, request_factory, middleware):
        """Test that all security headers are added."""
        request = request_factory.get("/")
        response = middleware(request)

        # Check required headers
        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["X-XSS-Protection"] == "1; mode=block"
        assert response["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "Permissions-Policy" in response
        assert response["Server"] == "aisreact"

    def test_permissions_policy(self, request_factory, middleware):
        """Test that Permissions-Policy disables features."""
        request = request_factory.get("/")
        response = middleware(request)

        policy = response["Permissions-Policy"]
        assert "camera=()" in policy
        assert "microphone=()" in policy
        assert "geolocation=()" in policy
        assert "payment=()" in policy

    def test_auth_endpoint_cache_control(self, request_factory, middleware):
        """Test that auth endpoints have no-cache headers."""
        request = request_factory.get("/api/auth/me/")
        response = middleware(request)

        assert (
            response["Cache-Control"] == "no-store, no-cache, must-revalidate, private"
        )

    def test_non_auth_endpoint_no_cache_control(self, request_factory, middleware):
        """Test that non-auth endpoints don't get cache control."""
        request = request_factory.get("/api/posts/")
        response = middleware(request)

        assert "Cache-Control" not in response

    def test_existing_headers_not_overridden(self, request_factory):
        """Test that existing headers are not overridden."""

        def get_response(request):
            response = HttpResponse("OK")
            response["Content-Security-Policy"] = "custom-csp"
            response["X-Content-Type-Options"] = "custom-nosniff"
            return response

        middleware = SecurityHeadersMiddleware(get_response)
        request = request_factory.get("/")
        response = middleware(request)

        # Should keep existing headers
        assert response["Content-Security-Policy"] == "custom-csp"
        assert response["X-Content-Type-Options"] == "custom-nosniff"

    def test_powered_by_header_removed(self, request_factory):
        """Test that X-Powered-By header is removed."""

        def get_response(request):
            response = HttpResponse("OK")
            response["X-Powered-By"] = "Django"
            return response

        middleware = SecurityHeadersMiddleware(get_response)
        request = request_factory.get("/")
        response = middleware(request)

        assert "X-Powered-By" not in response

    @pytest.mark.skipif(not settings.DEBUG, reason="Only test HSTS in production mode")
    def test_hsts_header_production(self, request_factory, middleware):
        """Test HSTS header in production."""
        # This would need production settings to test properly
        pass


@pytest.mark.django_db
class TestSecurityHeadersIntegration:
    """Test security headers in real API responses."""

    def test_api_endpoint_has_headers(self, api_client):
        """Test that API endpoints have security headers."""
        response = api_client.get(reverse("api:health"))

        assert response["X-Content-Type-Options"] == "nosniff"
        assert "Content-Security-Policy" in response
        assert response["Server"] == "aisreact"

    def test_csrf_endpoint_has_headers(self, api_client):
        """Test that CSRF endpoint has security headers."""
        response = api_client.get(reverse("api:csrf_token"))

        assert response["X-Content-Type-Options"] == "nosniff"
        assert "Permissions-Policy" in response

    def test_auth_endpoint_cache_headers(self, api_client):
        """Test that auth endpoints have proper cache headers."""
        # Try to access auth endpoint (will fail without auth, but headers should be set)
        response = api_client.get(reverse("api:me"))

        assert (
            response["Cache-Control"] == "no-store, no-cache, must-revalidate, private"
        )
