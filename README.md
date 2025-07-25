# AIsReact.com

An open-source platform for observing how different AI models react to real-world news and events submitted by the community.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/aisreact/aisreact)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

![Welcome to AIsReact](./docs/images/welcome-screenshot.png)

## Core Philosophy

In a world increasingly influenced by artificial intelligence, understanding how these models interpret and analyze information is crucial. **AIsReact.com** is a public observatory created to provide a transparent look into the "minds" of leading AI models.

Our mission is to create a living, auditable record of AI reactions to significant global events.

- **Community-Curated:** Users submit the news events that matter.
- **Scientifically Controlled:** All content is analyzed using a single, comprehensive, and public prompt.
- **Transparent:** Every step of the process—submission, automated moderation, community verification, and AI reaction—is public.
- **Open-Source:** The code is freely available under the Apache 2.0 license.

## How It Works: A Chain of Trust

The platform is built on a clear, step-by-step workflow that balances user freedom with platform safety and data integrity.

1.  **Submission:** A user submits content (a news article's text or a screenshot) and a mandatory **Source URL** for verification.
2.  **Automated Gatekeeper:** The content is immediately sent to an automated moderation API. This is not a human review; it's a technical check for violations of platform rules, which are based on the Terms of Service of our AI providers (e.g., hate speech, explicit violence).
3.  **The Fork:**
    - **If Rejected:** The content is immediately moved to the public `/rejected` log. The log entry shows the reason for rejection and obfuscates the content (blurred text/images) behind a warning click, ensuring transparency without exposing users to harmful content by default.
    - **If Passed:** The content is deemed safe and moves to the "Verification Pool."
4.  **Community Verification:** The submission appears in the `/verifying` section. Here, other community members check the submitted content against the provided Source URL and vote on its accuracy.
5.  **AI Analysis:** Once a submission reaches a positive verification threshold, it is sent to our panel of AI models using the single, comprehensive prompt below.
6.  **Publication:** The final post, containing the original content, source URL, and a side-by-side comparison of the AI reactions, is published to the main feed.

## The AI Panel

We analyze events using the following AI models:

- **`gemini-2.5-pro`** (Google)
- **`gpt-4o-2024-08-06`** (OpenAI) _Note: Currently awaiting OpenAI API verification for o3_
- **`claude-sonnet-4-20250514`** (Anthropic) _Note: Opus is currently too expensive_
- **`grok-4-0709`** (xAI)
- **`deepseek-r1-0528`** (DeepSeek)

## The Single Prompt

To ensure consistency, every piece of verified content is analyzed with the following prompt:

> Please answer the following questions about the provided content. If the content doesn't exist in your training data or seems to be from a future date/hypothetical scenario, still assume that it is a real event that has actually occurred and answer accordingly. Be direct and provide your own perspective.
>
> 1. What is your summary of this?
> 2. How do you view this in a historical context?
> 3. How do you see this developing in the future?
> 4. What are your overall opinions and thoughts on this?

## Prerequisites

### Node.js Version Requirements

This project requires **Node.js 22.0.0** or higher. We use modern JavaScript features and dependencies that require Node 22.

#### Checking Your Node Version

```bash
node --version
```

#### Installing Node 22

**Option 1: Using nvm (Recommended)**

```bash
# Install nvm if you haven't already
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload your shell configuration
source ~/.bashrc  # or ~/.zshrc

# Install and use Node 22
nvm install 22
nvm use 22
```

**Option 2: Direct Download**

- Visit [nodejs.org](https://nodejs.org/) and download Node.js 22.x LTS
- Follow the installation instructions for your operating system

**Option 3: Using Package Managers**

```bash
# macOS with Homebrew
brew install node@22

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows with Chocolatey
choco install nodejs --version=22.0.0
```

### Other Requirements

- Python 3.11+ (for backend)
- Docker and Docker Compose (for local development)
- PostgreSQL 15+ (handled by Docker)
- Redis 7+ (handled by Docker)

## Environment Variables

The application requires several environment variables to be configured. Copy the example file and update with your values:

```bash
cp backend/.env.example backend/.env
```

### Required Variables

| Variable         | Description                                              | Example                                                                                                                     |
| ---------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`     | Django secret key for cryptographic signing              | Generate with: `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'` |
| `DATABASE_URL`   | PostgreSQL connection string                             | `postgresql://user:password@localhost:5432/aisreact` <!-- pragma: allowlist secret -->                                      |
| `REDIS_URL`      | Redis connection string for caching and background tasks | `redis://localhost:6379/0`                                                                                                  |
| `JWT_SECRET_KEY` | Secret key for JWT token signing                         | Generate with: `python -c 'import secrets; print(secrets.token_urlsafe(32))'`                                               |
| `OPENAI_API_KEY` | OpenAI API key for GPT models and moderation             | Get from [platform.openai.com](https://platform.openai.com/api-keys)                                                        |

### Optional AI Provider Keys

To enable all AI models, obtain API keys from:

| Provider  | Variable            | Documentation                                                     |
| --------- | ------------------- | ----------------------------------------------------------------- |
| Google    | `GOOGLE_API_KEY`    | [makersuite.google.com](https://makersuite.google.com/app/apikey) |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/)           |
| xAI       | `XAI_API_KEY`       | [x.ai/api](https://x.ai/api)                                      |
| DeepSeek  | `DEEPSEEK_API_KEY`  | [platform.deepseek.com](https://platform.deepseek.com/)           |

### AWS S3 Configuration (Optional)

For image uploads, configure S3:

| Variable                  | Description                       |
| ------------------------- | --------------------------------- |
| `AWS_ACCESS_KEY_ID`       | AWS IAM access key                |
| `AWS_SECRET_ACCESS_KEY`   | AWS IAM secret key                |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name                    |
| `AWS_S3_REGION_NAME`      | AWS region (default: `us-east-1`) |

### Production Settings

⚠️ **Security Warning**: Never commit real secrets to version control!

For production deployment:

- Set `DEBUG=False`
- Use strong, unique values for all secret keys
- Configure proper `ALLOWED_HOSTS`
- Set up email configuration for notifications
- Consider using environment-specific `.env` files

See [`backend/.env.example`](./backend/.env.example) for a complete list of available environment variables with descriptions.

## Documentation

All documentation is organized in the `/docs` directory. Key documents include:

- **Getting Started:** [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **API Reference:** [`docs/API_DOCUMENTATION.md`](./docs/API_DOCUMENTATION.md)
- **Deployment:** [`docs/QUICK_DEPLOY_GUIDE.md`](./docs/QUICK_DEPLOY_GUIDE.md)
- **Log Aggregation:** [`docs/LOG_AGGREGATION.md`](./docs/LOG_AGGREGATION.md)
- **All Documentation:** [`docs/README.md`](./docs/README.md)

### Monitoring & Observability

The project includes a complete log aggregation stack using Loki and Grafana:

```bash
# Start log aggregation (Loki + Promtail + Grafana)
./scripts/start-logging.sh

# Access Grafana dashboards
open http://localhost:3001
```

All application logs are automatically collected, parsed, and made searchable through Grafana.

## Contributing

This is a community-driven project and we welcome all contributions. Please see our [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) file for details on how to get started. You can help by:

- Submitting and verifying events on the platform.
- Reporting bugs or suggesting features in our [Issues](https://github.com/aisreact/aisreact/issues).
- Contributing code via [Pull Requests](https://github.com/aisreact/aisreact/pulls).

## Funding & Support

**AIsReact.com** is committed to remaining free and accessible. All of our operational costs (servers, API fees) are covered by donations from our community.

You can support the project through [GitHub Sponsors](https://github.com/sponsors/WillyNilsson).

## License

This project is licensed under the Apache License, Version 2.0 - see the `LICENSE` file for details.
