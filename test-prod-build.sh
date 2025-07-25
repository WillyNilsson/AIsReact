#!/bin/bash
# Test production build locally

echo "🧪 Testing production build..."

# First, let's make sure we have all required environment variables
echo "📋 Checking environment variables..."

# Check if .env.production has required values
if ! grep -q "OPENAI_API_KEY=sk-" backend/.env.production; then
    echo "⚠️  Warning: OPENAI_API_KEY not set in backend/.env.production"
    echo "   AI analysis won't work without at least one AI provider key"
fi

# Build the images first
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker images built successfully!"
echo ""
echo "To run the production build:"
echo "  ./run-prod-local.sh"
echo ""
echo "Note: Make sure you have updated backend/.env.production with:"
echo "  - DEBUG=False"
echo "  - A secure SECRET_KEY"
echo "  - At least one AI provider API key"
echo "  - Proper ALLOWED_HOSTS"