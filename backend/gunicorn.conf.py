"""
Gunicorn configuration for production deployment
Optimized for low memory usage on Render free tier (512MB)
"""

import os

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
backlog = 2048

# Worker processes
# Use only 1 worker for 512MB memory constraint
workers = 1
worker_class = "sync"  # Use sync worker instead of gthread to save memory
worker_connections = 100
max_requests = 500  # Restart workers after 500 requests to prevent memory leaks
max_requests_jitter = 50
timeout = 120
graceful_timeout = 30
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "aisreact-backend"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL - handled by Render's proxy
keyfile = None
certfile = None

# Debugging
reload = False
reload_engine = "auto"
reload_extra_files = []
spew = False
check_config = False
print_config = False

# Memory optimization
preload_app = True  # Load app before forking to save memory


def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker initialized (pid: %s)", worker.pid)


def worker_int(worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    worker.log.info("Worker received SIGINT/SIGQUIT")


def worker_abort(worker):
    """Called when a worker received the SIGABRT signal."""
    worker.log.info("Worker received SIGABRT")
