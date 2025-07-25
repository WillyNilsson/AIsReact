# Log Aggregation Guide

This guide covers logging strategies and aggregation options for AIsReact in production.

## Logging Architecture

### Backend Logging

The Django backend uses structured JSON logging with correlation IDs:

```python
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "message": "User login successful",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": 123,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "duration_ms": 245
}
```

### Frontend Logging

The frontend uses a custom logger that:

- Disables non-error logs in production
- Buffers logs for debugging
- Integrates with error tracking services

### Log Levels

- **DEBUG**: Detailed debugging information
- **INFO**: General informational messages
- **WARNING**: Warning messages for concerning behavior
- **ERROR**: Error messages for failures
- **CRITICAL**: Critical issues requiring immediate attention

## Local Development

### Backend Logs

```bash
# Django logs
tail -f backend/logs/django.log

# Celery logs
tail -f backend/logs/celery.log

# All logs
tail -f backend/logs/*.log
```

### Frontend Logs

- Browser console for client-side logs
- Terminal for server-side rendering logs

## Production Logging

### Render.com Logs

Access logs through Render dashboard or CLI:

```bash
# Install Render CLI
brew install render

# Stream logs
render logs --service aisreact-backend --tail

# Download logs
render logs --service aisreact-backend --since 1h > logs.txt
```

### Log Format Configuration

**Django Settings**:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
```

## Log Aggregation Services

### 1. ELK Stack (Self-Hosted)

**Setup**:

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

**Logstash Configuration**:

```ruby
input {
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  if [correlation_id] {
    mutate {
      add_field => { "[@metadata][correlation_id]" => "%{correlation_id}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "aisreact-%{+YYYY.MM.dd}"
  }
}
```

### 2. Datadog

**Installation**:

```bash
pip install ddtrace
```

**Configuration**:

```python
# settings.py
INSTALLED_APPS += ['ddtrace.contrib.django']

DATADOG_TRACE = {
    'AGENT_HOSTNAME': 'localhost',
    'AGENT_PORT': 8126,
    'TAGS': {'env': 'production'},
}
```

**Frontend Integration**:

```javascript
import { datadogLogs } from "@datadog/browser-logs";

datadogLogs.init({
  clientToken: "<CLIENT_TOKEN>",
  site: "datadoghq.com",
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
});
```

### 3. Sentry

**Backend Setup**:

```python
# settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="https://your-dsn@sentry.io/project-id",
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
)
```

**Frontend Setup**:

```javascript
// app/layout.tsx
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

### 4. AWS CloudWatch

**Setup with boto3**:

```python
import boto3
import watchtower

cloudwatch = boto3.client('logs', region_name='us-east-1')

LOGGING['handlers']['cloudwatch'] = {
    'class': 'watchtower.CloudWatchLogHandler',
    'boto3_client': cloudwatch,
    'log_group': 'aisreact',
    'stream_name': 'production',
}
```

### 5. Grafana Loki

**Docker Setup**:

```yaml
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

## Log Analysis Queries

### Common Searches

**Find all errors for a user**:

```json
{
  "query": {
    "bool": {
      "must": [{ "term": { "level": "ERROR" } }, { "term": { "user_id": 123 } }]
    }
  }
}
```

**Track request flow**:

```json
{
  "query": {
    "term": { "correlation_id": "550e8400-e29b-41d4-a716-446655440000" }
  }
}
```

**Slow requests**:

```json
{
  "query": {
    "range": { "duration_ms": { "gte": 1000 } }
  }
}
```

### Useful Dashboards

1. **Request Overview**

   - Request rate
   - Error rate
   - Response time percentiles
   - Top endpoints

2. **Error Tracking**

   - Error frequency
   - Error types
   - Affected users
   - Stack traces

3. **Performance Monitoring**

   - Database query time
   - AI provider latency
   - Cache hit rates
   - Queue depths

4. **Security Monitoring**
   - Failed login attempts
   - Suspicious patterns
   - Rate limit violations
   - Authentication failures

## Best Practices

### 1. Structured Logging

Always use structured logging with consistent fields:

```python
logger.info("User action", extra={
    "action": "post_created",
    "user_id": user.id,
    "post_id": post.id,
    "ip_address": request.META.get('REMOTE_ADDR')
})
```

### 2. Correlation IDs

Track requests across services:

```python
# Middleware adds correlation ID
correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
```

### 3. Sensitive Data

Never log sensitive information:

```python
# Bad
logger.info(f"User logged in with password: {password}")

# Good
logger.info(f"User logged in", extra={"user_id": user.id})
```

### 4. Log Retention

Set appropriate retention policies:

- Debug logs: 1-3 days
- Info logs: 7-14 days
- Error logs: 30-90 days
- Security logs: 1 year+

### 5. Log Sampling

For high-traffic applications:

```python
import random

if random.random() < 0.1:  # Log 10% of requests
    logger.info("Request processed", extra={...})
```

## Alerting

### Key Metrics to Alert On

1. **Error Rate** > 1% of requests
2. **Response Time** > 2 seconds (p95)
3. **Queue Depth** > 1000 items
4. **Failed AI Calls** > 10 per minute
5. **Authentication Failures** > 100 per hour

### Alert Configuration Example

**Datadog Monitor**:

```yaml
name: High Error Rate
type: metric alert
query: avg(last_5m):sum:aisreact.errors{env:production}.as_rate() > 0.01
message: |
  Error rate is above 1%!
  Check logs: {{log_link}}
  @slack-alerts @pagerduty
```

## Debugging Production Issues

### 1. Trace Request Flow

```bash
# Find correlation ID from error
grep "ERROR" logs.json | jq '.correlation_id' | head -1

# Get all logs for that request
grep "550e8400-e29b-41d4-a716-446655440000" logs.json | jq '.'
```

### 2. Performance Analysis

```bash
# Find slow requests
jq 'select(.duration_ms > 1000)' logs.json

# Aggregate by endpoint
jq -r '.endpoint' logs.json | sort | uniq -c | sort -nr
```

### 3. Error Patterns

```bash
# Group errors by type
jq 'select(.level == "ERROR") | .error_type' logs.json | sort | uniq -c

# Find error spike times
jq 'select(.level == "ERROR") | .timestamp' logs.json | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c
```

## Cost Optimization

1. **Log Level by Environment**

   - Development: DEBUG
   - Staging: INFO
   - Production: WARNING

2. **Selective Logging**

   - Don't log every request
   - Use sampling for high-volume endpoints
   - Compress logs before storage

3. **Retention Policies**
   - Delete old logs automatically
   - Archive to cheaper storage
   - Keep aggregated metrics longer than raw logs
