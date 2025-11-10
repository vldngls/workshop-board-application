# Workshop Board Application - Unified Setup Script (PowerShell)
# This script allows you to choose between local and network deployment
# Requires PowerShell 5.1 or later

param(
    [string]$Mode = "",
    [string]$Environment = "",
    [switch]$Auto,
    [string]$Seed = "",
    [string]$ApiKey = "",
    [switch]$SkipApiKey
)

Write-Host "[SETUP] Workshop Board Application Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "[ERROR] Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Check if Docker is installed (optional)
try {
    docker --version | Out-Null
    Write-Host "[OK] Docker is available" -ForegroundColor Green
    $useDocker = $true
} catch {
    Write-Host "[WARNING] Docker not found. You'll need to install MongoDB manually." -ForegroundColor Yellow
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

function New-RandomHex {
    param(
        [int]$Bytes = 32
    )

    $buffer = New-Object Byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

# Choose environment if not specified
if ($Environment) {
    $Environment = $Environment.ToLower()
}
if ($Auto -and -not $Environment) {
    $Environment = "development"
}

if (-not $Environment) {
    Write-Host ""
    Write-Host "Choose environment:" -ForegroundColor Cyan
    Write-Host "1. Development (engineering workstation)" -ForegroundColor White
    Write-Host "2. Production (cloud deployment)" -ForegroundColor White
    Write-Host "3. Dealership PC (on-prem single machine)" -ForegroundColor White
    Write-Host ""

    do {
        $envChoice = Read-Host "Enter your choice (1, 2, or 3)"
        switch ($envChoice) {
            "1" { $Environment = "development"; break }
            "2" { $Environment = "production"; break }
            "3" { $Environment = "dealership"; break }
            default { Write-Host "Please enter 1, 2, or 3" -ForegroundColor Red }
        }
    } while (-not $Environment)
}

if ($Environment -notin @("development","production","dealership")) {
    Write-Host "[ERROR] Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "        Allowed values: development, production, dealership" -ForegroundColor Red
    exit 1
}

# Choose deployment mode if not specified
if ($Mode) {
    $Mode = $Mode.ToLower()
}

if ($Auto -and -not $Mode) {
    $Mode = "network"
}

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

if ($Mode -notin @("local","network")) {
    Write-Host "[ERROR] Invalid deployment mode: $Mode" -ForegroundColor Red
    Write-Host "        Allowed values: local, network" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[INSTALL] Installing dependencies..." -ForegroundColor Blue
npm run install:all

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Dependencies installed successfully" -ForegroundColor Green

# Setup environment files based on mode
Write-Host ""
Write-Host "[CONFIG] Setting up environment files for $Environment ($Mode) deployment..." -ForegroundColor Blue

if ($Environment -eq "development") {
    if ($Mode -eq "local") {
        Write-Host "[SETUP] Configuring for local development..." -ForegroundColor Cyan

        $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
"@
        $webEnvPath = Join-Path "web" ".env.local"
        Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
        Write-Host "[OK] Created web/.env.local" -ForegroundColor Green

        $serverEnvContent = @"
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
"@
        $serverEnvPath = Join-Path "server" ".env"
        Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
        Write-Host "[OK] Created server/.env" -ForegroundColor Green

        Write-Host ""
        Write-Host "[NETWORK] Access URLs:" -ForegroundColor Cyan
        Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "   Backend API: http://localhost:4000" -ForegroundColor White
    } else {
        Write-Host "[SETUP] Configuring for network development..." -ForegroundColor Cyan
        $localIP = Get-LocalIPAddress
        Write-Host "[NETWORK] Detected local IP address: $localIP" -ForegroundColor Cyan

        $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://$localIP:4000
API_KEY=workshopapikeytigerlily
JWT_SECRET=workshopjwtsecrettigerlily
NEXT_JWT_ENC_SECRET=workshopjwtencsecrettigerlily
"@
        $webEnvPath = Join-Path "web" ".env.local"
        Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
        Write-Host "[OK] Created web/.env.local" -ForegroundColor Green

        $serverEnvContent = @"
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://$localIP:3000
"@
        $serverEnvPath = Join-Path "server" ".env"
        Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
        Write-Host "[OK] Created server/.env" -ForegroundColor Green

        Write-Host ""
        Write-Host "[NETWORK] Access URLs:" -ForegroundColor Cyan
        Write-Host "   Local: http://localhost:3000" -ForegroundColor White
        Write-Host "   Network: http://$localIP:3000" -ForegroundColor White
        Write-Host "   Backend API: http://$localIP:4000" -ForegroundColor White
        Write-Host ""
        Write-Host "[NOTE] Network Setup Notes:" -ForegroundColor Yellow
        Write-Host "   - Allow inbound connections on ports 3000 and 4000 in your firewall" -ForegroundColor White
        Write-Host "   - Other devices can access the app at http://$localIP:3000" -ForegroundColor White
    }
} elseif ($Environment -eq "dealership") {
    Write-Host "[SETUP] Configuring for on-prem dealership deployment..." -ForegroundColor Cyan

    $defaultApiKey = New-RandomHex -Bytes 24
    $defaultJwtSecret = New-RandomHex -Bytes 32
    $defaultEncSecret = New-RandomHex -Bytes 32

    if ($Auto) {
        $dealershipApiKey = $defaultApiKey
        $dealershipJwtSecret = $defaultJwtSecret
        $dealershipEncSecret = $defaultEncSecret
    } else {
    $dealershipApiKey = Read-Host "API key [$defaultApiKey]"
    if (-not $dealershipApiKey) { $dealershipApiKey = $defaultApiKey }

    $dealershipJwtSecret = Read-Host "JWT secret [$defaultJwtSecret]"
    if (-not $dealershipJwtSecret) { $dealershipJwtSecret = $defaultJwtSecret }

    $dealershipEncSecret = Read-Host "JWT encryption secret [$defaultEncSecret]"
    if (-not $dealershipEncSecret) { $dealershipEncSecret = $defaultEncSecret }
    }

    if ($Mode -eq "network") {
        $localIP = Get-LocalIPAddress
        Write-Host "[NETWORK] Detected local IP address: $localIP" -ForegroundColor Cyan

        $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://$localIP:4000
API_KEY=$dealershipApiKey
JWT_SECRET=$dealershipJwtSecret
NEXT_JWT_ENC_SECRET=$dealershipEncSecret
"@
        $webEnvPath = Join-Path "web" ".env.local"
        Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
        Write-Host "[OK] Created web/.env.local" -ForegroundColor Green

        $serverEnvContent = @"
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=$dealershipJwtSecret
API_KEY=$dealershipApiKey
NODE_ENV=production
WEB_ORIGIN=http://$localIP:3000
"@
        $serverEnvPath = Join-Path "server" ".env"
        Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
        Write-Host "[OK] Created server/.env" -ForegroundColor Green

        Write-Host ""
        Write-Host "[NETWORK] Access URLs:" -ForegroundColor Cyan
        Write-Host "   Local: http://localhost:3000" -ForegroundColor White
        Write-Host "   Network: http://$localIP:3000" -ForegroundColor White
        Write-Host "   Backend API: http://$localIP:4000" -ForegroundColor White
    } else {
        $webEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_KEY=$dealershipApiKey
JWT_SECRET=$dealershipJwtSecret
NEXT_JWT_ENC_SECRET=$dealershipEncSecret
"@
        $webEnvPath = Join-Path "web" ".env.local"
        Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
        Write-Host "[OK] Created web/.env.local" -ForegroundColor Green

        $serverEnvContent = @"
PORT=4000
HOST=127.0.0.1
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=$dealershipJwtSecret
API_KEY=$dealershipApiKey
NODE_ENV=production
WEB_ORIGIN=http://localhost:3000
"@
        $serverEnvPath = Join-Path "server" ".env"
        Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
        Write-Host "[OK] Created server/.env" -ForegroundColor Green

        Write-Host ""
        Write-Host "[NETWORK] Access URLs:" -ForegroundColor Cyan
        Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "   Backend API: http://localhost:4000" -ForegroundColor White
    }

    Write-Host ""
    Write-Host "[SECURITY] Saved API key: $dealershipApiKey" -ForegroundColor Yellow
    Write-Host "           Store this value securely for future logins or integrations." -ForegroundColor Yellow
} elseif ($Environment -eq "production") {
    Write-Host "[SETUP] Configuring for production deployment..." -ForegroundColor Cyan
    Write-Host "        Press enter to accept the suggested defaults in brackets." -ForegroundColor Cyan

    $defaultBackendUrl = "https://your-backend-domain.vercel.app"
    $defaultFrontendUrl = "https://your-frontend-domain.vercel.app"
    $defaultMongoUri = "mongodb+srv://username:password@cluster.mongodb.net/workshop-board"
    $defaultJwtSecret = New-RandomHex -Bytes 32
    $defaultApiKey = New-RandomHex -Bytes 24

    if ($Auto) {
        $prodBackendUrl = $defaultBackendUrl
        $prodFrontendUrl = $defaultFrontendUrl
        $prodMongoUri = $defaultMongoUri
        $prodJwtSecret = $defaultJwtSecret
        $prodApiKey = $defaultApiKey
    } else {
    $prodBackendUrl = Read-Host "Backend base URL [$defaultBackendUrl]"
    if (-not $prodBackendUrl) { $prodBackendUrl = $defaultBackendUrl }

    $prodFrontendUrl = Read-Host "Frontend base URL [$defaultFrontendUrl]"
    if (-not $prodFrontendUrl) { $prodFrontendUrl = $defaultFrontendUrl }

    $prodMongoUri = Read-Host "MongoDB connection string [$defaultMongoUri]"
    if (-not $prodMongoUri) { $prodMongoUri = $defaultMongoUri }

    $prodJwtSecret = Read-Host "JWT secret [$defaultJwtSecret]"
    if (-not $prodJwtSecret) { $prodJwtSecret = $defaultJwtSecret }

    $prodApiKey = Read-Host "API key [$defaultApiKey]"
    if (-not $prodApiKey) { $prodApiKey = $defaultApiKey }
    }

    $serverHost = if ($Mode -eq "network") { "0.0.0.0" } else { "127.0.0.1" }

    $serverEnvContent = @"
PORT=4000
HOST=$serverHost
MONGODB_URI=$prodMongoUri
JWT_SECRET=$prodJwtSecret
API_KEY=$prodApiKey
NODE_ENV=production
WEB_ORIGIN=$prodFrontendUrl
"@
    $serverEnvPath = Join-Path "server" ".env"
    Set-Content -Path $serverEnvPath -Value $serverEnvContent -Encoding UTF8
    Write-Host "[OK] Created server/.env" -ForegroundColor Green

    $webEnvProdContent = @"
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=$prodBackendUrl
JWT_SECRET=$prodJwtSecret
API_KEY=$prodApiKey
"@
    $webEnvProdPath = Join-Path "web" ".env.production"
    Set-Content -Path $webEnvProdPath -Value $webEnvProdContent -Encoding UTF8
    Write-Host "[OK] Created web/.env.production" -ForegroundColor Green

    $webEnvLocalContent = @"
NEXT_PUBLIC_API_BASE_URL=$prodBackendUrl
API_KEY=$prodApiKey
JWT_SECRET=$prodJwtSecret
NEXT_JWT_ENC_SECRET=$prodJwtSecret
"@
    $webEnvLocalPath = Join-Path "web" ".env.local"
    Set-Content -Path $webEnvLocalPath -Value $webEnvLocalContent -Encoding UTF8
    Write-Host "[OK] Updated web/.env.local" -ForegroundColor Green

    Write-Host ""
    Write-Host "[NETWORK] Access URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend: $prodFrontendUrl" -ForegroundColor White
    Write-Host "   Backend API: $prodBackendUrl" -ForegroundColor White
}

# Setup MongoDB
Write-Host ""
Write-Host "[DATABASE] Setting up MongoDB..." -ForegroundColor Blue

if ($useDocker) {
    if ($Mode -eq "network") {
        Write-Host "[DOCKER] Starting MongoDB with network configuration..." -ForegroundColor Cyan
        docker-compose -f workspace/docker/docker-compose.network.yml up -d mongodb
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] MongoDB started successfully" -ForegroundColor Green
            Write-Host "   MongoDB Express: http://localhost:8081 (admin/admin)" -ForegroundColor White
        } else {
            Write-Host "[WARNING] Failed to start MongoDB with Docker. Please check Docker is running." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[DOCKER] Starting MongoDB with local configuration..." -ForegroundColor Cyan
        docker-compose -f workspace/docker/docker-compose.dev.yml up -d mongodb
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] MongoDB started successfully" -ForegroundColor Green
            Write-Host "   MongoDB Express: http://localhost:8081 (admin/admin)" -ForegroundColor White
        } else {
            Write-Host "[WARNING] Failed to start MongoDB with Docker. Please check Docker is running." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[WARNING] Docker not available. Please ensure MongoDB is running locally on port 27017" -ForegroundColor Yellow
}

# Seed database option
Write-Host ""
Write-Host "[SEED] Database seeding options:" -ForegroundColor Blue
Write-Host "1. Skip seeding" -ForegroundColor White
Write-Host "2. Basic seed data" -ForegroundColor White
Write-Host "3. Enhanced seed data" -ForegroundColor White
Write-Host "4. Comprehensive seed data" -ForegroundColor White

$seedChoice = $null
$seedPreference = $Seed.ToLower()
if ($Auto -and -not $seedPreference) {
    $seedPreference = "skip"
}

if ($Auto) {
    switch ($seedPreference) {
        "skip" { $seedChoice = "1" }
        "basic" { $seedChoice = "2" }
        "enhanced" { $seedChoice = "3" }
        "comprehensive" { $seedChoice = "4" }
        default {
            Write-Host "[WARNING] Unknown seed option '$Seed', defaulting to skip." -ForegroundColor Yellow
            $seedChoice = "1"
        }
    }
} else {
do {
    $seedChoice = Read-Host "Choose seeding option (1-4)"
        if ($seedChoice -notmatch "^[1-4]$") {
            Write-Host "Please enter 1, 2, 3, or 4" -ForegroundColor Red
        }
    } while ($seedChoice -notmatch "^[1-4]$")
}

    switch ($seedChoice) {
        "2" { 
            Write-Host "[SEED] Seeding database with basic data..." -ForegroundColor Cyan
            npm run seed
        }
        "3" { 
            Write-Host "[SEED] Seeding database with enhanced data..." -ForegroundColor Cyan
            npm run seed:enhanced
        }
        "4" { 
            Write-Host "[SEED] Seeding database with comprehensive data..." -ForegroundColor Cyan
            npm run seed:comprehensive
    }
}

if ($seedChoice -ne "1") {
    Write-Host "[OK] Database seeded successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "[CREDENTIALS] Default login credentials:" -ForegroundColor Cyan
    if ($seedChoice -eq "2") {
        Write-Host "   Super Admin: vldngls / Vldngls04182002!@" -ForegroundColor White
        Write-Host "   Administrator: admin / test123456" -ForegroundColor White
        Write-Host "   Job Controller: jobcontroller / test123456" -ForegroundColor White
        Write-Host "   Technician 1: technician1 / test123456" -ForegroundColor White
        Write-Host "   Service Advisor 1: serviceadvisor1 / test123456" -ForegroundColor White
    } elseif ($seedChoice -eq "3") {
        Write-Host "   Super Admin: vldngls / Vldngls04182002!@" -ForegroundColor White
        Write-Host "   Administrators: admin1, admin2 / test123456" -ForegroundColor White
        Write-Host "   Job Controller: jobcontroller / test123456" -ForegroundColor White
        Write-Host "   Technicians: technician1-5 / test123456" -ForegroundColor White
        Write-Host "   Service Advisors: serviceadvisor1-5 / test123456" -ForegroundColor White
    } elseif ($seedChoice -eq "4") {
        Write-Host "   Super Admin: vldngls / Vldngls04182002!@" -ForegroundColor White
        Write-Host "   Administrators: admin1, admin2 / test123456" -ForegroundColor White
        Write-Host "   Job Controller: jobcontroller / test123456" -ForegroundColor White
        Write-Host "   Technicians: technician1-5 / test123456" -ForegroundColor White
        Write-Host "   Service Advisors: serviceadvisor1-5 / test123456" -ForegroundColor White
        Write-Host "   (30 job orders created across yesterday and today)" -ForegroundColor White
    }
}

# API Key setup option
Write-Host ""
Write-Host "[API] API Key Configuration:" -ForegroundColor Blue
Write-Host "1. Skip API key setup (use default or set later)" -ForegroundColor White
Write-Host "2. Set API key now" -ForegroundColor White

$apiKeyChoice = $null
$apiKeyToSet = $null

if ($Auto) {
    if (-not $SkipApiKey -and $ApiKey) {
        $apiKeyChoice = "2"
        $apiKeyToSet = $ApiKey
    } else {
        $apiKeyChoice = "1"
    }
} else {
do {
    $apiKeyChoice = Read-Host "Choose API key option (1-2)"
        if ($apiKeyChoice -notmatch "^[1-2]$") {
            Write-Host "Please enter 1 or 2" -ForegroundColor Red
        }
    } while ($apiKeyChoice -notmatch "^[1-2]$")

    if ($apiKeyChoice -eq "2") {
        $apiKeyToSet = Read-Host "Enter API key"
    }
}

if ($apiKeyChoice -eq "2") {
    if ($apiKeyToSet) {
                Write-Host "[API] Setting API key..." -ForegroundColor Cyan
                Push-Location server
        $env:API_KEY = $apiKeyToSet
        node ..\workspace\scripts\set-api-key.mjs $apiKeyToSet
                Pop-Location
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] API key configured successfully" -ForegroundColor Green
                } else {
                    Write-Host "[WARNING] Failed to set API key. You can set it later in the maintenance settings." -ForegroundColor Yellow
                }
            } else {
                Write-Host "[WARNING] No API key provided. Skipping..." -ForegroundColor Yellow
            }
    }

# Final instructions
Write-Host ""
Write-Host "[DONE] Setup completed successfully!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

Write-Host ""
Write-Host "[START] To start the application:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White

if ($Environment -eq "dealership") {
    Write-Host ""
    Write-Host "[RUN] Dealership deployment tips:" -ForegroundColor Cyan
    Write-Host "   - Build once:         npm run build" -ForegroundColor White
    Write-Host "   - Start API service:  npm run server:start" -ForegroundColor White
    Write-Host "   - Start web service:  npm run web:start" -ForegroundColor White
    Write-Host "   - Keep them running with PM2 or Task Scheduler after login." -ForegroundColor White
    Write-Host "   - Confirm the MongoDB Windows service is running before launch." -ForegroundColor White
}

Write-Host ""
Write-Host "[DOCS] For more information, see:" -ForegroundColor Cyan
Write-Host "   - workspace/docs/DEPLOYMENT.md for detailed instructions" -ForegroundColor White
Write-Host "   - workspace/docs/WORKFLOW_DOCUMENTATION.md for feature details" -ForegroundColor White

Write-Host ""
Write-Host "[HELP] Need help? Check the troubleshooting section in workspace/docs/DEPLOYMENT.md" -ForegroundColor Yellow
