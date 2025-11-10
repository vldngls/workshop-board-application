#!/bin/bash

# Workshop Board Application - Unified Setup Script (Bash)
# This script allows you to choose between local and network deployment

ENVIRONMENT=""
DEPLOYMENT_MODE=""
AUTO_MODE=false
SEED_OPTION=""
API_KEY_VALUE=""
SKIP_API_KEY_CONFIG=false

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
        --auto)
            AUTO_MODE=true
            shift
            ;;
        --mode)
            DEPLOYMENT_MODE="$2"
            shift 2
            ;;
        --env|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --seed)
            SEED_OPTION="$2"
            shift 2
            ;;
        --seed=*)
            SEED_OPTION="${1#*=}"
            shift
            ;;
        --api-key)
            API_KEY_VALUE="$2"
            shift 2
            ;;
        --api-key=*)
            API_KEY_VALUE="${1#*=}"
            shift
            ;;
        --skip-api-key)
            SKIP_API_KEY_CONFIG=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--env development|dealership|production] [--mode local|network] [--seed skip|basic|enhanced|comprehensive]"
            echo "  --env:  Specify environment (development, dealership, or production)"
            echo "  --mode: Specify deployment mode (local or network)"
            echo "  --seed: Seed database automatically (skip by default when --auto is used)"
            echo "  --api-key: Provide API key to set after seeding (skipped by default)"
            echo "  --skip-api-key: Skip API key configuration even if --api-key provided"
            echo "  --auto: Run in non-interactive mode using defaults unless overridden"
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

# Normalize environment value if provided via CLI
if [ -n "$ENVIRONMENT" ]; then
    ENVIRONMENT=$(echo "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')
fi

if [ "$AUTO_MODE" = true ] && [ -z "$ENVIRONMENT" ]; then
    ENVIRONMENT="development"
fi

# Choose environment if not specified
if [ -z "$ENVIRONMENT" ]; then
    echo ""
    echo "Choose environment:"
    echo "1. Development (engineering workstation)"
    echo "2. Production (cloud deployment)"
    echo "3. Dealership PC (on-prem single machine)"
    echo ""

    while true; do
        read -p "Enter your choice (1, 2, or 3): " env_choice
        case $env_choice in
            1)
                ENVIRONMENT="development"
                break
                ;;
            2)
                ENVIRONMENT="production"
                break
                ;;
            3)
                ENVIRONMENT="dealership"
                break
                ;;
            *)
                echo "Please enter 1, 2, or 3"
                ;;
        esac
    done
fi

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "dealership" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "   Allowed values: development, production, dealership"
    exit 1
fi

# Choose deployment mode if not specified
if [ "$AUTO_MODE" = true ] && [ -z "$DEPLOYMENT_MODE" ]; then
    DEPLOYMENT_MODE="network"
fi

if [ -z "$DEPLOYMENT_MODE" ]; then
    echo ""
    echo "Choose deployment mode:"
    echo "1. Local Development (localhost only)"
    echo "2. Network Deployment (accessible from other devices)"
    echo ""
    
    while true; do
        read -p "Enter your choice (1 or 2): " choice
        case $choice in
            1)
                DEPLOYMENT_MODE="local"
                break
                ;;
            2)
                DEPLOYMENT_MODE="network"
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
# Ensure deployment mode value is normalized
if [ -n "$DEPLOYMENT_MODE" ]; then
    DEPLOYMENT_MODE=$(echo "$DEPLOYMENT_MODE" | tr '[:upper:]' '[:lower:]')
fi

if [[ "$DEPLOYMENT_MODE" != "local" && "$DEPLOYMENT_MODE" != "network" ]]; then
    echo "❌ Invalid deployment mode: $DEPLOYMENT_MODE"
    echo "   Allowed values: local, network"
    exit 1
fi

echo "⚙️  Setting up environment files for $ENVIRONMENT ($DEPLOYMENT_MODE) deployment..."

# Helper to generate secrets when needed
generate_secret() {
    node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"
}

if [ "$ENVIRONMENT" = "development" ]; then
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        # Local Development Configuration
        echo "🔧 Configuring for local development..."

        # Create web/.env.local
        cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
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

    elif [ "$DEPLOYMENT_MODE" = "network" ]; then
        # Network Deployment Configuration
        echo "🔧 Configuring for network deployment..."

        # Get local IP address
        LOCAL_IP=$(get_local_ip)
        echo "🌐 Detected local IP address: $LOCAL_IP"

        # Create web/.env.local
        cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://$LOCAL_IP:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
EOF
        echo "✅ Created web/.env.local"

        # Create server/.env
        cat > server/.env << EOF
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$LOCAL_IP:3000
HOST=0.0.0.0
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

elif [ "$ENVIRONMENT" = "dealership" ]; then
    echo "🏢 Dealership on-prem configuration"
    echo "    Press enter to accept suggested defaults."

    DEFAULT_API_KEY=$(generate_secret 24)
    DEFAULT_JWT_SECRET=$(generate_secret 32)
    DEFAULT_ENC_SECRET=$(generate_secret 32)

    if [ "$AUTO_MODE" = true ]; then
        DEALERSHIP_API_KEY="$DEFAULT_API_KEY"
        DEALERSHIP_JWT_SECRET="$DEFAULT_JWT_SECRET"
        DEALERSHIP_JWT_ENC_SECRET="$DEFAULT_ENC_SECRET"
    else
    read -p "API key [$DEFAULT_API_KEY]: " DEALERSHIP_API_KEY_INPUT
    DEALERSHIP_API_KEY=${DEALERSHIP_API_KEY_INPUT:-$DEFAULT_API_KEY}

    read -p "JWT secret [$DEFAULT_JWT_SECRET]: " DEALERSHIP_JWT_SECRET_INPUT
    DEALERSHIP_JWT_SECRET=${DEALERSHIP_JWT_SECRET_INPUT:-$DEFAULT_JWT_SECRET}

    read -p "JWT encryption secret [$DEFAULT_ENC_SECRET]: " DEALERSHIP_JWT_ENC_INPUT
    DEALERSHIP_JWT_ENC_SECRET=${DEALERSHIP_JWT_ENC_INPUT:-$DEFAULT_ENC_SECRET}
    fi

    if [ "$DEPLOYMENT_MODE" = "network" ]; then
        LOCAL_IP=$(get_local_ip)
        echo "🌐 Detected local IP address: $LOCAL_IP"

        cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://$LOCAL_IP:4000
API_KEY=$DEALERSHIP_API_KEY
JWT_SECRET=$DEALERSHIP_JWT_SECRET
NEXT_JWT_ENC_SECRET=$DEALERSHIP_JWT_ENC_SECRET
EOF
        echo "✅ Created web/.env.local"

        cat > server/.env << EOF
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=$DEALERSHIP_JWT_SECRET
API_KEY=$DEALERSHIP_API_KEY
NODE_ENV=production
WEB_ORIGIN=http://$LOCAL_IP:3000
EOF
        echo "✅ Created server/.env"

        echo ""
        echo "🌐 Access URLs:"
        echo "   Local: http://localhost:3000"
        echo "   Network: http://$LOCAL_IP:3000"
        echo "   Backend API: http://$LOCAL_IP:4000"
    else
        cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_KEY=$DEALERSHIP_API_KEY
JWT_SECRET=$DEALERSHIP_JWT_SECRET
NEXT_JWT_ENC_SECRET=$DEALERSHIP_JWT_ENC_SECRET
EOF
        echo "✅ Created web/.env.local"

        cat > server/.env << EOF
PORT=4000
HOST=127.0.0.1
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=$DEALERSHIP_JWT_SECRET
API_KEY=$DEALERSHIP_API_KEY
NODE_ENV=production
WEB_ORIGIN=http://localhost:3000
EOF
        echo "✅ Created server/.env"

        echo ""
        echo "🌐 Access URLs:"
        echo "   Frontend: http://localhost:3000"
        echo "   Backend API: http://localhost:4000"
    fi

    echo ""
    echo "🔐 Saved API key: $DEALERSHIP_API_KEY"
    echo "   Store this value safely for future logins or integrations."

elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🛠️  Production configuration"
    echo "    Press enter to accept the default in brackets."

    DEFAULT_BACKEND_URL="https://your-backend-domain.vercel.app"
    DEFAULT_FRONTEND_URL="https://your-frontend-domain.vercel.app"
    DEFAULT_MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/workshop-board"
    DEFAULT_JWT_SECRET=$(generate_secret 32)
    DEFAULT_API_KEY=$(generate_secret 24)

    read -p "Backend base URL [$DEFAULT_BACKEND_URL]: " PROD_BACKEND_URL
    PROD_BACKEND_URL=${PROD_BACKEND_URL:-$DEFAULT_BACKEND_URL}

    read -p "Frontend base URL [$DEFAULT_FRONTEND_URL]: " PROD_FRONTEND_URL
    PROD_FRONTEND_URL=${PROD_FRONTEND_URL:-$DEFAULT_FRONTEND_URL}

    read -p "MongoDB connection string [$DEFAULT_MONGODB_URI]: " PROD_MONGODB_URI
    PROD_MONGODB_URI=${PROD_MONGODB_URI:-$DEFAULT_MONGODB_URI}

    read -p "JWT secret [$DEFAULT_JWT_SECRET]: " PROD_JWT_SECRET_INPUT
    PROD_JWT_SECRET=${PROD_JWT_SECRET_INPUT:-$DEFAULT_JWT_SECRET}

    read -p "API key [$DEFAULT_API_KEY]: " PROD_API_KEY_INPUT
    PROD_API_KEY=${PROD_API_KEY_INPUT:-$DEFAULT_API_KEY}

    if [ "$DEPLOYMENT_MODE" = "network" ]; then
        SERVER_HOST="0.0.0.0"
    else
        SERVER_HOST="127.0.0.1"
    fi

    cat > server/.env << EOF
PORT=4000
HOST=$SERVER_HOST
MONGODB_URI=$PROD_MONGODB_URI
JWT_SECRET=$PROD_JWT_SECRET
API_KEY=$PROD_API_KEY
NODE_ENV=production
WEB_ORIGIN=$PROD_FRONTEND_URL
EOF
    echo "✅ Created server/.env"

    cat > web/.env.production << EOF
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=$PROD_BACKEND_URL
JWT_SECRET=$PROD_JWT_SECRET
API_KEY=$PROD_API_KEY
EOF
    echo "✅ Created web/.env.production"

    cat > web/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=$PROD_BACKEND_URL
API_KEY=$PROD_API_KEY
JWT_SECRET=$PROD_JWT_SECRET
NEXT_JWT_ENC_SECRET=$PROD_JWT_SECRET
EOF
    echo "✅ Updated web/.env.local for production parity"

    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend: $PROD_FRONTEND_URL"
    echo "   Backend API: $PROD_BACKEND_URL"
fi

# Setup MongoDB
echo ""
echo "🗄️  Setting up MongoDB..."

if [ "$ENVIRONMENT" = "development" ]; then
    if [ "$USE_DOCKER" = true ]; then
        if [ "$DEPLOYMENT_MODE" = "network" ]; then
            echo "🐳 Starting MongoDB with network configuration..."
            docker-compose -f workspace/docker/docker-compose.network.yml up -d mongodb
            if [ $? -eq 0 ]; then
                echo "✅ MongoDB started successfully"
                echo "   MongoDB Express: http://localhost:8081 (admin/admin)"
            else
                echo "⚠️  Failed to start MongoDB with Docker. Please check Docker is running."
            fi
        else
            echo "🐳 Starting MongoDB with local configuration..."
            docker-compose -f workspace/docker/docker-compose.dev.yml up -d mongodb
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
elif [ "$ENVIRONMENT" = "dealership" ]; then
    echo "ℹ️  Skipping Docker-based MongoDB setup for dealership mode."
    echo "   Make sure MongoDB Community Server is installed and running as a Windows service on this PC."
    echo "   Connection string used: mongodb://localhost:27017/workshop_board"
else
    echo "ℹ️  Skipping Docker-based MongoDB setup for production."
    echo "   Ensure your MongoDB instance is reachable at the provided connection string."
fi

# Seed database option
echo ""
echo "🌱 Database seeding options:"
echo "1. Skip seeding"
echo "2. Basic seed data"
echo "3. Enhanced seed data"
echo "4. Comprehensive seed data"

if [ "$AUTO_MODE" = true ] && [ -z "$SEED_OPTION" ]; then
    SEED_OPTION="skip"
fi

if [ "$AUTO_MODE" = true ]; then
    normalized_seed=$(printf '%s' "$SEED_OPTION" | tr '[:upper:]' '[:lower:]')
    case "$normalized_seed" in
        skip|"")
            seed_choice=1
            ;;
        basic)
            seed_choice=2
            ;;
        enhanced)
            seed_choice=3
            ;;
        comprehensive|full)
            seed_choice=4
            ;;
        *)
            echo "⚠️  Unknown seed option '$SEED_OPTION', defaulting to skip."
            seed_choice=1
            ;;
    esac
else
    while true; do
        read -p "Choose seeding option (1-4): " seed_choice
        case $seed_choice in
            1|2|3|4)
            break
            ;;
        *)
            echo "Please enter 1, 2, 3, or 4"
            ;;
    esac
done
fi

if [ "$seed_choice" = "2" ]; then
    echo "🌱 Seeding database with basic data..."
    npm run seed
elif [ "$seed_choice" = "3" ]; then
    echo "🌱 Seeding database with enhanced data..."
    npm run seed:enhanced
elif [ "$seed_choice" = "4" ]; then
    echo "🌱 Seeding database with comprehensive data..."
    npm run seed:comprehensive
fi

if [ "$seed_choice" != "1" ]; then
    echo "✅ Database seeded successfully"
    echo ""
    echo "🔑 Default login credentials:"
    if [ "$seed_choice" = "2" ]; then
        echo "   Super Admin: vldngls / Vldngls04182002!@"
        echo "   Administrator: admin / test123456"
        echo "   Job Controller: jobcontroller / test123456"
        echo "   Technician 1: technician1 / test123456"
        echo "   Service Advisor 1: serviceadvisor1 / test123456"
    elif [ "$seed_choice" = "3" ]; then
        echo "   Super Admin: vldngls / Vldngls04182002!@"
        echo "   Administrators: admin1, admin2 / test123456"
        echo "   Job Controller: jobcontroller / test123456"
        echo "   Technicians: technician1-5 / test123456"
        echo "   Service Advisors: serviceadvisor1-5 / test123456"
    elif [ "$seed_choice" = "4" ]; then
        echo "   Super Admin: vldngls / Vldngls04182002!@"
        echo "   Administrators: admin1, admin2 / test123456"
        echo "   Job Controller: jobcontroller / test123456"
        echo "   Technicians: technician1-5 / test123456"
        echo "   Service Advisors: serviceadvisor1-5 / test123456"
        echo "   (30 job orders created across yesterday and today)"
    fi
fi

# API Key setup option
echo ""
echo "🔑 API Key Configuration:"
echo "1. Skip API key setup (use default or set later)"
echo "2. Set API key now"

if [ "$AUTO_MODE" = true ]; then
    api_key_choice=1
    if [ "$SKIP_API_KEY_CONFIG" = false ] && [ -n "$API_KEY_VALUE" ]; then
        api_key_choice=2
        api_key="$API_KEY_VALUE"
    fi
else
while true; do
    read -p "Choose API key option (1-2): " api_key_choice
    case $api_key_choice in
            1|2)
            break
            ;;
            *)
                echo "Please enter 1 or 2"
                ;;
        esac
    done

    if [ "$api_key_choice" = "2" ]; then
            read -p "Enter API key: " api_key
    fi
fi

if [ "$api_key_choice" = "2" ]; then
            if [ -n "$api_key" ]; then
                echo "🔑 Setting API key..."
                pushd server > /dev/null
                API_KEY="$api_key" node ../workspace/scripts/set-api-key.mjs "$api_key"
                api_key_status=$?
                popd > /dev/null
                if [ $api_key_status -eq 0 ]; then
                    echo "✅ API key configured successfully"
                else
                    echo "⚠️  Failed to set API key. You can set it later in the maintenance settings."
                fi
            else
                echo "⚠️  No API key provided. Skipping..."
            fi
fi

# Final instructions
echo ""
echo "🎉 Setup completed successfully!"
echo "================================="

echo ""
echo "🚀 To start the application:"
echo "   npm run dev"

if [ "$ENVIRONMENT" = "dealership" ]; then
    echo ""
    echo "🏁 Dealership run options:"
    echo "   - One terminal (dev mode): npm run dev"
    echo "   - Production build:        npm run build"
    echo "   - Start backend service:   npm run server:start"
    echo "   - Start frontend service:  npm run web:start"
    echo ""
    echo "📌 Tip: Use PM2 or Windows Task Scheduler to auto-start the backend and frontend commands after login."
    echo "📌 Ensure the MongoDB Windows service is running before launching the app."
fi

echo ""
echo "📚 For more information, see:"
echo "   - workspace/docs/DEPLOYMENT.md for detailed instructions"
echo "   - workspace/docs/WORKFLOW_DOCUMENTATION.md for feature details"

echo ""
echo "🆘 Need help? Check the troubleshooting section in workspace/docs/DEPLOYMENT.md"
