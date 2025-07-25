# Development Guide

This guide will help you set up and run the AIsReact project locally.

## Prerequisites

- **Node.js 22.0.0+** (Required - project uses modern features)
- **Python 3.11+**
- **PostgreSQL 15+**
- **Redis**
- **pnpm** (Package manager for frontend)
- **Git**

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/aisreact.git
   cd aisreact
   ```

2. **Run the setup script**

   ```bash
   ./setup.sh
   ```

   This will:

   - Create Python virtual environment
   - Install backend dependencies
   - Install frontend dependencies with pnpm
   - Create `.env` files from examples
   - Set up the database

3. **Start all services**
   ```bash
   ./start-local.sh
   ```
   This starts:
   - PostgreSQL and Redis (via Docker)
   - Django backend on http://localhost:8000
   - Celery worker for background tasks
   - Next.js frontend on http://localhost:3000

## Manual Setup

### Backend Setup

1. **Create virtual environment**

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys and settings
   ```

4. **Run migrations**

   ```bash
   python manage.py migrate
   ```

5. **Create superuser (optional)**

   ```bash
   python manage.py createsuperuser
   ```

6. **Start development server**
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. **Install dependencies**

   ```bash
   cd frontend
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local if needed
   ```

3. **Start development server**
   ```bash
   pnpm dev
   ```

### Database Setup

Using Docker (recommended):

```bash
docker-compose up -d postgres redis
```

Manual setup:

- Install PostgreSQL 15+
- Install Redis
- Create database: `createdb aisreact`
- Update DATABASE_URL in backend/.env

## Environment Variables

### Backend (.env)

```bash
# Django
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost/aisreact  # pragma: allowlist secret

# Redis
REDIS_URL=redis://localhost:6379

# AWS S3 (for image uploads)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_STORAGE_BUCKET_NAME=your-bucket

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
XAI_API_KEY=xai-...
DEEPSEEK_API_KEY=sk-...
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Development Workflow

### Running Tests

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && pnpm test

# E2E tests
cd frontend && pnpm e2e
```

### Code Quality

```bash
# Run all linting/formatting
pnpm run lint
pnpm run format

# Pre-commit hooks (auto-installed)
pre-commit run --all-files
```

### Making Changes

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Commit with descriptive message
5. Push and create PR

## Common Issues

### Node.js Version

- Must use Node.js 22+
- Use nvm/fnm to manage versions

### Port Conflicts

- Backend: 8000 (change with `python manage.py runserver 8001`)
- Frontend: 3000 (change in package.json)
- PostgreSQL: 5432
- Redis: 6379

### Database Connection

- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Run migrations after model changes

### Missing API Keys

- All AI providers need valid API keys
- Get keys from respective platforms
- Some features work without all keys

## Useful Commands

```bash
# Django shell
python manage.py shell

# Create test data
python manage.py create_test_posts

# Clear cache
python manage.py clear_cache

# Check database connection
python manage.py check_db_url

# Frontend build
cd frontend && pnpm build

# Analyze bundle size
cd frontend && pnpm analyze
```

## VS Code Setup

Recommended extensions:

- Python
- Pylance
- Black Formatter
- ESLint
- Prettier
- Tailwind CSS IntelliSense

## Additional Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./QUICK_DEPLOY_GUIDE.md)
