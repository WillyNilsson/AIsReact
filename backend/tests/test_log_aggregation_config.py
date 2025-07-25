"""
Tests for log aggregation configuration.
"""

import json
import os
from pathlib import Path

import yaml
from django.test import TestCase


class LogAggregationConfigTest(TestCase):
    """Test log aggregation configuration files."""

    def setUp(self):
        self.base_dir = Path(__file__).resolve().parent.parent.parent
        self.monitoring_dir = self.base_dir / "monitoring"

    def test_loki_config_valid_yaml(self):
        """Test that Loki config is valid YAML."""
        config_path = self.monitoring_dir / "loki-config.yml"
        self.assertTrue(config_path.exists(), f"Loki config not found at {config_path}")

        with open(config_path) as f:
            config = yaml.safe_load(f)

        # Check required sections
        self.assertIn("server", config)
        self.assertIn("schema_config", config)
        self.assertIn("storage_config", config)
        self.assertIn("limits_config", config)

        # Check server config
        self.assertEqual(config["server"]["http_listen_port"], 3100)

        # Check retention is set
        self.assertEqual(config["table_manager"]["retention_period"], "720h")

    def test_promtail_config_valid_yaml(self):
        """Test that Promtail config is valid YAML."""
        config_path = self.monitoring_dir / "promtail-config.yml"
        self.assertTrue(
            config_path.exists(), f"Promtail config not found at {config_path}"
        )

        with open(config_path) as f:
            config = yaml.safe_load(f)

        # Check required sections
        self.assertIn("server", config)
        self.assertIn("clients", config)
        self.assertIn("scrape_configs", config)

        # Check server config
        self.assertEqual(config["server"]["http_listen_port"], 9080)

        # Check Loki client config
        self.assertEqual(len(config["clients"]), 1)
        self.assertEqual(
            config["clients"][0]["url"], "http://loki:3100/loki/api/v1/push"
        )

        # Check scrape configs
        job_names = [job["job_name"] for job in config["scrape_configs"]]
        self.assertIn("docker", job_names)
        self.assertIn("aisreact-files", job_names)

    def test_docker_compose_logging_valid(self):
        """Test that docker-compose.logging.yml is valid."""
        compose_path = self.base_dir / "docker-compose.logging.yml"
        self.assertTrue(
            compose_path.exists(), f"Docker compose not found at {compose_path}"
        )

        with open(compose_path) as f:
            compose = yaml.safe_load(f)

        # Check services
        self.assertIn("services", compose)
        self.assertIn("loki", compose["services"])
        self.assertIn("promtail", compose["services"])
        self.assertIn("grafana-logging", compose["services"])

        # Check Loki service
        loki = compose["services"]["loki"]
        self.assertEqual(loki["image"], "grafana/loki:2.9.0")
        self.assertIn("3100:3100", loki["ports"])

        # Check Promtail service
        promtail = compose["services"]["promtail"]
        self.assertEqual(promtail["image"], "grafana/promtail:2.9.0")
        self.assertEqual(promtail["user"], "root")  # Required for Docker logs

        # Check volumes
        self.assertIn("volumes", compose)
        self.assertIn("loki_data", compose["volumes"])

    def test_grafana_datasource_config(self):
        """Test Grafana datasource provisioning."""
        datasource_path = (
            self.monitoring_dir / "grafana/provisioning/datasources/loki.yml"
        )
        self.assertTrue(
            datasource_path.exists(),
            f"Datasource config not found at {datasource_path}",
        )

        with open(datasource_path) as f:
            config = yaml.safe_load(f)

        self.assertEqual(config["apiVersion"], 1)
        self.assertEqual(len(config["datasources"]), 1)

        ds = config["datasources"][0]
        self.assertEqual(ds["name"], "Loki")
        self.assertEqual(ds["type"], "loki")
        self.assertEqual(ds["url"], "http://loki:3100")

    def test_grafana_dashboard_valid_json(self):
        """Test Grafana dashboard is valid JSON."""
        dashboard_path = (
            self.monitoring_dir / "grafana/provisioning/dashboards/aisreact-logs.json"
        )
        self.assertTrue(
            dashboard_path.exists(), f"Dashboard not found at {dashboard_path}"
        )

        with open(dashboard_path) as f:
            dashboard = json.load(f)

        # Check dashboard metadata
        self.assertEqual(dashboard["title"], "AIReact Logs Dashboard")
        self.assertEqual(dashboard["uid"], "aisreact-logs")

        # Check panels exist
        self.assertIn("panels", dashboard)
        self.assertGreater(len(dashboard["panels"]), 0)

        # Check for key panels
        panel_titles = [p["title"] for p in dashboard["panels"]]
        self.assertIn("Error Logs", panel_titles)
        self.assertIn("Security Events", panel_titles)
        self.assertIn("All Application Logs", panel_titles)

    def test_start_logging_script_exists(self):
        """Test that start-logging.sh script exists and is executable."""
        script_path = self.base_dir / "scripts/start-logging.sh"
        self.assertTrue(
            script_path.exists(), f"Start script not found at {script_path}"
        )

        # Check if executable
        self.assertTrue(os.access(script_path, os.X_OK), "Script is not executable")

        # Check script content
        with open(script_path) as f:
            content = f.read()

        # Check for key commands
        self.assertIn("docker-compose -f docker-compose.logging.yml up -d", content)
        self.assertIn("curl -f http://localhost:3100/ready", content)

    def test_log_aggregation_documentation_exists(self):
        """Test that log aggregation documentation exists."""
        doc_path = self.base_dir / "docs/LOG_AGGREGATION.md"
        self.assertTrue(doc_path.exists(), f"Documentation not found at {doc_path}")

        with open(doc_path) as f:
            content = f.read()

        # Check for key sections
        self.assertIn("## Overview", content)
        self.assertIn("## Quick Start", content)
        self.assertIn("## Configuration", content)
        self.assertIn("LogQL Query Examples", content)
