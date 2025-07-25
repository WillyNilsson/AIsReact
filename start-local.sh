#!/bin/bash
# Local development startup script - runs services natively for faster iteration

echo "🚀 Starting aisreact local development environment..."
echo "==============================="

# Check if backend/.env exists
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env file not found!"
    echo "Please create backend/.env with your configuration."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Start only PostgreSQL and Redis in Docker
echo "📦 Starting PostgreSQL and Redis in Docker..."
docker-compose up -d postgres redis

# Wait for services to be healthy
echo "⏳ Waiting for database services..."
sleep 5

# Check if Python venv exists
if [ ! -d "backend/venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# Check if Node modules exist
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Function to open new terminal window
open_terminal() {
    local title=$1
    local command=$2
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"echo '🚀 $title' && $command\""
    else
        # Linux - try various terminal emulators
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal --title="$title" -- bash -c "$command; exec bash"
        elif command -v konsole &> /dev/null; then
            konsole --title="$title" -e bash -c "$command; exec bash"
        elif command -v xterm &> /dev/null; then
            xterm -title "$title" -e bash -c "$command; exec bash"
        else
            echo "⚠️  Could not find a terminal emulator. Please run manually:"
            echo "   $command"
        fi
    fi
}

# Start backend
echo "🔧 Starting backend server..."
open_terminal "aisreact Backend" "cd $(pwd)/backend && source venv/bin/activate && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"

# Give backend time to start
sleep 3

# Start worker
echo "⚙️  Starting background worker..."
open_terminal "aisreact Worker" "cd $(pwd)/backend && source venv/bin/activate && celery -A aisreact worker --loglevel=info"

# Start frontend
echo "🎨 Starting frontend..."
open_terminal "aisreact Frontend" "cd $(pwd)/frontend && npm run dev"

echo ""
echo "✅ Local development environment started!"
echo ""
echo "Services running at:"
echo "  📦 PostgreSQL: localhost:5432"
echo "  📦 Redis: localhost:6379"
echo "  🔧 Backend API: http://localhost:8000"
echo "  📚 API Docs: http://localhost:8000/docs"
echo "  🎨 Frontend: http://localhost:3000"
echo ""
echo "To stop all services:"
echo "  1. Close the terminal windows (Ctrl+C in each)"
echo "  2. Run: docker-compose down"
echo ""
echo "For faster development:"
echo "  - Backend auto-reloads on file changes"
echo "  - Frontend has hot module replacement"
echo "  - No Docker rebuild needed for code changes"