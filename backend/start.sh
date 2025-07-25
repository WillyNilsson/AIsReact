#!/usr/bin/env bash
# Start script for Render deployment
set -o errexit

# Default PORT to 8000 if not set
PORT=${PORT:-8000}

# Use production settings
export DJANGO_SETTINGS_MODULE=aisreact.settings_production

echo "=== Starting Gunicorn on port $PORT ==="

# Start Gunicorn with memory-optimized settings for Render free tier
gunicorn aisreact.wsgi:application \
  --config gunicorn.conf.py