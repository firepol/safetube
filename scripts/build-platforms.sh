#!/bin/bash

# Build script for different platforms
# Usage: ./scripts/build-platforms.sh [linux|win|mac|all]

PLATFORM=${1:-all}

echo "🔨 Building SafeTube for platform: $PLATFORM"
echo ""

case $PLATFORM in
  "linux")
    echo "🐧 Building for Linux (AppImage)..."
    yarn electron:build --linux
    ;;
  "win")
    echo "🪟 Building for Windows (NSIS)..."
    echo "⚠️  Note: Windows builds from Linux may fail due to Wine compatibility"
    echo "   Consider using a Windows machine or VM for reliable Windows builds"
    echo ""
    yarn electron:build --win
    ;;
  "mac")
    echo "🍎 Building for macOS (DMG)..."
    yarn electron:build --mac
    ;;
  "all")
    echo "🌍 Building for all platforms..."
    yarn electron:build --linux --win --mac
    ;;
  *)
    echo "❌ Invalid platform: $PLATFORM"
    echo "Usage: $0 [linux|win|mac|all]"
    exit 1
    ;;
esac

echo ""
echo "✅ Build completed for $PLATFORM"
echo "📁 Check the release/ folder for output files"
