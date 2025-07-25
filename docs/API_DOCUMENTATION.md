# API Documentation

Base URL: `https://api.aisreact.com` (production) or `http://localhost:8000` (development)

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Login

```
POST /api/auth/login/
```

Request:

```json
{
  "username": "string",
  "password": "string" // pragma: allowlist secret // pragma: allowlist secret
}
```

Response:

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "is_verified": true,
    "avatar_url": "https://..."
  }
}
```

### Register

```
POST /api/auth/register/
```

Request:

```json
{
  "username": "string",
  "email": "email",
  "password": "string" // pragma: allowlist secret
}
```

### Refresh Token

```
POST /api/auth/refresh/
```

Request:

```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Logout

```
POST /api/auth/logout/
```

Request:

```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

## User Endpoints

### Get Current User

```
GET /api/auth/me/
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "is_verified": true,
  "avatar_url": "https://...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Update Profile

```
PATCH /api/auth/me/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "username": "string",
  "email": "email"
}
```

### Upload Avatar

```
POST /api/users/avatar/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "filename": "avatar.jpg"
}
```

Response:

```json
{
  "upload_url": "https://s3.presigned.url...",
  "avatar_url": "https://final.avatar.url..."
}
```

## Posts Endpoints

### List Posts

```
GET /api/posts/
```

Query Parameters:

- `status`: draft, pending, approved, rejected
- `author`: user_id
- `search`: search in title and content
- `ordering`: created_at, -created_at, vote_score
- `page`: page number
- `page_size`: items per page (max 10)

Response:

```json
{
  "count": 100,
  "next": "http://api/posts/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Post Title",
      "content": "Post content...",
      "author": {
        "id": 1,
        "username": "johndoe",
        "avatar_url": "https://..."
      },
      "status": "approved",
      "created_at": "2024-01-01T00:00:00Z",
      "image_url": "https://...",
      "source_url": "https://...",
      "verification_stats": {
        "total_votes": 5,
        "positive_votes": 4,
        "negative_votes": 1
      },
      "ai_responses": []
    }
  ]
}
```

### Get Single Post

```
GET /api/posts/{id}/
```

Response includes full post details with AI responses:

```json
{
  "id": 1,
  "title": "Post Title",
  "content": "Full post content...",
  "author": {...},
  "status": "approved",
  "ai_responses": [
    {
      "id": 1,
      "provider": "openai",
      "provider_name": "OpenAI GPT-4o",
      "title": "AI's interpretation",
      "content": "Detailed response...",
      "analysis": {
        "sentiment": "positive",
        "key_points": ["point1", "point2"]
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Post

```
POST /api/posts/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "title": "string",
  "content": "string",
  "source_url": "url",
  "image_url": "url (optional)"
}
```

### Update Post

```
PATCH /api/posts/{id}/
Authorization: Bearer <access_token>
```

Only draft posts can be updated by their author.

### Delete Post

```
DELETE /api/posts/{id}/
Authorization: Bearer <access_token>
```

Only draft posts can be deleted by their author.

### Upload Post Image

```
POST /api/posts/upload/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "filename": "image.jpg",
  "content_type": "image/jpeg"
}
```

Response:

```json
{
  "upload_url": "https://s3.presigned.url...",
  "file_url": "https://final.image.url..."
}
```

## Verification Endpoints

### Get Verification Queue

```
GET /api/verification/queue/
Authorization: Bearer <access_token>
```

Returns posts pending verification, excluding those already voted by the user.

Response:

```json
{
  "count": 10,
  "results": [
    {
      "id": 1,
      "title": "Post Title",
      "content": "Post content...",
      "author": {...},
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Submit Vote

```
POST /api/verification/vote/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "post_id": 1,
  "vote_type": "positive" // or "negative"
}
```

### Batch Vote

```
POST /api/posts/batch-vote/
Authorization: Bearer <access_token>
```

Request:

```json
{
  "votes": [
    { "post_id": 1, "vote_type": "positive" },
    { "post_id": 2, "vote_type": "negative" }
  ]
}
```

### Get Verification Stats

```
GET /api/posts/{id}/verification-stats/
```

Response:

```json
{
  "post_id": 1,
  "total_votes": 5,
  "positive_votes": 4,
  "negative_votes": 1,
  "verification_score": 0.8,
  "user_vote": "positive" // if authenticated
}
```

## Health Check

```
GET /api/health/
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "celery": "healthy",
    "ai_providers": {
      "openai": "healthy",
      "anthropic": "healthy",
      "google": "healthy",
      "xai": "healthy",
      "deepseek": "healthy"
    }
  }
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "field": "field_name" // for validation errors
  }
}
```

Common HTTP status codes:

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type  | Limit     |
| -------------- | --------- |
| Anonymous      | 100/hour  |
| Authenticated  | 1000/hour |
| Registration   | 5/hour    |
| Login          | 10/hour   |
| Password Reset | 3/hour    |
| Post Creation  | 20/hour   |

Rate limit headers:

- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## Pagination

List endpoints use cursor-based pagination:

```json
{
  "count": 100,
  "next": "http://api/endpoint/?page=2",
  "previous": null,
  "results": [...]
}
```

Query parameters:

- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 10)

## Webhooks (Future)

Planned webhook events:

- `post.approved` - When post passes verification
- `post.analyzed` - When AI analysis completes
- `user.verified` - When user email verified

## SDKs

Official SDKs planned for:

- JavaScript/TypeScript
- Python
- Go

## API Versioning

The API uses URL versioning. Current version: v1

Future versions will maintain backward compatibility or provide migration guides.
