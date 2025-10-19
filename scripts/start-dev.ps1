# Workshop Board Application - Start Development Script (PowerShell)
Write-Host "🚀 Starting Workshop Board Application in development mode..." -ForegroundColor Green

# Check if MongoDB is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:27017" -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {
    Write-Host "⚠️  MongoDB doesn't seem to be running on localhost:27017" -ForegroundColor Yellow
    Write-Host "   Please start MongoDB first:" -ForegroundColor White
    Write-Host "   - Using Docker: docker-compose -f docker-compose.dev.yml up -d mongodb" -ForegroundColor White
    Write-Host "   - Or install MongoDB locally and start it" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/N)"
    if ($continue -notmatch "^[Yy]$") {
        exit 1
    }
}

# Start the development servers
Write-Host "🎯 Starting frontend and backend servers..." -ForegroundColor Blue
npm run dev
