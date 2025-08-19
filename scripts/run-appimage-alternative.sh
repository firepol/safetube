#!/bin/bash

# Alternative approach to run SafeTube AppImage
# Tries different GTK configurations to resolve compatibility issues

echo "🔧 Trying alternative GTK configurations..."

# Find the AppImage
APPIMAGE_PATH="./release/SafeTube-1.0.0.AppImage"

if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "❌ AppImage not found at $APPIMAGE_PATH"
    echo "   Please run 'yarn electron:build' first"
    exit 1
fi

echo "✅ Found AppImage: $APPIMAGE_PATH"
echo ""

# Method 1: Try with Wayland backend
echo "🔄 Method 1: Trying with Wayland backend..."
export GDK_BACKEND=wayland
export GTK_USE_PORTAL=1
unset GTK_VERSION
unset ELECTRON_FORCE_GTK3

echo "   GDK_BACKEND=$GDK_BACKEND"
echo "   GTK_USE_PORTAL=$GTK_USE_PORTAL"
echo ""

if timeout 10s "$APPIMAGE_PATH" 2>&1 | head -20; then
    echo "✅ Success with Wayland backend!"
    exit 0
else
    echo "❌ Failed with Wayland backend"
fi

echo ""

# Method 2: Try with minimal GTK environment
echo "🔄 Method 2: Trying with minimal GTK environment..."
export GDK_BACKEND=x11
export GTK_USE_PORTAL=0
unset GTK_VERSION
unset ELECTRON_FORCE_GTK3
unset LD_LIBRARY_PATH

echo "   GDK_BACKEND=$GDK_BACKEND"
echo "   GTK_USE_PORTAL=$GTK_USE_PORTAL"
echo ""

if timeout 10s "$APPIMAGE_PATH" 2>&1 | head -20; then
    echo "✅ Success with minimal GTK environment!"
    exit 0
else
    echo "❌ Failed with minimal GTK environment"
fi

echo ""

# Method 3: Try with system default (no overrides)
echo "🔄 Method 3: Trying with system default (no overrides)..."
unset GDK_BACKEND
unset GTK_USE_PORTAL
unset GTK_VERSION
unset ELECTRON_FORCE_GTK3
unset LD_LIBRARY_PATH

echo "   Using system default GTK configuration"
echo ""

if timeout 10s "$APPIMAGE_PATH" 2>&1 | head -20; then
    echo "✅ Success with system default!"
    exit 0
else
    echo "❌ Failed with system default"
fi

echo ""
echo "❌ All methods failed. This appears to be a fundamental GTK compatibility issue."
echo "💡 Consider testing on a different system or using the development mode instead."
