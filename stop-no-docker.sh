#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping all aisreact services...${NC}"

# Kill processes on specific ports
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✓ Stopped backend server" || echo "- Backend server not running"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✓ Stopped frontend server" || echo "- Frontend server not running"

# Kill celery workers
pkill -f "celery.*aisreact" 2>/dev/null && echo "✓ Stopped Celery workers" || echo "- Celery workers not running"

echo -e "${GREEN}All services stopped!${NC}"
echo ""
echo "PostgreSQL and Redis are still running (to save startup time)."
echo "To stop them:"
echo "  brew services stop postgresql@15"
echo "  brew services stop redis"