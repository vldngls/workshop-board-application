#!/bin/bash

# Workshop Board Application - Unified Setup Script (Bash)
# This script allows you to choose between local and network deployment

MODE=""

echo "🚀 Workshop Board Application Setup"
echo "================================="

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

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--mode local|network]"
            echo "  --mode: Specify deployment mode (local or network)"
            echo "  --help: Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Choose deployment mode if not specified
if [ -z "$MODE" ]; then
    echo ""
    echo "Choose deployment mode:"
    echo "1. Local Development (localhost only)"
    echo "2. Network Deployment (accessible from other devices)"
    echo ""
    
    while true; do
        read -p "Enter your choice (1 or 2): " choice
        case $choice in
            1)
                MODE="local"
                break
                ;;
            2)
                MODE="network"
                break
                ;;
            *)
                echo "Please enter 1 or 2"
                ;;
        esac
    done
fi

echo ""
echo "📦 Installing dependencies..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Setup environment files based on mode
echo ""
echo "⚙️  Setting up environment files for $MODE deployment..."

if [ "$MODE" = "local" ]; then
    # Local Development Configuration
    echo "🔧 Configuring for local development..."
    
    # Create web/.env.local
    cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
EOF
    echo "✅ Created web/.env.local"
    
    # Create server/.env
    cat > server/.env << EOF
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
EOF
    echo "✅ Created server/.env"
    
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:4000"
    
elif [ "$MODE" = "network" ]; then
    # Network Deployment Configuration
    echo "🔧 Configuring for network deployment..."
    
    # Get local IP address
    LOCAL_IP=$(get_local_ip)
    echo "🌐 Detected local IP address: $LOCAL_IP"
    
    # Create web/.env.local
    cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://$LOCAL_IP:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
EOF
    echo "✅ Created web/.env.local"
    
    # Create server/.env
    cat > server/.env << EOF
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$LOCAL_IP:3000
EOF
    echo "✅ Created server/.env"
    
    echo ""
    echo "🌐 Access URLs:"
    echo "   Local: http://localhost:3000"
    echo "   Network: http://$LOCAL_IP:3000"
    echo "   Backend API: http://$LOCAL_IP:4000"
    
    echo ""
    echo "⚠️  Network Setup Notes:"
    echo "   - Make sure your firewall allows connections on ports 3000 and 4000"
    echo "   - Other devices can access the app at http://$LOCAL_IP:3000"
fi

# Setup MongoDB
echo ""
echo "🗄️  Setting up MongoDB..."

if [ "$USE_DOCKER" = true ]; then
    if [ "$MODE" = "network" ]; then
        echo "🐳 Starting MongoDB with network configuration..."
        docker-compose -f docker-compose.network.yml up -d mongodb
        if [ $? -eq 0 ]; then
            echo "✅ MongoDB started successfully"
            echo "   MongoDB Express: http://localhost:8081 (admin/admin)"
        else
            echo "⚠️  Failed to start MongoDB with Docker. Please check Docker is running."
        fi
    else
        echo "🐳 Starting MongoDB with local configuration..."
        docker-compose -f docker-compose.dev.yml up -d mongodb
        if [ $? -eq 0 ]; then
            echo "✅ MongoDB started successfully"
            echo "   MongoDB Express: http://localhost:8081 (admin/admin)"
        else
            echo "⚠️  Failed to start MongoDB with Docker. Please check Docker is running."
        fi
    fi
else
    echo "⚠️  Docker not available. Please ensure MongoDB is running locally on port 27017"
fi

# Seed database option
echo ""
echo "🌱 Database seeding options:"
echo "1. Skip seeding"
echo "2. Basic seed data"
echo "3. Enhanced seed data"
echo "4. Comprehensive seed data"

while true; do
    read -p "Choose seeding option (1-4): " seed_choice
    case $seed_choice in
        1)
            break
            ;;
        2)
            echo "🌱 Seeding database with basic data..."
            npm run seed
            break
            ;;
        3)
            echo "🌱 Seeding database with enhanced data..."
            npm run seed:enhanced
            break
            ;;
        4)
            echo "🌱 Seeding database with comprehensive data..."
            npm run seed:comprehensive
            break
            ;;
        *)
            echo "Please enter 1, 2, 3, or 4"
            ;;
    esac
done

if [ "$seed_choice" != "1" ]; then
    echo "✅ Database seeded successfully"
    echo ""
    echo "🔑 Default login credentials:"
    echo "   Administrator: admin / test123456"
    echo "   Job Controller: jobcontroller / test123456"
    echo "   Technician 1: technician1 / test123456"
    echo "   Service Advisor 1: serviceadvisor1 / test123456"
fi

# Final instructions
echo ""
echo "🎉 Setup completed successfully!"
echo "================================="

echo ""
echo "🚀 To start the application:"
echo "   npm run dev"

echo ""
echo "📚 For more information, see:"
echo "   - DEPLOYMENT.md for detailed instructions"
echo "   - WORKFLOW_DOCUMENTATION.md for feature details"

echo ""
echo "🆘 Need help? Check the troubleshooting section in DEPLOYMENT.md"
