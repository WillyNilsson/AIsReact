# This will make sure the app is always imported when
# Django starts so that shared_task will use this app.
import os

# Ensure Django settings are loaded before importing Celery
# This is crucial for production where we need settings_production
if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aisreact.settings')

from .celery import app as celery_app

__all__ = ("celery_app",)
