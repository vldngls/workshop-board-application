#!/bin/bash

# Workshop Board Application - Development Setup Script
echo "🚀 Setting up Workshop Board Application for local development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker is available"
    USE_DOCKER=true
else
    echo "⚠️  Docker not found. You'll need to install MongoDB manually."
    USE_DOCKER=false
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Setup environment files
echo "⚙️  Setting up environment files..."

# Create web/.env.local if it doesn't exist
if [ ! -f "web/.env.local" ]; then
    cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
EOF
    echo "✅ Created web/.env.local"
else
    echo "✅ web/.env.local already exists"
fi

# Create server/.env if it doesn't exist
if [ ! -f "server/.env" ]; then
    cat > server/.env << EOF
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
EOF
    echo "✅ Created server/.env"
else
    echo "✅ server/.env already exists"
fi

# Start MongoDB if Docker is available
if [ "$USE_DOCKER" = true ]; then
    echo "🐳 Starting MongoDB with Docker..."
    docker-compose -f docker-compose.dev.yml up -d mongodb
    
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB started successfully"
        echo "📊 MongoDB Express available at: http://localhost:8081 (admin/admin)"
    else
        echo "❌ Failed to start MongoDB with Docker"
        exit 1
    fi
else
    echo "⚠️  Please make sure MongoDB is running on localhost:27017"
    echo "   You can install MongoDB locally or use Docker"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Make sure MongoDB is running (localhost:27017)"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo "3. Open http://localhost:3000 in your browser"
echo "4. (Optional) Run 'npm run seed' to populate with sample data"
echo ""
echo "📚 Available commands:"
echo "  npm run dev          - Start development servers"
echo "  npm run seed         - Seed database with sample data"
echo "  npm run build        - Build for production"
echo "  npm run start        - Start production servers"
