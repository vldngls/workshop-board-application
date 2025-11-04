#!/bin/bash

# Cleanup script to reduce project size
# Removes unnecessary files and optimizes node_modules

echo "🧹 Cleaning up project..."

# Remove node_modules and reinstall (can help with size)
if [ "$1" = "--full" ]; then
    echo "📦 Removing all node_modules..."
    rm -rf node_modules server/node_modules web/node_modules
    echo "✅ Removed node_modules"
fi

# Clean npm cache
echo "🗑️  Cleaning npm cache..."
npm cache clean --force
echo "✅ npm cache cleaned"

# Remove build artifacts (if they exist)
echo "🗑️  Removing build artifacts..."
rm -rf server/dist web/.next web/out server/api
echo "✅ Build artifacts removed"

# Prune extraneous packages
echo "✂️  Pruning extraneous packages..."
npm prune
echo "✅ Pruned extraneous packages"

# Show size after cleanup
echo ""
echo "📊 Directory sizes after cleanup:"
du -sh node_modules server/node_modules web/node_modules .git 2>/dev/null

echo ""
echo "✅ Cleanup complete!"

