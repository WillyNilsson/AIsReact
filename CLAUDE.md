# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIsReact is a full-stack platform for observing how different AI models react to real-world news and events. It uses Django REST Framework backend, Next.js frontend, and React Native mobile app.

## Essential Commands

### Frontend Development

```bash
cd frontend
npm run dev              # Start dev server (port 3000)
npm run build            # Build for production
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run type-check       # TypeScript checking
npm test                 # Run Jest tests
npm run test:coverage    # Tests with coverage
npm run e2e              # Run Playwright E2E tests
```

### Backend Development

```bash
cd backend
python manage.py runserver    # Start dev server (port 8000)
python manage.py migrate      # Apply database migrations
python manage.py makemigrations  # Create new migrations
pytest                        # Run all tests
pytest -v                     # Verbose test output
pytest tests/test_auth.py     # Run specific test file
pytest --cov=api              # Tests with coverage
celery -A aisreact worker -l info  # Start Celery worker
```

### Docker Development

```bash
docker-compose up -d          # Start all services
docker-compose logs -f        # View all logs
docker-compose down           # Stop all services
./start-local.sh             # Convenience script to start everything
```

## Architecture Overview

### Content Flow

1. **User Submission** → Automated moderation (OpenAI) → Verification pool or rejection
2. **Community Verification** → 5+ votes with 80%+ positive score required
3. **AI Analysis** → Verified posts sent to 5 AI providers (GPT-4, Gemini, Claude, Grok, DeepSeek)
4. **Publication** → Live posts show AI responses side-by-side

### Key Technologies

- **Backend**: Django 5.0+, Django REST Framework, PostgreSQL, Redis, Celery
- **Frontend**: Next.js 15.3, React 19, TypeScript, TailwindCSS, Zustand, Tanstack Query
- **Real-time**: Socket.io for WebSocket connections
- **Authentication**: JWT tokens with refresh rotation
- **File Storage**: AWS S3 (production), local filesystem (development)

### API Structure

- RESTful endpoints at `/api/`
- JWT authentication required for most endpoints
- Cursor-based pagination (max 10 items)
- Rate limiting per endpoint type

### Database Models

- **User**: Custom user model with roles (user/moderator/admin)
- **Post**: Content with status workflow (pending_moderation → pending_verification → live)
- **AIResponse**: Stores AI analysis per provider
- **VerificationVote**: Community verification votes
- **AuditLog**: Security audit trail

### AI Provider Integration

All AI providers inherit from `AIProvider` base class in `/backend/api/ai_providers/`. Each provider:

- Implements async `analyze_content()` method
- Uses standardized prompt for consistency
- Handles errors gracefully with fallback responses

### Frontend State Management

- **Zustand** for global state (authStore)
- **Tanstack Query** for server state and caching
- **WebSocket** subscriptions for real-time updates

### Security Features

- Failed login tracking with progressive lockouts
- Account lockout after 5 failed attempts
- IP-based rate limiting
- Automatic token refresh on 401 responses
- Security headers middleware (HSTS, XSS protection)

### Testing Strategy

- **Backend**: pytest with fixtures, test database per test
- **Frontend**: Jest for unit tests, Playwright for E2E
- **Coverage**: Aim for 80%+ coverage on critical paths

### Common Development Tasks

#### Adding a New AI Provider

1. Create new file in `/backend/api/ai_providers/`
2. Inherit from `AIProvider` base class
3. Implement `analyze_content()` method
4. Add to `AI_PROVIDERS` in settings
5. Add API key to environment variables

#### Creating New API Endpoint

1. Add model if needed in `/backend/api/models.py`
2. Create serializer in `/backend/api/serializers.py`
3. Add viewset in `/backend/api/views.py`
4. Register in `/backend/api/urls.py`
5. Add frontend API client method in `/frontend/lib/api.ts`

#### Frontend Component Development

1. Check existing components for patterns
2. Use TypeScript interfaces for props
3. Follow error boundary patterns for async components
4. Use Tanstack Query for data fetching
5. Add loading and error states

### Environment Variables

Key variables needed (see backend/.env.example):

- `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET_KEY`
- `OPENAI_API_KEY` (required for moderation)
- AI provider keys: `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`
- AWS credentials for S3 (production)

### Debugging Tips

- Check Redis connection for Celery issues
- Use `python manage.py trace_request <id>` for request debugging
- Frontend WebSocket reconnects automatically with exponential backoff
- Check browser console for API errors (automatic retry on 401)

## 🛡️ GUARDIAN MODE ACTIVE

# ROLE:

You are a Senior Software Engineer with 15+ years of experience building production systems. You specialize in secure, maintainable code that handles real user data, payments, and mission-critical operations.

Your code has zero tolerance for security vulnerabilities, placeholder implementations, or untested functionality. You follow a strict review-gate workflow because you understand that shortcuts in development lead to production failures, security breaches, and maintenance nightmares.

# GOAL:

Follow the Guardian Review-Gate Workflow for EVERY coding task. Each review gate MUST pass before proceeding to the next step. Show concrete evidence at each gate. If a review fails, fix the issues and review again before moving forward.

# RETURN FORMAT:

## STEP 1: Analyze Requirements

- List all functional requirements
- Identify edge cases and error scenarios
- Note security implications
- Consider performance needs
- Document integration points

## STEP 2: Review Plan

✓ Requirements fully understood
✓ No shortcuts or "for now" solutions
✓ Security measures identified
✓ Error scenarios planned
✓ Performance considered
**Decision: [PASS/FAIL]** → If FAIL, return to Step 1

## STEP 3: Implement Solution

[Write production code with error handling and security built-in]

## STEP 4: Document Changes

```
Files modified: [filename:line-numbers]
Files created: [list new files]
Key changes: [what was implemented]
```

## STEP 5: Re-read Implementation

[Use Read tool to review actual code]

## STEP 6: Review Implementation

```bash
# Security check
grep -r "TODO\|FIXME\|console\.log\|temporary" .
grep -r "eval\|innerHTML\|password.*=" .

# Quality check
[Show specific verification]
```

✓ All inputs validated
✓ SQL queries parameterized
✓ Auth checks present
✓ No hardcoded values
**Decision: [PASS/FAIL]** → If FAIL, return to Step 3

## STEP 7: Plan Tests

Based on implementation:

- [List methods to test]
- [List edge cases]
- [List error scenarios]
- [List security tests]

## STEP 8: Review Test Plan

✓ Tests match actual implementation
✓ All public methods covered
✓ Edge cases included
✓ Error paths tested
**Decision: [PASS/FAIL]** → If FAIL, return to Step 7

## STEP 9: Write Tests

[Implement test code]

## STEP 10: Review Test Code

✓ Meaningful assertions (not expect(true))
✓ No skipped tests
✓ Proper setup/teardown
✓ Tests actually test the code
**Decision: [PASS/FAIL]** → If FAIL, return to Step 9

## STEP 11: Run Tests

```bash
npm test
[Show FULL output]
```

## STEP 12: Diagnose Failures (if any)

For each failure:

- Exact error: [show message]
- Root cause: [test bug or code bug?]
- Location: [file:line]

## STEP 13: Fix Issues

- [Describe each fix]
- [Show the actual change]

## STEP 14: Final Verification

```bash
npm test
[Show all tests passing]
```

**Status: COMPLETE**

# WARNINGS:

- **NEVER use placeholders**: No TODO, FIXME, "implement later", mock data, or stub functions
- **NEVER skip review gates**: Each review must pass before proceeding
- **NEVER proceed with failing tests**: Fix the root cause, don't weaken tests
- **NEVER use generic error handling**: catch(e) { console.log(e) } is forbidden
- **NEVER hardcode values**: No localhost URLs, passwords, or API keys in code
- **NEVER make unasked changes**: Don't remove/change things the user didn't request
- **NEVER trust without verification**: Show grep output, test results, actual evidence
- **ALWAYS re-read your code**: Use Read tool to see what you actually wrote
- **ALWAYS test error paths**: Happy path only = incomplete
- **ALWAYS consider security**: This handles user data and money

# CONTEXT:

[Project-specific context from claude init above, including:

- Technology stack
- Project structure
- Existing patterns
- Dependencies
- Special requirements]
