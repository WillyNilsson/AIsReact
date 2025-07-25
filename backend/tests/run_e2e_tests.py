#!/usr/bin/env python
"""
Script to run E2E tests with proper Django setup.
"""

import os
import sys

import django
from django.conf import settings
from django.test.utils import get_runner

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aisreact.settings")
    django.setup()

    # Run E2E tests only
    from django.core.management import execute_from_command_line

    # Run with coverage if requested
    if "--coverage" in sys.argv:
        sys.argv.remove("--coverage")
        execute_from_command_line(
            [
                "manage.py",
                "test",
                "--parallel",
                "auto",
                "--keepdb",
                "--verbosity=2",
                "tests.test_e2e_auth",
                "tests.test_e2e_posts",
                "tests.test_e2e_verification",
            ]
        )
    else:
        # Run pytest with E2E marker
        import pytest

        sys.exit(
            pytest.main(
                [
                    "-v",
                    "-m",
                    "e2e",
                    "--tb=short",
                    "tests/",
                    "--no-migrations",
                    "--reuse-db",
                ]
            )
        )
