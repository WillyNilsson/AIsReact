"""Check database URL configuration."""

import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Show database configuration"

    def handle(self, *args, **options):
        # Show environment variable
        db_url = os.environ.get("DATABASE_URL", "NOT SET")
        self.stdout.write(f"DATABASE_URL env var: {db_url}")

        # Show Django settings
        db_config = settings.DATABASES["default"]
        self.stdout.write("\nDjango Database Config:")
        self.stdout.write(f"  ENGINE: {db_config.get('ENGINE', 'N/A')}")
        self.stdout.write(f"  NAME: {db_config.get('NAME', 'N/A')}")
        self.stdout.write(f"  HOST: {db_config.get('HOST', 'N/A')}")
        self.stdout.write(f"  PORT: {db_config.get('PORT', 'N/A')}")
        self.stdout.write(f"  USER: {db_config.get('USER', 'N/A')}")
