# Workshop Board Application - Development Setup Script (PowerShell)
Write-Host "Setting up Workshop Board Application for local development..." -ForegroundColor Green

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

# Setup environment files
Write-Host "Setting up environment files..." -ForegroundColor Blue

# Create web/.env.local if it doesn't exist
if (-not (Test-Path "web/.env.local")) {
    $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
"@
    $webEnvContent | Out-File -FilePath "web/.env.local" -Encoding UTF8
    Write-Host "Created web/.env.local" -ForegroundColor Green
} else {
    Write-Host "web/.env.local already exists" -ForegroundColor Green
}

# Create server/.env if it doesn't exist
if (-not (Test-Path "server/.env")) {
    $serverEnvContent = @"
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
"@
    $serverEnvContent | Out-File -FilePath "server/.env" -Encoding UTF8
    Write-Host "Created server/.env" -ForegroundColor Green
} else {
    Write-Host "server/.env already exists" -ForegroundColor Green
}

# Start MongoDB if Docker is available
if ($useDocker) {
    Write-Host "Starting MongoDB with Docker..." -ForegroundColor Blue
    docker-compose -f docker-compose.dev.yml up -d mongodb
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "MongoDB started successfully" -ForegroundColor Green
        Write-Host "MongoDB Express available at: http://localhost:8081 (admin/admin)" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to start MongoDB with Docker" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Please make sure MongoDB is running on localhost:27017" -ForegroundColor Yellow
    Write-Host "You can install MongoDB locally or use Docker" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete! Next steps:" -ForegroundColor Green
Write-Host "1. Make sure MongoDB is running (localhost:27017)" -ForegroundColor White
Write-Host "2. Run 'npm run dev' to start both frontend and backend" -ForegroundColor White
Write-Host "3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "4. (Optional) Run 'npm run seed' to populate with sample data" -ForegroundColor White
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Start development servers" -ForegroundColor White
Write-Host "  npm run seed         - Seed database with sample data" -ForegroundColor White
Write-Host "  npm run build        - Build for production" -ForegroundColor White
Write-Host "  npm run start        - Start production servers" -ForegroundColor White
