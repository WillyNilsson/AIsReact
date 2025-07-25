# Quick Deploy Guide

This guide covers deploying AIsReact to production. We'll use Render.com as the primary example, but the principles apply to other platforms.

## Prerequisites

- GitHub repository with your code
- Accounts for:
  - Render.com (or your chosen platform)
  - PostgreSQL database
  - Redis instance
  - AWS S3 bucket
  - AI provider API keys

## Environment Variables

First, prepare all required environment variables:

### Backend Environment

```bash
# Django Settings
DEBUG=False
SECRET_KEY=<generate-strong-secret>
ALLOWED_HOSTS=your-backend-domain.com
DJANGO_SETTINGS_MODULE=aisreact.settings_production

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname  # pragma: allowlist secret

# Redis
REDIS_URL=redis://host:port

# AWS S3
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_STORAGE_BUCKET_NAME=<your-bucket>
AWS_S3_REGION_NAME=us-east-1
AWS_DEFAULT_ACL=public-read

# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
XAI_API_KEY=xai-...
DEEPSEEK_API_KEY=sk-...

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Email (optional)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
SENDGRID_API_KEY=<your-key>
```

### Frontend Environment

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

## Render.com Deployment

### 1. Create Services

Create these services in Render:

1. **PostgreSQL Database**

   - Choose PostgreSQL 15
   - Note the connection string

2. **Redis Instance**

   - Choose Redis 7
   - Note the connection URL

3. **Backend Web Service**

   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `./build.sh`
   - Start Command: `./start-prod.sh`
   - Environment: Python 3.11

4. **Celery Worker**

   - Connect same GitHub repo
   - Root Directory: `backend`
   - Build Command: `./build.sh`
   - Start Command: `./start-worker.sh`
   - Environment: Python 3.11

5. **Frontend Static Site**
   - Connect GitHub repo
   - Root Directory: `frontend`
   - Build Command: `pnpm install && pnpm build`
   - Publish Directory: `out`

### 2. Configure render.yaml

Create `render.yaml` in your repo root:

```yaml
services:
  # Backend API
  - type: web
    name: aisreact-backend
    runtime: python
    plan: starter
    buildCommand: cd backend && ./build.sh
    startCommand: cd backend && ./start-prod.sh
    envVars:
      - key: DJANGO_SETTINGS_MODULE
        value: aisreact.settings_production
      - key: DATABASE_URL
        fromDatabase:
          name: aisreact-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: aisreact-redis
          property: connectionString

  # Celery Worker
  - type: worker
    name: aisreact-worker
    runtime: python
    plan: starter
    buildCommand: cd backend && ./build.sh
    startCommand: cd backend && ./start-worker.sh
    envVars:
      - key: DJANGO_SETTINGS_MODULE
        value: aisreact.settings_production
      - key: DATABASE_URL
        fromDatabase:
          name: aisreact-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: aisreact-redis
          property: connectionString

  # Frontend
  - type: web
    name: aisreact-frontend
    runtime: static
    buildCommand: cd frontend && pnpm install && pnpm build
    staticPublishPath: frontend/out
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY

databases:
  - name: aisreact-db
    plan: starter
    databaseName: aisreact
    user: aisreact_user

  - name: aisreact-redis
    type: redis
    plan: starter
```

### 3. Deploy Scripts

Ensure you have these scripts in your backend directory:

**build.sh**:

```bash
#!/usr/bin/env bash
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate
```

**start-prod.sh**:

```bash
#!/usr/bin/env bash
set -o errexit

gunicorn aisreact.wsgi:application \
  --bind 0.0.0.0:$PORT \
  --workers 2 \
  --threads 4 \
  --worker-class sync \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile -
```

**start-worker.sh**:

```bash
#!/usr/bin/env bash
set -o errexit

export DJANGO_SETTINGS_MODULE=aisreact.settings_production

celery -A aisreact worker \
  --loglevel=INFO \
  --concurrency=1 \
  --max-tasks-per-child=50 \
  --max-memory-per-child=200000
```

### 4. Set Up S3 Bucket

1. Create S3 bucket in AWS
2. Configure bucket policy for public read:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::your-bucket/avatars/*",
        "arn:aws:s3:::your-bucket/uploads/*"
      ]
    }
  ]
}
```

### 5. DNS Configuration

1. Add custom domain in Render
2. Update DNS records:
   - Backend: `api.yourdomain.com` → Render backend
   - Frontend: `yourdomain.com` → Render frontend

## Alternative Platforms

### Heroku

- Use `Procfile` instead of start scripts
- Add buildpacks for Python and Node.js
- Use Heroku Postgres and Redis add-ons

### AWS

- Backend: Elastic Beanstalk or ECS
- Frontend: S3 + CloudFront
- Database: RDS PostgreSQL
- Cache: ElastiCache Redis
- Workers: ECS or Lambda

### DigitalOcean

- Use App Platform
- Similar to Render configuration
- Managed databases available

### Self-Hosted

- Use Docker Compose (see docker-compose.yml)
- Nginx reverse proxy
- SSL with Let's Encrypt
- SystemD for process management

## Post-Deployment

### 1. Create Admin User

```bash
python manage.py createsuperuser
```

### 2. Test Health Endpoint

```bash
curl https://api.yourdomain.com/api/health/
```

### 3. Configure Monitoring

- Set up error tracking (Sentry)
- Configure uptime monitoring
- Set up log aggregation

### 4. Security Checklist

- [ ] SSL certificates active
- [ ] Environment variables secure
- [ ] Debug mode disabled
- [ ] Secret keys rotated
- [ ] CORS properly configured
- [ ] Rate limiting active

## Troubleshooting

### Database Connection Issues

- Check DATABASE_URL format
- Verify network connectivity
- Check SSL requirements

### Static Files Not Loading

- Run `collectstatic` command
- Check STATIC_ROOT setting
- Verify whitenoise configuration

### Worker Not Processing Tasks

- Check Redis connection
- Verify Celery logs
- Check task routing

### Memory Issues

- Adjust worker concurrency
- Enable swap if needed
- Monitor memory usage

## Scaling

### Horizontal Scaling

- Add more web dynos/instances
- Scale workers independently
- Use read replicas for database

### Performance Optimization

- Enable CDN for static files
- Add caching headers
- Optimize database queries

### High Availability

- Multi-region deployment
- Database replication
- Redis persistence enabled
