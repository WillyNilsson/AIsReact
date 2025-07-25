# Backend Dockerfile for production
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install gunicorn

# Copy project
COPY . .

# Create static directory
RUN mkdir -p /app/staticfiles

# Collect static files (will be done at runtime with proper settings)
# RUN python manage.py collectstatic --noinput

# Create non-root user
RUN useradd -m -u 1000 django && \
    chown -R django:django /app

USER django

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# Expose port
EXPOSE 8000

# Start command (will be overridden by docker-compose)
CMD ["gunicorn", "aisreact.wsgi:application", "--bind", "0.0.0.0:8000"]