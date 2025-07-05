#!/bin/bash

# WebBBS Startup Script
echo "🚀 Starting WebBBS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    # Try docker compose (newer syntax)
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Check if .env file exists in backend
if [ ! -f "./backend/.env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from example...${NC}"
    
    # Create .env file with Docker database credentials
    cat > ./backend/.env << EOF
# Database Configuration
DB_USER=webbs_user
DB_PASSWORD=webbs_pass
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webbs

# JWT Secret (change this in production!)
JWT_SECRET=your-secret-key-here-change-in-production

# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost:5000
EOF
    
    echo -e "${GREEN}✅ Created .env file with default configuration${NC}"
fi

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"

# Check if node_modules exists in root
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

# Check if node_modules exists in backend
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Check if node_modules exists in frontend
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Start PostgreSQL with Docker Compose
echo -e "${YELLOW}🐘 Starting PostgreSQL database...${NC}"
$DOCKER_COMPOSE up -d

# Wait for PostgreSQL to be ready
echo "Waiting for database to be ready..."
for i in {1..30}; do
    if docker exec webbs-postgres pg_isready -U webbs_user -d webbs &> /dev/null; then
        echo -e "${GREEN}✅ Database is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database failed to start. Check Docker logs:${NC}"
        echo "Run: docker logs webbs-postgres"
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Start the application
echo -e "${YELLOW}🌐 Starting WebBBS application...${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}║         WebBBS is starting up!                   ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Frontend: http://localhost:3000                 ║${NC}"
echo -e "${GREEN}║  Backend:  http://localhost:5000                 ║${NC}"
echo -e "${GREEN}║  Database: PostgreSQL on port 5432               ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services               ║${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    
    # Stop the npm process
    if [ ! -z "$NPM_PID" ]; then
        kill $NPM_PID 2>/dev/null
    fi
    
    # Ask if user wants to stop the database
    read -p "Stop the database too? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping PostgreSQL..."
        $DOCKER_COMPOSE down
        echo -e "${GREEN}✅ Database stopped${NC}"
    else
        echo -e "${YELLOW}ℹ️  Database still running. To stop it later, run: ${DOCKER_COMPOSE} down${NC}"
    fi
    
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Start the application
npm run dev &
NPM_PID=$!

# Wait for the npm process
wait $NPM_PID