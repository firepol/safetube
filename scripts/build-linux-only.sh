#!/bin/bash

# Build script for Linux only (avoids Wine compatibility issues)
# This script builds the AppImage without trying to build Windows packages

echo "🐧 Building SafeTube for Linux only..."
echo "   This avoids Wine compatibility issues when building from Linux"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the SafeTube project root"
    exit 1
fi

# Build the application
echo "🔨 Building application..."
yarn build:all

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Application built successfully"
echo ""

# Build only Linux package
echo "📦 Building Linux AppImage..."
yarn electron:build --linux

if [ $? -ne 0 ]; then
    echo "❌ Linux build failed"
    exit 1
fi

echo ""
echo "🎉 Linux build completed successfully!"
echo "📁 Check the release/ folder for your AppImage"
echo ""
echo "💡 To build for Windows, you'll need to:"
echo "   1. Use a Windows machine, or"
echo "   2. Use a Windows VM, or"
echo "   3. Use GitHub Actions for cross-platform builds"
