#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting aisreact without Docker...${NC}"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${RED}PostgreSQL is not running!${NC}"
    echo "Start it with: brew services start postgresql@14"
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}Redis is not running!${NC}"
    echo "Start it with: brew services start redis"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL and Redis are running${NC}"

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw aisreact; then
    echo -e "${BLUE}Creating database...${NC}"
    createdb aisreact
    psql aisreact -c "CREATE USER aisreact WITH PASSWORD 'aisreact';" 2>/dev/null || true
    psql aisreact -c "GRANT ALL PRIVILEGES ON DATABASE aisreact TO aisreact;" 2>/dev/null || true
fi

# Function to open new terminal tab and run command
open_new_tab() {
    osascript -e "tell application \"Terminal\" to do script \"cd $PWD && $1\""
}

# Kill any existing processes on our ports
echo -e "${BLUE}Cleaning up old processes...${NC}"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start Backend
echo -e "${BLUE}Starting Backend...${NC}"
open_new_tab "cd backend && source venv/bin/activate && python manage.py migrate && python manage.py runserver"

# Wait a bit for backend to start
sleep 3

# Start Celery Worker
echo -e "${BLUE}Starting Celery Worker...${NC}"
open_new_tab "cd backend && source venv/bin/activate && celery -A aisreact worker -l info"

# Start Frontend
echo -e "${BLUE}Starting Frontend...${NC}"
open_new_tab "cd frontend && npm run dev"

echo -e "${GREEN}✓ All services starting!${NC}"
echo ""
echo "Access the app at:"
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}Backend API:${NC} http://localhost:8000/api/"
echo -e "${BLUE}Django Admin:${NC} http://localhost:8000/admin/"
echo ""
echo "To stop all services:"
echo "1. Close all Terminal tabs"
echo "2. Or run: ${BLUE}./stop-no-docker.sh${NC}"