# Workshop Board Application - Network Setup Script (PowerShell)
# This script configures the application for local network access

Write-Host "Setting up Workshop Board Application for network access..." -ForegroundColor Green

# Function to get local IP address
function Get-LocalIPAddress {
    try {
        $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.IPAddress -notlike "127.*" -and 
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
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

# Get local IP address
$localIP = Get-LocalIPAddress
Write-Host "Detected local IP address: $localIP" -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Check if Docker is installed (optional)
try {
    docker --version | Out-Null
    Write-Host "Docker is available" -ForegroundColor Green
    $useDocker = $true
} catch {
    Write-Host "Docker not found. You'll need to install MongoDB manually." -ForegroundColor Yellow
    $useDocker = $false
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Blue
npm run install:all

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Setup environment files for network access
Write-Host "Setting up environment files for network access..." -ForegroundColor Blue

# Create web/.env.local for network access
$webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://$localIP:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
"@
$webEnvContent | Out-File -FilePath "web/.env.local" -Encoding UTF8
Write-Host "Created web/.env.local with network configuration" -ForegroundColor Green

# Create server/.env for network access
$serverEnvContent = @"
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$localIP:3000
"@
$serverEnvContent | Out-File -FilePath "server/.env" -Encoding UTF8
Write-Host "Created server/.env with network configuration" -ForegroundColor Green

# Start MongoDB if Docker is available
if ($useDocker) {
    Write-Host "Starting MongoDB with Docker for network access..." -ForegroundColor Blue
    docker-compose -f docker-compose.network.yml up -d mongodb
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "MongoDB started successfully for network access" -ForegroundColor Green
        Write-Host "MongoDB Express available at: http://$localIP:8081 (admin/admin)" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to start MongoDB with Docker" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Please make sure MongoDB is running and accessible on port 27017" -ForegroundColor Yellow
    Write-Host "You can install MongoDB locally or use Docker" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Network setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your application will be accessible at:" -ForegroundColor Cyan
Write-Host "  Local access:" -ForegroundColor White
Write-Host "    Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "    Backend:  http://localhost:4000" -ForegroundColor White
Write-Host ""
Write-Host "  Network access (from other devices):" -ForegroundColor White
Write-Host "    Frontend: http://$localIP:3000" -ForegroundColor White
Write-Host "    Backend:  http://$localIP:4000" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Make sure your firewall allows connections on ports 3000 and 4000" -ForegroundColor White
Write-Host "2. Run 'npm run dev' to start both frontend and backend" -ForegroundColor White
Write-Host "3. Test access from another device on your network" -ForegroundColor White
Write-Host "4. (Optional) Run 'npm run seed' to populate with sample data" -ForegroundColor White
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Start development servers" -ForegroundColor White
Write-Host "  npm run seed         - Seed database with sample data" -ForegroundColor White
Write-Host "  npm run build        - Build for production" -ForegroundColor White
Write-Host "  npm run start        - Start production servers" -ForegroundColor White
