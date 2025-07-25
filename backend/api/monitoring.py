"""
Monitoring configuration and custom metrics for aisreact platform.
"""

import functools
import logging
import time
from typing import Any, Callable, Dict, Optional

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from django_prometheus.models import ExportModelOperationsMixin
from prometheus_client import Counter, Gauge, Histogram, Info

logger = logging.getLogger(__name__)

# Application info
app_info = Info("aisreact_app", "Application information")
app_info.info(
    {
        "version": getattr(settings, "APP_VERSION", "unknown"),
        "environment": "production" if not settings.DEBUG else "development",
    }
)

# Request metrics
http_requests_total = Counter(
    "aisreact_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "aisreact_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
)

# Business metrics
posts_created_total = Counter(
    "aisreact_posts_created_total", "Total posts created", ["content_type", "user_type"]
)

posts_moderated_total = Counter(
    "aisreact_posts_moderated_total", "Total posts moderated", ["result", "reason"]
)

posts_verified_total = Counter(
    "aisreact_posts_verified_total", "Total posts verified", ["vote_type", "result"]
)

ai_analyses_total = Counter(
    "aisreact_ai_analyses_total", "Total AI analyses performed", ["provider", "status"]
)

ai_analysis_duration_seconds = Histogram(
    "aisreact_ai_analysis_duration_seconds",
    "AI analysis duration",
    ["provider"],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

# User metrics
active_users_gauge = Gauge(
    "aisreact_active_users", "Number of active users in the last hour"
)

user_registrations_total = Counter(
    "aisreact_user_registrations_total", "Total user registrations", ["source"]
)

# System metrics
database_connections_active = Gauge(
    "aisreact_database_connections_active", "Active database connections"
)

cache_operations_total = Counter(
    "aisreact_cache_operations_total", "Total cache operations", ["operation", "status"]
)

background_tasks_total = Counter(
    "aisreact_background_tasks_total", "Total background tasks", ["task_name", "status"]
)

background_task_duration_seconds = Histogram(
    "aisreact_background_task_duration_seconds",
    "Background task duration",
    ["task_name"],
)

# Error metrics
application_errors_total = Counter(
    "aisreact_application_errors_total",
    "Total application errors",
    ["error_type", "endpoint"],
)

# S3 metrics
s3_operations_total = Counter(
    "aisreact_s3_operations_total", "Total S3 operations", ["operation", "status"]
)

s3_operation_duration_seconds = Histogram(
    "aisreact_s3_operation_duration_seconds", "S3 operation duration", ["operation"]
)


def track_request_metrics(method: str, endpoint: str, status: int, duration: float):
    """Track HTTP request metrics."""
    http_requests_total.labels(
        method=method, endpoint=endpoint, status=str(status)
    ).inc()
    http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(
        duration
    )


def track_post_created(content_type: str, user_type: str = "regular"):
    """Track post creation."""
    posts_created_total.labels(content_type=content_type, user_type=user_type).inc()


def track_post_moderated(result: str, reason: Optional[str] = None):
    """Track post moderation."""
    posts_moderated_total.labels(result=result, reason=reason or "none").inc()


def track_post_verified(vote_type: str, result: str):
    """Track post verification."""
    posts_verified_total.labels(vote_type=vote_type, result=result).inc()


def track_ai_analysis(provider: str, status: str, duration: Optional[float] = None):
    """Track AI analysis metrics."""
    ai_analyses_total.labels(provider=provider, status=status).inc()
    if duration is not None:
        ai_analysis_duration_seconds.labels(provider=provider).observe(duration)


def track_user_registration(source: str = "web"):
    """Track user registration."""
    user_registrations_total.labels(source=source).inc()


def track_cache_operation(operation: str, status: str):
    """Track cache operations."""
    cache_operations_total.labels(operation=operation, status=status).inc()


def track_background_task(
    task_name: str, status: str, duration: Optional[float] = None
):
    """Track background task execution."""
    background_tasks_total.labels(task_name=task_name, status=status).inc()
    if duration is not None:
        background_task_duration_seconds.labels(task_name=task_name).observe(duration)


def track_error(error_type: str, endpoint: str = "unknown"):
    """Track application errors."""
    application_errors_total.labels(error_type=error_type, endpoint=endpoint).inc()


def track_s3_operation(operation: str, status: str, duration: Optional[float] = None):
    """Track S3 operations."""
    s3_operations_total.labels(operation=operation, status=status).inc()
    if duration is not None:
        s3_operation_duration_seconds.labels(operation=operation).observe(duration)


def update_system_metrics():
    """Update system metrics (called periodically)."""
    try:
        # Update active database connections
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM pg_stat_activity
                WHERE datname = current_database()
            """
            )
            conn_count = cursor.fetchone()[0]
            database_connections_active.set(conn_count)

        # Update active users count
        from api.models import User

        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        active_count = User.objects.filter(last_login__gte=one_hour_ago).count()
        active_users_gauge.set(active_count)

    except Exception as e:
        logger.error(f"Error updating system metrics: {e}")


class MonitoringMiddleware:
    """Middleware to track request metrics."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        response = self.get_response(request)

        duration = time.time() - start_time

        # Track metrics
        track_request_metrics(
            method=request.method,
            endpoint=request.path,
            status=response.status_code,
            duration=duration,
        )

        return response

    def process_exception(self, request, exception):
        """Track exceptions."""
        track_error(error_type=type(exception).__name__, endpoint=request.path)
        return None


def monitor_task(func: Callable) -> Callable:
    """Decorator to monitor background tasks."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        task_name = func.__name__

        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            track_background_task(task_name, "success", duration)
            return result
        except Exception as e:
            duration = time.time() - start_time
            track_background_task(task_name, "failure", duration)
            track_error(error_type=type(e).__name__, endpoint=f"task:{task_name}")
            raise

    return wrapper


def monitor_ai_call(provider: str):
    """Decorator to monitor AI API calls."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                track_ai_analysis(provider, "success", duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                track_ai_analysis(provider, "failure", duration)
                track_error(error_type=type(e).__name__, endpoint=f"ai:{provider}")
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                track_ai_analysis(provider, "success", duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                track_ai_analysis(provider, "failure", duration)
                track_error(error_type=type(e).__name__, endpoint=f"ai:{provider}")
                raise

        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


class CacheMonitor:
    """Wrapper for cache operations with monitoring."""

    def __init__(self, cache_backend):
        self.cache = cache_backend

    def get(self, key: str, default=None):
        """Get value from cache with monitoring."""
        try:
            value = self.cache.get(key, default)
            track_cache_operation("get", "hit" if value is not None else "miss")
            return value
        except Exception as e:
            track_cache_operation("get", "error")
            raise

    def set(self, key: str, value: Any, timeout: Optional[int] = None):
        """Set value in cache with monitoring."""
        try:
            result = self.cache.set(key, value, timeout)
            track_cache_operation("set", "success" if result else "failure")
            return result
        except Exception as e:
            track_cache_operation("set", "error")
            raise

    def delete(self, key: str):
        """Delete value from cache with monitoring."""
        try:
            result = self.cache.delete(key)
            track_cache_operation("delete", "success")
            return result
        except Exception as e:
            track_cache_operation("delete", "error")
            raise


# Custom alerts configuration
ALERT_RULES = {
    "high_error_rate": {
        "condition": lambda: application_errors_total._value.sum() > 100,
        "message": "High error rate detected",
        "severity": "critical",
    },
    "database_connection_pool_exhausted": {
        "condition": lambda: database_connections_active._value._value > 90,
        "message": "Database connection pool nearly exhausted",
        "severity": "warning",
    },
    "slow_ai_responses": {
        "condition": lambda: ai_analysis_duration_seconds._sum._value
        / ai_analysis_duration_seconds._count._value
        > 30,
        "message": "AI response times are slow",
        "severity": "warning",
    },
}


def check_alerts():
    """Check alert conditions and trigger notifications."""
    for alert_name, alert_config in ALERT_RULES.items():
        try:
            if alert_config["condition"]():
                logger.warning(
                    f"Alert triggered: {alert_name} - {alert_config['message']} "
                    f"(severity: {alert_config['severity']})"
                )
                # Here you would send notifications (email, Slack, etc.)
        except Exception as e:
            logger.error(f"Error checking alert {alert_name}: {e}")


# Initialize monitoring
def setup_monitoring():
    """Initialize monitoring components."""
    logger.info("Setting up monitoring...")

    # Update initial system metrics
    update_system_metrics()

    # Schedule periodic metric updates
    from django_cron import CronJobBase, Schedule

    class UpdateMetricsJob(CronJobBase):
        schedule = Schedule(run_every_mins=1)
        code = "api.monitoring.update_metrics"

        def do(self):
            update_system_metrics()
            check_alerts()

    logger.info("Monitoring setup complete")
