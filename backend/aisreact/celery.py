"""
Celery configuration for aisreact project.
"""

import os

from celery import Celery

# Set the default Django settings module for the 'celery' program.
# This will be overridden by the environment if DJANGO_SETTINGS_MODULE is already set
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings")

app = Celery("aisreact")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Explicitly set broker and backend if REDIS_URL is in environment
redis_url = os.environ.get("REDIS_URL")
if redis_url:
    app.conf.broker_url = redis_url
    app.conf.result_backend = redis_url

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    """Debug task to test Celery is working."""
    print(f"Request: {self.request!r}")
