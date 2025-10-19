#!/bin/bash

# Workshop Board Application - Start Development Script
echo "🚀 Starting Workshop Board Application in development mode..."

# Check if MongoDB is running
if ! curl -s http://localhost:27017 > /dev/null 2>&1; then
    echo "⚠️  MongoDB doesn't seem to be running on localhost:27017"
    echo "   Please start MongoDB first:"
    echo "   - Using Docker: docker-compose -f docker-compose.dev.yml up -d mongodb"
    echo "   - Or install MongoDB locally and start it"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the development servers
echo "🎯 Starting frontend and backend servers..."
npm run dev
