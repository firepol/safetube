#!/bin/bash

# Wrapper script to run SafeTube AppImage with correct GTK environment
# This fixes the GTK 2/3 vs GTK 4 compatibility issue on Fedora 41

echo "🚀 Starting SafeTube AppImage with GTK 3 compatibility..."

# Force GTK 3 usage to avoid conflicts with GTK 4
export GTK_VERSION=3
export GTK_USE_PORTAL=0

# Unset any GTK 4 specific variables
unset GTK_USE_PORTAL_GTK4
unset GTK_USE_PORTAL_GTK3

# Set Electron to use GTK 3
export ELECTRON_FORCE_GTK3=1

# Additional GTK 3 forcing
export GDK_BACKEND=x11
export GTK_THEME=Adwaita
export GTK_IM_MODULE=ibus

# Force specific GTK library versions
export LD_LIBRARY_PATH="/usr/lib64/gtk-3.0:$LD_LIBRARY_PATH"

# Run the AppImage
echo "📱 Using GTK 3 environment variables:"
echo "   GTK_VERSION=$GTK_VERSION"
echo "   ELECTRON_FORCE_GTK3=$ELECTRON_FORCE_GTK3"
echo "   GDK_BACKEND=$GDK_BACKEND"
echo "   LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
echo ""

# Find the AppImage
APPIMAGE_PATH="./release/SafeTube-1.0.0.AppImage"

if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "❌ AppImage not found at $APPIMAGE_PATH"
    echo "   Please run 'yarn electron:build' first"
    exit 1
fi

echo "✅ Found AppImage: $APPIMAGE_PATH"
echo "🎯 Starting with GTK 3 compatibility..."
echo ""

# Run the AppImage
exec "$APPIMAGE_PATH" "$@"
