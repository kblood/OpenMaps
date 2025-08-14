#!/bin/bash

# OpenMaps Setup and Launch Script
# This script sets up the entire OpenMaps application and launches it

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | sed 's/v//')
        REQUIRED_VERSION="18.0.0"
        if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
            print_success "Node.js $NODE_VERSION is installed"
            return 0
        else
            print_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION or higher"
            return 1
        fi
    else
        print_error "Node.js is not installed"
        return 1
    fi
}

# Function to install Node.js (for Ubuntu/Debian)
install_nodejs() {
    print_status "Installing Node.js..."
    
    if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        print_error "curl is required to install Node.js"
        exit 1
    fi
}

# Function to check and install dependencies
check_dependencies() {
    print_status "Checking system dependencies..."
    
    # Check Node.js
    if ! check_node_version; then
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            read -p "Would you like to install Node.js? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                install_nodejs
            else
                print_error "Node.js is required to run OpenMaps"
                exit 1
            fi
        else
            print_error "Please install Node.js 18+ from https://nodejs.org/"
            exit 1
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "All system dependencies are satisfied"
}

# Function to setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in current directory"
        exit 1
    fi
    
    print_status "Installing frontend dependencies..."
    npm install
    
    print_success "Frontend setup complete"
}

# Function to setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    if [ ! -d "backend" ]; then
        print_error "Backend directory not found"
        exit 1
    fi
    
    cd backend
    
    if [ ! -f "package.json" ]; then
        print_error "Backend package.json not found"
        exit 1
    fi
    
    print_status "Installing backend dependencies..."
    npm install
    
    # Setup environment file
    if [ ! -f ".env" ]; then
        print_status "Creating backend .env file..."
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "You may want to customize the .env file for your environment"
    fi
    
    # Build backend
    print_status "Building backend..."
    npm run build
    
    cd ..
    print_success "Backend setup complete"
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local timeout=30
    local count=0
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $count -lt $timeout ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        printf "."
    done
    
    echo
    print_error "$service_name failed to start within $timeout seconds"
    return 1
}

# Function to launch the application
launch_application() {
    print_status "Launching OpenMaps application..."
    
    # Check if ports are available
    if ! check_port 3000; then
        print_error "Port 3000 is already in use. Please free it or change the frontend port."
        exit 1
    fi
    
    if ! check_port 3001; then
        print_error "Port 3001 is already in use. Please free it or change the backend port."
        exit 1
    fi
    
    # Create log directory
    mkdir -p logs
    
    # Start backend
    print_status "Starting backend server..."
    cd backend
    npm run dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to be ready
    sleep 3
    if ! wait_for_service "http://localhost:3001/health" "Backend API"; then
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Start frontend
    print_status "Starting frontend server..."
    npm run dev > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    sleep 5
    if ! wait_for_service "http://localhost:3000" "Frontend"; then
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Store PIDs for cleanup
    echo $BACKEND_PID > logs/backend.pid
    echo $FRONTEND_PID > logs/frontend.pid
    
    print_success "OpenMaps is now running!"
    echo
    echo "🗺️  OpenMaps Application URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:3001"
    echo "   Health Check: http://localhost:3001/health"
    echo
    echo "📋 Logs are available in the logs/ directory"
    echo "   Backend: logs/backend.log"
    echo "   Frontend: logs/frontend.log"
    echo
    print_warning "Press Ctrl+C to stop the application"
    
    # Setup cleanup on exit
    cleanup() {
        print_status "Shutting down OpenMaps..."
        
        if [ -f logs/backend.pid ]; then
            BACKEND_PID=$(cat logs/backend.pid)
            kill $BACKEND_PID 2>/dev/null || true
            rm -f logs/backend.pid
        fi
        
        if [ -f logs/frontend.pid ]; then
            FRONTEND_PID=$(cat logs/frontend.pid)
            kill $FRONTEND_PID 2>/dev/null || true
            rm -f logs/frontend.pid
        fi
        
        print_success "OpenMaps stopped successfully"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Keep the script running
    wait
}

# Function to show help
show_help() {
    echo "OpenMaps Setup and Launch Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --setup-only        Only setup dependencies, don't launch"
    echo "  --launch-only       Only launch (assumes setup is complete)"
    echo "  --docker            Use Docker Compose instead"
    echo "  --check-deps        Only check system dependencies"
    echo
    echo "Examples:"
    echo "  $0                  # Full setup and launch"
    echo "  $0 --setup-only     # Only install dependencies"
    echo "  $0 --launch-only    # Only launch the application"
    echo "  $0 --docker         # Use Docker Compose"
}

# Function to launch with Docker
launch_docker() {
    print_status "Launching OpenMaps with Docker Compose..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "Building and starting containers..."
    docker-compose up --build
}

# Main function
main() {
    echo "🗺️  OpenMaps Setup and Launch Script"
    echo "=================================="
    echo
    
    # Parse command line arguments
    case "${1:-}" in
        --help|-h)
            show_help
            exit 0
            ;;
        --setup-only)
            check_dependencies
            setup_frontend
            setup_backend
            print_success "Setup complete! Run '$0 --launch-only' to start the application"
            exit 0
            ;;
        --launch-only)
            launch_application
            exit 0
            ;;
        --docker)
            launch_docker
            exit 0
            ;;
        --check-deps)
            check_dependencies
            exit 0
            ;;
        "")
            # Default: full setup and launch
            check_dependencies
            setup_frontend
            setup_backend
            launch_application
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"