"""
Management command to trace requests by ID.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = "Trace a request through logs by request ID"

    def add_arguments(self, parser):
        parser.add_argument("request_id", type=str, help="The request ID to search for")
        parser.add_argument(
            "--log-dir",
            type=str,
            default="/var/log/aisreact",
            help="Directory containing log files (default: /var/log/aisreact)",
        )
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Number of hours to search back (default: 24)",
        )
        parser.add_argument(
            "--format",
            type=str,
            choices=["json", "pretty", "raw"],
            default="pretty",
            help="Output format (default: pretty)",
        )

    def handle(self, *args, **options):
        request_id = options["request_id"]
        log_dir = Path(options["log_dir"])
        hours = options["hours"]
        output_format = options["format"]

        # Check if log directory exists
        if not log_dir.exists():
            # Try local logs directory
            log_dir = Path("logs")
            if not log_dir.exists():
                raise CommandError(
                    f"Log directory not found: {options['log_dir']} or ./logs"
                )

        self.stdout.write(f"Searching for request ID: {request_id}")
        self.stdout.write(f"Log directory: {log_dir}")
        self.stdout.write(f"Time range: last {hours} hours\n")

        # Find all log entries for this request
        entries = self.find_request_logs(request_id, log_dir, hours)

        if not entries:
            self.stdout.write(
                self.style.WARNING(f"No logs found for request ID: {request_id}")
            )
            return

        # Sort entries by timestamp
        entries.sort(key=lambda x: x.get("timestamp", ""))

        # Display results
        if output_format == "json":
            self.stdout.write(json.dumps(entries, indent=2))
        elif output_format == "raw":
            for entry in entries:
                self.stdout.write(entry.get("_raw", json.dumps(entry)))
        else:
            self.display_pretty(entries, request_id)

    def find_request_logs(self, request_id, log_dir, hours):
        """Find all log entries matching the request ID."""
        entries = []
        cutoff_time = timezone.now() - timedelta(hours=hours)

        # Search all .log files
        for log_file in log_dir.glob("*.log"):
            # Skip old rotated files
            if log_file.stat().st_mtime < cutoff_time.timestamp():
                continue

            try:
                with open(log_file, "r") as f:
                    for line in f:
                        if request_id in line:
                            try:
                                # Try to parse as JSON
                                entry = json.loads(line.strip())
                                entry["_source"] = log_file.name
                                entry["_raw"] = line.strip()
                                entries.append(entry)
                            except json.JSONDecodeError:
                                # Store raw line if not JSON
                                entries.append(
                                    {
                                        "_source": log_file.name,
                                        "_raw": line.strip(),
                                        "message": line.strip(),
                                    }
                                )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error reading {log_file}: {e}"))

        return entries

    def display_pretty(self, entries, request_id):
        """Display logs in a pretty, human-readable format."""
        self.stdout.write(
            self.style.SUCCESS(
                f"\nFound {len(entries)} log entries for request {request_id}\n"
            )
        )

        # Group by event type
        by_type = {}
        for entry in entries:
            event_type = entry.get("event_type", "other")
            if event_type not in by_type:
                by_type[event_type] = []
            by_type[event_type].append(entry)

        # Display request flow
        if "api_request" in by_type:
            self.display_request_info(by_type["api_request"][0])

        # Display timeline
        self.stdout.write(self.style.HTTP_INFO("\n📋 Timeline:"))
        self.stdout.write("-" * 80)

        for entry in entries:
            timestamp = entry.get("timestamp", entry.get("asctime", "Unknown"))
            level = entry.get("level", entry.get("levelname", "INFO"))
            message = entry.get("message", entry.get("msg", ""))
            event_type = entry.get("event_type", "")

            # Format timestamp
            if timestamp != "Unknown":
                try:
                    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                    timestamp = dt.strftime("%H:%M:%S.%f")[:-3]
                except (ValueError, AttributeError) as e:
                    # Keep original timestamp if parsing fails
                    self.stdout.write(
                        self.style.WARNING(
                            f"Could not parse timestamp '{timestamp}': {str(e)}"
                        )
                    )

            # Color based on level
            if level == "ERROR":
                level_style = self.style.ERROR
            elif level == "WARNING":
                level_style = self.style.WARNING
            else:
                level_style = self.style.HTTP_INFO

            # Special formatting for certain events
            if event_type == "slow_request":
                duration = entry.get("duration_seconds", 0)
                message = f"⚠️  Slow request: {duration:.2f}s"
            elif event_type == "api_error":
                error_type = entry.get("error_type", "Unknown")
                message = f"❌ {error_type}: {message}"
            elif event_type == "security":
                message = f"🔒 Security: {message}"

            self.stdout.write(f"{timestamp} [{level_style(level.ljust(7))}] {message}")

            # Show additional context
            if event_type and event_type not in ["api_request", "api_response"]:
                self.stdout.write(f"           Type: {event_type}")

            if "error_type" in entry:
                self.stdout.write(f"           Error: {entry['error_type']}")

            if "duration_seconds" in entry and event_type != "slow_request":
                self.stdout.write(
                    f"           Duration: {entry['duration_seconds']:.3f}s"
                )

        self.stdout.write("-" * 80)

        # Summary
        self.display_summary(entries)

    def display_request_info(self, request_entry):
        """Display initial request information."""
        self.stdout.write(self.style.HTTP_INFO("\n🌐 Request Information:"))
        self.stdout.write("-" * 80)

        method = request_entry.get("method", "Unknown")
        path = request_entry.get("path", "Unknown")
        user_id = request_entry.get("user_id", "Anonymous")
        ip = request_entry.get("ip_address", "Unknown")

        self.stdout.write(f"Method: {method}")
        self.stdout.write(f"Path: {path}")
        self.stdout.write(f"User: {user_id}")
        self.stdout.write(f"IP: {ip}")

        if "user_agent" in request_entry:
            ua = (
                request_entry["user_agent"][:80] + "..."
                if len(request_entry["user_agent"]) > 80
                else request_entry["user_agent"]
            )
            self.stdout.write(f"User Agent: {ua}")

    def display_summary(self, entries):
        """Display summary statistics."""
        self.stdout.write(self.style.SUCCESS("\n📊 Summary:"))

        # Count by level
        levels = {}
        for entry in entries:
            level = entry.get("level", entry.get("levelname", "UNKNOWN"))
            levels[level] = levels.get(level, 0) + 1

        for level, count in sorted(levels.items()):
            self.stdout.write(f"  {level}: {count}")

        # Find total duration
        durations = [
            e.get("duration_seconds", 0) for e in entries if "duration_seconds" in e
        ]
        if durations:
            total_duration = max(durations)
            self.stdout.write(f"\n  Total Duration: {total_duration:.3f}s")

        # Find final status
        status_codes = [e.get("status_code") for e in entries if "status_code" in e]
        if status_codes:
            final_status = status_codes[-1]
            self.stdout.write(f"  Final Status: {final_status}")

        # Check for errors
        errors = [
            e
            for e in entries
            if e.get("level") == "ERROR" or e.get("levelname") == "ERROR"
        ]
        if errors:
            self.stdout.write(self.style.ERROR(f"\n  ⚠️  {len(errors)} errors found!"))
