#!/usr/bin/env bash
# Build script for Render deployment
set -o errexit

echo "=== Installing dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Setting Django settings module ==="
export DJANGO_SETTINGS_MODULE=aisreact.settings_production

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput

echo "=== Running database migrations ==="
python manage.py migrate

echo "=== Creating cache table ==="
python manage.py createcachetable || true

echo "=== Build completed successfully ==="