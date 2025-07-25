#!/usr/bin/env python3
"""
Generate coverage badge for README.
Following Guardian standards - accurate coverage reporting.
"""
import re
import subprocess
import sys


def get_coverage_percentage():
    """Get the current test coverage percentage."""
    try:
        # Run coverage report
        result = subprocess.run(
            ["python", "-m", "coverage", "report"], capture_output=True, text=True
        )

        if result.returncode != 0:
            print("Error running coverage report")
            return None

        # Parse the output for TOTAL line
        for line in result.stdout.split("\n"):
            if "TOTAL" in line:
                # Extract percentage from line like "TOTAL    1234   567    54%"
                match = re.search(r"(\d+)%", line)
                if match:
                    return int(match.group(1))

        return None
    except Exception as e:
        print(f"Error getting coverage: {e}")
        return None


def get_badge_color(percentage):
    """Get badge color based on coverage percentage."""
    if percentage >= 80:
        return "brightgreen"
    elif percentage >= 60:
        return "yellow"
    elif percentage >= 40:
        return "orange"
    else:
        return "red"


def generate_badge_url(percentage):
    """Generate shields.io badge URL."""
    color = get_badge_color(percentage)
    return f"https://img.shields.io/badge/coverage-{percentage}%25-{color}"


def main():
    """Main function."""
    print("Generating coverage badge...")

    # Get coverage percentage
    percentage = get_coverage_percentage()

    if percentage is None:
        print("Failed to get coverage percentage")
        sys.exit(1)

    print(f"Current coverage: {percentage}%")

    # Generate badge URL
    badge_url = generate_badge_url(percentage)
    print(f"Badge URL: {badge_url}")

    # Generate markdown
    badge_markdown = f"![Coverage]({badge_url})"
    print(f"\nMarkdown for README:")
    print(badge_markdown)

    # Save to file
    with open("coverage_badge.md", "w") as f:
        f.write(badge_markdown + "\n")

    print("\nBadge markdown saved to coverage_badge.md")

    # Check if target met
    if percentage >= 80:
        print(f"✅ Coverage target of 80% met! ({percentage}%)")
        return 0
    else:
        print(f"❌ Coverage target of 80% not met ({percentage}%)")
        return 1


if __name__ == "__main__":
    sys.exit(main())
