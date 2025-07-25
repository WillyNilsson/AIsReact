#!/usr/bin/env bash

# aisreact.com Setup Script
# This script handles the complete setup process for the project

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Print colored output
print_color() {
    color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Print section header
print_header() {
    echo
    print_color "$BLUE" "════════════════════════════════════════════════════════════"
    print_color "$BOLD" "$1"
    print_color "$BLUE" "════════════════════════════════════════════════════════════"
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    case "$OSTYPE" in
        darwin*)  echo "macOS" ;;
        linux*)   echo "Linux" ;;
        msys*|cygwin*|mingw*) echo "Windows" ;;
        *)        echo "unknown" ;;
    esac
}

OS=$(detect_os)

print_header "Welcome to aisreact.com Setup"
print_color "$GREEN" "This script will help you set up the development environment."
print_color "$YELLOW" "Detected OS: $OS"

# Check Node.js version
print_header "Checking Node.js Version"

if ! command_exists node; then
    print_color "$RED" "❌ Node.js is not installed!"
    print_color "$YELLOW" "Please install Node.js 22.0.0 or higher."
    
    case "$OS" in
        macOS)
            echo
            print_color "$BLUE" "Installation options for macOS:"
            echo "1. Using Homebrew (if installed):"
            echo "   brew install node@22"
            echo
            echo "2. Using nvm (recommended):"
            echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "   source ~/.zshrc"
            echo "   nvm install 22"
            echo
            echo "3. Download from https://nodejs.org/"
            ;;
        Linux)
            echo
            print_color "$BLUE" "Installation options for Linux:"
            echo "1. Using nvm (recommended):"
            echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "   source ~/.bashrc"
            echo "   nvm install 22"
            echo
            echo "2. Using NodeSource (Ubuntu/Debian):"
            echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
            echo "   sudo apt-get install -y nodejs"
            ;;
        Windows)
            echo
            print_color "$BLUE" "Installation options for Windows:"
            echo "1. Download from https://nodejs.org/"
            echo "2. Using Chocolatey: choco install nodejs --version=22.0.0"
            echo "3. Using nvm-windows from: https://github.com/coreybutler/nvm-windows"
            ;;
    esac
    
    exit 1
fi


# Check Node.js version (22.0.0 or higher required)
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt 22 ]; then
    print_color "$RED" "❌ Node.js version $NODE_VERSION is too old!"
    print_color "$YELLOW" "This project requires Node.js 22.0.0 or higher."
    
    if command_exists nvm; then
        print_color "$YELLOW" "You have nvm installed. Run: nvm install 22"
    fi
    exit 1
else
    print_color "$GREEN" "✅ Node.js $NODE_VERSION is installed"
fi

# Check Python
print_header "Checking Python"

if ! command_exists python3; then
    print_color "$RED" "❌ Python 3 is not installed!"
    print_color "$YELLOW" "Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
print_color "$GREEN" "✅ Python $PYTHON_VERSION is installed"

# Check Docker
print_header "Checking Docker"

if ! command_exists docker; then
    print_color "$YELLOW" "⚠️  Docker is not installed!"
    print_color "$YELLOW" "Docker is required for PostgreSQL and Redis."
    print_color "$YELLOW" "Install Docker from: https://docs.docker.com/get-docker/"
    echo
    read -p "Do you want to continue without Docker? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_color "$GREEN" "✅ Docker is installed"
    
    if ! command_exists docker-compose; then
        print_color "$YELLOW" "⚠️  docker-compose is not installed!"
        print_color "$YELLOW" "Installing docker-compose is recommended."
    else
        print_color "$GREEN" "✅ docker-compose is installed"
    fi
fi

# Install dependencies
print_header "Installing Dependencies"

# Check if pnpm is available
if ! command_exists pnpm; then
    print_color "$YELLOW" "⚠️  pnpm is not installed!"
    print_color "$YELLOW" "Installing pnpm globally..."
    npm install -g pnpm
    
    if ! command_exists pnpm; then
        print_color "$RED" "❌ Failed to install pnpm!"
        print_color "$YELLOW" "Please install pnpm manually: npm install -g pnpm"
        exit 1
    fi
    print_color "$GREEN" "✅ pnpm installed successfully"
else
    print_color "$GREEN" "✅ pnpm is already installed"
fi

# Install root dependencies
print_color "$YELLOW" "Installing root dependencies..."
pnpm install

# Install pre-commit hooks
print_header "Setting up Code Quality Tools"

print_color "$YELLOW" "Installing pre-commit hooks..."
if command_exists pre-commit; then
    pre-commit install
    pre-commit install --hook-type commit-msg
    print_color "$GREEN" "✅ Pre-commit hooks installed successfully"
    print_color "$YELLOW" "Pre-commit will now run automatically on git commit"
else
    print_color "$YELLOW" "⚠️  pre-commit not found. Installing..."
    pip install --user pre-commit
    if command_exists pre-commit; then
        pre-commit install
        pre-commit install --hook-type commit-msg
        print_color "$GREEN" "✅ Pre-commit hooks installed successfully"
    else
        print_color "$YELLOW" "⚠️  Could not install pre-commit hooks. You can install them manually with:"
        echo "   pip install pre-commit"
        echo "   pre-commit install"
        echo "   pre-commit install --hook-type commit-msg"
    fi
fi

# Setup backend
print_header "Setting up Backend"

cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    print_color "$YELLOW" "Creating Python virtual environment..."
    python3 -m venv venv
else
    print_color "$GREEN" "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
print_color "$YELLOW" "Installing backend dependencies..."
if [ "$OS" = "Windows" ]; then
    ./venv/Scripts/activate && pip install -r requirements.txt
else
    source venv/bin/activate && pip install -r requirements.txt
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_color "$YELLOW" "Creating backend .env file..."
    cp .env.example .env 2>/dev/null || {
        print_color "$YELLOW" "No .env.example found. Creating basic .env file..."
        cat > .env << EOL
# Django settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///db.sqlite3

# Redis (for Celery)
REDIS_URL=redis://localhost:6379

# AI Provider API Keys (add your own)
OPENAI_API_KEY=
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
XAI_API_KEY=
DEEPSEEK_API_KEY=

# AWS S3 (optional for development)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=us-east-1

# Email (optional for development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=noreply@aisreact.com
EOL
    }
    print_color "$GREEN" "✅ Created .env file"
    print_color "$YELLOW" "⚠️  Please update the .env file with your API keys"
else
    print_color "$GREEN" "✅ Backend .env file already exists"
fi

cd ..

# Setup frontend
print_header "Setting up Frontend"

cd frontend

print_color "$YELLOW" "Installing frontend dependencies with pnpm..."
pnpm install

# Create .env.local file if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_color "$YELLOW" "Creating frontend .env.local file..."
    cat > .env.local << EOL
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Optional: Analytics
NEXT_PUBLIC_GA_ID=
EOL
    print_color "$GREEN" "✅ Created .env.local file"
else
    print_color "$GREEN" "✅ Frontend .env.local file already exists"
fi

cd ..

# Start Docker services if Docker is available
if command_exists docker && command_exists docker-compose; then
    print_header "Starting Docker Services"
    
    read -p "Do you want to start PostgreSQL and Redis using Docker? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        print_color "$YELLOW" "Starting Docker services..."
        docker-compose up -d postgres redis
        
        # Wait for services to be ready
        print_color "$YELLOW" "Waiting for services to be ready..."
        sleep 5
        
        # Update .env to use PostgreSQL
        if [ -f "backend/.env" ]; then
            print_color "$YELLOW" "Updating backend .env to use PostgreSQL..."
            sed -i.bak 's|DATABASE_URL=sqlite:///db.sqlite3|DATABASE_URL=postgresql://aisreact:aisreact@localhost:5432/aisreact|' backend/.env
        fi
    fi
fi

# Run migrations
print_header "Running Database Migrations"

cd backend
if [ "$OS" = "Windows" ]; then
    ./venv/Scripts/activate && python manage.py migrate
else
    source venv/bin/activate && python manage.py migrate
fi
cd ..

# Create superuser
print_header "Create Admin User"

read -p "Do you want to create a superuser account? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    cd backend
    if [ "$OS" = "Windows" ]; then
        ./venv/Scripts/activate && python manage.py createsuperuser
    else
        source venv/bin/activate && python manage.py createsuperuser
    fi
    cd ..
fi

# Setup complete
print_header "Setup Complete! 🎉"

print_color "$GREEN" "✅ All dependencies installed"
print_color "$GREEN" "✅ Environment files created"
print_color "$GREEN" "✅ Database migrations applied"

echo
print_color "$BOLD" "Next steps:"
echo "1. Update backend/.env with your API keys"
echo "2. Start the development servers:"
echo "   - Backend: cd backend && python manage.py runserver"
echo "   - Frontend: cd frontend && pnpm dev"
echo "   - Celery: cd backend && celery -A aisreact worker --loglevel=info"
echo
echo "3. Or use the convenience script:"
echo "   ./start-local.sh"
echo
echo "4. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - Django Admin: http://localhost:8000/admin"

if [ -f "backend/.env" ] && grep -q "your-secret-key-here" backend/.env; then
    echo
    print_color "$YELLOW" "⚠️  Important: Don't forget to:"
    echo "   - Update SECRET_KEY in backend/.env"
    echo "   - Add your AI provider API keys"
fi

echo
print_color "$BLUE" "Happy coding! 🚀"