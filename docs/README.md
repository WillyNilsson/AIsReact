# AIsReact Documentation

Welcome to the AIsReact documentation! This directory contains comprehensive guides for developers, operators, and contributors.

## 📚 Documentation Index

### Getting Started

- **[Development Guide](./DEVELOPMENT.md)** - Set up your local development environment
- **[Architecture Overview](./ARCHITECTURE.md)** - Understand the system design and components

### API & Integration

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Authentication](./API_DOCUMENTATION.md#authentication)** - JWT authentication flow
- **[Rate Limiting](./API_DOCUMENTATION.md#rate-limiting)** - API usage limits

### Deployment & Operations

- **[Quick Deploy Guide](./QUICK_DEPLOY_GUIDE.md)** - Deploy to production quickly
- **[Log Aggregation](./LOG_AGGREGATION.md)** - Logging strategies and monitoring

## 🚀 Quick Links

### For Developers

1. [Setting up locally](./DEVELOPMENT.md#quick-start)
2. [Running tests](./DEVELOPMENT.md#running-tests)
3. [Code style guide](./DEVELOPMENT.md#code-quality)
4. [Making contributions](./DEVELOPMENT.md#making-changes)

### For DevOps

1. [Render deployment](./QUICK_DEPLOY_GUIDE.md#rendercom-deployment)
2. [Environment variables](./QUICK_DEPLOY_GUIDE.md#environment-variables)
3. [Scaling strategies](./QUICK_DEPLOY_GUIDE.md#scaling)
4. [Monitoring setup](./LOG_AGGREGATION.md#production-logging)

### For API Users

1. [Authentication](./API_DOCUMENTATION.md#authentication)
2. [Creating posts](./API_DOCUMENTATION.md#create-post)
3. [Verification system](./API_DOCUMENTATION.md#verification-endpoints)
4. [Error handling](./API_DOCUMENTATION.md#error-responses)

## 📖 Documentation Overview

### [Development Guide](./DEVELOPMENT.md)

Everything you need to start developing:

- Prerequisites and setup
- Running the application locally
- Development workflow
- Testing strategies
- Common issues and solutions

### [Architecture Overview](./ARCHITECTURE.md)

Deep dive into the system design:

- Technology stack breakdown
- Component architecture
- Database schema
- Request flows
- Security architecture
- Performance optimizations

### [API Documentation](./API_DOCUMENTATION.md)

Complete REST API reference:

- Authentication endpoints
- User management
- Post creation and management
- Verification system
- Health checks
- Error responses

### [Quick Deploy Guide](./QUICK_DEPLOY_GUIDE.md)

Production deployment instructions:

- Platform-specific guides
- Environment configuration
- Infrastructure setup
- Post-deployment checklist
- Troubleshooting

### [Log Aggregation](./LOG_AGGREGATION.md)

Logging and monitoring strategies:

- Log architecture
- Aggregation services setup
- Analysis queries
- Alerting configuration
- Best practices

## 🔧 Technical Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Data fetching
- **Zustand** - State management

### Backend

- **Django 5.1** - Web framework
- **Django REST Framework** - API toolkit
- **Celery** - Task queue
- **PostgreSQL** - Primary database
- **Redis** - Cache and message broker

### Infrastructure

- **AWS S3** - File storage
- **Docker** - Containerization
- **Render/Heroku/AWS** - Deployment platforms

### AI Integrations

- OpenAI GPT-4o
- Anthropic Claude 3 Sonnet
- Google Gemini 2.0 Pro
- xAI Grok
- DeepSeek

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Read the [Development Guide](./DEVELOPMENT.md)
2. Understand the [Architecture](./ARCHITECTURE.md)
3. Check the [API Documentation](./API_DOCUMENTATION.md)
4. Follow the code style guidelines
5. Write tests for your changes
6. Submit a pull request

## 📞 Getting Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/aisreact/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/aisreact/discussions)
- **Email**: support@aisreact.com

## 🔄 Keeping Docs Updated

When making changes to the codebase:

- Update relevant documentation
- Add new sections as needed
- Remove outdated information
- Include examples where helpful

## 📝 License

This project is licensed under the Apache License 2.0. See the [LICENSE](../LICENSE) file for details.
