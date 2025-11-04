# Workshop Board Application - Unified Setup Script (PowerShell)
# This script allows you to choose between local and network deployment
# Requires PowerShell 5.1 or later

param(
    [string]$Mode = ""
)

# Set output encoding to UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🚀 Workshop Board Application Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Check if Docker is installed (optional)
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
    $useDocker = $true
} catch {
    Write-Host "⚠️  Docker not found. You'll need to install MongoDB manually." -ForegroundColor Yellow
    $useDocker = $false
}

# Function to get local IP address
function Get-LocalIPAddress {
    try {
        $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.IPAddress -notlike "127.*" -and 
            $_.IPAddress -notlike "169.254.*" -and
            ($_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual")
        }
        
        if ($ipAddresses.Count -gt 0) {
            return $ipAddresses[0].IPAddress
        } else {
            Write-Host "Could not automatically detect IP address. Please enter it manually." -ForegroundColor Yellow
            return Read-Host "Enter your local IP address"
        }
    } catch {
        Write-Host "Could not automatically detect IP address. Please enter it manually." -ForegroundColor Yellow
        return Read-Host "Enter your local IP address"
    }
}

# Choose deployment mode if not specified
if (-not $Mode) {
    Write-Host ""
    Write-Host "Choose deployment mode:" -ForegroundColor Cyan
    Write-Host "1. Local Development (localhost only)" -ForegroundColor White
    Write-Host "2. Network Deployment (accessible from other devices)" -ForegroundColor White
    Write-Host ""
    
    do {
        $choice = Read-Host "Enter your choice (1 or 2)"
        switch ($choice) {
            "1" { $Mode = "local"; break }
            "2" { $Mode = "network"; break }
            default { Write-Host "Please enter 1 or 2" -ForegroundColor Red }
        }
    } while ($Mode -eq "")
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm run install:all

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green

# Setup environment files based on mode
Write-Host ""
Write-Host "⚙️  Setting up environment files for $Mode deployment..." -ForegroundColor Blue

if ($Mode -eq "local") {
    # Local Development Configuration
    Write-Host "🔧 Configuring for local development..." -ForegroundColor Cyan
    
    # Create web/.env.local
    $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
"@
    $webEnvPath = Join-Path "web" ".env.local"
    Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
    Write-Host "✅ Created web/.env.local" -ForegroundColor Green
    
    # Create server/.env
    $serverEnvContent = @"
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
"@
    $serverEnvPath = Join-Path "server" ".env"
    Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
    Write-Host "✅ Created server/.env" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "   Backend API: http://localhost:4000" -ForegroundColor White
    
} elseif ($Mode -eq "network") {
    # Network Deployment Configuration
    Write-Host "🔧 Configuring for network deployment..." -ForegroundColor Cyan
    
    # Get local IP address
    $localIP = Get-LocalIPAddress
    Write-Host "🌐 Detected local IP address: $localIP" -ForegroundColor Cyan
    
    # Create web/.env.local
    $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://$localIP:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
"@
    $webEnvPath = Join-Path "web" ".env.local"
    Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
    Write-Host "✅ Created web/.env.local" -ForegroundColor Green
    
    # Create server/.env
    $serverEnvContent = @"
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$localIP:3000
"@
    $serverEnvPath = Join-Path "server" ".env"
    Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
    Write-Host "✅ Created server/.env" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
    Write-Host "   Local: http://localhost:3000" -ForegroundColor White
    Write-Host "   Network: http://$localIP:3000" -ForegroundColor White
    Write-Host "   Backend API: http://$localIP:4000" -ForegroundColor White
    
    Write-Host ""
    Write-Host "⚠️  Network Setup Notes:" -ForegroundColor Yellow
    Write-Host "   - Make sure your firewall allows connections on ports 3000 and 4000" -ForegroundColor White
    Write-Host "   - Other devices can access the app at http://$localIP:3000" -ForegroundColor White
}

# Setup MongoDB
Write-Host ""
Write-Host "🗄️  Setting up MongoDB..." -ForegroundColor Blue

if ($useDocker) {
    if ($Mode -eq "network") {
        Write-Host "🐳 Starting MongoDB with network configuration..." -ForegroundColor Cyan
        docker-compose -f workspace/docker/docker-compose.network.yml up -d mongodb
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ MongoDB started successfully" -ForegroundColor Green
            Write-Host "   MongoDB Express: http://localhost:8081 (admin/admin)" -ForegroundColor White
        } else {
            Write-Host "⚠️  Failed to start MongoDB with Docker. Please check Docker is running." -ForegroundColor Yellow
        }
    } else {
        Write-Host "🐳 Starting MongoDB with local configuration..." -ForegroundColor Cyan
        docker-compose -f workspace/docker/docker-compose.dev.yml up -d mongodb
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ MongoDB started successfully" -ForegroundColor Green
            Write-Host "   MongoDB Express: http://localhost:8081 (admin/admin)" -ForegroundColor White
        } else {
            Write-Host "⚠️  Failed to start MongoDB with Docker. Please check Docker is running." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  Docker not available. Please ensure MongoDB is running locally on port 27017" -ForegroundColor Yellow
}

# Seed database option
Write-Host ""
Write-Host "🌱 Database seeding options:" -ForegroundColor Blue
Write-Host "1. Skip seeding" -ForegroundColor White
Write-Host "2. Basic seed data" -ForegroundColor White
Write-Host "3. Enhanced seed data" -ForegroundColor White
Write-Host "4. Comprehensive seed data" -ForegroundColor White

do {
    $seedChoice = Read-Host "Choose seeding option (1-4)"
    switch ($seedChoice) {
        "1" { break }
        "2" { 
            Write-Host "🌱 Seeding database with basic data..." -ForegroundColor Cyan
            npm run seed
            break
        }
        "3" { 
            Write-Host "🌱 Seeding database with enhanced data..." -ForegroundColor Cyan
            npm run seed:enhanced
            break
        }
        "4" { 
            Write-Host "🌱 Seeding database with comprehensive data..." -ForegroundColor Cyan
            npm run seed:comprehensive
            break
        }
        default { Write-Host "Please enter 1, 2, 3, or 4" -ForegroundColor Red }
    }
} while ($seedChoice -notmatch "^[1-4]$")

if ($seedChoice -ne "1") {
    Write-Host "✅ Database seeded successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔑 Default login credentials:" -ForegroundColor Cyan
    Write-Host "   Administrator: admin / test123456" -ForegroundColor White
    Write-Host "   Job Controller: jobcontroller / test123456" -ForegroundColor White
    Write-Host "   Technician 1: technician1 / test123456" -ForegroundColor White
    Write-Host "   Service Advisor 1: serviceadvisor1 / test123456" -ForegroundColor White
}

# Final instructions
Write-Host ""
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 To start the application:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White

Write-Host ""
Write-Host "📚 For more information, see:" -ForegroundColor Cyan
Write-Host "   - workspace/docs/DEPLOYMENT.md for detailed instructions" -ForegroundColor White
Write-Host "   - workspace/docs/WORKFLOW_DOCUMENTATION.md for feature details" -ForegroundColor White

Write-Host ""
Write-Host "🆘 Need help? Check the troubleshooting section in workspace/docs/DEPLOYMENT.md" -ForegroundColor Yellow
