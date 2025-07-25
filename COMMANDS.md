# aisreact Commands Reference

## Quick Start

### Start Everything (Recommended)

```bash
./start-local.sh
```

### Manual Start (Step by Step)

#### 1. Start Infrastructure (PostgreSQL & Redis)

```bash
docker-compose up -d
```

#### 2. Start Backend Server

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

#### 3. Start Background Worker (new terminal)

```bash
cd backend
source venv/bin/activate
celery -A aisreact worker -l info
```

#### 4. Start Frontend (new terminal)

```bash
cd frontend
npm run dev
```

## Initial Setup

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Database Commands

### Run Migrations

```bash
cd backend
python manage.py migrate
```

### Create Migrations

```bash
cd backend
python manage.py makemigrations
```

### Create Superuser

```bash
cd backend
python manage.py createsuperuser
```

### Seed Database with Test Data

```bash
cd backend
python manage.py shell < create_test_posts.py
```

## Development Commands

### Backend

#### Run Tests

```bash
cd backend
python manage.py test
```

#### Run Specific Test

```bash
cd backend
python manage.py test api.tests.test_auth
```

#### Format Code

```bash
cd backend
black .
```

#### Lint Code

```bash
cd backend
flake8
```

#### Django Shell

```bash
cd backend
python manage.py shell
```

### Frontend

#### Run Tests

```bash
cd frontend
npm test
```

#### Build Production

```bash
cd frontend
npm run build
```

#### Lint Code

```bash
cd frontend
npm run lint
```

#### Format Code

```bash
cd frontend
npm run format
```

#### Type Check

```bash
cd frontend
npm run type-check
```

## Docker Commands

### Start All Services

```bash
docker-compose up -d
```

### Stop All Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f
```

### View Specific Service Logs

```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Reset Database

```bash
docker-compose down -v
docker-compose up -d
cd backend && python manage.py migrate
```

## Production Commands

### Backend Production Server

```bash
cd backend
gunicorn aisreact.wsgi:application --bind 0.0.0.0:8000
```

### Frontend Production Build & Serve

```bash
cd frontend
npm install && npm run build && npm start
```

## Troubleshooting

### Install Missing Python Dependencies

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Install Missing Frontend Dependencies

```bash
cd frontend
npm install
```

### Clear Python Cache

```bash
find . -type d -name __pycache__ -exec rm -r {} +
find . -type f -name "*.pyc" -delete
```

### Clear Frontend Cache

```bash
cd frontend
rm -rf .next
rm -rf node_modules/.cache
```

### Check Service Status

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check if Redis is running
docker ps | grep redis

# Check if backend is running
curl http://localhost:8000/api/health/

# Check if frontend is running
curl http://localhost:3000
```

## Environment Variables

### Backend (.env)

```bash
cd backend
cp .env.example .env
# Edit .env with your settings
```

### Frontend (.env.local)

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your settings
```

## Git Commands

### Create a New Branch

```bash
git checkout -b feature/your-feature-name
```

### Commit Changes (ProGuardian compliant)

```bash
git add .
git commit -m "feat: your commit message

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Push to Remote

```bash
git push -u origin feature/your-feature-name
```

### Create Pull Request

```bash
gh pr create --title "Your PR title" --body "Your PR description"
```

## Useful Shortcuts

### Kill Process on Port

```bash
# Kill process on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Check Python Version

```bash
python --version
```

### Check Node Version

```bash
node --version
```

### Check Docker Status

```bash
docker --version
docker-compose --version
docker ps
```

## AI Provider Testing

### Test AI Analysis

```bash
cd backend
python test_ai_analysis.py
```

### Test AI Quality

```bash
cd backend
python test_ai_quality.py
```

## ProGuardian Compliance

### Run Security Checks

```bash
# Check for security issues
grep -r "TODO\|FIXME\|console\.log\|temporary" . --exclude-dir=node_modules --exclude-dir=venv

# Check for hardcoded secrets
grep -r "password.*=\|api_key.*=\|secret.*=" . --exclude-dir=node_modules --exclude-dir=venv
```

### Verify ProGuardian Status

```bash
cat .proguardian
```
