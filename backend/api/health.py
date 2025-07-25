"""
Enhanced health check endpoints for comprehensive monitoring.
"""

import os
import platform
import time

import boto3
import psutil
import redis
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views import View


class HealthCheckView(View):
    """Basic health check endpoint for load balancers."""

    def get(self, request, *args, **kwargs):
        return JsonResponse(
            {
                "status": "healthy",
                "service": "aisreact-backend",
                "timestamp": int(time.time()),
            }
        )


class DetailedHealthCheckView(View):
    """Comprehensive health check with system and dependency status."""

    def get(self, request, *args, **kwargs):
        start_time = time.time()

        health_status = {
            "status": "healthy",
            "service": "aisreact-backend",
            "version": self.get_version(),
            "timestamp": int(time.time()),
            "uptime_seconds": self.get_uptime(),
            "environment": settings.DEBUG and "development" or "production",
            "checks": {},
            "metrics": {},
            "system": self.get_system_info(),
        }

        # Run all health checks
        self.check_database(health_status)
        self.check_redis(health_status)
        self.check_s3(health_status)
        self.check_ai_providers(health_status)
        self.check_celery(health_status)
        self.check_disk_space(health_status)
        self.check_memory(health_status)
        self.check_recent_errors(health_status)

        # Add response time
        health_status["response_time_ms"] = round((time.time() - start_time) * 1000, 2)

        # Determine overall status
        self.determine_overall_status(health_status)

        # Set appropriate HTTP status code
        status_code = 200 if health_status["status"] == "healthy" else 503

        return JsonResponse(health_status, status=status_code)

    def get_version(self):
        """Get application version from git or environment."""
        version = os.environ.get("APP_VERSION", "unknown")
        if version == "unknown" and os.path.exists(".git"):
            try:
                import subprocess

                version = subprocess.check_output(
                    ["git", "rev-parse", "--short", "HEAD"], text=True
                ).strip()
            except (subprocess.CalledProcessError, FileNotFoundError):
                # Git not available or not in a git repository
                pass
        return version

    def get_uptime(self):
        """Calculate application uptime."""
        # This would typically be tracked from application start
        # For now, use system uptime as a proxy
        try:
            return int(time.time() - psutil.boot_time())
        except (AttributeError, OSError):
            # psutil not available or system call failed
            return 0

    def get_system_info(self):
        """Get system information."""
        try:
            return {
                "hostname": platform.node(),
                "platform": platform.system(),
                "python_version": platform.python_version(),
                "cpu_count": psutil.cpu_count(),
                "total_memory_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            }
        except (AttributeError, OSError):
            # System information not available
            return {}

    def check_database(self, health_status):
        """Check database connectivity and performance."""
        try:
            start = time.time()
            with connection.cursor() as cursor:
                # Basic connectivity check
                cursor.execute("SELECT 1")

                # Get database statistics
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) as connection_count
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                """
                )
                stats = cursor.fetchone()

                # Check migrations
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM django_migrations
                """
                )
                migration_count = cursor.fetchone()[0]

            response_time = (time.time() - start) * 1000

            health_status["checks"]["database"] = {
                "status": "healthy",
                "response_time_ms": round(response_time, 2),
                "connection_count": stats[0] if stats else 0,
                "migrations_applied": migration_count,
                "backend": connection.vendor,
            }
        except Exception as e:
            health_status["checks"]["database"] = {
                "status": "unhealthy",
                "error": str(e),
            }
            health_status["status"] = "unhealthy"

    def check_redis(self, health_status):
        """Check Redis connectivity and performance."""
        try:
            start = time.time()

            # Test basic operations
            test_key = f"health_check_{int(time.time())}"
            cache.set(test_key, "test_value", 10)
            value = cache.get(test_key)
            cache.delete(test_key)

            if value != "test_value":
                raise ValueError("Cache read/write test failed")

            # Get Redis info if possible
            redis_info = {}
            try:
                redis_client = cache._cache.get_client()
                info = redis_client.info()
                redis_info = {
                    "version": info.get("redis_version", "unknown"),
                    "connected_clients": info.get("connected_clients", 0),
                    "used_memory_mb": round(info.get("used_memory", 0) / (1024**2), 2),
                    "uptime_days": round(info.get("uptime_in_seconds", 0) / 86400, 2),
                }
            except (AttributeError, redis.RedisError):
                # Redis client details not accessible
                pass

            response_time = (time.time() - start) * 1000

            health_status["checks"]["redis"] = {
                "status": "healthy",
                "response_time_ms": round(response_time, 2),
                **redis_info,
            }
        except Exception as e:
            health_status["checks"]["redis"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"

    def check_s3(self, health_status):
        """Check S3 configuration and connectivity."""
        if not hasattr(settings, "AWS_ACCESS_KEY_ID") or not settings.AWS_ACCESS_KEY_ID:
            health_status["checks"]["s3"] = {"status": "not_configured"}
            return

        try:
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME,
            )

            # Check bucket access
            bucket_name = settings.AWS_STORAGE_BUCKET_NAME
            s3_client.head_bucket(Bucket=bucket_name)

            # Get bucket size estimate
            s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)

            health_status["checks"]["s3"] = {
                "status": "healthy",
                "bucket": bucket_name,
                "region": settings.AWS_S3_REGION_NAME,
                "accessible": True,
            }
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            health_status["checks"]["s3"] = {
                "status": "unhealthy",
                "error": f"AWS Error: {error_code}",
                "bucket": settings.AWS_STORAGE_BUCKET_NAME,
            }
        except Exception as e:
            health_status["checks"]["s3"] = {"status": "unhealthy", "error": str(e)}

    def check_ai_providers(self, health_status):
        """Check AI provider configuration."""
        providers = {
            "openai": bool(getattr(settings, "OPENAI_API_KEY", None)),
            "anthropic": bool(getattr(settings, "ANTHROPIC_API_KEY", None)),
            "google": bool(getattr(settings, "GOOGLE_API_KEY", None)),
            "deepseek": bool(getattr(settings, "DEEPSEEK_API_KEY", None)),
            "xai": bool(getattr(settings, "XAI_API_KEY", None)),
        }

        configured_providers = [
            name for name, configured in providers.items() if configured
        ]

        health_status["checks"]["ai_providers"] = {
            "status": "healthy" if configured_providers else "degraded",
            "configured": configured_providers,
            "count": len(configured_providers),
            "all_providers": list(providers.keys()),
        }

        if not configured_providers:
            health_status["status"] = "degraded"

    def check_celery(self, health_status):
        """Check Celery worker status."""
        try:
            # Check if Celery is configured
            if not hasattr(settings, "CELERY_BROKER_URL"):
                health_status["checks"]["celery"] = {"status": "not_configured"}
                return

            # Get active tasks count from Redis
            active_tasks = 0
            try:
                redis_client = redis.from_url(settings.CELERY_BROKER_URL)
                for _key in redis_client.scan_iter("celery-task-meta-*"):
                    active_tasks += 1
            except (redis.RedisError, ConnectionError):
                # Redis connection failed
                pass

            health_status["checks"]["celery"] = {
                "status": "healthy",
                "broker": "redis",
                "active_tasks": active_tasks,
            }
        except Exception as e:
            health_status["checks"]["celery"] = {"status": "unknown", "error": str(e)}

    def check_disk_space(self, health_status):
        """Check available disk space."""
        try:
            disk_usage = psutil.disk_usage("/")

            # Warning if less than 20% free, critical if less than 10%
            if disk_usage.percent > 90:
                status = "critical"
                health_status["status"] = "degraded"
            elif disk_usage.percent > 80:
                status = "warning"
            else:
                status = "healthy"

            health_status["checks"]["disk_space"] = {
                "status": status,
                "used_percent": disk_usage.percent,
                "free_gb": round(disk_usage.free / (1024**3), 2),
                "total_gb": round(disk_usage.total / (1024**3), 2),
            }
        except Exception as e:
            health_status["checks"]["disk_space"] = {
                "status": "unknown",
                "error": str(e),
            }

    def check_memory(self, health_status):
        """Check memory usage."""
        try:
            memory = psutil.virtual_memory()

            # Warning if less than 20% free, critical if less than 10%
            if memory.percent > 90:
                status = "critical"
                health_status["status"] = "degraded"
            elif memory.percent > 80:
                status = "warning"
            else:
                status = "healthy"

            health_status["checks"]["memory"] = {
                "status": status,
                "used_percent": memory.percent,
                "available_gb": round(memory.available / (1024**3), 2),
                "total_gb": round(memory.total / (1024**3), 2),
            }
        except Exception as e:
            health_status["checks"]["memory"] = {"status": "unknown", "error": str(e)}

    def check_recent_errors(self, health_status):
        """Check for recent application errors."""
        try:
            # Check for recent errors in the database
            # (if error logging table exists)
            error_count = 0
            recent_errors = []

            # This is a placeholder - implement based on your
            # error logging strategy. You might check log files,
            # error tracking service, or database

            health_status["metrics"]["recent_errors"] = {
                "count_last_hour": error_count,
                "recent": recent_errors[:5],  # Last 5 errors
            }
        except Exception:
            # Error tracking not available
            pass

    def determine_overall_status(self, health_status):
        """Determine overall health status based on individual checks."""
        critical_services = ["database"]
        important_services = ["redis", "s3"]

        # Check critical services
        for service in critical_services:
            if (
                service in health_status["checks"]
                and health_status["checks"][service].get("status") == "unhealthy"
            ):
                health_status["status"] = "unhealthy"
                return

        # Check important services
        degraded_count = 0
        for service in important_services:
            if (
                service in health_status["checks"]
                and health_status["checks"][service].get("status") == "unhealthy"
            ):
                degraded_count += 1

        if degraded_count > 0:
            health_status["status"] = "degraded"

        # Check system resources
        for resource in ["disk_space", "memory"]:
            if (
                resource in health_status["checks"]
                and health_status["checks"][resource].get("status") == "critical"
            ):
                health_status["status"] = "degraded"


class ReadinessCheckView(View):
    """Kubernetes readiness probe endpoint."""

    def get(self, request, *args, **kwargs):
        # Check if the application is ready to serve requests
        try:
            # Check database
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

            # Check Redis
            cache.set("readiness_check", "ok", 10)

            return JsonResponse({"status": "ready"})
        except Exception as e:
            return JsonResponse({"status": "not_ready", "error": str(e)}, status=503)


class LivenessCheckView(View):
    """Kubernetes liveness probe endpoint."""

    def get(self, request, *args, **kwargs):
        # Simple check to ensure the application is alive
        return JsonResponse({"status": "alive"})
