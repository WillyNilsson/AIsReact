# Architecture Overview

## System Architecture

AIsReact is a full-stack web application that allows users to submit content and see how different AI models react to it. The system follows a microservices-inspired architecture with clear separation between frontend, backend, and background workers.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Next.js App   │────▶│  Django REST    │────▶│   PostgreSQL    │
│   (Frontend)    │     │     Backend     │     │    Database     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │                ┌─────────────────┐
                                 │                │                 │
                                 └───────────────▶│      Redis      │
                                                 │     Cache       │
                                                 │                 │
                                                 └────────┬────────┘
                                                          │
┌─────────────────┐     ┌─────────────────┐              │
│                 │     │                 │              │
│  Celery Worker  │────▶│   AI Providers  │◀─────────────┘
│                 │     │  (APIs)         │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

## Technology Stack

### Frontend

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation

### Backend

- **Framework**: Django 5.1 with Django REST Framework
- **Language**: Python 3.11+
- **Authentication**: JWT (djangorestframework-simplejwt)
- **Task Queue**: Celery
- **File Storage**: AWS S3 (via boto3)

### Infrastructure

- **Database**: PostgreSQL 15+
- **Cache/Message Broker**: Redis
- **File Storage**: AWS S3
- **Deployment**: Render.com (can deploy anywhere)

### AI Integrations

- OpenAI (GPT-4o)
- Anthropic (Claude 3 Sonnet)
- Google (Gemini 2.0 Pro)
- xAI (Grok)
- DeepSeek

## Core Components

### 1. Frontend Application

The frontend is a modern React application using Next.js App Router:

```
frontend/
├── app/                    # App Router pages
│   ├── (main)/            # Public routes
│   ├── (protected)/       # Auth-required routes
│   └── (auth)/           # Authentication routes
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── ai/               # AI-related components
│   └── layout/           # Layout components
├── lib/                   # Utilities and helpers
│   ├── api/              # API client
│   ├── hooks/            # Custom React hooks
│   └── schemas/          # Zod schemas
└── store/                # Zustand stores
```

### 2. Backend API

Django REST Framework API with clear separation of concerns:

```
backend/
├── aisreact/             # Django project settings
├── api/                  # Main API app
│   ├── models.py         # Database models
│   ├── views.py          # API endpoints
│   ├── serializers.py    # Data serialization
│   ├── ai_providers/     # AI provider integrations
│   └── services/         # Business logic
└── tests/                # Test suite
```

### 3. Database Schema

Key models and relationships:

```python
User (Django Auth)
  ├── username
  ├── email
  ├── is_verified
  └── avatar_url

Post
  ├── author (FK → User)
  ├── title
  ├── content
  ├── image_url
  ├── source_url
  ├── status (draft/pending/approved/rejected)
  ├── moderation_result
  └── created_at

AIResponse
  ├── post (FK → Post)
  ├── provider (openai/anthropic/google/xai/deepseek)
  ├── title
  ├── content
  ├── analysis
  └── created_at

VerificationVote
  ├── post (FK → Post)
  ├── user (FK → User)
  ├── vote_type (positive/negative)
  └── created_at
```

### 4. Request Flow

#### Content Submission Flow

1. User submits content via frontend form
2. Frontend validates and sends to POST /api/posts/
3. Backend validates and saves post with status="pending"
4. Triggers async moderation check via Celery
5. If moderation passes, status → "pending_verification"
6. Post enters community verification pool

#### Verification Flow

1. Users vote on pending posts (5 votes required)
2. Optimistic updates on frontend for instant feedback
3. After 5 votes with >60% positive → status="approved"
4. Triggers AI analysis via Celery task

#### AI Analysis Flow

1. Celery worker receives analysis task
2. Parallel API calls to all 5 AI providers
3. Each provider analyzes the content
4. Results saved to database
5. Frontend polls/subscribes for updates

## Security Architecture

### Authentication

- JWT tokens with 30-day access, 90-day refresh
- Tokens stored in httpOnly cookies (planned)
- Token rotation on refresh

### Authorization

- Route-based protection in frontend
- Permission classes in backend
- User verification required for certain actions

### Data Protection

- Input validation at frontend and backend
- SQL injection prevention via ORM
- XSS protection via React
- CORS configured for specific origins

### Rate Limiting

- API endpoints rate limited by user/IP
- More restrictive limits on auth endpoints
- AI API calls rate limited and queued

## Performance Optimizations

### Frontend

- Lazy loading of components
- Image optimization with Next.js Image
- Code splitting by route
- Prefetching of likely navigation

### Backend

- Database query optimization with select_related
- Redis caching for frequently accessed data
- Pagination on all list endpoints
- Async processing for heavy operations

### Caching Strategy

- Redis for session data and API responses
- CDN for static assets
- Browser caching headers
- Invalidation on updates

## Scalability Considerations

### Horizontal Scaling

- Stateless backend (scales easily)
- Redis for shared state
- Database connection pooling
- Load balancer ready

### Background Jobs

- Celery workers can scale independently
- Redis as message broker
- Retry logic for failed tasks
- Dead letter queue for investigation

### Database

- Read replicas for heavy queries
- Indexing on common queries
- Partitioning strategy for large tables
- Regular maintenance tasks

## Monitoring and Observability

### Logging

- Structured JSON logging
- Correlation IDs for request tracking
- Error aggregation with Sentry (optional)
- Performance monitoring

### Metrics

- API response times
- AI provider latencies
- Queue depths
- Error rates

### Health Checks

- Endpoint: GET /api/health/
- Checks database, Redis, AI providers
- Used by load balancers

## Development Patterns

### API Design

- RESTful endpoints
- Consistent error responses
- Pagination format
- Filter/search parameters

### Code Organization

- Feature-based structure
- Shared utilities
- Type safety throughout
- Comprehensive test coverage

### State Management

- Server state: React Query
- Client state: Zustand
- Form state: React Hook Form
- Optimistic updates for UX

## Future Architecture Considerations

1. **WebSocket Support**: Real-time updates for AI responses
2. **GraphQL**: More flexible data fetching
3. **Microservices**: Split AI processing into separate service
4. **Event Sourcing**: Audit trail for all actions
5. **Multi-region**: Geographic distribution for latency
