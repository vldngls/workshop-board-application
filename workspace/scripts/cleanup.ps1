# Cleanup script to reduce project size
# Removes unnecessary files and optimizes node_modules

Write-Host "🧹 Cleaning up project..." -ForegroundColor Cyan

# Remove node_modules and reinstall (can help with size)
if ($args[0] -eq "--full") {
    Write-Host "📦 Removing all node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules, server/node_modules, web/node_modules -ErrorAction SilentlyContinue
    Write-Host "✅ Removed node_modules" -ForegroundColor Green
}

# Clean npm cache
Write-Host "🗑️  Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "✅ npm cache cleaned" -ForegroundColor Green

# Remove build artifacts (if they exist)
Write-Host "🗑️  Removing build artifacts..." -ForegroundColor Yellow
Remove-Item -Recurse -Force server/dist, web/.next, web/out, server/api -ErrorAction SilentlyContinue
Write-Host "✅ Build artifacts removed" -ForegroundColor Green

# Prune extraneous packages
Write-Host "✂️  Pruning extraneous packages..." -ForegroundColor Yellow
npm prune
Write-Host "✅ Pruned extraneous packages" -ForegroundColor Green

# Show size after cleanup
Write-Host ""
Write-Host "📊 Directory sizes after cleanup:" -ForegroundColor Cyan
Get-ChildItem -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "node_modules|\.git" } | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "$([math]::Round($size, 2)) MB - $($_.Name)" -ForegroundColor White
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green


