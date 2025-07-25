#!/usr/bin/env bash
# Start script for Celery worker on Render
set -o errexit

# CRITICAL: Set Django settings BEFORE any Python imports
export DJANGO_SETTINGS_MODULE=aisreact.settings_production

# Force Python to not load any modules until env vars are set
export PYTHONDONTWRITEBYTECODE=1

# Explicitly set Celery environment variables from REDIS_URL
if [ -n "$REDIS_URL" ]; then
    export CELERY_BROKER_URL="$REDIS_URL"
    export CELERY_RESULT_BACKEND="$REDIS_URL"
    # Also set C_FORCE_ROOT for running as root in container
    export C_FORCE_ROOT=1
fi

echo "=== Starting Celery Worker (Memory Optimized) ==="
echo "REDIS_URL: ${REDIS_URL}"
echo "CELERY_BROKER_URL: ${CELERY_BROKER_URL}"
echo "CELERY_RESULT_BACKEND: ${CELERY_RESULT_BACKEND}"
echo "DJANGO_SETTINGS_MODULE: ${DJANGO_SETTINGS_MODULE}"

# Start Celery with memory-optimized settings for 512MB
# Use only 1 worker process with limited memory
celery -A aisreact worker \
  --loglevel=INFO \
  --concurrency=1 \
  --max-tasks-per-child=50 \
  --max-memory-per-child=200000 \
  --without-heartbeat \
  --without-gossip \
  --without-mingle