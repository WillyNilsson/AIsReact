"""
URL configuration for aisreact project.
"""

import os
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

# Get admin URL from environment variable with fallback
admin_path = os.environ.get('ADMIN_URL_PATH', 'admin')
if not admin_path.endswith('/'):
    admin_path += '/'

urlpatterns = [
    path(admin_path, admin.site.urls),
    path("api/", include("api.urls")),
]

# Add prometheus metrics endpoint in production
if not settings.DEBUG:
    urlpatterns += [
        path("", include("django_prometheus.urls")),
    ]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
