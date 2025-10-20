#!/bin/bash

# Workshop Board Application - Network Setup Script (Bash)
# This script configures the application for local network access

echo "Setting up Workshop Board Application for network access..."

# Function to get local IP address
get_local_ip() {
    # Try different methods to get local IP
    if command -v ip &> /dev/null; then
        # Linux with ip command
        local_ip=$(ip route get 1.1.1.1 | awk '{print $7; exit}' 2>/dev/null)
    elif command -v ifconfig &> /dev/null; then
        # macOS/Linux with ifconfig
        local_ip=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
    elif command -v hostname &> /dev/null; then
        # Fallback method
        local_ip=$(hostname -I | awk '{print $1}' 2>/dev/null)
    fi
    
    if [ -z "$local_ip" ]; then
        echo "Could not automatically detect IP address. Please enter it manually."
        read -p "Enter your local IP address: " local_ip
    fi
    
    echo "$local_ip"
}

# Get local IP address
local_ip=$(get_local_ip)
echo "Detected local IP address: $local_ip"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

node_version=$(node -v)
echo "Node.js version: $node_version"

# Check Node.js version
version_number=$(echo $node_version | sed 's/v\([0-9]*\).*/\1/')
if [ "$version_number" -lt 18 ]; then
    echo "Node.js version 18+ is required. Current version: $node_version"
    exit 1
fi

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "Docker is available"
    use_docker=true
else
    echo "Docker not found. You'll need to install MongoDB manually."
    use_docker=false
fi

# Install dependencies
echo "Installing dependencies..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

# Setup environment files for network access
echo "Setting up environment files for network access..."

# Create web/.env.local for network access
cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://$local_ip:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
EOF
echo "Created web/.env.local with network configuration"

# Create server/.env for network access
cat > server/.env << EOF
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$local_ip:3000
EOF
echo "Created server/.env with network configuration"

# Start MongoDB if Docker is available
if [ "$use_docker" = true ]; then
    echo "Starting MongoDB with Docker for network access..."
    docker-compose -f docker-compose.network.yml up -d mongodb
    
    if [ $? -eq 0 ]; then
        echo "MongoDB started successfully for network access"
        echo "MongoDB Express available at: http://$local_ip:8081 (admin/admin)"
    else
        echo "Failed to start MongoDB with Docker"
        exit 1
    fi
else
    echo "Please make sure MongoDB is running and accessible on port 27017"
    echo "You can install MongoDB locally or use Docker"
fi

echo ""
echo "Network setup complete!"
echo ""
echo "Your application will be accessible at:"
echo "  Local access:"
echo "    Frontend: http://localhost:3000"
echo "    Backend:  http://localhost:4000"
echo ""
echo "  Network access (from other devices):"
echo "    Frontend: http://$local_ip:3000"
echo "    Backend:  http://$local_ip:4000"
echo ""
echo "Next steps:"
echo "1. Make sure your firewall allows connections on ports 3000 and 4000"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo "3. Test access from another device on your network"
echo "4. (Optional) Run 'npm run seed' to populate with sample data"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start development servers"
echo "  npm run seed         - Seed database with sample data"
echo "  npm run build        - Build for production"
echo "  npm run start        - Start production servers"
