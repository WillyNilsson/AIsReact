#!/bin/bash
# Script to run production build locally with Docker

echo "🚀 Starting production build locally..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f backend/.env.production ]; then
    echo -e "${RED}❌ Error: backend/.env.production not found${NC}"
    echo "Creating from .env..."
    cp backend/.env backend/.env.production
    echo -e "${YELLOW}⚠️  Please update backend/.env.production with production values${NC}"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Build and start services
echo "🏗️  Building production images..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

# Check backend
if curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Check frontend
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
fi

echo ""
echo "🎉 Production build is running!"
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/api/docs/"
echo ""
echo "📋 View logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f [service]"
echo ""
echo "🛑 To stop:"
echo "   docker-compose -f docker-compose.prod.yml down"