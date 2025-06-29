#!/bin/bash

# Read .env file and export variables
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "ELECTRON_LOG_VERBOSE=$ELECTRON_LOG_VERBOSE"
else
    echo "No .env file found"
fi

# Start Electron with environment variables
echo "Starting Electron with environment variables..."
NODE_ENV=development npx electron-nightly . 